/**
 * API Server implementation
 * Exposes HTTP endpoints for retrieving messages and forum threads
 */

import express, { Request, Response, NextFunction } from "express";
import { DataStore, StoredMessage } from "./data-store";

// Type definitions for the new multi-channel messages endpoint
type MultiChannelMessagesRequest = {
    channelIds: string[];
    maxMessagesPerChannel: number;
};

type MultiChannelMessagesResponse = {
    [channelId: string]: StoredMessage[];
};

export class ApiServer {
    private app = express();
    private port: number;
    private dataStoresByGuild: Map<string, DataStore>;

    constructor(port: number, dataStoresByGuild: Map<string, DataStore>) {
        this.port = port;
        this.dataStoresByGuild = dataStoresByGuild;
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    /**
     * Start the API server
     */
    start(): void {
        this.app.listen(this.port, () => {
            console.log(`API server listening on port ${this.port}`);
        });
    }

    /**
     * Setup middleware for the Express app
     */
    private setupMiddleware(): void {
        // Parse JSON request bodies
        this.app.use(express.json());

        // Basic logging middleware
        this.app.use((req, _, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    /**
     * Setup error handling middleware - must be called after routes are setup
     */
    private setupErrorHandling(): void {
        // Error handling middleware - must be registered after routes
        this.app.use(this.errorHandler.bind(this));
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
     * Setup API routes
     */
    private setupRoutes(): void {
        // Get messages for multiple channels
        this.app.post(
            "/:guildId/messages",
            (
                req: Request<{ guildId: string }, MultiChannelMessagesResponse, MultiChannelMessagesRequest>,
                res: Response,
            ): void => {
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

                    // Fetch messages for each channel
                    const result: MultiChannelMessagesResponse = {};
                    for (const channelId of channelIds) {
                        const allMessages = dataStore.getMessagesForChannel(channelId);
                        // Get the most recent messages up to the limit
                        const limitedMessages =
                            maxMessagesPerChannel === 0 ? [] : allMessages.slice(-maxMessagesPerChannel);
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
        this.app.get("/:guildId/forum-threads", (req: Request<{ guildId: string }>, res: Response): void => {
            try {
                const { guildId } = req.params;

                // Check if the guild ID is valid (configured)
                const dataStore = this.dataStoresByGuild.get(guildId);
                if (!dataStore) {
                    res.status(400).json({ error: "Invalid guild ID" });
                    return;
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
        });

        // Health check endpoint
        this.app.get("/health", (_, res) => {
            res.json({ status: "ok" });
        });
    }
}
