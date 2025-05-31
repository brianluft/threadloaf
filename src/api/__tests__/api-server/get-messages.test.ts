import { DataStore, StoredMessage } from "../../data-store";
import request from "supertest";
import express from "express";
import { createShared } from "./shared";

jest.mock("../../data-store");

describe("ApiServer GET /:guildId/messages/:channelId", () => {
    let dataStore: jest.Mocked<DataStore>;
    let app: express.Express;
    const TEST_GUILD_ID = "test-guild-id";

    beforeEach(() => {
        jest.clearAllMocks();

        const x = createShared();
        dataStore = x.dataStore;
        app = x.app;
    });

    test("should return messages for a valid guild and channel ID", async () => {
        const channelId = "channel123";
        const messages: StoredMessage[] = [
            {
                id: "msg1",
                content: "Hello world",
                authorTag: "User#1234",
                timestamp: 1693000000000,
            },
            {
                id: "msg2",
                content: "Test message",
                authorTag: "User#5678",
                timestamp: 1693000100000,
            },
        ];

        // Mock dataStore.getMessagesForChannel
        dataStore.getMessagesForChannel = jest.fn().mockReturnValue(messages);

        const response = await request(app).get(`/${TEST_GUILD_ID}/messages/${channelId}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(messages);
        expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith(channelId);
    });

    test("should return empty array for channel with no messages", async () => {
        const channelId = "empty-channel";

        // Mock dataStore.getMessagesForChannel
        dataStore.getMessagesForChannel = jest.fn().mockReturnValue([]);

        const response = await request(app).get(`/${TEST_GUILD_ID}/messages/${channelId}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
        expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith(channelId);
    });

    test("should return 400 error for invalid guild ID", async () => {
        const invalidGuildId = "invalid-guild-id";
        const channelId = "channel123";

        const response = await request(app).get(`/${invalidGuildId}/messages/${channelId}`);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "Invalid guild ID" });
        // Should not call dataStore methods for invalid guild
        expect(dataStore.getMessagesForChannel).not.toHaveBeenCalled();
    });

    test("should handle errors when fetching messages fails", async () => {
        const channelId = "error-channel";

        // Create a spy on console.error to verify it's called with the right arguments
        const consoleErrorSpy = jest.spyOn(console, "error");
        consoleErrorSpy.mockImplementation(() => {});

        // Mock dataStore.getMessagesForChannel to throw an error with a specific message
        const errorMessage = "Database connection failed";
        const mockError = new Error(errorMessage);
        dataStore.getMessagesForChannel = jest.fn().mockImplementation(() => {
            throw mockError;
        });

        const response = await request(app).get(`/${TEST_GUILD_ID}/messages/${channelId}`);

        // Assert the response status and body
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Failed to fetch messages" });

        // Verify dataStore.getMessagesForChannel was called with the channel ID
        expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith(channelId);

        // Verify console.error was called with the expected error
        expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching messages:", mockError);

        // Restore console.error
        consoleErrorSpy.mockRestore();
    });
});
