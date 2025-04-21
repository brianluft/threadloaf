import { DataStore, StoredMessage } from "../../data-store";

describe("DataStore Message Storage", () => {
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

    test("pruneOldMessages should handle unknown channel gracefully", () => {
        // Invoke pruneOldMessages on a channel that doesn't exist
        expect(() => (dataStore as any).pruneOldMessages("unknown-channel")).not.toThrow();
        // getMessagesForChannel should return empty array
        expect(dataStore.getMessagesForChannel("unknown-channel")).toEqual([]);
        // @ts-ignore - accessing private property
        expect((dataStore as any).messagesByChannel.has("unknown-channel")).toBe(false);
    });
});
