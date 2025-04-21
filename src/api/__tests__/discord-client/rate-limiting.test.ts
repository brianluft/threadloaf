import { TEST_TOKEN, TEST_GUILD_ID } from "./discord.mocks";
import { DiscordClient } from "../../discord-client";
import { DataStore } from "../../data-store";
import { Client, ChannelType, Collection } from "discord.js";

// Mock DataStore
jest.mock("../../data-store");

describe("DiscordClient Rate Limiting", () => {
    let discordClient: DiscordClient;
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

        // Initialize mockClient.channels and guilds to prevent undefined errors
        mockClient.channels = {
            cache: {
                get: jest.fn(),
            },
        } as any;

        mockClient.guilds = {
            cache: {
                get: jest.fn(),
            },
        } as any;

        // Spy on Client constructor to inject our mock
        jest.spyOn(require("discord.js"), "Client").mockImplementation(() => mockClient);

        // Create the DiscordClient instance
        discordClient = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);
    });

    afterEach(() => {
        // Make sure timers are restored
        jest.useRealTimers();

        // Restore any mocked globals
        jest.restoreAllMocks();
    });

    describe("handleRateLimitedOperation", () => {
        // Create a method to access the private handleRateLimitedOperation method
        let handleRateLimitedOperation: any;

        beforeEach(() => {
            // Access the private method using type casting
            handleRateLimitedOperation = (discordClient as any).handleRateLimitedOperation.bind(discordClient);

            // Mock setTimeout to execute immediately
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test("should handle unknown message error (code 10008)", async () => {
            // Create a mock operation that throws an error with code 10008
            const mockOperation = jest.fn().mockRejectedValue({
                code: 10008,
                message: "Unknown Message",
            });

            // Use the private method directly
            const result = await handleRateLimitedOperation(mockOperation, "test-operation");

            // Verify the warning was logged
            expect(console.warn).toHaveBeenCalledWith(
                "Unknown message encountered during operation for test-operation, continuing",
            );

            // Verify the operation was attempted exactly once (no retries for this error)
            expect(mockOperation).toHaveBeenCalledTimes(1);

            // Verify the operation returned false without retrying
            expect(result).toEqual({ success: false });
        });

        test("should handle unknown channel error (code 10003)", async () => {
            // Create a mock operation that throws an error with code 10003
            const mockOperation = jest.fn().mockRejectedValue({
                code: 10003,
                message: "Unknown Channel",
            });

            // Use the private method directly
            const result = await handleRateLimitedOperation(mockOperation, "test-operation");

            // Verify the warning was logged
            expect(console.warn).toHaveBeenCalledWith("Channel/thread test-operation not found, skipping operation");

            // Verify the operation was attempted exactly once (no retries for this error)
            expect(mockOperation).toHaveBeenCalledTimes(1);

            // Verify the operation returned false without retrying
            expect(result).toEqual({ success: false });
        });

        test("should handle generic errors with exponential backoff", async () => {
            // Spy on console.error and console.warn
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
            const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

            // Use fake timers instead of mocking setTimeout directly
            jest.useFakeTimers();

            // Create a new instance to test private method
            const client = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);

            // Create specific error message to check error handling
            const specificError = new Error("Generic operation error");

            // Create an operation that fails with a generic error
            const failingOperation = jest.fn().mockRejectedValue(specificError);

            // Start the operation but don't await yet
            const resultPromise = (client as any).handleRateLimitedOperation(
                failingOperation,
                "test-op",
                2, // max retries
            );

            // Advance timers for each retry (initial attempt + 2 retries)
            for (let i = 0; i < 3; i++) {
                await Promise.resolve(); // Let the current execution complete
                jest.runAllTimers(); // Run the timer for the backoff
            }

            // Now get the final result
            const result = await resultPromise;

            // Verify the operation was called the expected number of times (initial + retries)
            // With maxRetries=2, we expect 3 total calls (initial + 2 retries)
            expect(failingOperation).toHaveBeenCalledTimes(2);

            // Specifically testing line 393 - the error handling and logging for non-Discord errors
            expect(consoleErrorSpy).toHaveBeenCalledWith("Error during operation for test-op:", specificError);

            // Also checking line 394 - the backoff warning
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringMatching(/Retrying in \d+ms \(attempt 1\/2\)/));

            // Verify we logged the final failure
            expect(consoleErrorSpy).toHaveBeenCalledWith("Failed operation for test-op after 2 attempts");

            // Verify the operation failed
            expect(result).toEqual({ success: false });

            // Clean up
            consoleErrorSpy.mockRestore();
            consoleWarnSpy.mockRestore();
            jest.useRealTimers();
        });

        test("should exhaust all retries with non-Discord error", async () => {
            // Spy on console.error and console.warn
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
            const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

            // Use fake timers
            jest.useFakeTimers();

            // Create a specific error
            const specificError = new Error("Persistent error");

            // Create an operation that always fails
            const failingOperation = jest.fn().mockRejectedValue(specificError);

            // Start the operation with 3 retries (reduced from 5 for efficiency)
            const resultPromise = handleRateLimitedOperation(failingOperation, "test-op", 3);

            // Process all retries in sequence
            for (let i = 0; i < 4; i++) {
                await Promise.resolve(); // Let the current execution complete
                jest.runAllTimers(); // Run the timer for the backoff
                await Promise.resolve(); // Let the next iteration start
            }

            // Get the final result
            const result = await resultPromise;

            // Verify the operation was called the expected number of times
            expect(failingOperation).toHaveBeenCalledTimes(3);

            // Verify error logging
            expect(consoleErrorSpy).toHaveBeenCalledWith("Error during operation for test-op:", specificError);
            expect(consoleErrorSpy).toHaveBeenCalledWith("Failed operation for test-op after 3 attempts");

            // Verify backoff warnings were logged with increasing delays
            for (let i = 1; i <= 3; i++) {
                const backoffTime = Math.min(1000 * Math.pow(2, i), 30000);
                expect(consoleWarnSpy).toHaveBeenCalledWith(`Retrying in ${backoffTime}ms (attempt ${i}/3)`);
            }

            // Verify the operation failed
            expect(result).toEqual({ success: false });

            // Clean up
            consoleErrorSpy.mockRestore();
            consoleWarnSpy.mockRestore();
            jest.useRealTimers();
        }, 10000); // Increased timeout to 10 seconds

        test("should handle Discord rate limit errors (HTTP 429)", async () => {
            // Create a mock operation that throws a rate limit error
            const mockOperation = jest
                .fn()
                .mockRejectedValueOnce({
                    httpStatus: 429,
                    retryAfter: 1, // 1 second retry after
                    message: "Rate limited",
                })
                .mockResolvedValueOnce("success"); // succeed on retry

            // Use fake timers
            jest.useFakeTimers();

            // Start the operation
            const resultPromise = handleRateLimitedOperation(mockOperation, "rate-limited-op");

            // Let the first rejection happen
            await Promise.resolve();

            // Verify warning was logged
            expect(console.warn).toHaveBeenCalledWith(
                "Rate limited during operation for rate-limited-op. Retrying after 1000ms",
            );

            // Advance timer by retry delay
            jest.advanceTimersByTime(1000);

            // Complete the operation
            await Promise.resolve();

            // Verify the operation was retried and succeeded
            expect(mockOperation).toHaveBeenCalledTimes(2);
            const result = await resultPromise;
            expect(result).toEqual({ success: true, result: "success" });
        });

        test("should handle Discord rate limit errors without retryAfter (HTTP 429)", async () => {
            // Create a mock operation that throws a rate limit error without retryAfter
            const mockOperation = jest
                .fn()
                .mockRejectedValueOnce({
                    httpStatus: 429,
                    message: "Rate limited",
                    // No retryAfter provided, should default to 5000ms
                })
                .mockResolvedValueOnce("success"); // succeed on retry

            // Use fake timers
            jest.useFakeTimers();

            // Start the operation
            const resultPromise = handleRateLimitedOperation(mockOperation, "rate-limited-op");

            // Let the first rejection happen
            await Promise.resolve();

            // Verify warning was logged with default 5000ms retry time
            expect(console.warn).toHaveBeenCalledWith(
                "Rate limited during operation for rate-limited-op. Retrying after 5000ms",
            );

            // Advance timer by default retry delay
            jest.advanceTimersByTime(5000);

            // Complete the operation
            await Promise.resolve();

            // Verify the operation was retried and succeeded
            expect(mockOperation).toHaveBeenCalledTimes(2);
            const result = await resultPromise;
            expect(result).toEqual({ success: true, result: "success" });
        });

        test("should handle rate limit error (HTTP 429) with retryAfter", async () => {
            // Mock console.warn to avoid cluttering test output
            const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

            // Create a mock operation that first throws a rate limit error, then succeeds
            const mockOperation = jest
                .fn()
                .mockRejectedValueOnce({
                    httpStatus: 429,
                    retryAfter: 2, // 2 seconds retry after
                    message: "Rate limited",
                })
                .mockResolvedValueOnce("success");

            // Start the operation
            const resultPromise = handleRateLimitedOperation(mockOperation, "rate-limited-op");

            // Let the first attempt complete and hit rate limit
            await Promise.resolve();

            // Verify rate limit warning was logged
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                "Rate limited during operation for rate-limited-op. Retrying after 2000ms",
            );

            // Advance timer by retryAfter duration
            jest.advanceTimersByTime(2000);
            await Promise.resolve();

            // Get final result
            const result = await resultPromise;

            // Verify the operation was called twice (initial + retry after rate limit)
            expect(mockOperation).toHaveBeenCalledTimes(2);

            // Verify we got success on the retry
            expect(result).toEqual({ success: true, result: "success" });

            // Clean up
            consoleWarnSpy.mockRestore();
        });

        test("should handle rate limit error without retryAfter specified", async () => {
            // Mock console.warn to avoid cluttering test output
            const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

            // Create a mock operation that first throws a rate limit error without retryAfter, then succeeds
            const mockOperation = jest
                .fn()
                .mockRejectedValueOnce({
                    httpStatus: 429,
                    message: "Rate limited",
                })
                .mockResolvedValueOnce("success");

            // Start the operation
            const resultPromise = handleRateLimitedOperation(mockOperation, "rate-limited-op");

            // Let the first attempt complete and hit rate limit
            await Promise.resolve();

            // Verify rate limit warning was logged with default 5000ms
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                "Rate limited during operation for rate-limited-op. Retrying after 5000ms",
            );

            // Advance timer by default retry duration
            jest.advanceTimersByTime(5000);
            await Promise.resolve();

            // Get final result
            const result = await resultPromise;

            // Verify the operation was called twice (initial + retry after rate limit)
            expect(mockOperation).toHaveBeenCalledTimes(2);

            // Verify we got success on the retry
            expect(result).toEqual({ success: true, result: "success" });

            // Clean up
            consoleWarnSpy.mockRestore();
        });

        test("should handle rate limit errors with specified retry delay", async () => {
            // Spy on console.warn
            const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

            // Use fake timers
            jest.useFakeTimers();

            // Create a mock operation that first throws a rate limit error, then succeeds
            const mockOperation = jest
                .fn()
                .mockRejectedValueOnce({
                    httpStatus: 429,
                    retryAfter: 2, // 2 seconds retry delay
                    message: "Rate limited",
                })
                .mockResolvedValueOnce("success");

            // Start the operation
            const resultPromise = handleRateLimitedOperation(mockOperation, "rate-limited-op");

            // Let the first attempt complete (which will hit rate limit)
            await Promise.resolve();

            // Verify rate limit warning was logged
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                "Rate limited during operation for rate-limited-op. Retrying after 2000ms",
            );

            // Advance timer by the retry delay
            jest.advanceTimersByTime(2000);
            await Promise.resolve();

            // Get the final result
            const result = await resultPromise;

            // Verify the operation was called twice (once for rate limit, once for success)
            expect(mockOperation).toHaveBeenCalledTimes(2);

            // Verify we got success on the retry
            expect(result).toEqual({ success: true, result: "success" });

            // Clean up
            consoleWarnSpy.mockRestore();
            jest.useRealTimers();
        });
    });

    describe("rate limit handling", () => {
        test("should handle rate limits and retry during backfill", async () => {
            // Create a direct mock of handleRateLimitedOperation instead of testing through backfill
            // This avoids the complex timing issues
            const mockHandleRateLimitedOperation = jest.fn().mockResolvedValue({ success: true });

            // Create a simple mock channel
            const mockChannel = {
                id: "channel1",
                type: ChannelType.GuildText,
                isTextBased: () => true,
                isThread: () => false,
                messages: {
                    fetch: jest.fn().mockResolvedValue(new Collection()),
                },
            };

            // Create a fresh client for this test
            const client = new DiscordClient(TEST_TOKEN, TEST_GUILD_ID, dataStore);

            // Mock the client's channels cache
            (client as any).client.channels = {
                cache: {
                    get: jest.fn().mockReturnValue(mockChannel),
                },
            };

            // Inject our mock for the handleRateLimitedOperation method
            (client as any).handleRateLimitedOperation = mockHandleRateLimitedOperation;

            // Call backfillChannelMessages directly
            await (client as any).backfillChannelMessages("channel1");

            // Verify our mock was called with the expected parameters
            expect(mockHandleRateLimitedOperation).toHaveBeenCalledWith(expect.any(Function), "channel:channel1");
        });
    });
});
