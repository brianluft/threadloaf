import { DiscordClient } from "../../discord-client";
import { DataStore, StoredMessage } from "../../data-store";
import { Client, ChannelType, Collection, AnyThreadChannel } from "discord.js";
import { TEST_TOKEN, TEST_GUILD_ID } from "./discord.mocks";

// Mock discord.js Client to prevent real connections
jest.mock("discord.js", () => {
    const actual = jest.requireActual("discord.js");
    const mockClient = {
        on: jest.fn().mockReturnThis(),
        login: jest.fn().mockResolvedValue(undefined),
    };
    return {
        ...actual,
        Client: jest.fn(() => mockClient),
    };
});

describe("processActiveThreads error branch", () => {
    let discordClient: any;
    let consoleWarnSpy: jest.SpyInstance;
    const THREAD_ID = "thread1";

    beforeEach(() => {
        jest.clearAllMocks();
        discordClient = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, new DataStore());
        consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
    });

    test("should stop backfill when messages fetch fails", async () => {
        const mockThread = {
            guild: { id: TEST_GUILD_ID },
            type: ChannelType.PublicThread,
            join: jest.fn().mockResolvedValue(undefined),
            parent: undefined,
            id: THREAD_ID,
        } as unknown as AnyThreadChannel;

        // Stub handleRateLimitedOperation to simulate failure
        (discordClient as any).handleRateLimitedOperation = jest.fn().mockResolvedValue({ success: false });

        // Prepare thread collection
        const threadCollection = new Collection<string, AnyThreadChannel>();
        threadCollection.set(THREAD_ID, mockThread);

        // Call the private method directly
        await (discordClient as any).processActiveThreads(threadCollection);

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            `Could not fetch messages for thread ${THREAD_ID}, stopping backfill`,
        );
    });
});

const mockMessage = (id: string, timestamp: number, content: string = "content"): any => ({
    id,
    content,
    author: { tag: "author#1234" },
    createdTimestamp: timestamp,
});

