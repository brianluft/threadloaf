import { ApiServer } from "../../api-server";
import { DataStore } from "../../data-store";
import express from "express";

export function createShared(): { dataStore: jest.Mocked<DataStore>; app: express.Express } {
    // Create a new DataStore mock
    const dataStore = new DataStore() as jest.Mocked<DataStore>;

    // Create the API server
    const apiServer = new ApiServer(3000, dataStore);

    // Create an express app instance that we can use for testing
    // We'll manually invoke the route handlers instead of starting the server
    const app = express();
    // @ts-ignore - access private method for testing
    apiServer.setupMiddleware = jest.fn().mockImplementation(() => {
        app.use(express.json());
    });
    // @ts-ignore - access private method for testing
    apiServer.setupRoutes = jest.fn().mockImplementation(() => {
        app.get("/messages/:channelId", (req, res) => {
            try {
                const channelId = req.params.channelId;
                const messages = dataStore.getMessagesForChannel(channelId);
                res.json(messages);
            } catch (error) {
                console.error("Error fetching messages:", error);
                res.status(500).json({ error: "Failed to fetch messages" });
            }
        });

        app.get("/forum-threads", (req, res) => {
            try {
                const forumThreads = dataStore.getAllForumThreads();

                // Map to response format with latest replies
                const response = forumThreads.map((thread) => {
                    const allMessages = dataStore.getMessagesForChannel(thread.id);
                    const latestReplies = allMessages.length > 1 ? allMessages.slice(1).slice(-5) : [];

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

        app.get("/health", (_, res) => {
            res.json({ status: "ok" });
        });
    });

    // Setup the app routes
    // @ts-ignore - access private methods for testing
    apiServer.setupMiddleware();
    // @ts-ignore - access private methods for testing
    apiServer.setupRoutes();

    return { dataStore, app };
}
