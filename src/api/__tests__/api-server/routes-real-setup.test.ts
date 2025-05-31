import { ApiServer } from "../../api-server";
import { DataStore, StoredMessage, ThreadMeta } from "../../data-store";
import request from "supertest";
import express from "express";

jest.mock("../../data-store");

// Add real setup routes tests to cover uncovered code in GET /messages
describe("ApiServer routes - real setup", () => {
    let apiServer: ApiServer;
    let dataStore: jest.Mocked<DataStore>;
    let dataStoresByGuild: Map<string, DataStore>;
    let app: express.Express;
    const TEST_GUILD_ID = "test-guild-id";

    beforeEach(() => {
        jest.clearAllMocks();
        dataStore = new DataStore() as jest.Mocked<DataStore>;

        // Create a Map with the test DataStore
        dataStoresByGuild = new Map<string, DataStore>();
        dataStoresByGuild.set(TEST_GUILD_ID, dataStore);

        apiServer = new ApiServer(3000, dataStoresByGuild);
        // Access the actual Express app from the server instance
        app = (apiServer as unknown as { app: express.Express }).app;
    });

    test("GET /:guildId/messages/:channelId real setup success", async () => {
        const channelId = "channel123";
        const messages: StoredMessage[] = [
            {
                id: "msg1",
                content: "Hello",
                authorTag: "User#1",
                timestamp: 1600000000000,
            },
        ];

        dataStore.getMessagesForChannel.mockReturnValue(messages);

        const response = await request(app).get(`/${TEST_GUILD_ID}/messages/${channelId}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(messages);
        expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith(channelId);
    });

    test("GET /:guildId/messages/:channelId real setup error", async () => {
        const channelId = "error-channel";
        const error = new Error("Test failure");
        dataStore.getMessagesForChannel.mockImplementation(() => {
            throw error;
        });

        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const response = await request(app).get(`/${TEST_GUILD_ID}/messages/${channelId}`);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Failed to fetch messages" });
        expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching messages:", error);

        consoleErrorSpy.mockRestore();
    });

    test("GET /:guildId/messages/:channelId with invalid guild ID", async () => {
        const channelId = "channel123";
        const invalidGuildId = "invalid-guild-id";

        const response = await request(app).get(`/${invalidGuildId}/messages/${channelId}`);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "Invalid guild ID" });
        // Should not call dataStore methods for invalid guild
        expect(dataStore.getMessagesForChannel).not.toHaveBeenCalled();
    });

    test("GET /:guildId/forum-threads real setup success", async () => {
        const threads: ThreadMeta[] = [
            {
                id: "thread1",
                title: "Forum Post",
                parentId: "forum123",
                createdAt: 1690000000000,
                createdBy: "User#1234",
            },
            {
                id: "thread2",
                title: "Forum Post 2",
                parentId: "forum123",
                createdAt: 1690000100000,
                createdBy: "User#5678",
            },
        ];
        const thread1Messages: StoredMessage[] = [
            { id: "root1", content: "root", authorTag: "u1", timestamp: 1690000000000 },
            { id: "reply1", content: "r1", authorTag: "u2", timestamp: 1690000001000 },
            { id: "reply2", content: "r2", authorTag: "u3", timestamp: 1690000002000 },
        ];
        const thread2Messages: StoredMessage[] = [
            { id: "root2", content: "root2", authorTag: "u2", timestamp: 1690000100000 },
        ];

        dataStore.getAllForumThreads.mockReturnValue(threads);
        dataStore.getMessagesForChannel.mockImplementation((channelId: string) =>
            channelId === "thread1" ? thread1Messages : thread2Messages,
        );

        const response = await request(app).get(`/${TEST_GUILD_ID}/forum-threads`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([
            {
                threadId: "thread1",
                title: "Forum Post",
                createdBy: "User#1234",
                createdAt: 1690000000000,
                latestReplies: [thread1Messages[1], thread1Messages[2]],
            },
            {
                threadId: "thread2",
                title: "Forum Post 2",
                createdBy: "User#5678",
                createdAt: 1690000100000,
                latestReplies: [],
            },
        ]);
    });

    test("GET /:guildId/forum-threads real setup error", async () => {
        const error = new Error("Test failure");
        dataStore.getAllForumThreads.mockImplementation(() => {
            throw error;
        });

        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const response = await request(app).get(`/${TEST_GUILD_ID}/forum-threads`);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Failed to fetch forum threads" });
        expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching forum threads:", error);

        consoleErrorSpy.mockRestore();
    });

    test("GET /:guildId/forum-threads with invalid guild ID", async () => {
        const invalidGuildId = "invalid-guild-id";

        const response = await request(app).get(`/${invalidGuildId}/forum-threads`);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "Invalid guild ID" });
        // Should not call dataStore methods for invalid guild
        expect(dataStore.getAllForumThreads).not.toHaveBeenCalled();
        expect(dataStore.getMessagesForChannel).not.toHaveBeenCalled();
    });
});

describe("ApiServer real setup", () => {
    test("should properly initialize with real methods", () => {
        // Create a mocked DataStore
        const dataStore = new DataStore() as jest.Mocked<DataStore>;

        // Create a Map with the test DataStore
        const dataStoresByGuild = new Map<string, DataStore>();
        dataStoresByGuild.set("test-guild-id", dataStore);

        // This tests that the constructor runs without error and properly calls internal methods
        const apiServer = new ApiServer(3000, dataStoresByGuild);

        // Verify server was created
        expect(apiServer).toBeDefined();

        // Verify the server has the expected properties
        expect(apiServer).toHaveProperty("start");
    });
});
