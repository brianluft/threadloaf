import { ApiServer } from "../../api-server";
import { DataStore, StoredMessage } from "../../data-store";
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
    app: express.Express;
} {
    // Create a new DataStore mock
    const dataStore = new DataStore() as jest.Mocked<DataStore>;

    // Create a Map with the test guild ID
    const TEST_GUILD_ID = "test-guild-id";
    const dataStoresByGuild = new Map<string, DataStore>();
    dataStoresByGuild.set(TEST_GUILD_ID, dataStore);

    // Create the API server
    const apiServer = new ApiServer(3000, dataStoresByGuild);

    // Get the actual Express app from the ApiServer instance
    // @ts-ignore - access private property for testing
    const app = apiServer.app;

    return { dataStore, dataStoresByGuild, app };
}
