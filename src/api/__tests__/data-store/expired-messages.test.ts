import { DataStore, ThreadMeta, StoredMessage } from "../../data-store";

describe("DataStore Expired Messages", () => {
    let dataStore: DataStore;
    const NOW = 1693000000000; // Fixed timestamp for testing

    beforeEach(() => {
        dataStore = new DataStore();
        // Mock Date.now() to return a fixed timestamp for predictable testing
        jest.spyOn(global.Date, "now").mockImplementation(() => NOW);
    });

    afterEach(() => {
        jest.restoreAllMocks();
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

        test("should prune expired messages across all channels", () => {
            const channelId = "channel1";
            const ONE_DAY_MS = 24 * 60 * 60 * 1000;
            const oldMessage: StoredMessage = {
                id: "oldMsg",
                content: "Old message",
                authorTag: "User#1234",
                timestamp: Date.now() - ONE_DAY_MS - 1000, // Just over 24 hours ago
            };
            const recentMessage: StoredMessage = {
                id: "recentMsg",
                content: "Recent message",
                authorTag: "User#5678",
                timestamp: Date.now() - 3600000, // 1 hour ago
            };

            // Manually set messages for pruning
            // @ts-ignore - accessing private property for testing
            (dataStore as any).messagesByChannel.set(channelId, [oldMessage, recentMessage]);

            // Ensure both messages are present
            expect(dataStore.getMessagesForChannel(channelId)).toHaveLength(2);

            dataStore.pruneAllExpiredMessages();

            const messages = dataStore.getMessagesForChannel(channelId);
            expect(messages).toHaveLength(1);
            expect(messages[0]).toEqual(recentMessage);
        });
    });
});
