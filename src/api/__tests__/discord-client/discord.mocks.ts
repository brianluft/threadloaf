import { ChannelType, ThreadChannel } from "discord.js";

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

export const TEST_TOKEN = "test-token";
export const TEST_GUILD_ID = "test-guild-id";

// Helper function to create mock ThreadChannel
export function createMockThreadChannel(
    options: {
        threadId?: string;
        guildId?: string;
        archived?: boolean;
        parentId?: string;
        threadType?: number;
        parentType?: number;
    } = {},
): ThreadChannel {
    const threadId = options.threadId || "test-thread-id";
    const guildId = options.guildId || TEST_GUILD_ID;
    const archived = options.archived !== undefined ? options.archived : false;
    const parentId = options.parentId || "parent-channel-id";
    const threadType = options.threadType || ChannelType.PublicThread;
    const parentType = options.parentType || ChannelType.GuildForum;

    return {
        id: threadId,
        guild: { id: guildId },
        archived: archived,
        parentId: parentId,
        name: "Test Thread",
        parent: {
            type: parentType,
        },
        type: threadType,
        join: jest.fn().mockResolvedValue(undefined),
        fetchStarterMessage: jest.fn().mockResolvedValue({
            author: { tag: "Thread Starter#1234" },
            content: "Thread starter message",
        }),
    } as unknown as ThreadChannel;
}
