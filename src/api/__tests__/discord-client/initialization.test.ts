import { TEST_TOKEN, TEST_GUILD_ID } from "./discord.mocks";
import { DiscordClient } from "../../discord-client";
import { DataStore } from "../../data-store";
import { Client, Events, Collection, Guild } from "discord.js";

// Mock DataStore
jest.mock("../../data-store");

describe("DiscordClient Initialization", () => {
    let mockClient: jest.Mocked<Client>;
    let dataStore: jest.Mocked<DataStore>;
    let clientOnHandlers: Record<string, Function> = {};

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock DataStore
        dataStore = new DataStore() as jest.Mocked<DataStore>;

        // Create a mock discord.js Client that captures the event handlers
        const captureEventHandler = (event: string, handler: Function) => {
            clientOnHandlers[event] = handler;
            return mockClient;
        };

        mockClient = new Client({
            intents: ["Guilds", "GuildMessages", "MessageContent"],
        }) as jest.Mocked<Client>;
        mockClient.on = jest.fn().mockImplementation(captureEventHandler);

        // Spy on Client constructor to inject our mock
        jest.spyOn(require("discord.js"), "Client").mockImplementation(() => mockClient);

        // Create the DiscordClient instance
        new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);
    });

    test("should set up event handlers", () => {
        expect(mockClient.on).toHaveBeenCalledWith(Events.ClientReady, expect.any(Function));
        expect(mockClient.on).toHaveBeenCalledWith(Events.MessageCreate, expect.any(Function));
        expect(mockClient.on).toHaveBeenCalledWith(Events.ThreadCreate, expect.any(Function));
        expect(mockClient.on).toHaveBeenCalledWith(Events.ThreadUpdate, expect.any(Function));
        expect(mockClient.on).toHaveBeenCalledWith(Events.ThreadDelete, expect.any(Function));
        expect(mockClient.login).toHaveBeenCalledWith(TEST_TOKEN);
    });

    test("should handle login errors", async () => {
        // Save the original login implementation
        const originalLogin = mockClient.login;

        // Create a spy on console.error
        const consoleErrorSpy = jest.spyOn(console, "error");
        consoleErrorSpy.mockImplementation(() => {});

        // Make login reject with an error
        mockClient.login = jest.fn().mockRejectedValue(new Error("Auth failed"));

        // Create a new client instance that will fail to login
        new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);

        // Wait for the promise rejection to be processed
        await new Promise(process.nextTick);

        // Verify error was logged
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "Failed to log in to Discord:",
            expect.objectContaining({ message: "Auth failed" }),
        );

        // Restore mocks
        mockClient.login = originalLogin;
        consoleErrorSpy.mockRestore();
    });

    test("should schedule periodic message cleanup", async () => {
        // Mock setInterval instead of spying on it to avoid memory leaks
        const originalSetInterval = global.setInterval;
        const mockSetInterval = jest.fn().mockImplementation((callback, ms) => {
            // Return a fake timer ID
            return 123 as unknown as NodeJS.Timeout;
        });
        global.setInterval = mockSetInterval;

        // Setup guild mock
        const mockGuild = {
            id: TEST_GUILD_ID,
            name: "Test Guild",
            channels: {
                cache: new Collection(),
                fetchActiveThreads: jest.fn().mockResolvedValue({ threads: new Collection() }),
            },
        } as unknown as Guild;

        mockClient.guilds.cache.get = jest.fn().mockReturnValue(mockGuild);

        // Trigger ready event
        await clientOnHandlers[Events.ClientReady]();

        // Verify setInterval was called with the expected interval
        expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 60 * 60 * 1000);

        // Get the interval callback function
        const intervalCallback = mockSetInterval.mock.calls[0][0] as Function;

        // Call the interval callback directly
        intervalCallback();

        // Verify that pruneAllExpiredMessages was called
        expect(dataStore.pruneAllExpiredMessages).toHaveBeenCalled();

        // Restore original setInterval
        global.setInterval = originalSetInterval;
    });

    test("should handle errors during initialization", async () => {
        // Spy on console.error
        const consoleErrorSpy = jest.spyOn(console, "error");
        consoleErrorSpy.mockImplementation(() => {});

        // Setup guild mock that will throw an error
        mockClient.guilds.cache.get = jest.fn().mockImplementation(() => {
            throw new Error("Initialization error");
        });

        // Trigger ready event
        await clientOnHandlers[Events.ClientReady]();

        // Verify error was logged
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "Error during initialization:",
            expect.objectContaining({ message: "Initialization error" }),
        );

        // Restore console.error
        consoleErrorSpy.mockRestore();
    });

    test("should handle errors during backfill", async () => {
        // Spy on console.error
        const consoleErrorSpy = jest.spyOn(console, "error");
        consoleErrorSpy.mockImplementation(() => {});

        // Create a mock guild that will throw an error during fetchActiveThreads
        const mockGuild = {
            id: TEST_GUILD_ID,
            name: "Test Guild",
            channels: {
                cache: new Collection(),
                fetchActiveThreads: jest.fn().mockRejectedValue(new Error("Failed to fetch threads")),
            },
        } as unknown as Guild;

        mockClient.guilds.cache.get = jest.fn().mockReturnValue(mockGuild);

        // Mock setInterval to avoid memory leaks
        const originalSetInterval = global.setInterval;
        global.setInterval = jest.fn().mockReturnValue(123 as unknown as NodeJS.Timeout);

        // Trigger ready event
        await clientOnHandlers[Events.ClientReady]();

        // Verify error was logged
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "Error during backfill:",
            expect.objectContaining({ message: "Failed to fetch threads" }),
        );

        // Restore mocks
        consoleErrorSpy.mockRestore();
        global.setInterval = originalSetInterval;
    });
});
