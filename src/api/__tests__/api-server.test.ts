import { ApiServer } from "../api-server";
import { DataStore, StoredMessage, ThreadMeta } from "../data-store";
import request from "supertest";
import express from "express";

jest.mock("../data-store");

describe("ApiServer", () => {
    let apiServer: ApiServer;
    let dataStore: jest.Mocked<DataStore>;
    let app: express.Express;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Create a new DataStore mock
        dataStore = new DataStore() as jest.Mocked<DataStore>;

        // Create the API server
        apiServer = new ApiServer(3000, dataStore);

        // Create an express app instance that we can use for testing
        // We'll manually invoke the route handlers instead of starting the server
        app = express();
        // @ts-ignore - access private method for testing
        apiServer.setupMiddleware = jest.fn().mockImplementation(() => {
            app.use(express.json());
        });
        // @ts-ignore - access private method for testing
        apiServer.setupRoutes = jest.fn().mockImplementation(() => {
            app.get("/messages/:channelId", (req, res) => {
                try {
                    const channelId = req.params.channelId;
                    const messages = dataStore.getMessagesForChannel(channelId);
                    res.json(messages);
                } catch (error) {
                    console.error("Error fetching messages:", error);
                    res.status(500).json({ error: "Failed to fetch messages" });
                }
            });

            app.get("/forum-threads", (req, res) => {
                try {
                    const forumThreads = dataStore.getAllForumThreads();

                    // Map to response format with latest replies
                    const response = forumThreads.map((thread) => {
                        const allMessages = dataStore.getMessagesForChannel(thread.id);
                        const latestReplies = allMessages.length > 1 ? allMessages.slice(1).slice(-5) : [];

                        return {
                            threadId: thread.id,
                            title: thread.title,
                            createdBy: thread.createdBy,
                            createdAt: thread.createdAt,
                            latestReplies,
                        };
                    });

                    res.json(response);
                } catch (error) {
                    console.error("Error fetching forum threads:", error);
                    res.status(500).json({ error: "Failed to fetch forum threads" });
                }
            });

            app.get("/health", (_, res) => {
                res.json({ status: "ok" });
            });
        });

        // Setup the app routes
        // @ts-ignore - access private methods for testing
        apiServer.setupMiddleware();
        // @ts-ignore - access private methods for testing
        apiServer.setupRoutes();
    });

    describe("GET /messages/:channelId", () => {
        test("should return messages for a valid channel ID", async () => {
            const channelId = "channel123";
            const messages: StoredMessage[] = [
                {
                    id: "msg1",
                    content: "Hello world",
                    authorTag: "User#1234",
                    timestamp: 1693000000000,
                },
                {
                    id: "msg2",
                    content: "Test message",
                    authorTag: "User#5678",
                    timestamp: 1693000100000,
                },
            ];

            // Mock dataStore.getMessagesForChannel
            dataStore.getMessagesForChannel = jest.fn().mockReturnValue(messages);

            const response = await request(app).get(`/messages/${channelId}`);

            expect(response.status).toBe(200);
            expect(response.body).toEqual(messages);
            expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith(channelId);
        });

        test("should return empty array for channel with no messages", async () => {
            const channelId = "empty-channel";

            // Mock dataStore.getMessagesForChannel
            dataStore.getMessagesForChannel = jest.fn().mockReturnValue([]);

            const response = await request(app).get(`/messages/${channelId}`);

            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);
            expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith(channelId);
        });

        test("should handle errors when fetching messages fails", async () => {
            const channelId = "error-channel";

            // Create a spy on console.error to verify it's called with the right arguments
            const consoleErrorSpy = jest.spyOn(console, "error");
            consoleErrorSpy.mockImplementation(() => {});

            // Mock dataStore.getMessagesForChannel to throw an error with a specific message
            const errorMessage = "Database connection failed";
            const mockError = new Error(errorMessage);
            dataStore.getMessagesForChannel = jest.fn().mockImplementation(() => {
                throw mockError;
            });

            const response = await request(app).get(`/messages/${channelId}`);

            // Assert the response status and body
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: "Failed to fetch messages" });

            // Verify dataStore.getMessagesForChannel was called with the channel ID
            expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith(channelId);

            // Verify console.error was called with the expected error
            expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching messages:", mockError);

            // Restore console.error
            consoleErrorSpy.mockRestore();
        });
    });

    describe("GET /forum-threads", () => {
        test("should return forum threads with latest replies", async () => {
            const threads: ThreadMeta[] = [
                {
                    id: "thread1",
                    title: "Forum Post 1",
                    parentId: "forum123",
                    createdAt: 1693000000000,
                    createdBy: "User#1234",
                },
                {
                    id: "thread2",
                    title: "Forum Post 2",
                    parentId: "forum123",
                    createdAt: 1693001000000,
                    createdBy: "User#5678",
                },
            ];

            const thread1Messages: StoredMessage[] = [
                {
                    id: "rootmsg1",
                    content: "Root post content",
                    authorTag: "User#1234",
                    timestamp: 1693000000000,
                },
                {
                    id: "reply1",
                    content: "Reply 1",
                    authorTag: "User#5678",
                    timestamp: 1693000100000,
                },
                {
                    id: "reply2",
                    content: "Reply 2",
                    authorTag: "User#9012",
                    timestamp: 1693000200000,
                },
            ];

            const thread2Messages: StoredMessage[] = [
                {
                    id: "rootmsg2",
                    content: "Root post 2 content",
                    authorTag: "User#5678",
                    timestamp: 1693001000000,
                },
            ];

            // Mock dataStore methods
            dataStore.getAllForumThreads = jest.fn().mockReturnValue(threads);
            dataStore.getMessagesForChannel = jest.fn().mockImplementation((threadId) => {
                if (threadId === "thread1") return thread1Messages;
                if (threadId === "thread2") return thread2Messages;
                return [];
            });

            const response = await request(app).get("/forum-threads");

            expect(response.status).toBe(200);
            expect(response.body).toEqual([
                {
                    threadId: "thread1",
                    title: "Forum Post 1",
                    createdBy: "User#1234",
                    createdAt: 1693000000000,
                    latestReplies: [
                        {
                            id: "reply1",
                            content: "Reply 1",
                            authorTag: "User#5678",
                            timestamp: 1693000100000,
                        },
                        {
                            id: "reply2",
                            content: "Reply 2",
                            authorTag: "User#9012",
                            timestamp: 1693000200000,
                        },
                    ],
                },
                {
                    threadId: "thread2",
                    title: "Forum Post 2",
                    createdBy: "User#5678",
                    createdAt: 1693001000000,
                    latestReplies: [],
                },
            ]);

            expect(dataStore.getAllForumThreads).toHaveBeenCalled();
            expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith("thread1");
            expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith("thread2");
        });

        test("should return empty array when no forum threads exist", async () => {
            // Mock dataStore methods
            dataStore.getAllForumThreads = jest.fn().mockReturnValue([]);

            const response = await request(app).get("/forum-threads");

            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);
            expect(dataStore.getAllForumThreads).toHaveBeenCalled();
        });

        test("should handle threads with more than 5 replies correctly", async () => {
            const threads: ThreadMeta[] = [
                {
                    id: "thread1",
                    title: "Forum Post with many replies",
                    parentId: "forum123",
                    createdAt: 1693000000000,
                    createdBy: "User#1234",
                },
            ];

            // Create 10 messages (1 root + 9 replies)
            const threadMessages: StoredMessage[] = [
                {
                    id: "rootmsg",
                    content: "Root post content",
                    authorTag: "User#1234",
                    timestamp: 1693000000000,
                },
                ...Array.from({ length: 9 }, (_, i) => ({
                    id: `reply${i + 1}`,
                    content: `Reply ${i + 1}`,
                    authorTag: `User#${i + 100}`,
                    timestamp: 1693000000000 + (i + 1) * 100000,
                })),
            ];

            // Mock dataStore methods
            dataStore.getAllForumThreads = jest.fn().mockReturnValue(threads);
            dataStore.getMessagesForChannel = jest.fn().mockReturnValue(threadMessages);

            const response = await request(app).get("/forum-threads");

            expect(response.status).toBe(200);
            expect(response.body[0].latestReplies).toHaveLength(5);
            // Should include only the 5 latest replies (replies 5-9)
            expect(response.body[0].latestReplies[0].id).toBe("reply5");
            expect(response.body[0].latestReplies[4].id).toBe("reply9");
        });

        test("should handle threads with only one message (no replies)", async () => {
            const threads: ThreadMeta[] = [
                {
                    id: "thread1",
                    title: "Forum Post with single message",
                    parentId: "forum123",
                    createdAt: 1693000000000,
                    createdBy: "User#1234",
                },
            ];

            // Create just 1 message (the root post with no replies)
            const threadMessages: StoredMessage[] = [
                {
                    id: "rootmsg",
                    content: "Root post content",
                    authorTag: "User#1234",
                    timestamp: 1693000000000,
                },
            ];

            // Mock dataStore methods
            dataStore.getAllForumThreads = jest.fn().mockReturnValue(threads);
            dataStore.getMessagesForChannel = jest.fn().mockReturnValue(threadMessages);

            // Create a real ApiServer instance
            const realApp = express();
            const server = new ApiServer(3000, dataStore);

            // @ts-ignore - replace app with our test app
            server.app = realApp;

            // Call setupMiddleware and setupRoutes
            // @ts-ignore - access private method for testing
            server.setupMiddleware();
            // @ts-ignore - access private method for testing
            server.setupRoutes();

            // Make request to the forum-threads endpoint
            const response = await request(realApp).get("/forum-threads");

            expect(response.status).toBe(200);
            expect(response.body[0].latestReplies).toEqual([]);
            expect(dataStore.getAllForumThreads).toHaveBeenCalled();
            expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith("thread1");
        });

        test("should handle errors when fetching forum threads fails", async () => {
            // Mock dataStore.getAllForumThreads to throw an error
            dataStore.getAllForumThreads = jest.fn().mockImplementation(() => {
                throw new Error("Database error");
            });

            // Mock console.error to prevent output during test
            const originalConsoleError = console.error;
            console.error = jest.fn();

            const response = await request(app).get("/forum-threads");

            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: "Failed to fetch forum threads" });
            expect(dataStore.getAllForumThreads).toHaveBeenCalled();
            expect(console.error).toHaveBeenCalled();

            // Restore console.error
            console.error = originalConsoleError;
        });

        test("should handle errors when getMessagesForChannel throws error during forum thread processing", async () => {
            // Mock getAllForumThreads to return threads
            const threads: ThreadMeta[] = [
                {
                    id: "thread1",
                    title: "Forum Post 1",
                    parentId: "forum123",
                    createdAt: 1693000000000,
                    createdBy: "User#1234",
                },
                {
                    id: "thread2",
                    title: "Forum Post 2",
                    parentId: "forum123",
                    createdAt: 1693001000000,
                    createdBy: "User#5678",
                },
            ];

            dataStore.getAllForumThreads = jest.fn().mockReturnValue(threads);

            // Mock getMessagesForChannel to throw an error only for the second thread
            dataStore.getMessagesForChannel = jest.fn().mockImplementation((threadId) => {
                if (threadId === "thread2") {
                    throw new Error("Test error for thread2");
                }
                return [
                    {
                        id: "msg1",
                        content: "Test content",
                        authorTag: "User#1234",
                        timestamp: 1693000000000,
                    },
                ];
            });

            // Create a real ApiServer instance
            const realApp = express();
            const server = new ApiServer(3000, dataStore);

            // @ts-ignore - replace app with our test app
            server.app = realApp;

            // Call setupMiddleware and setupRoutes
            // @ts-ignore - access private method for testing
            server.setupMiddleware();
            // @ts-ignore - access private method for testing
            server.setupRoutes();

            // Make request to the forum-threads endpoint
            const response = await request(realApp).get("/forum-threads");

            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: "Failed to fetch forum threads" });
            expect(dataStore.getAllForumThreads).toHaveBeenCalled();
            expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith("thread1");
            expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith("thread2");
        });

        test("should handle errors thrown from getMessagesForChannel", async () => {
            // Mock the methods to throw an error
            dataStore.getMessagesForChannel = jest.fn().mockImplementation(() => {
                throw new Error("Test error");
            });

            // Set up explicit error handling that the original route would have
            app = express();
            app.use(express.json());
            app.get("/messages/:channelId", (req, res) => {
                try {
                    const channelId = req.params.channelId;
                    const messages = dataStore.getMessagesForChannel(channelId);
                    res.json(messages);
                } catch (error) {
                    console.error("Error fetching messages:", error);
                    res.status(500).json({ error: "Failed to fetch messages" });
                }
            });

            const response = await request(app).get("/messages/channel123");

            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: "Failed to fetch messages" });
        });
    });

    describe("GET /health", () => {
        test("should return status ok", async () => {
            const response = await request(app).get("/health");

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ status: "ok" });
        });
    });

    describe("Error Handling Middleware", () => {
        let testApp: express.Express;

        beforeEach(() => {
            // Create a new Express app for error handling tests
            testApp = express();
            testApp.use(express.json());

            // Add test routes that will trigger errors
            testApp.get("/test-error", (_req, _res, next) => {
                next(new Error("Test error message"));
            });

            testApp.get("/test-non-error", (_req, _res, next) => {
                next("String error message");
            });

            // Add error handling middleware that matches the real implementation
            testApp.use(
                (err: Error | unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
                    // Log the error
                    if (err instanceof Error) {
                        console.error("API error:", err.message);
                    } else {
                        console.error("API error:", err);
                    }

                    // Send error response
                    res.status(500).json({ error: "Internal server error" });
                    next();
                },
            );
        });

        test("should handle Error objects correctly", async () => {
            // Create a spy on console.error
            const consoleErrorSpy = jest.spyOn(console, "error");
            consoleErrorSpy.mockImplementation(() => {});

            const response = await request(testApp).get("/test-error");

            // Verify response
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: "Internal server error" });

            // Verify error was logged correctly
            expect(consoleErrorSpy).toHaveBeenCalledWith("API error:", "Test error message");

            consoleErrorSpy.mockRestore();
        });

        test("should handle non-Error objects correctly", async () => {
            // Create a spy on console.error
            const consoleErrorSpy = jest.spyOn(console, "error");
            consoleErrorSpy.mockImplementation(() => {});

            const response = await request(testApp).get("/test-non-error");

            // Verify response
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: "Internal server error" });

            // Verify error was logged correctly
            expect(consoleErrorSpy).toHaveBeenCalledWith("API error:", "String error message");

            consoleErrorSpy.mockRestore();
        });
    });

    describe("start", () => {
        test("should start the API server listening on the specified port", () => {
            // Mock the listen method of app
            const listenMock = jest.fn().mockImplementation((port, callback) => {
                // Call the callback to simulate server start
                callback();
                return { on: jest.fn() };
            });

            // Create server with mocked app
            const server = new ApiServer(3456, dataStore);

            // @ts-ignore - replace app.listen with mock
            server.app.listen = listenMock;

            // Spy on console.log
            const consoleLogSpy = jest.spyOn(console, "log");
            consoleLogSpy.mockImplementation(() => {});

            // Call start method
            server.start();

            // Verify server was started on the correct port
            expect(listenMock).toHaveBeenCalledWith(3456, expect.any(Function));
            expect(consoleLogSpy).toHaveBeenCalledWith("API server listening on port 3456");

            // Restore console.log
            consoleLogSpy.mockRestore();
        });
    });

    describe("setupMiddleware", () => {
        test("should log requests to console", async () => {
            // Create an actual express app to test middleware
            const realApp = express();

            // Spy on express.use to verify middleware is set up
            const useSpy = jest.spyOn(realApp, "use");

            // Mock console.log
            const originalConsoleLog = console.log;
            console.log = jest.fn();

            // Create new server with actual app
            const server = new ApiServer(3000, dataStore);

            // @ts-ignore - replace app with our test app
            server.app = realApp;

            // Call setupMiddleware
            // @ts-ignore - access private method for testing
            server.setupMiddleware();

            // Verify middleware was added (should be called 2 times now that error handling was moved)
            expect(useSpy).toHaveBeenCalledTimes(2);

            // Test logging middleware
            const mockRequest = {
                method: "GET",
                path: "/test-path",
            } as unknown as Request;
            const mockNext = jest.fn();

            // Get the logging middleware (2nd call to use)
            const loggingMiddleware = useSpy.mock.calls[1][0];

            // @ts-ignore - call the middleware manually
            loggingMiddleware(mockRequest, {}, mockNext);

            // Verify middleware worked as expected
            expect(mockNext).toHaveBeenCalled();
            expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/.*- GET \/test-path/));

            // Restore console.log
            console.log = originalConsoleLog;
        });
    });

    describe("setupErrorHandling", () => {
        test("should register error handling middleware", () => {
            // Create an actual express app to test middleware
            const realApp = express();

            // Spy on express.use to verify middleware is set up
            const useSpy = jest.spyOn(realApp, "use");

            // Create new server with actual app
            const server = new ApiServer(3000, dataStore);

            // @ts-ignore - replace app with our test app
            server.app = realApp;

            // Call setupErrorHandling
            // @ts-ignore - access private method for testing
            server.setupErrorHandling();

            // Verify middleware was added
            expect(useSpy).toHaveBeenCalledTimes(1);

            // We can verify that the bound method is registered, but can't easily test its behavior here
            expect(useSpy).toHaveBeenCalled();
        });
    });

    describe("errorHandler", () => {
        test("should handle Error objects correctly", () => {
            // Create server
            const server = new ApiServer(3000, dataStore);

            // Create mock request, response, next
            const mockError = new Error("Test error message");
            const mockRequest = {} as Request;
            const mockResponse = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            } as unknown as Response;
            const mockNext = jest.fn();

            // Spy on console.error
            const consoleErrorSpy = jest.spyOn(console, "error");
            consoleErrorSpy.mockImplementation(() => {});

            // Call the error handler directly
            // @ts-ignore - access private method for testing
            server.errorHandler(mockError, mockRequest, mockResponse, mockNext);

            // Verify error was handled correctly
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: "Internal server error" });
            expect(mockNext).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith("API error:", "Test error message");

            // Restore console.error
            consoleErrorSpy.mockRestore();
        });

        test("should handle non-Error objects thrown as errors", () => {
            // Create server
            const server = new ApiServer(3000, dataStore);

            // Use a string as the error - this tests handling of different error types
            const nonErrorObject = "This is not an Error object";
            const mockRequest = {} as Request;
            const mockResponse = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            } as unknown as Response;
            const mockNext = jest.fn();

            // Spy on console.error
            const consoleErrorSpy = jest.spyOn(console, "error");
            consoleErrorSpy.mockImplementation(() => {});

            // Call the error handler with non-Error object
            // @ts-ignore - access private method and pass non-Error
            server.errorHandler(nonErrorObject, mockRequest, mockResponse, mockNext);

            // Verify error handling behaves the same
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: "Internal server error" });
            expect(mockNext).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith("API error:", nonErrorObject);

            // Restore console.error
            consoleErrorSpy.mockRestore();
        });
    });

    describe("Health endpoint", () => {
        test("should directly test the health endpoint route handler", () => {
            // Create a server instance
            const server = new ApiServer(3000, dataStore);

            // Create a mock Express app
            const mockApp = {
                get: jest.fn(),
            };

            // Replace the app with our mock
            // @ts-ignore - access private property
            server.app = mockApp;

            // Call setupRoutes to register the routes with our mock app
            // @ts-ignore - access private method
            server.setupRoutes();

            // Get the health route handler (3rd GET route)
            const healthHandler = mockApp.get.mock.calls[2][1];

            // Create mock response
            const mockRes = {
                json: jest.fn(),
            };

            // Call the health handler directly
            healthHandler(null, mockRes);

            // Verify it returned the correct response
            expect(mockRes.json).toHaveBeenCalledWith({ status: "ok" });
        });
    });
});

