import { DiscordClient } from "../discord-client";
import { DataStore, StoredMessage, ThreadMeta } from "../data-store";
import {
    Client,
    Events,
    Message,
    ChannelType,
    ThreadChannel,
    Collection,
    Guild,
    TextChannel,
    User,
    GuildTextBasedChannel,
    AnyThreadChannel,
} from "discord.js";

// Mock discord.js
jest.mock("discord.js", () => {
    // Create mock classes
    class MockCollection<K, V> extends Map<K, V> {
        constructor(entries?: Array<[K, V]>) {
            super(entries || []);
        }

        filter(fn: (value: V, key: K) => boolean): MockCollection<K, V> {
            const filtered = new MockCollection<K, V>();
            for (const [key, value] of this.entries()) {
                if (fn(value, key)) {
                    filtered.set(key, value);
                }
            }
            return filtered;
        }

        last(): V | undefined {
            const values = Array.from(this.values());
            return values[values.length - 1];
        }
    }

    const mockClient = jest.fn().mockImplementation(() => ({
        login: jest.fn().mockResolvedValue("token"),
        on: jest.fn(),
        user: { tag: "TestBot#0000" },
        guilds: {
            cache: {
                get: jest.fn(),
            },
        },
    }));

    // Return the mock module
    return {
        Client: mockClient,
        Events: {
            ClientReady: "ready",
            MessageCreate: "messageCreate",
            ThreadCreate: "threadCreate",
            ThreadUpdate: "threadUpdate",
            ThreadDelete: "threadDelete",
        },
        ChannelType: {
            GuildText: 0,
            GuildForum: 15,
            PublicThread: 11,
            PrivateThread: 12,
            GuildAnnouncement: 5,
        },
        Collection: MockCollection,
        GatewayIntentBits: {
            Guilds: 1,
            GuildMessages: 2,
            MessageContent: 3,
        },
    };
});

// Mock DataStore
jest.mock("../data-store");