describe("processActiveThreads successful backfill", () => {
    let discordClient: any;
    let dataStore: DataStore;
    let mockHandleRateLimitedOperation: jest.Mock;
    const THREAD_ID = "thread-success";
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    beforeEach(() => {
        jest.clearAllMocks();
        dataStore = new DataStore();
        jest.spyOn(dataStore, "addMessage");
        discordClient = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);
        mockHandleRateLimitedOperation = jest.fn();
        (discordClient as any).handleRateLimitedOperation = mockHandleRateLimitedOperation;

        // Mock console.log to suppress output during tests
        jest.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        (console.log as jest.Mock).mockRestore();
    });

    const createMockThread = (threadId: string): AnyThreadChannel =>
        ({
            guild: { id: TEST_GUILD_ID },
            type: ChannelType.PublicThread,
            join: jest.fn().mockResolvedValue(undefined),
            parent: undefined,
            id: threadId,
            messages: {
                // Mock the messages manager directly
                fetch: jest.fn(), // This won't be called directly, handleRateLimitedOperation is mocked
            },
        }) as unknown as AnyThreadChannel;

    test("should backfill messages from a single batch", async () => {
        const mockThread = createMockThread(THREAD_ID);
        const messages = new Collection<string, any>();
        const msg1 = mockMessage("msg1", now - 1000);
        const msg2 = mockMessage("msg2", now - 2000);
        messages.set(msg1.id, msg1);
        messages.set(msg2.id, msg2);

        mockHandleRateLimitedOperation.mockResolvedValueOnce({ success: true, result: messages });

        const threadCollection = new Collection<string, AnyThreadChannel>();
        threadCollection.set(THREAD_ID, mockThread);

        await (discordClient as any).processActiveThreads(threadCollection);

        expect(mockHandleRateLimitedOperation).toHaveBeenCalledTimes(1);
        expect(mockHandleRateLimitedOperation).toHaveBeenCalledWith(
            expect.any(Function), // The actual fetch function
            `thread:${THREAD_ID}`,
        );
        // Check the fetch options passed within the function closure
        const fetchCall = mockHandleRateLimitedOperation.mock.calls[0][0];
        const mockFetch = jest.fn();
        (mockThread.messages as any).fetch = mockFetch; // Temporarily assign mock to check options
        await fetchCall(); // Execute the function passed to handleRateLimitedOperation
        expect(mockFetch).toHaveBeenCalledWith({ limit: 100 }); // No 'before' option

        expect(dataStore.addMessage).toHaveBeenCalledTimes(2);
        expect(dataStore.addMessage).toHaveBeenCalledWith(THREAD_ID, expect.objectContaining({ id: msg1.id }));
        expect(dataStore.addMessage).toHaveBeenCalledWith(THREAD_ID, expect.objectContaining({ id: msg2.id }));
    });

    test("should backfill messages from multiple batches", async () => {
        const mockThread = createMockThread(THREAD_ID);
        const batch1 = new Collection<string, any>();
        for (let i = 0; i < 100; i++) {
            const msg = mockMessage(`msg_batch1_${i}`, now - i * 1000);
            batch1.set(msg.id, msg);
        }
        const oldestBatch1MsgId = batch1.last()!.id;

        const batch2 = new Collection<string, any>();
        const finalMsg = mockMessage("msg_batch2_0", now - 101 * 1000);
        batch2.set(finalMsg.id, finalMsg);

        // First call returns 100 messages
        mockHandleRateLimitedOperation.mockResolvedValueOnce({ success: true, result: batch1 });
        // Second call returns 1 message
        mockHandleRateLimitedOperation.mockResolvedValueOnce({ success: true, result: batch2 });

        const threadCollection = new Collection<string, AnyThreadChannel>();
        threadCollection.set(THREAD_ID, mockThread);

        await (discordClient as any).processActiveThreads(threadCollection);

        expect(mockHandleRateLimitedOperation).toHaveBeenCalledTimes(2);

        // Check first call options
        const fetchCall1 = mockHandleRateLimitedOperation.mock.calls[0][0];
        const mockFetch1 = jest.fn();
        (mockThread.messages as any).fetch = mockFetch1;
        await fetchCall1();
        expect(mockFetch1).toHaveBeenCalledWith({ limit: 100 }); // No 'before'

        // Check second call options (covers line 282)
        const fetchCall2 = mockHandleRateLimitedOperation.mock.calls[1][0];
        const mockFetch2 = jest.fn();
        (mockThread.messages as any).fetch = mockFetch2;
        await fetchCall2();
        expect(mockFetch2).toHaveBeenCalledWith({ limit: 100, before: oldestBatch1MsgId }); // 'before' option set

        expect(dataStore.addMessage).toHaveBeenCalledTimes(101);
        expect(dataStore.addMessage).toHaveBeenCalledWith(
            THREAD_ID,
            expect.objectContaining({ id: batch1.first()!.id }),
        );
        expect(dataStore.addMessage).toHaveBeenCalledWith(THREAD_ID, expect.objectContaining({ id: finalMsg.id }));
    });

    test("should stop backfill if only old messages are found", async () => {
        const mockThread = createMockThread(THREAD_ID);
        const messages = new Collection<string, any>();
        const oldMsg = mockMessage("oldMsg", oneDayAgo - 1000); // Older than 24h
        messages.set(oldMsg.id, oldMsg);

        mockHandleRateLimitedOperation.mockResolvedValueOnce({ success: true, result: messages });

        const threadCollection = new Collection<string, AnyThreadChannel>();
        threadCollection.set(THREAD_ID, mockThread);

        await (discordClient as any).processActiveThreads(threadCollection);

        expect(mockHandleRateLimitedOperation).toHaveBeenCalledTimes(1);
        expect(dataStore.addMessage).not.toHaveBeenCalled();
    });

    test("should stop backfill if no messages are found", async () => {
        const mockThread = createMockThread(THREAD_ID);
        const messages = new Collection<string, any>(); // Empty collection

        mockHandleRateLimitedOperation.mockResolvedValueOnce({ success: true, result: messages });

        const threadCollection = new Collection<string, AnyThreadChannel>();
        threadCollection.set(THREAD_ID, mockThread);

        await (discordClient as any).processActiveThreads(threadCollection);

        expect(mockHandleRateLimitedOperation).toHaveBeenCalledTimes(1);
        expect(dataStore.addMessage).not.toHaveBeenCalled();
    });

    test("should skip threads not in the specified guild", async () => {
        const mockThread = createMockThread(THREAD_ID);
        mockThread.guild.id = "other-guild"; // Different guild ID

        const threadCollection = new Collection<string, AnyThreadChannel>();
        threadCollection.set(THREAD_ID, mockThread);

        await (discordClient as any).processActiveThreads(threadCollection);

        expect(mockHandleRateLimitedOperation).not.toHaveBeenCalled();
        expect(dataStore.addMessage).not.toHaveBeenCalled();
    });

    test("should skip non-thread channels", async () => {
        const mockChannel = {
            // Not a thread
            guild: { id: TEST_GUILD_ID },
            type: ChannelType.GuildText, // Text channel, not thread
            id: "text-channel-1",
        } as unknown as AnyThreadChannel; // Cast for collection type

        const threadCollection = new Collection<string, AnyThreadChannel>();
        threadCollection.set(mockChannel.id, mockChannel);

        await (discordClient as any).processActiveThreads(threadCollection);

        expect(mockHandleRateLimitedOperation).not.toHaveBeenCalled();
    });

    test("should handle errors during thread processing gracefully", async () => {
        const mockThread = createMockThread(THREAD_ID);
        const error = new Error("Test join error");
        mockThread.join = jest.fn().mockRejectedValue(error); // Simulate error on join

        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const threadCollection = new Collection<string, AnyThreadChannel>();
        threadCollection.set(THREAD_ID, mockThread);

        await (discordClient as any).processActiveThreads(threadCollection);

        expect(mockHandleRateLimitedOperation).not.toHaveBeenCalled(); // Should not attempt fetch if join fails
        expect(consoleErrorSpy).toHaveBeenCalledWith(`Error processing thread ${THREAD_ID}:`, error);

        consoleErrorSpy.mockRestore();
    });
});
