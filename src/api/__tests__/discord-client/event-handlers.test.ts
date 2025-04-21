import { createMockThreadChannel, TEST_TOKEN, TEST_GUILD_ID } from "./discord.mocks";
import { DiscordClient } from "../../discord-client";
import { DataStore } from "../../data-store";
import { Client, Events, Message, ChannelType, ThreadChannel } from "discord.js";

// Mock DataStore
jest.mock("../../data-store");

describe("DiscordClient Event Handlers", () => {
    let mockClient: jest.Mocked<Client>;
    let dataStore: jest.Mocked<DataStore>;
    let clientOnHandlers: Record<string, Function> = {};

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock DataStore
        dataStore = new DataStore() as jest.Mocked<DataStore>;

        // Create a mock discord.js Client that captures the event handlers
        const captureEventHandler = (event: string, handler: Function) => {
            clientOnHandlers[event] = handler;
            return mockClient;
        };

        mockClient = new Client({
            intents: ["Guilds", "GuildMessages", "MessageContent"],
        }) as jest.Mocked<Client>;
        mockClient.on = jest.fn().mockImplementation(captureEventHandler);

        // Spy on Client constructor to inject our mock
        jest.spyOn(require("discord.js"), "Client").mockImplementation(() => mockClient);

        // Create the DiscordClient instance
        new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);
    });

    describe("handleMessageCreate", () => {
        test("should ignore messages not in the target guild", () => {
            const mockMessage = {
                guild: { id: "other-guild-id" },
                content: "test message",
                id: "msg1",
                author: { tag: "User#1234" },
                createdTimestamp: Date.now(),
                channelId: "channel1",
            } as unknown as Message;

            // Call the handler directly
            clientOnHandlers[Events.MessageCreate](mockMessage);

            // Should not call addMessage
            expect(dataStore.addMessage).not.toHaveBeenCalled();
        });

        test("should ignore private thread messages", () => {
            const mockMessage = {
                guild: { id: TEST_GUILD_ID },
                content: "test message",
                id: "msg1",
                author: { tag: "User#1234" },
                createdTimestamp: Date.now(),
                channelId: "private-thread",
                channel: {
                    isThread: () => true,
                    type: ChannelType.PrivateThread,
                },
            } as unknown as Message;

            // Call the handler directly
            clientOnHandlers[Events.MessageCreate](mockMessage);

            // Should not call addMessage
            expect(dataStore.addMessage).not.toHaveBeenCalled();
        });

        test("should store valid messages from text channels", () => {
            const timestamp = Date.now();
            const mockMessage = {
                guild: { id: TEST_GUILD_ID },
                content: "test message",
                id: "msg1",
                author: { tag: "User#1234" },
                createdTimestamp: timestamp,
                channelId: "channel1",
                channel: {
                    isThread: () => false,
                    type: ChannelType.GuildText,
                },
            } as unknown as Message;

            // Call the handler directly
            clientOnHandlers[Events.MessageCreate](mockMessage);

            // Should call addMessage with correct data
            expect(dataStore.addMessage).toHaveBeenCalledWith("channel1", {
                id: "msg1",
                content: "test message",
                authorTag: "User#1234",
                timestamp,
            });
        });

        test("should store valid messages from public threads", () => {
            const timestamp = Date.now();
            const mockMessage = {
                guild: { id: TEST_GUILD_ID },
                content: "thread message",
                id: "msg2",
                author: { tag: "User#5678" },
                createdTimestamp: timestamp,
                channelId: "thread1",
                channel: {
                    isThread: () => true,
                    type: ChannelType.PublicThread,
                },
            } as unknown as Message;

            // Call the handler directly
            clientOnHandlers[Events.MessageCreate](mockMessage);

            // Should call addMessage with correct data
            expect(dataStore.addMessage).toHaveBeenCalledWith("thread1", {
                id: "msg2",
                content: "thread message",
                authorTag: "User#5678",
                timestamp,
            });
        });
    });

    describe("handleThreadCreate", () => {
        test("should ignore threads not in the target guild", async () => {
            const mockThread = {
                guild: { id: "other-guild-id" },
                id: "thread1",
                join: jest.fn().mockResolvedValue(undefined),
            } as unknown as ThreadChannel;

            // Call the handler directly
            await clientOnHandlers[Events.ThreadCreate](mockThread);

            // Should not call join or other methods
            expect(mockThread.join).not.toHaveBeenCalled();
            expect(dataStore.addMessage).not.toHaveBeenCalled();
            expect(dataStore.addForumThread).not.toHaveBeenCalled();
        });

        test("should ignore private threads", async () => {
            const mockThread = {
                guild: { id: TEST_GUILD_ID },
                id: "private-thread",
                type: ChannelType.PrivateThread,
                join: jest.fn().mockResolvedValue(undefined),
            } as unknown as ThreadChannel;

            // Call the handler directly
            await clientOnHandlers[Events.ThreadCreate](mockThread);

            // Should not call join or other methods
            expect(mockThread.join).not.toHaveBeenCalled();
            expect(dataStore.addMessage).not.toHaveBeenCalled();
            expect(dataStore.addForumThread).not.toHaveBeenCalled();
        });

        test("should handle new forum threads correctly", async () => {
            const timestamp = Date.now();
            const mockStarterMessage = {
                id: "root1",
                content: "Forum post content",
                author: { tag: "User#1234" },
                createdTimestamp: timestamp,
            };

            const mockThread = {
                guild: { id: TEST_GUILD_ID },
                id: "forum-thread",
                name: "Forum Thread Title",
                type: ChannelType.PublicThread,
                parentId: "forum123",
                parent: { type: ChannelType.GuildForum },
                createdTimestamp: timestamp,
                join: jest.fn().mockResolvedValue(undefined),
                fetchStarterMessage: jest.fn().mockResolvedValue(mockStarterMessage),
            } as unknown as ThreadChannel;

            // Call the handler directly
            await clientOnHandlers[Events.ThreadCreate](mockThread);

            // Should join the thread
            expect(mockThread.join).toHaveBeenCalled();

            // Should store the starter message
            expect(dataStore.addMessage).toHaveBeenCalledWith("forum-thread", {
                id: "root1",
                content: "Forum post content",
                authorTag: "User#1234",
                timestamp,
            });

            // Should store thread metadata
            expect(dataStore.addForumThread).toHaveBeenCalledWith({
                id: "forum-thread",
                title: "Forum Thread Title",
                parentId: "forum123",
                createdAt: timestamp,
                createdBy: "User#1234",
            });
        });

        test("should handle failure to fetch starter message", async () => {
            const timestamp = Date.now();
            const mockThread = {
                guild: { id: TEST_GUILD_ID },
                id: "forum-thread",
                name: "Forum Thread Title",
                type: ChannelType.PublicThread,
                parentId: "forum123",
                parent: { type: ChannelType.GuildForum },
                createdTimestamp: timestamp,
                join: jest.fn().mockResolvedValue(undefined),
                fetchStarterMessage: jest.fn().mockRejectedValue(new Error("Not found")),
            } as unknown as ThreadChannel;

            // Call the handler directly
            await clientOnHandlers[Events.ThreadCreate](mockThread);

            // Should still join the thread
            expect(mockThread.join).toHaveBeenCalled();

            // Should not store any messages or thread metadata
            expect(dataStore.addMessage).not.toHaveBeenCalled();
            expect(dataStore.addForumThread).not.toHaveBeenCalled();
        });

        test("should handle errors during thread creation", async () => {
            // Create a mock thread that will throw an error
            const mockThread = createMockThreadChannel();

            // Make join throw an error
            mockThread.join = jest.fn().mockRejectedValue(new Error("Failed to join thread"));

            // Spy on console.error
            const consoleErrorSpy = jest.spyOn(console, "error");
            consoleErrorSpy.mockImplementation(() => {});

            // Call the handler
            await clientOnHandlers[Events.ThreadCreate](mockThread);

            // Verify error was logged with thread ID
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                `Error handling thread create for ${mockThread.id}:`,
                expect.objectContaining({ message: "Failed to join thread" }),
            );

            // Restore console.error
            consoleErrorSpy.mockRestore();
        });
    });

    describe("handleThreadUpdate", () => {
        test("should remove archived threads", () => {
            const mockThread = {
                guild: { id: TEST_GUILD_ID },
                id: "thread1",
                archived: true,
            } as unknown as ThreadChannel;

            // Call the handler directly
            clientOnHandlers[Events.ThreadUpdate](undefined, mockThread);

            // Should remove the thread
            expect(dataStore.removeThread).toHaveBeenCalledWith("thread1");
        });

        test("should ignore non-archived thread updates", () => {
            const mockThread = {
                guild: { id: TEST_GUILD_ID },
                id: "thread1",
                archived: false,
            } as unknown as ThreadChannel;

            // Call the handler directly
            clientOnHandlers[Events.ThreadUpdate](undefined, mockThread);

            // Should not remove the thread
            expect(dataStore.removeThread).not.toHaveBeenCalled();
        });
    });

    describe("handleThreadDelete", () => {
        test("should remove deleted threads", () => {
            const mockThread = {
                guild: { id: TEST_GUILD_ID },
                id: "thread1",
            } as unknown as ThreadChannel;

            // Call the handler directly
            clientOnHandlers[Events.ThreadDelete](mockThread);

            // Should remove the thread
            expect(dataStore.removeThread).toHaveBeenCalledWith("thread1");
        });

        test("should ignore threads from other guilds", () => {
            const mockThread = {
                guild: { id: "other-guild-id" },
                id: "thread1",
            } as unknown as ThreadChannel;

            // Call the handler directly
            clientOnHandlers[Events.ThreadDelete](mockThread);

            // Should not remove the thread
            expect(dataStore.removeThread).not.toHaveBeenCalled();
        });
    });
});
