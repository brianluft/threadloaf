/**
 * API Server implementation
 * Exposes HTTP endpoints for retrieving messages and forum threads
 */

import express, { Request, Response } from "express";
import { DataStore, StoredMessage } from "./data-store";

export class ApiServer {
    private app = express();
    private port: number;
    private dataStore: DataStore;

    constructor(port: number, dataStore: DataStore) {
        this.port = port;
        this.dataStore = dataStore;
        this.setupMiddleware();
        this.setupRoutes();
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

        // Error handling middleware
        this.app.use((err: Error, _: Request, res: Response, next: Function) => {
            console.error("API error:", err);
            res.status(500).json({ error: "Internal server error" });
            next();
        });
    }

    /**
     * Setup API routes
     */
    private setupRoutes(): void {
        // Get messages for a specific channel or thread
        this.app.get("/messages/:channelId", (req, res) => {
            try {
                const channelId = req.params.channelId;
                const messages = this.dataStore.getMessagesForChannel(channelId);
                res.json(messages);
            } catch (error) {
                console.error("Error fetching messages:", error);
                res.status(500).json({ error: "Failed to fetch messages" });
            }
        });

        // Get all forum threads with their latest replies
        this.app.get("/forum-threads", (req, res) => {
            try {
                const forumThreads = this.dataStore.getAllForumThreads();

                // Map to response format with latest replies
                const response = forumThreads.map((thread) => {
                    // Get all messages for this thread
                    const allMessages = this.dataStore.getMessagesForChannel(thread.id);

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

                res.json(response);
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
