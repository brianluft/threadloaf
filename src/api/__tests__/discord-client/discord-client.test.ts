import { createMockThreadChannel, TEST_TOKEN, TEST_GUILD_ID } from "./discord.mocks";
import { DiscordClient } from "../../discord-client";
import { DataStore } from "../../data-store";
import { Client, Events, ChannelType, Collection, Guild, AnyThreadChannel } from "discord.js";

// Mock DataStore
jest.mock("../../data-store");

describe("DiscordClient", () => {
    let discordClient: DiscordClient;
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
        discordClient = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);
    });

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

        test("should handle text channel backfill in performBackfill", async () => {
            // Spy on backfillChannelMessages to test if it's called
            const mockBackfillChannelMessages = jest.fn().mockResolvedValue(undefined);

            // Mock textBased and thread checks
            const mockTextChannel = {
                id: "text-channel-id",
                type: ChannelType.GuildText,
                isTextBased: jest.fn().mockReturnValue(true),
                isThread: jest.fn().mockReturnValue(false),
            };

            // Create mock channels
            const mockChannels = new Collection<string, any>();
            mockChannels.set(mockTextChannel.id, mockTextChannel);

            // Create a mock guild with our channels
            const mockGuild = {
                id: TEST_GUILD_ID,
                name: "Test Guild",
                channels: {
                    cache: mockChannels,
                    fetchActiveThreads: jest.fn().mockResolvedValue({ threads: new Collection() }),
                },
            } as unknown as Guild;

            // Use the DiscordClient constructor to get a fresh instance
            const client = new Client({ intents: [] }) as jest.Mocked<Client>;
            client.on = jest.fn();
            client.login = jest.fn().mockResolvedValue("token");

            // Spy on Client constructor to inject our mock
            jest.spyOn(require("discord.js"), "Client").mockReturnValue(client);

            // Create a new DiscordClient instance
            const testClient = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);

            // Mock the backfillChannelMessages method
            (testClient as any).backfillChannelMessages = mockBackfillChannelMessages;

            // Access the private method using type assertion
            const performBackfill = (testClient as any).performBackfill.bind(testClient);

            // Call the method directly
            await performBackfill(mockGuild);

            // Verify backfillChannelMessages was called with the text channel ID
            expect(mockBackfillChannelMessages).toHaveBeenCalledWith(mockTextChannel.id);
        });

        test("should skip forum channels for direct message backfill", async () => {
            // Spy on backfillChannelMessages to test if it's called
            const mockBackfillChannelMessages = jest.fn().mockResolvedValue(undefined);

            // Mock forum channel
            const mockForumChannel = {
                id: "forum-channel-id",
                type: ChannelType.GuildForum,
                isTextBased: jest.fn().mockReturnValue(true),
                isThread: jest.fn().mockReturnValue(false),
            };

            // Create mock channels
            const mockChannels = new Collection<string, any>();
            mockChannels.set(mockForumChannel.id, mockForumChannel);

            // Create a mock guild with our channels
            const mockGuild = {
                id: TEST_GUILD_ID,
                name: "Test Guild",
                channels: {
                    cache: mockChannels,
                    fetchActiveThreads: jest.fn().mockResolvedValue({ threads: new Collection() }),
                },
            } as unknown as Guild;

            // Use the DiscordClient constructor to get a fresh instance
            const client = new Client({ intents: [] }) as jest.Mocked<Client>;
            client.on = jest.fn();
            client.login = jest.fn().mockResolvedValue("token");

            // Spy on Client constructor to inject our mock
            jest.spyOn(require("discord.js"), "Client").mockReturnValue(client);

            // Create a new DiscordClient instance
            const testClient = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);

            // Mock the backfillChannelMessages method
            (testClient as any).backfillChannelMessages = mockBackfillChannelMessages;

            // Access the private method using type assertion
            const performBackfill = (testClient as any).performBackfill.bind(testClient);

            // Call the method directly
            await performBackfill(mockGuild);

            // Verify backfillChannelMessages was NOT called with the forum channel ID
            expect(mockBackfillChannelMessages).not.toHaveBeenCalledWith(mockForumChannel.id);
        });
    });

    describe("handleRateLimitedOperation", () => {
        // Create a method to access the private handleRateLimitedOperation method
        let handleRateLimitedOperation: any;

        beforeEach(() => {
            // Access the private method using type casting
            handleRateLimitedOperation = (discordClient as any).handleRateLimitedOperation.bind(discordClient);

            // Mock setTimeout to execute immediately
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test("should handle unknown message error (code 10008)", async () => {
            // Create a mock operation that throws an error with code 10008
            const mockOperation = jest.fn().mockRejectedValue({
                code: 10008,
                message: "Unknown Message",
            });

            // Use the private method directly
            const result = await handleRateLimitedOperation(mockOperation, "test-operation");

            // Verify the warning was logged
            expect(console.warn).toHaveBeenCalledWith(
                "Unknown message encountered during operation for test-operation, continuing",
            );

            // Verify the operation was attempted exactly once (no retries for this error)
            expect(mockOperation).toHaveBeenCalledTimes(1);

            // Verify the operation returned false without retrying
            expect(result).toEqual({ success: false });
        });

        test("should handle unknown channel error (code 10003)", async () => {
            // Create a mock operation that throws an error with code 10003
            const mockOperation = jest.fn().mockRejectedValue({
                code: 10003,
                message: "Unknown Channel",
            });

            // Use the private method directly
            const result = await handleRateLimitedOperation(mockOperation, "test-operation");

            // Verify the warning was logged
            expect(console.warn).toHaveBeenCalledWith("Channel/thread test-operation not found, skipping operation");

            // Verify the operation was attempted exactly once (no retries for this error)
            expect(mockOperation).toHaveBeenCalledTimes(1);

            // Verify the operation returned false without retrying
            expect(result).toEqual({ success: false });
        });

        test("should handle generic errors with exponential backoff", async () => {
            // Spy on console.error and console.warn
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
            const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

            // Use fake timers instead of mocking setTimeout directly
            jest.useFakeTimers();

            // Create a new instance to test private method
            const client = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);

            // Create specific error message to check error handling
            const specificError = new Error("Generic operation error");

            // Create an operation that fails with a generic error
            const failingOperation = jest.fn().mockRejectedValue(specificError);

            // Start the operation but don't await yet
            const resultPromise = (client as any).handleRateLimitedOperation(
                failingOperation,
                "test-op",
                2, // max retries
            );

            // Advance timers for each retry (initial attempt + 2 retries)
            for (let i = 0; i < 3; i++) {
                await Promise.resolve(); // Let the current execution complete
                jest.runAllTimers(); // Run the timer for the backoff
            }

            // Now get the final result
            const result = await resultPromise;

            // Verify the operation was called the expected number of times (initial + retries)
            // With maxRetries=2, we expect 3 total calls (initial + 2 retries)
            expect(failingOperation).toHaveBeenCalledTimes(2);

            // Specifically testing line 393 - the error handling and logging for non-Discord errors
            expect(consoleErrorSpy).toHaveBeenCalledWith("Error during operation for test-op:", specificError);

            // Also checking line 394 - the backoff warning
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringMatching(/Retrying in \d+ms \(attempt 1\/2\)/));

            // Verify we logged the final failure
            expect(consoleErrorSpy).toHaveBeenCalledWith("Failed operation for test-op after 2 attempts");

            // Verify the operation failed
            expect(result).toEqual({ success: false });

            // Clean up
            consoleErrorSpy.mockRestore();
            consoleWarnSpy.mockRestore();
            jest.useRealTimers();
        });
    });

    describe("backfillChannelMessages", () => {
        test("should backfill messages from a channel within last 24 hours", async () => {
            // Create mock messages that are within 24 hours
            const now = Date.now();
            const mockMessages = new Collection();
            const mockChannel = {
                id: "test-channel-id",
                isTextBased: () => true,
                messages: {
                    fetch: jest.fn().mockResolvedValue(mockMessages),
                },
            };

            // Add some test messages within last 24 hours
            mockMessages.set("msg1", {
                id: "msg1",
                content: "Test message 1",
                author: { tag: "User1#1234" },
                createdTimestamp: now - 1000 * 60 * 60, // 1 hour ago
            });
            mockMessages.set("msg2", {
                id: "msg2",
                content: "Test message 2",
                author: { tag: "User2#5678" },
                createdTimestamp: now - 1000 * 60 * 60 * 2, // 2 hours ago
            });

            // Mock the client's channels cache
            mockClient.channels = {
                cache: new Collection([["test-channel-id", mockChannel]]),
            } as any;

            // Call the private method using any type assertion
            await (discordClient as any).backfillChannelMessages("test-channel-id");

            // Verify that messages were fetched
            expect(mockChannel.messages.fetch).toHaveBeenCalledWith({ limit: 100 });

            // Verify that messages were stored
            expect(dataStore.addMessage).toHaveBeenCalledWith("test-channel-id", {
                id: "msg1",
                content: "Test message 1",
                authorTag: "User1#1234",
                timestamp: expect.any(Number),
            });
            expect(dataStore.addMessage).toHaveBeenCalledWith("test-channel-id", {
                id: "msg2",
                content: "Test message 2",
                authorTag: "User2#5678",
                timestamp: expect.any(Number),
            });
        });

        test("should handle rate limits during backfill", async () => {
            const mockChannel = {
                id: "test-channel-id",
                isTextBased: () => true,
                messages: {
                    fetch: jest
                        .fn()
                        .mockRejectedValueOnce({ httpStatus: 429, retryAfter: 0.1 })
                        .mockResolvedValueOnce(new Collection()),
                },
            };

            // Mock the client's channels cache
            mockClient.channels = {
                cache: new Collection([["test-channel-id", mockChannel]]),
            } as any;

            // Create spy for console.warn
            const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

            // Call the private method
            await (discordClient as any).backfillChannelMessages("test-channel-id");

            // Verify rate limit handling
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining("Rate limited during operation for channel:test-channel-id"),
            );
            expect(mockChannel.messages.fetch).toHaveBeenCalledTimes(2);

            warnSpy.mockRestore();
        });

        test("should stop backfill when reaching old messages", async () => {
            const now = Date.now();
            const oneDayAgo = now - 24 * 60 * 60 * 1000;

            // First batch: mix of recent and old messages
            const firstBatch = new Collection();
            firstBatch.set("msg1", {
                id: "msg1",
                content: "Recent message",
                author: { tag: "User1#1234" },
                createdTimestamp: now - 1000 * 60 * 60, // 1 hour ago
            });
            firstBatch.set("msg2", {
                id: "msg2",
                content: "Old message",
                author: { tag: "User2#5678" },
                createdTimestamp: oneDayAgo - 1000, // Just over 24 hours ago
            });

            // Second batch: only old messages
            const secondBatch = new Collection();
            secondBatch.set("msg3", {
                id: "msg3",
                content: "Very old message",
                author: { tag: "User3#9012" },
                createdTimestamp: oneDayAgo - 1000 * 60 * 60, // 25 hours ago
            });

            const mockChannel = {
                id: "test-channel-id",
                isTextBased: () => true,
                messages: {
                    fetch: jest.fn().mockResolvedValueOnce(firstBatch).mockResolvedValueOnce(secondBatch),
                },
            };

            // Mock the client's channels cache
            mockClient.channels = {
                cache: new Collection([["test-channel-id", mockChannel]]),
            } as any;

            // Create spy for console.log
            const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

            // Call the private method
            await (discordClient as any).backfillChannelMessages("test-channel-id");

            // Verify that only the recent message was stored
            expect(dataStore.addMessage).toHaveBeenCalledTimes(1);
            expect(dataStore.addMessage).toHaveBeenCalledWith("test-channel-id", {
                id: "msg1",
                content: "Recent message",
                authorTag: "User1#1234",
                timestamp: expect.any(Number),
            });

            // Verify that backfill completion was logged
            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining("Backfill complete for channel test-channel-id: fetched 1 messages"),
            );

            logSpy.mockRestore();
        });

        test("should handle empty message fetch results", async () => {
            const mockChannel = {
                id: "test-channel-id",
                isTextBased: () => true,
                messages: {
                    fetch: jest.fn().mockResolvedValue(new Collection()),
                },
            };

            // Mock the client's channels cache
            mockClient.channels = {
                cache: new Collection([["test-channel-id", mockChannel]]),
            } as any;

            // Create spy for console.log
            const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

            // Call the private method
            await (discordClient as any).backfillChannelMessages("test-channel-id");

            // Verify that fetch was called once
            expect(mockChannel.messages.fetch).toHaveBeenCalledTimes(1);

            // Verify that no messages were stored
            expect(dataStore.addMessage).not.toHaveBeenCalled();

            // Verify that backfill completion was logged
            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining("Backfill complete for channel test-channel-id: fetched 0 messages"),
            );

            logSpy.mockRestore();
        });

        test("backfillChannelMessages should handle non-text channels", async () => {
            // Spy on console.error
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            // Create a new client instance for this test
            const client = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);

            // Mock client.channels.cache.get to return non-text channel
            (client as any).client.channels = {
                cache: {
                    get: jest.fn().mockReturnValue({
                        isTextBased: () => false,
                        id: "non-text-channel",
                    }),
                },
            };

            // Call the private method directly
            await (client as any).backfillChannelMessages("non-text-channel");

            // Verify error was logged with the correct message
            expect(consoleErrorSpy).toHaveBeenCalledWith("Channel non-text-channel not found or not a text channel");

            // Clean up
            consoleErrorSpy.mockRestore();
        });

        test("backfillChannelMessages should handle channel not found", async () => {
            // Spy on console.error
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            // Create a new client instance for this test
            const client = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);

            // Mock client.channels.cache.get to return null (channel not found)
            (client as any).client.channels = {
                cache: {
                    get: jest.fn().mockReturnValue(null),
                },
            };

            // Call the private method directly
            await (client as any).backfillChannelMessages("nonexistent-channel");

            // Verify error was logged with the correct message
            expect(consoleErrorSpy).toHaveBeenCalledWith("Channel nonexistent-channel not found or not a text channel");

            // Clean up
            consoleErrorSpy.mockRestore();
        });
    });

    describe("rate limit handling", () => {
        beforeEach(() => {
            // Mock console methods to avoid noise in test output
            jest.spyOn(console, "warn").mockImplementation(() => {});
            jest.spyOn(console, "error").mockImplementation(() => {});
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        test("should handle rate limits and retry successfully", async () => {
            // Create a mock operation that fails with rate limit first, then succeeds
            let attempts = 0;
            const mockOperation = jest.fn().mockImplementation(async () => {
                attempts++;
                if (attempts === 1) {
                    // First attempt: throw rate limit error
                    const error: any = new Error("Rate limit exceeded");
                    error.httpStatus = 429;
                    error.retryAfter = 0.1; // 100ms
                    throw error;
                }
                // Second attempt: succeed
                return "success";
            });

            // Create a new client instance
            const client = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);

            // Access the private method using type assertion
            const result = await (client as any).handleRateLimitedOperation(mockOperation, "test-operation");

            expect(result).toEqual({ success: true, result: "success" });
            expect(mockOperation).toHaveBeenCalledTimes(2);
        });

        test("should handle unknown message error", async () => {
            const mockOperation = jest.fn().mockImplementation(() => {
                const error: any = new Error("Unknown Message");
                error.code = 10008;
                throw error;
            });

            const client = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);
            const result = await (client as any).handleRateLimitedOperation(mockOperation, "test-operation");

            expect(result).toEqual({ success: false });
            expect(mockOperation).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledWith(
                "Unknown message encountered during operation for test-operation, continuing",
            );
        });

        test("should handle unknown channel error", async () => {
            const mockOperation = jest.fn().mockImplementation(() => {
                const error: any = new Error("Unknown Channel");
                error.code = 10003;
                throw error;
            });

            const client = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);
            const result = await (client as any).handleRateLimitedOperation(mockOperation, "test-operation");

            expect(result).toEqual({ success: false });
            expect(mockOperation).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining("Channel/thread test-operation not found"),
            );
        });

        test("should handle other errors with exponential backoff", async () => {
            jest.useFakeTimers();

            let attempts = 0;
            const mockOperation = jest.fn().mockImplementation(() => {
                attempts++;
                const error = new Error("Generic error");
                throw error;
            });

            const client = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);
            const operationPromise = (client as any).handleRateLimitedOperation(
                mockOperation,
                "test-operation",
                2, // maxRetries
            );

            // Use jest.runOnlyPendingTimers() instead of manual time advancement
            await jest.runAllTimersAsync();

            const result = await operationPromise;

            expect(result).toEqual({ success: false });
            expect(mockOperation).toHaveBeenCalledTimes(2); // Initial attempt + 1 retry with maxRetries=2
            expect(console.error).toHaveBeenCalledWith("Error during operation for test-operation:", expect.any(Error));
            expect(console.error).toHaveBeenCalledWith("Failed operation for test-operation after 2 attempts");
            expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/Retrying in \d+ms \(attempt 1\/2\)/));

            jest.useRealTimers();
        }, 10000); // Increase timeout to 10 seconds
    });

    describe("rate limit handling", () => {
        test("should handle rate limits and retry during backfill", async () => {
            // Mock setTimeout to avoid actual delays
            const originalSetTimeout = global.setTimeout;
            global.setTimeout = jest.fn().mockImplementation((fn) => fn()) as any;

            try {
                // Create a mock channel with rate limited message fetching
                const mockChannel = {
                    id: "channel1",
                    type: ChannelType.GuildText,
                    isTextBased: () => true,
                    isThread: () => false,
                    messages: {
                        fetch: jest.fn().mockImplementation(async () => {
                            const error: any = new Error("Rate limit exceeded");
                            error.httpStatus = 429;
                            error.retryAfter = 0.1; // 100ms delay
                            throw error;
                        }),
                    },
                };

                // Create a mock guild
                const mockGuild = {
                    id: TEST_GUILD_ID,
                    name: "Test Guild",
                    channels: {
                        cache: new Collection([["channel1", mockChannel]]),
                        fetchActiveThreads: jest.fn().mockResolvedValue({ threads: new Collection() }),
                    },
                };

                // Set up the mock client's caches
                (mockClient.guilds.cache.get as jest.Mock).mockReturnValue(mockGuild);
                (mockClient.channels.cache.get as jest.Mock).mockReturnValue(mockChannel);

                // Get the ready handler directly from the mock client
                const readyHandler = mockClient.on.mock.calls.find((call) => call[0] === Events.ClientReady)?.[1];

                if (!readyHandler) {
                    throw new Error("Ready handler not found");
                }

                // Call the handler directly
                await readyHandler();

                // Verify that fetch was called multiple times due to retries
                expect(mockChannel.messages.fetch).toHaveBeenCalled();

                // Verify that setTimeout was called with the retry delay
                expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 100);
            } finally {
                // Restore setTimeout
                global.setTimeout = originalSetTimeout;
            }
        });
    });
});
