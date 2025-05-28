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
                expect.any(Error),
            );

            // Restore console.error
            consoleErrorSpy.mockRestore();
        });

        test("should handle thread with null parentId", async () => {
            const timestamp = Date.now();
            const mockStarterMessage = {
                id: "root1",
                content: "Forum post with null parentId",
                author: { tag: "User#9999" },
                createdTimestamp: timestamp,
            };

            // Create a thread with a null parentId
            const mockThread = {
                guild: { id: TEST_GUILD_ID },
                id: "forum-thread-null-parent",
                name: "Thread With Null ParentId",
                type: ChannelType.PublicThread,
                parentId: null, // Set parentId to null
                parent: { type: ChannelType.GuildForum },
                createdTimestamp: timestamp,
                join: jest.fn().mockResolvedValue(undefined),
                fetchStarterMessage: jest.fn().mockResolvedValue(mockStarterMessage),
            } as unknown as ThreadChannel;

            // Call the handler directly
            await clientOnHandlers[Events.ThreadCreate](mockThread);

            // Should store thread metadata with empty string as parentId
            expect(dataStore.addForumThread).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: "forum-thread-null-parent",
                    parentId: "", // Verify empty string is used when parentId is null
                }),
            );
        });

        test("handleThreadCreate should skip private threads", async () => {
            // Create a mock private thread
            const mockPrivateThread = {
                id: "private-thread-id",
                guild: {
                    id: TEST_GUILD_ID,
                },
                type: ChannelType.PrivateThread,
                join: jest.fn().mockResolvedValue(undefined),
            };

            // Call the handleThreadCreate method
            await clientOnHandlers[Events.ThreadCreate](mockPrivateThread);

            // Verify join was not called for a private thread
            expect(mockPrivateThread.join).not.toHaveBeenCalled();
        });

        test("handleThreadCreate should handle errors gracefully", async () => {
            // Spy on console.error to verify it's called
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            // Create a mock thread that will cause an error
            const mockErrorThread = {
                id: "error-thread-id",
                guild: {
                    id: TEST_GUILD_ID,
                },
                type: ChannelType.PublicThread,
                join: jest.fn().mockRejectedValue(new Error("Thread join error")),
                parent: null, // This will cause an error when accessing thread.parent.type
            };

            // Call the handleThreadCreate method - should not throw despite the error
            await clientOnHandlers[Events.ThreadCreate](mockErrorThread);

            // Verify the error was logged
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining(`Error handling thread create for ${mockErrorThread.id}:`),
                expect.any(Error),
            );

            // Clean up
            consoleErrorSpy.mockRestore();
        });

        test("should handle non-forum threads in text channels", async () => {
            // Create the DiscordClient instance to access the backfillChannelMessages method
            const discordClient = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);

            // Mock the backfillChannelMessages method to verify it gets called
            const backfillChannelMessagesSpy = jest
                .spyOn(discordClient as any, "backfillChannelMessages")
                .mockResolvedValue(undefined);

            const mockThread = {
                guild: { id: TEST_GUILD_ID },
                id: "text-channel-thread",
                name: "Thread in Text Channel",
                type: ChannelType.PublicThread,
                parentId: "text-channel-123",
                parent: { type: ChannelType.GuildText }, // This makes isForum false
                createdTimestamp: Date.now(),
                join: jest.fn().mockResolvedValue(undefined),
            } as unknown as ThreadChannel;

            // Call the handleThreadCreate method directly on the instance
            await discordClient["handleThreadCreate"](mockThread);

            // Should join the thread
            expect(mockThread.join).toHaveBeenCalled();

            // Should call backfillChannelMessages for the parent channel (this covers line 152)
            expect(backfillChannelMessagesSpy).toHaveBeenCalledWith("text-channel-123");

            // Should not store forum thread metadata since it's not a forum thread
            expect(dataStore.addForumThread).not.toHaveBeenCalled();

            // Clean up the spy
            backfillChannelMessagesSpy.mockRestore();
        });

        test("should handle non-forum threads with null parentId", async () => {
            // Create the DiscordClient instance to access the backfillChannelMessages method
            const discordClient = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);

            // Mock the backfillChannelMessages method to verify it gets called
            const backfillChannelMessagesSpy = jest
                .spyOn(discordClient as any, "backfillChannelMessages")
                .mockResolvedValue(undefined);

            const mockThread = {
                guild: { id: TEST_GUILD_ID },
                id: "text-channel-thread-null-parent",
                name: "Thread in Text Channel with Null Parent",
                type: ChannelType.PublicThread,
                parentId: null, // This will test the || "" fallback on line 152
                parent: { type: ChannelType.GuildText }, // This makes isForum false
                createdTimestamp: Date.now(),
                join: jest.fn().mockResolvedValue(undefined),
            } as unknown as ThreadChannel;

            // Call the handleThreadCreate method directly on the instance
            await discordClient["handleThreadCreate"](mockThread);

            // Should join the thread
            expect(mockThread.join).toHaveBeenCalled();

            // Should call backfillChannelMessages with empty string (the || "" fallback)
            expect(backfillChannelMessagesSpy).toHaveBeenCalledWith("");

            // Should not store forum thread metadata since it's not a forum thread
            expect(dataStore.addForumThread).not.toHaveBeenCalled();

            // Clean up the spy
            backfillChannelMessagesSpy.mockRestore();
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
