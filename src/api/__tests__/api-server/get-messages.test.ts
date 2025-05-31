import { DataStore, StoredMessage } from "../../data-store";
import request from "supertest";
import express from "express";
import { createShared } from "./shared";

jest.mock("../../data-store");

describe("ApiServer POST /:guildId/messages", () => {
    let dataStore: jest.Mocked<DataStore>;
    let app: express.Express;
    const TEST_GUILD_ID = "test-guild-id";

    beforeEach(() => {
        jest.clearAllMocks();

        const x = createShared();
        dataStore = x.dataStore;
        app = x.app;
    });

    test("should return messages for multiple channels", async () => {
        const channelIds = ["channel1", "channel2"];
        const maxMessagesPerChannel = 5;

        const messages1: StoredMessage[] = [
            {
                id: "msg1",
                content: "Hello from channel 1",
                authorTag: "User#1234",
                timestamp: 1693000000000,
            },
            {
                id: "msg2",
                content: "Another message from channel 1",
                authorTag: "User#5678",
                timestamp: 1693000100000,
            },
        ];

        const messages2: StoredMessage[] = [
            {
                id: "msg3",
                content: "Hello from channel 2",
                authorTag: "User#9999",
                timestamp: 1693000200000,
            },
        ];

        // Mock dataStore.getMessagesForChannel
        dataStore.getMessagesForChannel = jest.fn().mockReturnValueOnce(messages1).mockReturnValueOnce(messages2);

        const response = await request(app)
            .post(`/${TEST_GUILD_ID}/messages`)
            .send({ channelIds, maxMessagesPerChannel });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            channel1: messages1,
            channel2: messages2,
        });
        expect(dataStore.getMessagesForChannel).toHaveBeenCalledTimes(2);
        expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith("channel1");
        expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith("channel2");
    });

    test("should limit messages per channel based on maxMessagesPerChannel", async () => {
        const channelIds = ["channel1"];
        const maxMessagesPerChannel = 2;

        const allMessages: StoredMessage[] = [
            {
                id: "msg1",
                content: "Old message 1",
                authorTag: "User#1234",
                timestamp: 1693000000000,
            },
            {
                id: "msg2",
                content: "Old message 2",
                authorTag: "User#1234",
                timestamp: 1693000100000,
            },
            {
                id: "msg3",
                content: "Recent message 1",
                authorTag: "User#1234",
                timestamp: 1693000200000,
            },
            {
                id: "msg4",
                content: "Recent message 2",
                authorTag: "User#1234",
                timestamp: 1693000300000,
            },
        ];

        // Mock dataStore.getMessagesForChannel
        dataStore.getMessagesForChannel = jest.fn().mockReturnValue(allMessages);

        const response = await request(app)
            .post(`/${TEST_GUILD_ID}/messages`)
            .send({ channelIds, maxMessagesPerChannel });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            channel1: [allMessages[2], allMessages[3]], // Should get the last 2 messages
        });
        expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith("channel1");
    });

    test("should return empty arrays for channels with no messages", async () => {
        const channelIds = ["empty-channel1", "empty-channel2"];
        const maxMessagesPerChannel = 10;

        // Mock dataStore.getMessagesForChannel
        dataStore.getMessagesForChannel = jest.fn().mockReturnValue([]);

        const response = await request(app)
            .post(`/${TEST_GUILD_ID}/messages`)
            .send({ channelIds, maxMessagesPerChannel });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            "empty-channel1": [],
            "empty-channel2": [],
        });
        expect(dataStore.getMessagesForChannel).toHaveBeenCalledTimes(2);
    });

    test("should return 400 error for invalid guild ID", async () => {
        const invalidGuildId = "invalid-guild-id";
        const channelIds = ["channel1"];
        const maxMessagesPerChannel = 10;

        const response = await request(app)
            .post(`/${invalidGuildId}/messages`)
            .send({ channelIds, maxMessagesPerChannel });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "Invalid guild ID" });
        // Should not call dataStore methods for invalid guild
        expect(dataStore.getMessagesForChannel).not.toHaveBeenCalled();
    });

    test("should return 400 error when channelIds is missing", async () => {
        const maxMessagesPerChannel = 10;

        const response = await request(app).post(`/${TEST_GUILD_ID}/messages`).send({ maxMessagesPerChannel });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "channelIds must be an array" });
        expect(dataStore.getMessagesForChannel).not.toHaveBeenCalled();
    });

    test("should return 400 error when channelIds is not an array", async () => {
        const channelIds = "not-an-array";
        const maxMessagesPerChannel = 10;

        const response = await request(app)
            .post(`/${TEST_GUILD_ID}/messages`)
            .send({ channelIds, maxMessagesPerChannel });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "channelIds must be an array" });
        expect(dataStore.getMessagesForChannel).not.toHaveBeenCalled();
    });

    test("should return 400 error when channelIds is null", async () => {
        const channelIds = null;
        const maxMessagesPerChannel = 10;

        const response = await request(app)
            .post(`/${TEST_GUILD_ID}/messages`)
            .send({ channelIds, maxMessagesPerChannel });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "channelIds must be an array" });
        expect(dataStore.getMessagesForChannel).not.toHaveBeenCalled();
    });

    test("should return 400 error when maxMessagesPerChannel is missing", async () => {
        const channelIds = ["channel1"];

        const response = await request(app).post(`/${TEST_GUILD_ID}/messages`).send({ channelIds });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "maxMessagesPerChannel must be a non-negative number" });
        expect(dataStore.getMessagesForChannel).not.toHaveBeenCalled();
    });

    test("should return 400 error when maxMessagesPerChannel is negative", async () => {
        const channelIds = ["channel1"];
        const maxMessagesPerChannel = -1;

        const response = await request(app)
            .post(`/${TEST_GUILD_ID}/messages`)
            .send({ channelIds, maxMessagesPerChannel });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "maxMessagesPerChannel must be a non-negative number" });
        expect(dataStore.getMessagesForChannel).not.toHaveBeenCalled();
    });

    test("should return 400 error when maxMessagesPerChannel is not a number", async () => {
        const channelIds = ["channel1"];
        const maxMessagesPerChannel = "not-a-number";

        const response = await request(app)
            .post(`/${TEST_GUILD_ID}/messages`)
            .send({ channelIds, maxMessagesPerChannel });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "maxMessagesPerChannel must be a non-negative number" });
        expect(dataStore.getMessagesForChannel).not.toHaveBeenCalled();
    });

    test("should return 400 error when maxMessagesPerChannel is null", async () => {
        const channelIds = ["channel1"];
        const maxMessagesPerChannel = null;

        const response = await request(app)
            .post(`/${TEST_GUILD_ID}/messages`)
            .send({ channelIds, maxMessagesPerChannel });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "maxMessagesPerChannel must be a non-negative number" });
        expect(dataStore.getMessagesForChannel).not.toHaveBeenCalled();
    });

    test("should handle errors when fetching messages fails", async () => {
        const channelIds = ["error-channel"];
        const maxMessagesPerChannel = 10;

        // Create a spy on console.error to verify it's called with the right arguments
        const consoleErrorSpy = jest.spyOn(console, "error");
        consoleErrorSpy.mockImplementation(() => {});

        // Mock dataStore.getMessagesForChannel to throw an error with a specific message
        const errorMessage = "Database connection failed";
        const mockError = new Error(errorMessage);
        dataStore.getMessagesForChannel = jest.fn().mockImplementation(() => {
            throw mockError;
        });

        const response = await request(app)
            .post(`/${TEST_GUILD_ID}/messages`)
            .send({ channelIds, maxMessagesPerChannel });

        // Assert the response status and body
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Failed to fetch messages" });

        // Verify dataStore.getMessagesForChannel was called with the channel ID
        expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith("error-channel");

        // Verify console.error was called with the expected error
        expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching messages:", mockError);

        // Restore console.error
        consoleErrorSpy.mockRestore();
    });

    test("should handle maxMessagesPerChannel of 0", async () => {
        const channelIds = ["channel1"];
        const maxMessagesPerChannel = 0;

        const messages: StoredMessage[] = [
            {
                id: "msg1",
                content: "This should not be returned",
                authorTag: "User#1234",
                timestamp: 1693000000000,
            },
        ];

        // Mock dataStore.getMessagesForChannel
        dataStore.getMessagesForChannel = jest.fn().mockReturnValue(messages);

        const response = await request(app)
            .post(`/${TEST_GUILD_ID}/messages`)
            .send({ channelIds, maxMessagesPerChannel });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            channel1: [], // Should return empty array when limit is 0
        });
        expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith("channel1");
    });

    test("should return 400 error when channelIds is empty string", async () => {
        const channelIds = "";
        const maxMessagesPerChannel = 10;

        const response = await request(app)
            .post(`/${TEST_GUILD_ID}/messages`)
            .send({ channelIds, maxMessagesPerChannel });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "channelIds must be an array" });
        expect(dataStore.getMessagesForChannel).not.toHaveBeenCalled();
    });

    test("should return 400 error when maxMessagesPerChannel is explicitly undefined", async () => {
        const channelIds = ["channel1"];
        const maxMessagesPerChannel = undefined;

        const response = await request(app)
            .post(`/${TEST_GUILD_ID}/messages`)
            .send({ channelIds, maxMessagesPerChannel });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "maxMessagesPerChannel must be a non-negative number" });
        expect(dataStore.getMessagesForChannel).not.toHaveBeenCalled();
    });
});
