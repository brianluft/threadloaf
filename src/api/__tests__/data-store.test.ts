import { DataStore, StoredMessage, ThreadMeta } from "../data-store";

describe("DataStore", () => {
    let dataStore: DataStore;
    const NOW = 1693000000000; // Fixed timestamp for testing
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    beforeEach(() => {
        dataStore = new DataStore();
        // Mock Date.now() to return a fixed timestamp for predictable testing
        jest.spyOn(global.Date, "now").mockImplementation(() => NOW);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("message storage", () => {
        test("should add and retrieve messages", () => {
            const channelId = "channel123";
            const message: StoredMessage = {
                id: "msg1",
                content: "Hello world",
                authorTag: "User#1234",
                timestamp: NOW - 3600000, // 1 hour ago
            };

            dataStore.addMessage(channelId, message);
            const messages = dataStore.getMessagesForChannel(channelId);

            expect(messages).toHaveLength(1);
            expect(messages[0]).toEqual(message);
        });

        test("should return empty array for unknown channel", () => {
            const messages = dataStore.getMessagesForChannel("unknown-channel");
            expect(messages).toEqual([]);
        });

        test("should prune messages older than 24 hours", () => {
            const channelId = "channel123";
            const oldMessage: StoredMessage = {
                id: "oldMsg",
                content: "Old message",
                authorTag: "User#1234",
                timestamp: NOW - ONE_DAY_MS - 1000, // Just over 24 hours ago
            };

            const recentMessage: StoredMessage = {
                id: "recentMsg",
                content: "Recent message",
                authorTag: "User#1234",
                timestamp: NOW - 3600000, // 1 hour ago
            };

            // Add old message first
            dataStore.addMessage(channelId, oldMessage);
            // Add recent message which should trigger pruning
            dataStore.addMessage(channelId, recentMessage);

            const messages = dataStore.getMessagesForChannel(channelId);

            expect(messages).toHaveLength(1);
            expect(messages[0]).toEqual(recentMessage);
            expect(messages.find((m) => m.id === oldMessage.id)).toBeUndefined();
        });

        test("should remove channel when all messages are pruned in pruneOldMessages", () => {
            const channelId = "channel-to-be-removed";

            // Temporarily mock the pruneOldMessages method to prevent immediate pruning
            const originalPruneMethod = jest.spyOn(dataStore as any, "pruneOldMessages").mockImplementation(() => {});

            // Add old messages that would normally be pruned
            const oldMessage: StoredMessage = {
                id: "oldMsg",
                content: "Old message",
                authorTag: "User#1234",
                timestamp: NOW - ONE_DAY_MS - 1000, // Just over 24 hours ago
            };

            dataStore.addMessage(channelId, oldMessage);

            const anotherOldMessage: StoredMessage = {
                id: "anotherOldMsg",
                content: "Another old message",
                authorTag: "User#5678",
                timestamp: NOW - ONE_DAY_MS - 2000, // Even older
            };

            dataStore.addMessage(channelId, anotherOldMessage);

            // Verify messages were added (should be 2 since pruning was mocked)
            expect(dataStore.getMessagesForChannel(channelId)).toHaveLength(2);

            // Restore the original pruneOldMessages method
            originalPruneMethod.mockRestore();

            // Now manually call pruneOldMessages to trigger the channel removal
            (dataStore as any).pruneOldMessages(channelId);

            // Channel should be empty now as all messages were pruned
            expect(dataStore.getMessagesForChannel(channelId)).toHaveLength(0);

            // Verify the channel is actually deleted from the map
            // @ts-ignore - accessing private property for testing
            expect(dataStore.messagesByChannel.has(channelId)).toBe(false);
        });

        test("should keep channel with remaining messages after pruning some", () => {
            const channelId = "channel-with-mixed-messages";

            // Temporarily mock the pruneOldMessages method to prevent immediate pruning
            const originalPruneMethod = jest.spyOn(dataStore as any, "pruneOldMessages").mockImplementation(() => {});

            // Add an old message that would be pruned
            const oldMessage: StoredMessage = {
                id: "oldMsg",
                content: "Old message",
                authorTag: "User#1234",
                timestamp: NOW - ONE_DAY_MS - 1000, // Just over 24 hours ago
            };

            // Add a recent message that would be kept
            const recentMessage: StoredMessage = {
                id: "recentMsg",
                content: "Recent message",
                authorTag: "User#5678",
                timestamp: NOW - 3600000, // 1 hour ago
            };

            dataStore.addMessage(channelId, oldMessage);
            dataStore.addMessage(channelId, recentMessage);

            // Verify both messages were added
            expect(dataStore.getMessagesForChannel(channelId)).toHaveLength(2);

            // Restore the original method
            originalPruneMethod.mockRestore();

            // Call pruneOldMessages directly
            (dataStore as any).pruneOldMessages(channelId);

            // Verify only the recent message remains
            const remainingMessages = dataStore.getMessagesForChannel(channelId);
            expect(remainingMessages).toHaveLength(1);
            expect(remainingMessages[0].id).toBe("recentMsg");

            // Verify the channel entry was updated in the map
            // @ts-ignore - accessing private property for testing
            expect(dataStore.messagesByChannel.has(channelId)).toBe(true);
            // @ts-ignore - accessing private property for testing
            expect(dataStore.messagesByChannel.get(channelId)).toEqual([recentMessage]);
        });

        test("should remove channel when all messages are old", () => {
            const channelId = "channel-with-only-old-messages";

            // Add only old messages
            const oldMessage1: StoredMessage = {
                id: "oldMsg1",
                content: "Old message 1",
                authorTag: "User#1234",
                timestamp: NOW - ONE_DAY_MS - 1000, // Just over 24 hours ago
            };

            const oldMessage2: StoredMessage = {
                id: "oldMsg2",
                content: "Old message 2",
                authorTag: "User#5678",
                timestamp: NOW - ONE_DAY_MS - 2000, // Even older
            };

            dataStore.addMessage(channelId, oldMessage1);
            dataStore.addMessage(channelId, oldMessage2);

            // Add another message to trigger pruning
            const anotherChannelMessage: StoredMessage = {
                id: "msg3",
                content: "Message in another channel",
                authorTag: "User#9012",
                timestamp: NOW - 3600000, // 1 hour ago
            };
            dataStore.addMessage("another-channel", anotherChannelMessage);

            // The original channel should be gone since all its messages were old
            expect(dataStore.getMessagesForChannel(channelId)).toHaveLength(0);
            // @ts-ignore - accessing private property for testing
            expect(dataStore.messagesByChannel.has(channelId)).toBe(false);
        });
    });

    describe("forum thread handling", () => {
        test("should add and retrieve forum threads", () => {
            const threadMeta: ThreadMeta = {
                id: "thread1",
                title: "Forum Post Title",
                parentId: "forum123",
                createdAt: NOW - 3600000, // 1 hour ago
                createdBy: "User#1234",
            };

            dataStore.addForumThread(threadMeta);
            const threads = dataStore.getAllForumThreads();

            expect(threads).toHaveLength(1);
            expect(threads[0]).toEqual(threadMeta);
        });

        test("should remove thread data on thread removal", () => {
            const threadId = "thread1";
            const threadMeta: ThreadMeta = {
                id: threadId,
                title: "Forum Post Title",
                parentId: "forum123",
                createdAt: NOW - 3600000,
                createdBy: "User#1234",
            };

            // Add thread metadata
            dataStore.addForumThread(threadMeta);

            // Add some messages to the thread
            const message: StoredMessage = {
                id: "msg1",
                content: "Thread message",
                authorTag: "User#1234",
                timestamp: NOW - 1800000, // 30 minutes ago
            };

            dataStore.addMessage(threadId, message);

            // Remove the thread
            dataStore.removeThread(threadId);

            // Thread metadata and messages should be gone
            expect(dataStore.getAllForumThreads()).toHaveLength(0);
            expect(dataStore.getMessagesForChannel(threadId)).toEqual([]);
        });

        test("should prune forum threads with no recent messages", () => {
            const threadId = "thread1";
            const threadMeta: ThreadMeta = {
                id: threadId,
                title: "Forum Post Title",
                parentId: "forum123",
                createdAt: NOW - ONE_DAY_MS - 3600000, // 25 hours ago
                createdBy: "User#1234",
            };

            // Add thread metadata
            dataStore.addForumThread(threadMeta);

            // Add an old message
            const oldMessage: StoredMessage = {
                id: "msg1",
                content: "Old thread message",
                authorTag: "User#1234",
                timestamp: NOW - ONE_DAY_MS - 1800000, // 25.5 hours ago
            };

            dataStore.addMessage(threadId, oldMessage);

            // Trigger pruning
            dataStore.pruneAllExpiredMessages();

            // Thread should be removed as all its messages were pruned
            expect(dataStore.getAllForumThreads()).toHaveLength(0);
            expect(dataStore.getMessagesForChannel(threadId)).toEqual([]);
        });
    });

    describe("pruneAllExpiredMessages", () => {
        test("should prune forum threads with no messages", () => {
            // Add a thread
            const threadId = "thread-with-no-messages";
            const thread: ThreadMeta = {
                id: threadId,
                title: "Empty Thread",
                parentId: "forum-123",
                createdAt: Date.now() - 12 * 60 * 60 * 1000, // 12 hours ago
                createdBy: "User#1234",
            };

            dataStore.addForumThread(thread);

            // Ensure we have no messages for this thread
            expect(dataStore.getMessagesForChannel(threadId)).toHaveLength(0);

            // Verify the thread exists in forum threads
            expect(dataStore.getAllForumThreads()).toContainEqual(thread);

            // Call pruneAllExpiredMessages
            dataStore.pruneAllExpiredMessages();

            // Verify the thread was removed
            expect(dataStore.getAllForumThreads()).not.toContainEqual(thread);
        });
    });
});