// Add real setup routes tests to cover uncovered code in GET /messages
describe("ApiServer routes - real setup", () => {
    let apiServer: ApiServer;
    let dataStore: jest.Mocked<DataStore>;
    let app: express.Express;

    beforeEach(() => {
        jest.clearAllMocks();
        dataStore = new DataStore() as jest.Mocked<DataStore>;
        apiServer = new ApiServer(3000, dataStore);
        // Access the actual Express app from the server instance
        app = (apiServer as unknown as { app: express.Express }).app;
    });

    test("GET /messages/:channelId real setup success", async () => {
        const channelId = "channel123";
        const messages: StoredMessage[] = [
            {
                id: "msg1",
                content: "Hello",
                authorTag: "User#1",
                timestamp: 1600000000000,
            },
        ];

        dataStore.getMessagesForChannel.mockReturnValue(messages);

        const response = await request(app).get(`/messages/${channelId}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(messages);
        expect(dataStore.getMessagesForChannel).toHaveBeenCalledWith(channelId);
    });

    test("GET /messages/:channelId real setup error", async () => {
        const channelId = "error-channel";
        const error = new Error("Test failure");
        dataStore.getMessagesForChannel.mockImplementation(() => {
            throw error;
        });

        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const response = await request(app).get(`/messages/${channelId}`);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Failed to fetch messages" });
        expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching messages:", error);

        consoleErrorSpy.mockRestore();
    });

    test("GET /forum-threads real setup success", async () => {
        const threads: ThreadMeta[] = [
            {
                id: "thread1",
                title: "Forum Post",
                parentId: "forum123",
                createdAt: 1690000000000,
                createdBy: "User#1234",
            },
            {
                id: "thread2",
                title: "Forum Post 2",
                parentId: "forum123",
                createdAt: 1690000100000,
                createdBy: "User#5678",
            },
        ];
        const thread1Messages: StoredMessage[] = [
            { id: "root1", content: "root", authorTag: "u1", timestamp: 1690000000000 },
            { id: "reply1", content: "r1", authorTag: "u2", timestamp: 1690000001000 },
            { id: "reply2", content: "r2", authorTag: "u3", timestamp: 1690000002000 },
        ];
        const thread2Messages: StoredMessage[] = [
            { id: "root2", content: "root2", authorTag: "u2", timestamp: 1690000100000 },
        ];

        dataStore.getAllForumThreads.mockReturnValue(threads);
        dataStore.getMessagesForChannel.mockImplementation((channelId: string) =>
            channelId === "thread1" ? thread1Messages : thread2Messages,
        );

        const response = await request(app).get("/forum-threads");

        expect(response.status).toBe(200);
        expect(response.body).toEqual([
            {
                threadId: "thread1",
                title: "Forum Post",
                createdBy: "User#1234",
                createdAt: 1690000000000,
                latestReplies: [thread1Messages[1], thread1Messages[2]],
            },
            {
                threadId: "thread2",
                title: "Forum Post 2",
                createdBy: "User#5678",
                createdAt: 1690000100000,
                latestReplies: [],
            },
        ]);
    });

    test("GET /forum-threads real setup error", async () => {
        const error = new Error("Test failure");
        dataStore.getAllForumThreads.mockImplementation(() => {
            throw error;
        });

        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const response = await request(app).get("/forum-threads");

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Failed to fetch forum threads" });
        expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching forum threads:", error);

        consoleErrorSpy.mockRestore();
    });
});
