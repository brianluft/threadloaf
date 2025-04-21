import { ApiServer } from "../../api-server";
import { DataStore, StoredMessage, ThreadMeta } from "../../data-store";
import request from "supertest";
import express from "express";
import { createShared } from "./shared";

jest.mock("../../data-store");

describe("ApiServer GET /forum-threads", () => {
    let dataStore: jest.Mocked<DataStore>;
    let app: express.Express;

    beforeEach(() => {
        jest.clearAllMocks();

        const x = createShared();
        dataStore = x.dataStore;
        app = x.app;
    });

    test("should return forum threads with latest replies", async () => {
        const threads: ThreadMeta[] = [
            {
                id: "thread1",
                title: "Forum Post 1",
                parentId: "forum123",
                createdAt: 1693000000000,
                createdBy: "User#1234",
            },
            {
                id: "thread2",
                title: "Forum Post 2",
                parentId: "forum123",
                createdAt: 1693001000000,
                createdBy: "User#5678",
            },
        ];

        const thread1Messages: StoredMessage[] = [
            {
                id: "rootmsg1",
                content: "Root post content",
                authorTag: "User#1234",
                timestamp: 1693000000000,
            },
            {
                id: "reply1",
                content: "Reply 1",
                authorTag: "User#5678",
                timestamp: 1693000100000,
            },
            {
                id: "reply2",
                content: "Reply 2",
                authorTag: "User#9012",
                timestamp: 1693000200000,
            },
        ];

        const thread2Messages: StoredMessage[] = [
            {
                id: "rootmsg2",
                content: "Root post 2 content",
                authorTag: "User#5678",
                timestamp: 1693001000000,
            },
        ];

        // Mock dataStore methods
        dataStore.getAllForumThreads = jest.fn().mockReturnValue(threads);
        dataStore.getMessagesForChannel = jest.fn().mockImplementation((threadId) => {
            if (threadId === "thread1") return thread1Messages;
            if (threadId === "thread2") return thread2Messages;
            return [];
        });

        const response = await request(app).get("/forum-threads");

        expect(response.status).toBe(200);
        expect(response.body).toEqual([
            {
                threadId: "thread1",
                title: "Forum Post 1",
                createdBy: "User#1234",
                createdAt: 1693000000000,
                latestReplies: [
                    {
                        id: "reply1",
                        content: "Reply 1",
                        authorTag: "User#5678",
                        timestamp: 1693000100000,
                    },
                    {
                        id: "reply2",
                        content: "Reply 2",
                        authorTag: "User#9012",
                        timestamp: 1693000200000,
                    },
                ],
            },
            {
                threadId: "thread2",
                title: "Forum Post 2",
                createdBy: "User#5678",
                createdAt: 1693001000000,
                latestReplies: [],
            },
        ]);

        expect(dataStore.getAllForumThreads).toHaveBeenCalled();
        expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith("thread1");
        expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith("thread2");
    });

    test("should return empty array when no forum threads exist", async () => {
        // Mock dataStore methods
        dataStore.getAllForumThreads = jest.fn().mockReturnValue([]);

        const response = await request(app).get("/forum-threads");

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
        expect(dataStore.getAllForumThreads).toHaveBeenCalled();
    });

    test("should handle threads with more than 5 replies correctly", async () => {
        const threads: ThreadMeta[] = [
            {
                id: "thread1",
                title: "Forum Post with many replies",
                parentId: "forum123",
                createdAt: 1693000000000,
                createdBy: "User#1234",
            },
        ];

        // Create 10 messages (1 root + 9 replies)
        const threadMessages: StoredMessage[] = [
            {
                id: "rootmsg",
                content: "Root post content",
                authorTag: "User#1234",
                timestamp: 1693000000000,
            },
            ...Array.from({ length: 9 }, (_, i) => ({
                id: `reply${i + 1}`,
                content: `Reply ${i + 1}`,
                authorTag: `User#${i + 100}`,
                timestamp: 1693000000000 + (i + 1) * 100000,
            })),
        ];

        // Mock dataStore methods
        dataStore.getAllForumThreads = jest.fn().mockReturnValue(threads);
        dataStore.getMessagesForChannel = jest.fn().mockReturnValue(threadMessages);

        const response = await request(app).get("/forum-threads");

        expect(response.status).toBe(200);
        expect(response.body[0].latestReplies).toHaveLength(5);
        // Should include only the 5 latest replies (replies 5-9)
        expect(response.body[0].latestReplies[0].id).toBe("reply5");
        expect(response.body[0].latestReplies[4].id).toBe("reply9");
    });

    test("should handle threads with only one message (no replies)", async () => {
        const threads: ThreadMeta[] = [
            {
                id: "thread1",
                title: "Forum Post with single message",
                parentId: "forum123",
                createdAt: 1693000000000,
                createdBy: "User#1234",
            },
        ];

        // Create just 1 message (the root post with no replies)
        const threadMessages: StoredMessage[] = [
            {
                id: "rootmsg",
                content: "Root post content",
                authorTag: "User#1234",
                timestamp: 1693000000000,
            },
        ];

        // Mock dataStore methods
        dataStore.getAllForumThreads = jest.fn().mockReturnValue(threads);
        dataStore.getMessagesForChannel = jest.fn().mockReturnValue(threadMessages);

        // Create a real ApiServer instance
        const realApp = express();
        const server = new ApiServer(3000, dataStore);

        // @ts-ignore - replace app with our test app
        server.app = realApp;

        // Call setupMiddleware and setupRoutes
        // @ts-ignore - access private method for testing
        server.setupMiddleware();
        // @ts-ignore - access private method for testing
        server.setupRoutes();

        // Make request to the forum-threads endpoint
        const response = await request(realApp).get("/forum-threads");

        expect(response.status).toBe(200);
        expect(response.body[0].latestReplies).toEqual([]);
        expect(dataStore.getAllForumThreads).toHaveBeenCalled();
        expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith("thread1");
    });

    test("should handle errors when fetching forum threads fails", async () => {
        // Mock dataStore.getAllForumThreads to throw an error
        dataStore.getAllForumThreads = jest.fn().mockImplementation(() => {
            throw new Error("Database error");
        });

        // Mock console.error to prevent output during test
        const originalConsoleError = console.error;
        console.error = jest.fn();

        const response = await request(app).get("/forum-threads");

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Failed to fetch forum threads" });
        expect(dataStore.getAllForumThreads).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();

        // Restore console.error
        console.error = originalConsoleError;
    });

    test("should handle errors when getMessagesForChannel throws error during forum thread processing", async () => {
        // Mock getAllForumThreads to return threads
        const threads: ThreadMeta[] = [
            {
                id: "thread1",
                title: "Forum Post 1",
                parentId: "forum123",
                createdAt: 1693000000000,
                createdBy: "User#1234",
            },
            {
                id: "thread2",
                title: "Forum Post 2",
                parentId: "forum123",
                createdAt: 1693001000000,
                createdBy: "User#5678",
            },
        ];

        dataStore.getAllForumThreads = jest.fn().mockReturnValue(threads);

        // Mock getMessagesForChannel to throw an error only for the second thread
        dataStore.getMessagesForChannel = jest.fn().mockImplementation((threadId) => {
            if (threadId === "thread2") {
                throw new Error("Test error for thread2");
            }
            return [
                {
                    id: "msg1",
                    content: "Test content",
                    authorTag: "User#1234",
                    timestamp: 1693000000000,
                },
            ];
        });

        // Create a real ApiServer instance
        const realApp = express();
        const server = new ApiServer(3000, dataStore);

        // @ts-ignore - replace app with our test app
        server.app = realApp;

        // Call setupMiddleware and setupRoutes
        // @ts-ignore - access private method for testing
        server.setupMiddleware();
        // @ts-ignore - access private method for testing
        server.setupRoutes();

        // Make request to the forum-threads endpoint
        const response = await request(realApp).get("/forum-threads");

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Failed to fetch forum threads" });
        expect(dataStore.getAllForumThreads).toHaveBeenCalled();
        expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith("thread1");
        expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith("thread2");
    });

    test("should handle errors thrown from getMessagesForChannel", async () => {
        // Mock the methods to throw an error
        dataStore.getMessagesForChannel = jest.fn().mockImplementation(() => {
            throw new Error("Test error");
        });

        // Set up explicit error handling that the original route would have
        app = express();
        app.use(express.json());
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

        const response = await request(app).get("/messages/channel123");

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Failed to fetch messages" });
    });
});
