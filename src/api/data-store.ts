/**
 * Data storage for Discord messages and threads
 * Maintains an in-memory store with a 24-hour rolling window
 */

export type StoredMessage = {
    id: string;
    content: string;
    authorTag: string;
    timestamp: number;
};

export type ThreadMeta = {
    id: string;
    title: string;
    parentId: string;
    createdAt: number;
    createdBy: string;
};

export class DataStore {
    private messagesByChannel: Map<string, StoredMessage[]> = new Map();
    private forumThreads: Map<string, ThreadMeta> = new Map();
    private readonly ONE_DAY_MS = 24 * 60 * 60 * 1000;

    /**
     * Add a message to the store
     */
    addMessage(channelId: string, message: StoredMessage): void {
        const messages = this.messagesByChannel.get(channelId) || [];
        messages.push(message);
        this.messagesByChannel.set(channelId, messages);
        this.pruneOldMessages(channelId);
    }

    /**
     * Add a forum thread to the store
     */
    addForumThread(threadMeta: ThreadMeta): void {
        this.forumThreads.set(threadMeta.id, threadMeta);
    }

    /**
     * Get all messages for a channel within the last 24 hours
     */
    getMessagesForChannel(channelId: string): StoredMessage[] {
        return this.messagesByChannel.get(channelId) || [];
    }

    /**
     * Get all forum threads with their metadata
     */
    getAllForumThreads(): ThreadMeta[] {
        return Array.from(this.forumThreads.values());
    }

    /**
     * Remove expired messages from a channel
     */
    private pruneOldMessages(channelId: string): void {
        const messages = this.messagesByChannel.get(channelId) || [];
        const cutoff = Date.now() - this.ONE_DAY_MS;

        let index = 0;
        while (index < messages.length && messages[index].timestamp < cutoff) {
            index++;
        }

        if (index > 0) {
            messages.splice(0, index);

            // If no messages remain, remove the channel entry
            if (messages.length === 0) {
                this.messagesByChannel.delete(channelId);
            } else {
                this.messagesByChannel.set(channelId, messages);
            }
        }
    }

    /**
     * Remove a thread and its messages from the store
     */
    removeThread(threadId: string): void {
        this.forumThreads.delete(threadId);
        this.messagesByChannel.delete(threadId);
    }

    /**
     * Prune all expired messages across all channels
     */
    pruneAllExpiredMessages(): void {
        const now = Date.now();
        const cutoff = now - this.ONE_DAY_MS;

        // Prune messages in each channel
        for (const channelId of this.messagesByChannel.keys()) {
            this.pruneOldMessages(channelId);
        }

        // Prune forum threads that have no recent messages
        for (const threadId of this.forumThreads.keys()) {
            const messages = this.messagesByChannel.get(threadId) || [];
            if (messages.length === 0) {
                this.forumThreads.delete(threadId);
            }
        }
    }
}
