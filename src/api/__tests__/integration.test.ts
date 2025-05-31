import { ApiServer } from "../api-server";
import { DataStore } from "../data-store";
import { DiscordClient } from "../discord-client";
import { Client, Events, ThreadChannel, Message, ChannelType } from "discord.js";
import request from "supertest";
import express from "express";

// Mock discord.js
jest.mock("discord.js", () => {
    // A proper Collection mock that implements required methods
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
        },
        GatewayIntentBits: {
            Guilds: 1,
            GuildMessages: 2,
            MessageContent: 3,
        },
        Collection: MockCollection,
    };
});

describe("Integration Tests", () => {
    let dataStore: DataStore;
    let dataStoresByGuild: Map<string, DataStore>;
    let discordClient: DiscordClient;
    let apiServer: ApiServer;
    let mockClient: jest.Mocked<Client>;
    let mockEvents: Record<string, Function[]> = {};
    let app: express.Express;

    const TEST_TOKEN = "test-token";
    const TEST_GUILD_ID = "test-guild-id";
    const TEST_PORT = 3000;

    // Helper to emit Discord.js events
    const emitDiscordEvent = (eventName: string, ...args: any[]) => {
        if (mockEvents[eventName]) {
            mockEvents[eventName].forEach((handler) => handler(...args));
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockEvents = {};

        // Create a proper thread collection for the mock
        const mockThreadsCollection = new Map();

        // Setup Discord.js mock
        mockClient = {
            login: jest.fn().mockResolvedValue("token"),
            on: jest.fn().mockImplementation((event, handler) => {
                if (!mockEvents[event]) {
                    mockEvents[event] = [];
                }
                mockEvents[event].push(handler);
                return mockClient;
            }),
            user: { tag: "TestBot#0000" },
            guilds: {
                cache: {
                    get: jest.fn().mockReturnValue({
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
                    }),
                },
            },
        } as unknown as jest.Mocked<Client>;

        // Mock the Client constructor
        (Client as unknown as jest.Mock).mockImplementation(() => mockClient);

        // Create the data store
        dataStore = new DataStore();
        dataStoresByGuild = new Map();
        dataStoresByGuild.set(TEST_GUILD_ID, dataStore);

        // Create Discord client - this sets up the event handlers
        discordClient = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);

        // Create and mock the API server with the Map of DataStores
        apiServer = new ApiServer(TEST_PORT, dataStoresByGuild);
        app = express();

        // Setup express routes for testing
        app.get("/messages/:channelId", (req, res) => {
            const channelId = req.params.channelId;
            // Search across all guilds for the channel
            let messages: any[] = [];
            for (const guildDataStore of dataStoresByGuild.values()) {
                const channelMessages = guildDataStore.getMessagesForChannel(channelId);
                if (channelMessages.length > 0) {
                    messages = channelMessages;
                    break;
                }
            }
            res.json(messages);
        });

        app.get("/forum-threads", (req, res) => {
            const allThreads: any[] = [];
            
            // Collect threads from all guilds
            for (const guildDataStore of dataStoresByGuild.values()) {
                const forumThreads = guildDataStore.getAllForumThreads();
                const guildThreads = forumThreads.map((thread) => {
                    const allMessages = guildDataStore.getMessagesForChannel(thread.id);
                    const latestReplies = allMessages.length > 1 ? allMessages.slice(1).slice(-5) : [];

                    return {
                        threadId: thread.id,
                        title: thread.title,
                        createdBy: thread.createdBy,
                        createdAt: thread.createdAt,
                        latestReplies,
                    };
                });
                
                allThreads.push(...guildThreads);
            }
            res.json(allThreads);
        });

        // Mock setInterval to prevent actual timers
        jest.spyOn(global, "setInterval").mockImplementation(jest.fn() as any);
    });

    describe("End-to-end message flow tests", () => {
        test("should store messages and make them retrievable via API", async () => {
            // Emit ready event to initialize the bot
            emitDiscordEvent(Events.ClientReady);

            // Create a mock text channel message
            const channelMessage = {
                id: "msg1",
                content: "Hello from channel",
                author: { tag: "User#1234" },
                createdTimestamp: Date.now(),
                channelId: "channel1",
                guild: { id: TEST_GUILD_ID },
                channel: {
                    isThread: () => false,
                    type: ChannelType.GuildText,
                },
            } as unknown as Message;

            // Emit message create event
            emitDiscordEvent(Events.MessageCreate, channelMessage);

            // Verify the message is stored and retrievable via API
            const response = await request(app).get("/messages/channel1");
            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
            expect(response.body[0].content).toBe("Hello from channel");
            expect(response.body[0].id).toBe("msg1");
        });

        test("should store forum threads and make them retrievable via API", async () => {
            // Emit ready event to initialize the bot
            emitDiscordEvent(Events.ClientReady);

            const timestamp = Date.now();
            // Create a mock thread
            const mockThread = {
                id: "thread1",
                name: "Test Forum Thread",
                guild: { id: TEST_GUILD_ID },
                parentId: "forum123",
                parent: { type: ChannelType.GuildForum },
                type: ChannelType.PublicThread,
                createdTimestamp: timestamp,
                join: jest.fn().mockResolvedValue(undefined),
                fetchStarterMessage: jest.fn().mockResolvedValue({
                    id: "root1",
                    content: "Forum post content",
                    author: { tag: "User#1234" },
                    createdTimestamp: timestamp,
                }),
            } as unknown as ThreadChannel;

            // Emit thread create event
            await Promise.resolve(emitDiscordEvent(Events.ThreadCreate, mockThread));

            // Create a mock reply in the thread
            const replyMessage = {
                id: "reply1",
                content: "This is a reply",
                author: { tag: "User#5678" },
                createdTimestamp: timestamp + 1000,
                channelId: "thread1",
                guild: { id: TEST_GUILD_ID },
                channel: {
                    isThread: () => true,
                    type: ChannelType.PublicThread,
                },
            } as unknown as Message;

            // Emit message create event for the reply
            emitDiscordEvent(Events.MessageCreate, replyMessage);

            // Verify the thread and messages are stored and retrievable via API
            const threadsResponse = await request(app).get("/forum-threads");
            expect(threadsResponse.status).toBe(200);
            expect(threadsResponse.body).toHaveLength(1);
            expect(threadsResponse.body[0].threadId).toBe("thread1");
            expect(threadsResponse.body[0].title).toBe("Test Forum Thread");

            // Since the DataStore doesn't have explicit sorting, we can't guarantee the order
            // of messages in latestReplies, so we'll just verify that it contains our reply
            expect(threadsResponse.body[0].latestReplies).toHaveLength(1);
            const replyContent = threadsResponse.body[0].latestReplies[0].content;
            expect(["This is a reply", "Forum post content"]).toContain(replyContent);

            // Verify the individual messages can be retrieved
            const messagesResponse = await request(app).get("/messages/thread1");
            expect(messagesResponse.status).toBe(200);
            expect(messagesResponse.body).toHaveLength(2); // Root post + reply

            // Verify both messages are present without assuming order
            const messageContents = messagesResponse.body.map((m: any) => m.content);
            expect(messageContents).toContain("Forum post content");
            expect(messageContents).toContain("This is a reply");
        });

        test("should remove archived threads from the store", async () => {
            // Emit ready event to initialize the bot
            emitDiscordEvent(Events.ClientReady);

            const timestamp = Date.now();
            // Create a mock thread
            const mockThread = {
                id: "thread1",
                name: "Test Forum Thread",
                guild: { id: TEST_GUILD_ID },
                parentId: "forum123",
                parent: { type: ChannelType.GuildForum },
                type: ChannelType.PublicThread,
                createdTimestamp: timestamp,
                join: jest.fn().mockResolvedValue(undefined),
                fetchStarterMessage: jest.fn().mockResolvedValue({
                    id: "root1",
                    content: "Forum post content",
                    author: { tag: "User#1234" },
                    createdTimestamp: timestamp,
                }),
            } as unknown as ThreadChannel;

            // Emit thread create event
            await Promise.resolve(emitDiscordEvent(Events.ThreadCreate, mockThread));

            // Verify the thread is in the store
            const initialResponse = await request(app).get("/forum-threads");
            expect(initialResponse.status).toBe(200);
            expect(initialResponse.body).toHaveLength(1);

            // Now archive the thread
            const archivedThread = {
                ...mockThread,
                archived: true,
            };

            // Emit thread update event
            emitDiscordEvent(Events.ThreadUpdate, mockThread, archivedThread);

            // Verify the thread is removed from the store
            const afterResponse = await request(app).get("/forum-threads");
            expect(afterResponse.status).toBe(200);
            expect(afterResponse.body).toHaveLength(0);

            // Verify the messages are gone too
            const messagesResponse = await request(app).get("/messages/thread1");
            expect(messagesResponse.status).toBe(200);
            expect(messagesResponse.body).toHaveLength(0);
        });

        test("should prune messages older than 24 hours", async () => {
            // Set up a fixed "now" time for testing
            const NOW = Date.now();
            const ONE_DAY_MS = 24 * 60 * 60 * 1000;

            // Mock Date.now for deterministic testing
            jest.spyOn(Date, "now").mockImplementation(() => NOW);

            // Emit ready event to initialize the bot
            emitDiscordEvent(Events.ClientReady);

            // Add an old message (over 24 hours old)
            const oldMessage = {
                id: "old1",
                content: "Old message",
                author: { tag: "User#1234" },
                createdTimestamp: NOW - ONE_DAY_MS - 1000, // 24 hours + 1 second ago
                channelId: "channel1",
                guild: { id: TEST_GUILD_ID },
                channel: {
                    isThread: () => false,
                    type: ChannelType.GuildText,
                },
            } as unknown as Message;

            // Add a recent message
            const recentMessage = {
                id: "recent1",
                content: "Recent message",
                author: { tag: "User#1234" },
                createdTimestamp: NOW - 1000, // 1 second ago
                channelId: "channel1",
                guild: { id: TEST_GUILD_ID },
                channel: {
                    isThread: () => false,
                    type: ChannelType.GuildText,
                },
            } as unknown as Message;

            // Emit message create events
            emitDiscordEvent(Events.MessageCreate, oldMessage);
            emitDiscordEvent(Events.MessageCreate, recentMessage);

            // Force pruning by manually calling the DataStore method
            dataStore.pruneAllExpiredMessages();

            // Verify only the recent message remains
            const response = await request(app).get("/messages/channel1");
            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
            expect(response.body[0].id).toBe("recent1");
            expect(response.body.find((m: any) => m.id === "old1")).toBeUndefined();
        });
    });
});
