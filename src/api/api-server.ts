/**
 * API Server implementation
 * Exposes HTTP endpoints for retrieving messages and forum threads
 */

import express, { Request, Response, NextFunction, Express } from "express";
import cors from "cors";
import axios from "axios";
import jwt from "jsonwebtoken";
import * as http from "http";
import * as https from "https";
import { DataStore, StoredMessage } from "./data-store";
import { DiscordClient } from "./discord-client";
import { LetsEncryptManager, LetsEncryptConfig } from "./lets-encrypt";

// Type definitions for the new multi-channel messages endpoint
type MultiChannelMessagesRequest = {
    channelIds: string[];
    maxMessagesPerChannel: number;
};

type MultiChannelMessagesResponse = {
    [channelId: string]: StoredMessage[];
};

// OAuth2 type definitions
type AuthorizedRequest<P = any, ResBody = any, ReqBody = any> = Request<P, ResBody, ReqBody> & { userId?: string };

type AuthCacheEntry = {
    isGuildMember: boolean;
    expiresAt: number; // timestamp
};

export class ApiServer {
    private _app = express();
    private port: number;
    private dataStoresByGuild: Map<string, DataStore>;
    private discordClientsByGuild: Map<string, DiscordClient>;
    private authCache = new Map<string, AuthCacheEntry>(); // key: "userId:guildId"

    private authenticationEnabled: boolean;
    private letsEncryptManager: LetsEncryptManager | null = null;
    private httpServer?: http.Server;
    private httpsServer?: https.Server;

    // Expose app for testing
    public get app() {
        return this._app;
    }

    public set app(app: any) {
        this._app = app;
    }

