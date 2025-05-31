import { ApiServer } from "../../api-server";
import { DataStore } from "../../data-store";
import express from "express";

export function createShared(): { dataStore: jest.Mocked<DataStore>; dataStoresByGuild: Map<string, DataStore>; app: express.Express } {
    // Create a new DataStore mock
    const dataStore = new DataStore() as jest.Mocked<DataStore>;
    
    // Create a Map with the test guild ID
    const TEST_GUILD_ID = "test-guild-id";
    const dataStoresByGuild = new Map<string, DataStore>();
    dataStoresByGuild.set(TEST_GUILD_ID, dataStore);

    // Create the API server
    const apiServer = new ApiServer(3000, dataStoresByGuild);

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
                // Search across all guilds for the channel (for backward compatibility with tests)
                let messages: any[] = [];
                for (const guildDataStore of dataStoresByGuild.values()) {
                    const channelMessages = guildDataStore.getMessagesForChannel(channelId);
                    if (channelMessages.length > 0) {
                        messages = channelMessages;
                        break;
                    }
                }
                res.json(messages);
            } catch (error) {
                console.error("Error fetching messages:", error);
                res.status(500).json({ error: "Failed to fetch messages" });
            }
        });

        app.get("/forum-threads", (req, res) => {
            try {
                const allThreads: any[] = [];
                
                // Collect threads from all guilds
                for (const guildDataStore of dataStoresByGuild.values()) {
                    const forumThreads = guildDataStore.getAllForumThreads();
                    const guildThreads = forumThreads.map((thread) => {
                        const allMessages = guildDataStore.getMessagesForChannel(thread.id);
                        const latestReplies = allMessages.length > 1 ? allMessages.slice(1).slice(-5) : [];

                        return {
                            threadId: thread.id,
                            title: thread.title,
                            createdBy: thread.createdBy,
                            createdAt: thread.createdAt,
                            latestReplies,
                        };
                    });
                    
                    allThreads.push(...guildThreads);
                }

                res.json(allThreads);
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

    return { dataStore, dataStoresByGuild, app };
}
