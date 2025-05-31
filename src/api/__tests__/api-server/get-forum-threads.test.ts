import { ApiServer } from "../../api-server";
import { DataStore, StoredMessage, ThreadMeta } from "../../data-store";
import request from "supertest";
import express from "express";
import { createShared } from "./shared";

jest.mock("../../data-store");

describe("ApiServer GET /:guildId/forum-threads", () => {
    let dataStore: jest.Mocked<DataStore>;
    let app: express.Express;
    const TEST_GUILD_ID = "test-guild-id";

    beforeEach(() => {
        jest.clearAllMocks();

        const x = createShared();
        dataStore = x.dataStore;
        app = x.app;
    });

    test("should return forum threads with latest replies for valid guild", async () => {
        const mockThreads: ThreadMeta[] = [
            {
                id: "thread1",
                title: "Test Thread 1",
                parentId: "forum123",
                createdAt: 1690000000000,
                createdBy: "User#1234",
            },
            {
                id: "thread2",
                title: "Test Thread 2",
                parentId: "forum123",
                createdAt: 1690000100000,
                createdBy: "User#5678",
            },
        ];

        const thread1Messages: StoredMessage[] = [
            {
                id: "msg1",
                content: "Thread 1 starter message",
                authorTag: "User#1234",
                timestamp: 1690000000000,
            },
            {
                id: "msg2",
                content: "First reply",
                authorTag: "User#5678",
                timestamp: 1690000001000,
            },
            {
                id: "msg3",
                content: "Second reply",
                authorTag: "User#9999",
                timestamp: 1690000002000,
            },
        ];

        const thread2Messages: StoredMessage[] = [
            {
                id: "msg4",
                content: "Thread 2 starter message",
                authorTag: "User#5678",
                timestamp: 1690000100000,
            },
        ];

        dataStore.getAllForumThreads.mockReturnValue(mockThreads);
        dataStore.getMessagesForChannel.mockImplementation((channelId: string) => {
            if (channelId === "thread1") return thread1Messages;
            if (channelId === "thread2") return thread2Messages;
            return [];
        });

        const response = await request(app).get(`/${TEST_GUILD_ID}/forum-threads`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([
            {
                threadId: "thread1",
                title: "Test Thread 1",
                createdBy: "User#1234",
                createdAt: 1690000000000,
                latestReplies: [thread1Messages[1], thread1Messages[2]], // Skip first message (starter)
            },
            {
                threadId: "thread2",
                title: "Test Thread 2",
                createdBy: "User#5678",
                createdAt: 1690000100000,
                latestReplies: [], // Only starter message, no replies
            },
        ]);

        expect(dataStore.getAllForumThreads).toHaveBeenCalled();
        expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith("thread1");
        expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith("thread2");
    });

    test("should return empty array when no forum threads exist", async () => {
        dataStore.getAllForumThreads.mockReturnValue([]);

        const response = await request(app).get(`/${TEST_GUILD_ID}/forum-threads`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
        expect(dataStore.getAllForumThreads).toHaveBeenCalled();
    });

    test("should return 400 error for invalid guild ID", async () => {
        const invalidGuildId = "invalid-guild-id";

        const response = await request(app).get(`/${invalidGuildId}/forum-threads`);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "Invalid guild ID" });
        // Should not call dataStore methods for invalid guild
        expect(dataStore.getAllForumThreads).not.toHaveBeenCalled();
        expect(dataStore.getMessagesForChannel).not.toHaveBeenCalled();
    });

    test("should limit latest replies to 5 messages", async () => {
        const mockThread: ThreadMeta = {
            id: "thread1",
            title: "Busy Thread",
            parentId: "forum123",
            createdAt: 1690000000000,
            createdBy: "User#1234",
        };

        // Create 10 messages (1 starter + 9 replies)
        const manyMessages: StoredMessage[] = Array.from({ length: 10 }, (_, i) => ({
            id: `msg${i + 1}`,
            content: `Message ${i + 1}`,
            authorTag: `User#${1000 + i}`,
            timestamp: 1690000000000 + i * 1000,
        }));

        dataStore.getAllForumThreads.mockReturnValue([mockThread]);
        dataStore.getMessagesForChannel.mockReturnValue(manyMessages);

        const response = await request(app).get(`/${TEST_GUILD_ID}/forum-threads`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);

        // Should skip first message and take last 5 of the remaining (messages 6-10)
        const expectedReplies = manyMessages.slice(1).slice(-5); // Skip first, take last 5
        expect(response.body[0].latestReplies).toEqual(expectedReplies);
        expect(response.body[0].latestReplies).toHaveLength(5);
    });

    test("should handle errors gracefully", async () => {
        const error = new Error("Database error");
        dataStore.getAllForumThreads.mockImplementation(() => {
            throw error;
        });

        // Spy on console.error to verify error logging
        const consoleErrorSpy = jest.spyOn(console, "error");
        consoleErrorSpy.mockImplementation(() => {}); // Suppress console output during test

        const response = await request(app).get(`/${TEST_GUILD_ID}/forum-threads`);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Failed to fetch forum threads" });
        expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching forum threads:", error);

        // Restore console.error
        consoleErrorSpy.mockRestore();
    });

    test("should directly test the forum threads route handler", () => {
        // Create a Map with the test DataStore
        const dataStoresByGuild = new Map<string, DataStore>();
        dataStoresByGuild.set(TEST_GUILD_ID, dataStore);

        // Create mock Discord clients map
        const discordClientsByGuild = new Map();

        // Create a server instance with authentication disabled for tests
        const server = new ApiServer(3000, dataStoresByGuild, discordClientsByGuild, false);

        // Create a mock Express app
        const mockApp = {
            get: jest.fn(),
            post: jest.fn(),
        };

        // Replace the app with our mock
        // @ts-ignore - access private property
        server.app = mockApp;

        // Call setupRoutes to register the routes with our mock app
        // @ts-ignore - access private method
        server.setupRoutes();

        // Get the forum-threads route handler (2nd GET route, after OAuth callback)
        // Index [1][2] because it has middleware: [path, middleware, handler]
        const threadsHandler = mockApp.get.mock.calls[1][2];

        // Mock data
        const mockThreads: ThreadMeta[] = [
            {
                id: "thread1",
                title: "Test Thread",
                parentId: "forum123",
                createdAt: 1690000000000,
                createdBy: "User#1234",
            },
        ];

        const mockMessages: StoredMessage[] = [
            {
                id: "msg1",
                content: "Starter",
                authorTag: "User#1234",
                timestamp: 1690000000000,
            },
            {
                id: "msg2",
                content: "Reply",
                authorTag: "User#5678",
                timestamp: 1690000001000,
            },
        ];

        dataStore.getAllForumThreads.mockReturnValue(mockThreads);
        dataStore.getMessagesForChannel.mockReturnValue(mockMessages);

        // Create mock request and response
        const mockReq = {
            params: { guildId: TEST_GUILD_ID },
        };
        const mockRes = {
            json: jest.fn(),
        };

        // Call the threads handler directly
        threadsHandler(mockReq, mockRes);

        // Verify it returned the correct response
        expect(mockRes.json).toHaveBeenCalledWith([
            {
                threadId: "thread1",
                title: "Test Thread",
                createdBy: "User#1234",
                createdAt: 1690000000000,
                latestReplies: [mockMessages[1]], // Skip first message
            },
        ]);
    });
});
