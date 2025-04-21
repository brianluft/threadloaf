import { DiscordClient } from "../../discord-client";
import { DataStore } from "../../data-store";
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
