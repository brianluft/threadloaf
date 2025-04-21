import { TEST_TOKEN, TEST_GUILD_ID } from "./discord.mocks";
import { DiscordClient } from "../../discord-client";
import { DataStore } from "../../data-store";
import { Client, Events, ChannelType, Collection, Guild } from "discord.js";

// Mock DataStore
jest.mock("../../data-store");

describe("DiscordClient Backfill", () => {
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

        // Initialize mockClient.channels and guilds to prevent undefined errors
        mockClient.channels = {
            cache: {
                get: jest.fn(),
            },
        } as any;

        mockClient.guilds = {
            cache: {
                get: jest.fn(),
            },
        } as any;

        // Spy on Client constructor to inject our mock
        jest.spyOn(require("discord.js"), "Client").mockImplementation(() => mockClient);

        // Create the DiscordClient instance
        discordClient = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);
    });

    afterEach(() => {
        // Make sure timers are restored
        jest.useRealTimers();

        // Restore any mocked globals
        jest.restoreAllMocks();
    });

    describe("handleReady and backfill", () => {
        let originalSetInterval: typeof global.setInterval;

        beforeEach(() => {
            // Save the original setInterval and create a fresh mock for each test
            originalSetInterval = global.setInterval;
            global.setInterval = jest.fn();
        });

        afterEach(() => {
            // Restore the original setInterval after each test
            global.setInterval = originalSetInterval;
        });

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

            // Call the ready handler directly
            await clientOnHandlers[Events.ClientReady]();

            // Should attempt to get the guild
            expect(mockClient.guilds.cache.get).toHaveBeenCalledWith(TEST_GUILD_ID);

            // Should have attempted to fetch active threads
            expect(mockGuild.channels.fetchActiveThreads).toHaveBeenCalled();

            // Should have set up pruning interval
            expect(global.setInterval).toHaveBeenCalled();
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
            expect(global.setInterval).not.toHaveBeenCalled();

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
});