describe("DiscordClient", () => {
    let discordClient: DiscordClient;
    let mockClient: jest.Mocked<Client>;
    let dataStore: jest.Mocked<DataStore>;
    let clientOnHandlers: Record<string, Function> = {};
    const TEST_TOKEN = "test-token";
    const TEST_GUILD_ID = "test-guild-id";

    // Helper function to create mock ThreadChannel
    function createMockThreadChannel(
        options: {
            threadId?: string;
            guildId?: string;
            archived?: boolean;
            parentId?: string;
            threadType?: number;
        } = {},
    ): ThreadChannel {
        const threadId = options.threadId || "test-thread-id";
        const guildId = options.guildId || TEST_GUILD_ID;
        const archived = options.archived !== undefined ? options.archived : false;
        const parentId = options.parentId || "parent-channel-id";
        const threadType = options.threadType || ChannelType.PublicThread;

        return {
            id: threadId,
            guild: { id: guildId },
            archived: archived,
            parentId: parentId,
            name: "Test Thread",
            parent: {
                type: ChannelType.GuildForum,
            },
            type: threadType,
            join: jest.fn().mockResolvedValue(undefined),
            fetchStarterMessage: jest.fn().mockResolvedValue({
                author: { tag: "Thread Starter#1234" },
                content: "Thread starter message",
            }),
        } as unknown as ThreadChannel;
    }

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
        discordClient = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);
    });

    describe("initialization", () => {
        test("should set up event handlers", () => {
            expect(mockClient.on).toHaveBeenCalledWith(Events.ClientReady, expect.any(Function));
            expect(mockClient.on).toHaveBeenCalledWith(Events.MessageCreate, expect.any(Function));
            expect(mockClient.on).toHaveBeenCalledWith(Events.ThreadCreate, expect.any(Function));
            expect(mockClient.on).toHaveBeenCalledWith(Events.ThreadUpdate, expect.any(Function));
            expect(mockClient.on).toHaveBeenCalledWith(Events.ThreadDelete, expect.any(Function));
            expect(mockClient.login).toHaveBeenCalledWith(TEST_TOKEN);
        });

        test("should handle login errors", async () => {
            // Save the original login implementation
            const originalLogin = mockClient.login;

            // Create a spy on console.error
            const consoleErrorSpy = jest.spyOn(console, "error");
            consoleErrorSpy.mockImplementation(() => {});

            // Make login reject with an error
            mockClient.login = jest.fn().mockRejectedValue(new Error("Auth failed"));

            // Create a new client instance that will fail to login
            new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);

            // Wait for the promise rejection to be processed
            await new Promise(process.nextTick);

            // Verify error was logged
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Failed to log in to Discord:",
                expect.objectContaining({ message: "Auth failed" }),
            );

            // Restore mocks
            mockClient.login = originalLogin;
            consoleErrorSpy.mockRestore();
        });
    });

    describe("event handlers", () => {
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

    // Simple mock for the backfill test
    describe("handleReady and backfill", () => {
        test("should perform backfill when client is ready", async () => {
            // Create a proper mock collection for the threads
            const mockThreadsCollection = new Map();

            // Mock guild
            const mockGuild = {
                id: TEST_GUILD_ID,
                name: "Test Guild",
                channels: {
                    fetchActiveThreads: jest.fn().mockResolvedValue({
                        threads: mockThreadsCollection,
                    }),
                    cache: {
                        filter: jest.fn().mockReturnValue(new Map()),
                    },
                },
            } as unknown as Guild;

            // Setup mock client to return our guild
            mockClient.guilds.cache.get = jest.fn().mockReturnValue(mockGuild);

            // Setup interval spy to avoid actual setInterval
            jest.spyOn(global, "setInterval").mockImplementation(jest.fn() as any);

            // Call the ready handler directly
            await clientOnHandlers[Events.ClientReady]();

            // Should attempt to get the guild
            expect(mockClient.guilds.cache.get).toHaveBeenCalledWith(TEST_GUILD_ID);

            // Should have attempted to fetch active threads
            expect(mockGuild.channels.fetchActiveThreads).toHaveBeenCalled();

            // Should have set up pruning interval
            expect(setInterval).toHaveBeenCalled();
        });

        test("should handle guild not found error", async () => {
            // Temporarily mock console.error to avoid error message in test output
            const originalConsoleError = console.error;
            console.error = jest.fn();

            // Setup mock client to not find the guild
            mockClient.guilds.cache.get = jest.fn().mockReturnValue(undefined);

            // Call the ready handler directly
            await clientOnHandlers[Events.ClientReady]();

            // Should attempt to get the guild
            expect(mockClient.guilds.cache.get).toHaveBeenCalledWith(TEST_GUILD_ID);

            // Shouldn't proceed further with backfill
            expect(dataStore.addMessage).not.toHaveBeenCalled();
            expect(dataStore.addForumThread).not.toHaveBeenCalled();
            expect(setInterval).not.toHaveBeenCalled();

            // Restore console.error
            console.error = originalConsoleError;
        });
    });

    describe("handleThreadUpdate method", () => {
        test("should ignore threads from different guilds", async () => {
            // Create a thread from a different guild
            const wrongGuildThread = createMockThreadChannel({ guildId: "wrong-guild" });

            // Spy on dataStore.removeThread to ensure it's not called
            const removeThreadSpy = jest.spyOn(dataStore, "removeThread");

            // Call the method
            await discordClient["handleThreadUpdate"](wrongGuildThread);

            // Verify removeThread was not called
            expect(removeThreadSpy).not.toHaveBeenCalled();
        });

        test("should remove archived threads", async () => {
            // Create an archived thread in the correct guild
            const archivedThread = createMockThreadChannel({
                archived: true,
                guildId: TEST_GUILD_ID,
                threadId: "archived-thread-id",
            });

            // Spy on dataStore.removeThread
            const removeThreadSpy = jest.spyOn(dataStore, "removeThread");

            // Call the method
            await discordClient["handleThreadUpdate"](archivedThread);

            // Verify removeThread was called with the thread ID
            expect(removeThreadSpy).toHaveBeenCalledWith("archived-thread-id");
        });

        test("should not remove non-archived threads", async () => {
            // Create a non-archived thread in the correct guild
            const activeThread = createMockThreadChannel({
                archived: false,
                guildId: TEST_GUILD_ID,
            });

            // Spy on dataStore.removeThread
            const removeThreadSpy = jest.spyOn(dataStore, "removeThread");

            // Call the method
            await discordClient["handleThreadUpdate"](activeThread);

            // Verify removeThread was not called
            expect(removeThreadSpy).not.toHaveBeenCalled();
        });
    });

    describe("handleThreadDelete method", () => {
        test("should ignore threads from different guilds", async () => {
            // Create a thread from a different guild
            const wrongGuildThread = createMockThreadChannel({ guildId: "wrong-guild" });

            // Spy on dataStore.removeThread to ensure it's not called
            const removeThreadSpy = jest.spyOn(dataStore, "removeThread");

            // Call the method
            await discordClient["handleThreadDelete"](wrongGuildThread);

            // Verify removeThread was not called
            expect(removeThreadSpy).not.toHaveBeenCalled();
        });

        test("should remove deleted threads", async () => {
            // Create a thread in the correct guild
            const deletedThread = createMockThreadChannel({
                guildId: TEST_GUILD_ID,
                threadId: "deleted-thread-id",
            });

            // Spy on dataStore.removeThread
            const removeThreadSpy = jest.spyOn(dataStore, "removeThread");

            // Call the method
            await discordClient["handleThreadDelete"](deletedThread);

            // Verify removeThread was called with the thread ID
            expect(removeThreadSpy).toHaveBeenCalledWith("deleted-thread-id");
        });
    });

    describe("handleRateLimitedOperation method", () => {
        beforeEach(() => {
            // Restore console methods
            console.warn = jest.fn();
            console.error = jest.fn();
        });

        test("should return success with result for successful operation", async () => {
            // Create a mock operation that succeeds
            const mockOperation = jest.fn().mockResolvedValue("success-result");

            // Call the method
            const result = await discordClient["handleRateLimitedOperation"](mockOperation, "test-operation");

            // Verify the result
            expect(result).toEqual({
                success: true,
                result: "success-result",
            });
            expect(mockOperation).toHaveBeenCalledTimes(1);
        });

        test("should handle unknown message errors (code 10008)", async () => {
            // Create a mock operation that fails with unknown message error
            const mockOperation = jest.fn().mockRejectedValue({
                code: 10008,
                message: "Unknown message",
            });

            // Call the method
            const result = await discordClient["handleRateLimitedOperation"](mockOperation, "test-operation");

            // Verify the result
            expect(result).toEqual({
                success: false,
            });
            expect(mockOperation).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledWith(
                "Unknown message encountered during operation for test-operation, continuing",
            );
        });

        test("should handle unknown channel errors (code 10003)", async () => {
            // Create a mock operation that fails with unknown channel error
            const mockOperation = jest.fn().mockRejectedValue({
                code: 10003,
                message: "Unknown channel",
            });

            // Call the method
            const result = await discordClient["handleRateLimitedOperation"](mockOperation, "test-operation");

            // Verify the result
            expect(result).toEqual({
                success: false,
            });
            expect(mockOperation).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledWith("Channel/thread test-operation not found, skipping operation");
        });

        test("should retry on rate limit errors", async () => {
            // Create a counter for calls
            let callCount = 0;

            // Mock setTimeout to execute immediately
            jest.spyOn(global, "setTimeout").mockImplementation((callback: any) => {
                callback();
                return {} as any;
            });

            // Create a mock operation that fails with rate limit on first call, succeeds on second
            const mockOperation = jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    // First call: rate limit error
                    return Promise.reject({
                        httpStatus: 429,
                        retryAfter: 0.1, // 100ms
                        message: "Rate limited",
                    });
                } else {
                    // Second call: success
                    return Promise.resolve("success-after-retry");
                }
            });

            // Call the method
            const result = await discordClient["handleRateLimitedOperation"](mockOperation, "rate-limited-operation");

            // Verify the result
            expect(result).toEqual({
                success: true,
                result: "success-after-retry",
            });
            expect(mockOperation).toHaveBeenCalledTimes(2);
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining("Rate limited during operation for rate-limited-operation"),
            );
        });

        test("should retry with exponential backoff on other errors", async () => {
            // Create a counter for calls
            let callCount = 0;

            // Mock setTimeout to execute immediately
            jest.spyOn(global, "setTimeout").mockImplementation((callback: any) => {
                callback();
                return {} as any;
            });

            // Create a mock operation that fails with generic error on first call, succeeds on second
            const mockOperation = jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    // First call: generic error
                    return Promise.reject(new Error("Generic error"));
                } else {
                    // Second call: success
                    return Promise.resolve("success-after-retry");
                }
            });

            // Call the method
            const result = await discordClient["handleRateLimitedOperation"](mockOperation, "generic-error-operation");

            // Verify the result
            expect(result).toEqual({
                success: true,
                result: "success-after-retry",
            });
            expect(mockOperation).toHaveBeenCalledTimes(2);
            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining("Error during operation for generic-error-operation"),
                expect.any(Error),
            );
        });

        test("should give up after max retries", async () => {
            // Mock setTimeout to execute immediately
            jest.spyOn(global, "setTimeout").mockImplementation((callback: any) => {
                callback();
                return {} as any;
            });

            // Create a mock operation that always fails
            const mockOperation = jest.fn().mockRejectedValue(new Error("Persistent error"));

            // Call the method with a low max retries (2)
            const result = await discordClient["handleRateLimitedOperation"](mockOperation, "failing-operation", 2);

            // Verify the result
            expect(result).toEqual({
                success: false,
                result: undefined,
            });
            // Initial call + 1 retry = 2 total calls with maxRetries=2
            expect(mockOperation).toHaveBeenCalledTimes(2);
        });
    });
});
