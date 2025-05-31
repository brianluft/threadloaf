import { ApiServer } from "../../api-server";
import { DataStore, StoredMessage } from "../../data-store";
import { DiscordClient } from "../../discord-client";
import express, { Request, Response } from "express";

// Type definitions for the new multi-channel messages endpoint
type MultiChannelMessagesRequest = {
    channelIds: string[];
    maxMessagesPerChannel: number;
};

type MultiChannelMessagesResponse = {
    [channelId: string]: StoredMessage[];
};

export function createShared(): {
    dataStore: jest.Mocked<DataStore>;
    dataStoresByGuild: Map<string, DataStore>;
    discordClientsByGuild: Map<string, DiscordClient>;
    app: express.Express;
} {
    // Create a new DataStore mock
    const dataStore = new DataStore() as jest.Mocked<DataStore>;

    // Create mock Discord client
    const mockDiscordClient = {
        getClient: jest.fn().mockReturnValue({
            guilds: {
                cache: {
                    get: jest.fn().mockReturnValue({
                        members: {
                            fetch: jest.fn().mockResolvedValue({}),
                        },
                    }),
                },
            },
        }),
    } as unknown as DiscordClient;

    // Create Maps with the test guild ID
    const TEST_GUILD_ID = "test-guild-id";
    const dataStoresByGuild = new Map<string, DataStore>();
    const discordClientsByGuild = new Map<string, DiscordClient>();
    dataStoresByGuild.set(TEST_GUILD_ID, dataStore);
    discordClientsByGuild.set(TEST_GUILD_ID, mockDiscordClient);

    // Create the API server with authentication disabled for tests
    const apiServer = new ApiServer(3000, dataStoresByGuild, discordClientsByGuild, false);

    // Get the actual Express app from the ApiServer instance
    // @ts-ignore - access private property for testing
    const app = apiServer.app;

    return { dataStore, dataStoresByGuild, discordClientsByGuild, app };
}
