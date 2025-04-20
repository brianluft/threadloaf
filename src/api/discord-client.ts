/**
 * Discord client implementation
 * Handles real-time message ingestion and startup backfill
 */

import {
    Client,
    GatewayIntentBits,
    ChannelType,
    Message,
    ThreadChannel,
    Collection,
    Events,
    Guild,
    AnyThreadChannel,
} from "discord.js";
import { DataStore, StoredMessage, ThreadMeta } from "./data-store";

export class DiscordClient {
    private client: Client;
    private dataStore: DataStore;
    private guildId: string;
    private ready = false;

    constructor(token: string, guildId: string, dataStore: DataStore) {
        this.guildId = guildId;
        this.dataStore = dataStore;
        this.client = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
        });

        this.setupEventHandlers();
        this.client.login(token).catch((error) => {
            console.error("Failed to log in to Discord:", error);
        });
    }

    /**
     * Setup all event handlers for the Discord client
     */
    private setupEventHandlers(): void {
        this.client.on(Events.ClientReady, () => this.handleReady());
        this.client.on(Events.MessageCreate, (message) => this.handleMessageCreate(message));
        this.client.on(Events.ThreadCreate, (thread) => this.handleThreadCreate(thread));
        this.client.on(Events.ThreadUpdate, (_, newThread) => this.handleThreadUpdate(newThread));
        this.client.on(Events.ThreadDelete, (thread) => this.handleThreadDelete(thread));
    }

    /**
     * Handle the client ready event
     */
    private async handleReady(): Promise<void> {
        console.log(`Logged in as ${this.client.user?.tag}`);

        // Set ready state
        this.ready = true;

        try {
            // Get the target guild
            const guild = this.client.guilds.cache.get(this.guildId);
            if (!guild) {
                console.error(`Guild with ID ${this.guildId} not found`);
                return;
            }

            console.log(`Connected to guild: ${guild.name}`);

            // Perform backfill
            await this.performBackfill(guild);

            // Schedule periodic cleanup
            setInterval(
                () => {
                    this.dataStore.pruneAllExpiredMessages();
                },
                60 * 60 * 1000,
            ); // Run every hour
        } catch (error) {
            console.error("Error during initialization:", error);
        }
    }

    /**
     * Handle new messages
     */
    private handleMessageCreate(message: Message): void {
        // Skip if not in the target guild
        if (!message.guild || message.guild.id !== this.guildId) return;

        // Skip messages from DMs (no guild) or private threads
        if (!message.guild || (message.channel.isThread() && message.channel.type === ChannelType.PrivateThread)) {
            return;
        }

        // Convert to stored message format
        const storedMessage: StoredMessage = {
            id: message.id,
            content: message.content,
            authorTag: message.author.tag,
            timestamp: message.createdTimestamp,
        };

        // Add to data store
        this.dataStore.addMessage(message.channelId, storedMessage);
    }

    /**
     * Handle new thread creation
     */
    private async handleThreadCreate(thread: ThreadChannel): Promise<void> {
        // Skip if not in the target guild
        if (thread.guild.id !== this.guildId) return;

        // Skip private threads
        if (thread.type === ChannelType.PrivateThread) return;

        try {
            // Join the thread
            await thread.join();

            // Check if it's a forum thread
            const isForum = thread.parent?.type === ChannelType.GuildForum;

            if (isForum) {
                // Get the starter message
                const starterMessage = await thread.fetchStarterMessage().catch(() => null);

                if (starterMessage) {
                    // Store the starter message
                    const storedMessage: StoredMessage = {
                        id: starterMessage.id,
                        content: starterMessage.content,
                        authorTag: starterMessage.author.tag,
                        timestamp: starterMessage.createdTimestamp,
                    };

                    this.dataStore.addMessage(thread.id, storedMessage);

                    // Store thread metadata
                    const threadMeta: ThreadMeta = {
                        id: thread.id,
                        title: thread.name,
                        parentId: thread.parentId || "",
                        createdAt: thread.createdTimestamp || Date.now(),
                        createdBy: starterMessage.author.tag,
                    };

                    this.dataStore.addForumThread(threadMeta);
                }
            }
        } catch (error) {
            console.error(`Error handling thread create for ${thread.id}:`, error);
        }
    }

    /**
     * Handle thread updates
     */
    private handleThreadUpdate(thread: ThreadChannel): void {
        // Skip if not in the target guild
        if (thread.guild.id !== this.guildId) return;

        // If thread became archived, remove it
        if (thread.archived) {
            this.dataStore.removeThread(thread.id);
        }
    }

    /**
     * Handle thread deletion
     */
    private handleThreadDelete(thread: ThreadChannel): void {
        // Skip if not in the target guild
        if (thread.guild.id !== this.guildId) return;

        // Remove thread data
        this.dataStore.removeThread(thread.id);
    }

    /**
     * Perform backfill of messages from the last 24 hours
     */
    private async performBackfill(guild: Guild): Promise<void> {
        console.log("Starting 24-hour backfill...");

        try {
            // Fetch active threads first
            const fetchedThreads = await guild.channels.fetchActiveThreads();

            // Convert the threads collection to the format our method expects
            const threadCollection = new Collection<string, AnyThreadChannel>();
            for (const [id, thread] of fetchedThreads.threads) {
                threadCollection.set(id, thread);
            }

            await this.processActiveThreads(threadCollection);

            // Get text and forum channels
            const textChannels = guild.channels.cache.filter(
                (channel) =>
                    channel.type === ChannelType.GuildText ||
                    channel.type === ChannelType.GuildAnnouncement ||
                    channel.type === ChannelType.GuildForum,
            );

            for (const [, channel] of textChannels) {
                // Skip forum channels for direct message backfill (we handle their threads separately)
                if (channel.type === ChannelType.GuildForum) continue;

                // For text channels, fetch recent messages
                if (channel.isTextBased() && !channel.isThread()) {
                    await this.backfillChannelMessages(channel.id);
                }
            }

            console.log("Backfill complete");
        } catch (error) {
            console.error("Error during backfill:", error);
        }
    }

    /**
     * Process active threads during backfill
     */
    private async processActiveThreads(threads: Collection<string, AnyThreadChannel>): Promise<void> {
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;

        for (const [, thread] of threads) {
            // Skip if not in our guild
            if (thread.guild.id !== this.guildId) continue;

            // Skip private threads
            if (thread.type === ChannelType.PrivateThread) continue;

            try {
                // Join the thread to ensure we receive events
                await thread.join();

                // Check if it's a forum thread
                const isForum = thread.parent?.type === ChannelType.GuildForum;

                if (isForum) {
                    // Attempt to get the starter message
                    const { success: starterSuccess, result: starterMessage } = await this.handleRateLimitedOperation(
                        () => thread.fetchStarterMessage(),
                        `thread-starter:${thread.id}`,
                    );

                    if (starterSuccess && starterMessage) {
                        // Store thread metadata
                        const threadMeta: ThreadMeta = {
                            id: thread.id,
                            title: thread.name,
                            parentId: thread.parentId || "",
                            createdAt: thread.createdTimestamp || Date.now(),
                            createdBy: starterMessage.author.tag,
                        };

                        this.dataStore.addForumThread(threadMeta);
                    }
                }

                // Track if we've hit messages older than 24 hours
                let reachedEnd = false;
                // Start with no "before" parameter for the first batch
                let lastMessageId: string | undefined = undefined;
                // Counter for total messages fetched
                let totalFetched = 0;

                // Fetch messages in batches
                while (!reachedEnd) {
                    // Create fetch options
                    const options: { limit: number; before?: string } = { limit: 100 };
                    if (lastMessageId) {
                        options.before = lastMessageId;
                    }

                    // Use our helper to handle rate limiting
                    const { success, result: messages } = await this.handleRateLimitedOperation(
                        () => thread.messages.fetch(options),
                        `thread:${thread.id}`,
                    );

                    if (!success || !messages) {
                        console.warn(`Could not fetch messages for thread ${thread.id}, stopping backfill`);
                        break;
                    }

                    // If we got no messages, we've reached the end
                    if (messages.size === 0) {
                        reachedEnd = true;
                        continue;
                    }

                    // Process the messages
                    const recentMessages = messages.filter((m) => m.createdTimestamp >= oneDayAgo);

                    // If all messages are older than 24 hours, we've reached our limit
                    if (recentMessages.size === 0 && messages.size > 0) {
                        reachedEnd = true;
                        continue;
                    }

                    // Process and store messages
                    for (const [, message] of recentMessages) {
                        const storedMessage: StoredMessage = {
                            id: message.id,
                            content: message.content,
                            authorTag: message.author.tag,
                            timestamp: message.createdTimestamp,
                        };

                        this.dataStore.addMessage(thread.id, storedMessage);
                    }

                    totalFetched += recentMessages.size;

                    // Get the ID of the oldest message for next batch
                    lastMessageId = messages.last()?.id;

                    // If we fetched fewer than requested, we've reached the end
                    if (messages.size < 100) {
                        reachedEnd = true;
                        continue;
                    }

                    // Add a small delay to be nice to the API
                    await new Promise((resolve) => setTimeout(resolve, 250));
                }

                console.log(`Backfill complete for thread ${thread.id}: fetched ${totalFetched} messages`);
            } catch (error) {
                console.error(`Error processing thread ${thread.id}:`, error);
            }
        }
    }

    /**
     * Backfill messages from a specific channel
     */
    private async backfillChannelMessages(channelId: string): Promise<void> {
        try {
            console.log(`Backfilling messages for channel ${channelId}`);

            const channel = this.client.channels.cache.get(channelId);
            if (!channel || !channel.isTextBased()) {
                console.error(`Channel ${channelId} not found or not a text channel`);
                return;
            }

            const now = Date.now();
            const oneDayAgo = now - 24 * 60 * 60 * 1000;

            // Track if we've hit messages older than 24 hours
            let reachedEnd = false;

            // Start with no "before" parameter for the first batch
            let lastMessageId: string | undefined = undefined;

            // Counter for total messages fetched
            let totalFetched = 0;

            while (!reachedEnd) {
                // Create fetch options
                const options: { limit: number; before?: string } = { limit: 100 };
                if (lastMessageId) {
                    options.before = lastMessageId;
                }

                // Use our helper to handle rate limiting
                const { success, result: messages } = await this.handleRateLimitedOperation(
                    () => channel.messages.fetch(options),
                    `channel:${channelId}`,
                );

                if (!success || !messages) {
                    console.warn(`Could not fetch messages for channel ${channelId}, stopping backfill`);
                    break;
                }

                // If we got no messages, we've reached the end
                if (messages.size === 0) {
                    reachedEnd = true;
                    continue;
                }

                // Process the messages
                const recentMessages = messages.filter((m) => m.createdTimestamp >= oneDayAgo);

                // If all messages are older than 24 hours, we've reached our limit
                if (recentMessages.size === 0 && messages.size > 0) {
                    reachedEnd = true;
                    continue;
                }

                // Process and store messages
                for (const [, message] of recentMessages) {
                    const storedMessage: StoredMessage = {
                        id: message.id,
                        content: message.content,
                        authorTag: message.author.tag,
                        timestamp: message.createdTimestamp,
                    };

                    this.dataStore.addMessage(channelId, storedMessage);
                }

                totalFetched += recentMessages.size;

                // Get the ID of the oldest message for next batch
                lastMessageId = messages.last()?.id;

                // If we fetched fewer than requested, we've reached the end
                if (messages.size < 100) {
                    reachedEnd = true;
                    continue;
                }

                // Add a small delay to be nice to the API
                await new Promise((resolve) => setTimeout(resolve, 250));
            }

            console.log(`Backfill complete for channel ${channelId}: fetched ${totalFetched} messages`);
        } catch (error) {
            console.error(`Unexpected error during backfill for ${channelId}:`, error);
        }
    }

    /**
     * Helper to handle rate limiting and retry logic
     */
    private async handleRateLimitedOperation<T>(
        operation: () => Promise<T>,
        identifier: string,
        maxRetries: number = 5,
    ): Promise<{ success: boolean; result?: T }> {
        let retryCount = 0;

        while (retryCount < maxRetries) {
            try {
                const result = await operation();
                return { success: true, result };
            } catch (error: any) {
                retryCount++;

                // Check if this is a rate limit error
                if (error.code === 10008) {
                    // Unknown message - might be deleted, just continue
                    console.warn(`Unknown message encountered during operation for ${identifier}, continuing`);
                    return { success: false };
                } else if (error.code === 10003) {
                    // Unknown channel - exit
                    console.warn(`Channel/thread ${identifier} not found, skipping operation`);
                    return { success: false };
                } else if (error.httpStatus === 429) {
                    // Rate limit hit
                    const retryAfter = error.retryAfter ? error.retryAfter * 1000 : 5000;
                    console.warn(`Rate limited during operation for ${identifier}. Retrying after ${retryAfter}ms`);

                    // Wait for the specified retry time
                    await new Promise((resolve) => setTimeout(resolve, retryAfter));
                } else {
                    // Other error
                    console.error(`Error during operation for ${identifier}:`, error);

                    // Exponential backoff
                    const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 30000);
                    console.warn(`Retrying in ${backoffTime}ms (attempt ${retryCount}/${maxRetries})`);
                    await new Promise((resolve) => setTimeout(resolve, backoffTime));
                }
            }
        }

        console.error(`Failed operation for ${identifier} after ${maxRetries} attempts`);
        return { success: false };
    }
}