    constructor(
        port: number,
        dataStoresByGuild: Map<string, DataStore>,
        discordClientsByGuild: Map<string, DiscordClient>,
        authenticationEnabled?: boolean,
        letsEncryptConfig?: LetsEncryptConfig,
    ) {
        this.port = port;
        this.dataStoresByGuild = dataStoresByGuild;
        this.discordClientsByGuild = discordClientsByGuild;

        // If authenticationEnabled is explicitly provided, use it (for tests)
        // Otherwise, read from environment variable
        if (authenticationEnabled !== undefined) {
            this.authenticationEnabled = authenticationEnabled;
        } else {
            const testingMode = process.env.TESTING_MODE === "true";
            this.authenticationEnabled = !testingMode;
        }

        // Initialize Let's Encrypt if configuration provided
        if (letsEncryptConfig && letsEncryptConfig.enabled) {
            this.letsEncryptManager = new LetsEncryptManager(letsEncryptConfig);
        }

        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    /**
     * Start the API server with optional HTTPS support
     */
    async start(): Promise<void> {
        if (this.letsEncryptManager) {
            await this.startWithHttps();
        } else {
            this.startHttpOnly();
        }
    }

    /**
     * Start HTTP-only server (debug mode)
     */
    private startHttpOnly(): void {
        this._app.listen(this.port, () => {
            console.log(`API server listening on HTTP port ${this.port} (debug mode)`);
        });
    }

    /**
     * Start server with HTTPS support (production mode)
     */
    private async startWithHttps(): Promise<void> {
        if (!this.letsEncryptManager) {
            throw new Error("Let's Encrypt manager not initialized");
        }

        // Initialize Let's Encrypt
        await this.letsEncryptManager.initialize();

        // Create HTTP server for ACME challenges only
        this.httpServer = http.createServer(this._app);
        const httpPort = 80;
        this.httpServer.listen(httpPort, () => {
            console.log(`HTTP server listening on port ${httpPort} (ACME challenges only)`);
        });

        // Try to get existing certificate or request a new one
        let httpsServer = this.letsEncryptManager.createHttpsServer(this._app);

        if (!httpsServer) {
            console.log("No valid certificate found, requesting new certificate...");
            const certFiles = await this.letsEncryptManager.requestCertificate();

            if (certFiles) {
                httpsServer = this.letsEncryptManager.createHttpsServer(this._app);
            }
        }

        if (httpsServer) {
            const httpsPort = 443;
            this.httpsServer = httpsServer;
            this.httpsServer.listen(httpsPort, () => {
                console.log(`HTTPS server listening on port ${httpsPort}`);
            });

            // Schedule automatic certificate renewal
            this.letsEncryptManager.scheduleRenewal();
        } else {
            console.error("Failed to start HTTPS server - no valid certificate available");
            console.log("Continuing with HTTP-only server for ACME challenges");
        }
    }

    /**
     * Setup middleware for the Express app
     */
    private setupMiddleware(): void {
        // Configure CORS to allow requests from browser extensions and localhost
        this._app.use(
            cors({
                origin: (origin, callback) => {
                    // Allow requests from browser extensions, localhost, or no origin (for testing)
                    if (
                        !origin ||
                        origin.startsWith("chrome-extension://") ||
                        origin.startsWith("moz-extension://") ||
                        origin.startsWith("http://localhost:") ||
                        origin.startsWith("https://localhost:")
                    ) {
                        callback(null, true);
                    } else {
                        callback(new Error("Not allowed by CORS"));
                    }
                },
                credentials: true,
            }),
        );

        // Parse JSON request bodies
        this._app.use(express.json());

        // HTTPS enforcement middleware (production only)
        if (this.letsEncryptManager) {
            this._app.use((req, res, next) => {
                // Allow ACME challenge endpoint on HTTP
                if (req.path.startsWith("/.well-known/acme-challenge/")) {
                    next();
                    return;
                }

                // In production with Let's Encrypt enabled, mandate HTTPS
                if (!req.secure && req.get("X-Forwarded-Proto") !== "https") {
                    res.status(400).json({
                        error: "HTTPS required. This API only accepts secure connections.",
                    });
                    return;
                }
                next();
            });
        }

        // Basic logging middleware
        this._app.use((req, _, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    /**
     * Setup error handling middleware - must be called after routes are setup
     */
    private setupErrorHandling(): void {
        // Error handling middleware - must be registered after routes
        this._app.use(this.errorHandler.bind(this));
    }

    /**
     * Error handling middleware function
     */
    private errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
        // Log the error with appropriate handling for different error types
        if (err instanceof Error) {
            console.error("API error:", err.message);
        } else {
            console.error("API error:", err);
        }

        // Send a generic error response
        res.status(500).json({ error: "Internal server error" });
        next();
    }

    /**
     * Check if a user is a member of a guild, using cache when possible
     */
    private async isUserGuildMember(userId: string, guildId: string): Promise<boolean> {
        const cacheKey = `${userId}:${guildId}`;
        const cached = this.authCache.get(cacheKey);

        // Check if cache entry exists and is not expired
        if (cached && cached.expiresAt > Date.now()) {
            return cached.isGuildMember;
        }

        try {
            // Get the Discord client for this guild
            const discordClient = this.discordClientsByGuild.get(guildId);
            if (!discordClient) {
                return false;
            }

            // Check guild membership via Discord API
            const guild = discordClient.getClient().guilds.cache.get(guildId);
            if (!guild) {
                return false;
            }

            const member = await guild.members.fetch(userId);
            const isGuildMember = member !== null;

            // Cache the result for 24 hours
            this.authCache.set(cacheKey, {
                isGuildMember,
                expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
            });

            return isGuildMember;
        } catch (error) {
            console.error("Error checking guild membership:", error);
            return false;
        }
    }

    /**
     * Middleware to require authentication and guild membership
     */
    private requireGuildMember(req: AuthorizedRequest<any, any, any>, res: Response, next: NextFunction): void {
        // Skip authentication if disabled (for tests or testing mode)
        if (!this.authenticationEnabled) {
            req.userId = "test-user-id";
            next();
            return;
        }

        const auth = req.headers.authorization ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

        if (!token) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }

        try {
            const jwtSecret = process.env.JWT_SECRET!;
            const payload = jwt.verify(token, jwtSecret) as { sub: string };
            req.userId = payload.sub;
            next();
        } catch (error) {
            res.status(401).json({ error: "Invalid token" });
            return;
        }
    }

    /**
     * Setup API routes
     */
    private setupRoutes(): void {
        // Setup Let's Encrypt ACME challenge route
        if (this.letsEncryptManager) {
            this.letsEncryptManager.setupChallengeRoute(this._app);
        }
        // OAuth2 callback endpoint
        this._app.get("/auth/callback", async (req: Request, res: Response): Promise<void> => {
            const { code, state } = req.query;

            try {
                if (!code || !state || typeof code !== "string" || typeof state !== "string") {
                    res.status(400).send("Missing code or state parameter");
                    return;
                }

                // Exchange code for access token
                const tokenResponse = await axios.post(
                    "https://discord.com/api/oauth2/token",
                    new URLSearchParams({
                        client_id: process.env.DISCORD_CLIENT_ID!,
                        client_secret: process.env.DISCORD_CLIENT_SECRET!,
                        grant_type: "authorization_code",
                        code,
                        redirect_uri: process.env.DISCORD_REDIRECT_URI!,
                    }),
                    {
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                        },
                    },
                );

                const { access_token } = tokenResponse.data;

                // Get user information
                const userResponse = await axios.get("https://discord.com/api/users/@me", {
                    headers: {
                        Authorization: `Bearer ${access_token}`,
                    },
                });

                const userId = userResponse.data.id;

                // Verify user is a member of at least one of our configured guilds
                let isValidUser = false;
                for (const guildId of this.dataStoresByGuild.keys()) {
                    if (await this.isUserGuildMember(userId, guildId)) {
                        isValidUser = true;
                        break;
                    }
                }

                if (!isValidUser) {
                    res.status(403).send("User is not a member of any configured guild");
                    return;
                }

                // Create JWT token
                const jwtSecret = process.env.JWT_SECRET!;
                const jwtToken = jwt.sign({ sub: userId }, jwtSecret, { expiresIn: "7d" });

                // Make the token available to the extension content script via DOM
                res.set("Content-Type", "text/html").send(`
                    <!-- Hidden data for extension content script -->
                    <div id="threadloaf-oauth-data" style="display: none;" data-jwt="${jwtToken}" data-state="${state}" data-status="success"></div>
                    <h2>Logging into Threadloaf...</h2>
                `);
            } catch (error) {
                console.error("OAuth callback error:", error);

                // Make the error available to the extension content script via DOM
                res.set("Content-Type", "text/html").send(`
                    <!-- Hidden data for extension content script -->
                    <div id="threadloaf-oauth-data" style="display: none;" data-error="Authentication failed" data-state="${state}" data-status="error"></div>
                    <h2>Authentication failed!</h2>
                    <p>Please close this window and try again.</p>
                `);
            }
        });

        // Get messages for multiple channels
        this._app.post(
            "/:guildId/messages",
            this.requireGuildMember.bind(this),
            async (
                req: AuthorizedRequest<{ guildId: string }, MultiChannelMessagesResponse, MultiChannelMessagesRequest>,
                res: Response,
            ): Promise<void> => {
                try {
                    const { guildId } = req.params;
                    const { channelIds, maxMessagesPerChannel } = req.body;

                    // Validate request body
                    if (!channelIds || !Array.isArray(channelIds)) {
                        res.status(400).json({ error: "channelIds must be an array" });
                        return;
                    }

                    if (
                        maxMessagesPerChannel === undefined ||
                        typeof maxMessagesPerChannel !== "number" ||
                        maxMessagesPerChannel < 0
                    ) {
                        res.status(400).json({ error: "maxMessagesPerChannel must be a non-negative number" });
                        return;
                    }

                    // Check if the guild ID is valid (configured)
                    const dataStore = this.dataStoresByGuild.get(guildId);
                    if (!dataStore) {
                        res.status(400).json({ error: "Invalid guild ID" });
                        return;
                    }

                    // Verify user is a member of this guild (skip in test mode)
                    if (this.authenticationEnabled) {
                        const isGuildMember = await this.isUserGuildMember(req.userId!, guildId);
                        if (!isGuildMember) {
                            res.status(403).json({ error: "Access denied" });
                            return;
                        }
                    }

                    // Fetch messages for each channel
                    const result: MultiChannelMessagesResponse = {};
                    for (const channelId of channelIds) {
                        const allMessages = dataStore.getMessagesForChannel(channelId);
                        // Sort messages by timestamp to ensure chronological order (oldest first)
                        const sortedMessages = allMessages.slice().sort((a, b) => a.timestamp - b.timestamp);
                        // Get the most recent messages up to the limit
                        const limitedMessages =
                            maxMessagesPerChannel === 0 ? [] : sortedMessages.slice(-maxMessagesPerChannel);
                        result[channelId] = limitedMessages;
                    }

                    res.json(result);
                } catch (error) {
                    console.error("Error fetching messages:", error);
                    res.status(500).json({ error: "Failed to fetch messages" });
                }
            },
        );

        // Get all forum threads with their latest replies
        this._app.get(
            "/:guildId/forum-threads",
            this.requireGuildMember.bind(this),
            async (req: AuthorizedRequest<{ guildId: string }>, res: Response): Promise<void> => {
                try {
                    const { guildId } = req.params;

                    // Check if the guild ID is valid (configured)
                    const dataStore = this.dataStoresByGuild.get(guildId);
                    if (!dataStore) {
                        res.status(400).json({ error: "Invalid guild ID" });
                        return;
                    }

                    // Verify user is a member of this guild (skip in test mode)
                    if (this.authenticationEnabled) {
                        const isGuildMember = await this.isUserGuildMember(req.userId!, guildId);
                        if (!isGuildMember) {
                            res.status(403).json({ error: "Access denied" });
                            return;
                        }
                    }

                    const forumThreads = dataStore.getAllForumThreads();

                    // Map to response format with latest replies
                    const threads = forumThreads.map((thread) => {
                        // Get all messages for this thread
                        const allMessages = dataStore.getMessagesForChannel(thread.id);

                        // Assuming the first message is the root post, get up to 5 latest replies
                        const latestReplies =
                            allMessages.length > 1
                                ? allMessages.slice(1).slice(-5) // Skip first message and take last 5
                                : [];

                        return {
                            threadId: thread.id,
                            title: thread.title,
                            createdBy: thread.createdBy,
                            createdAt: thread.createdAt,
                            latestReplies,
                        };
                    });

                    res.json(threads);
                } catch (error) {
                    console.error("Error fetching forum threads:", error);
                    res.status(500).json({ error: "Failed to fetch forum threads" });
                }
            },
        );

        // OAuth2 configuration endpoint (no auth required - needed for login flow)
        this._app.get("/auth/config", (_, res: Response): void => {
            res.json({
                clientId: process.env.DISCORD_CLIENT_ID!,
                redirectUri: process.env.DISCORD_REDIRECT_URI!,
            });
        });

        // Health check endpoint
        this._app.get("/health", (_, res) => {
            res.json({ status: "ok" });
        });
    }
}
