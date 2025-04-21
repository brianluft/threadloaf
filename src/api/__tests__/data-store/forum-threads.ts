import { DataStore, StoredMessage, ThreadMeta } from "../../data-store";

describe("DataStore Forum Threads", () => {
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
