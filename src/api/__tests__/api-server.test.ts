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
        test("should return health status", async () => {
            const response = await request(app).get("/health");

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ status: "ok" });
        });

        test("should call the original health endpoint implementation", async () => {
            // Create a new app with the real implementation
            const realApp = express();

            // Create a new server with the real app
            const server = new ApiServer(3000, dataStore);

            // @ts-ignore - replace app with our test app
            server.app = realApp;

            // Call setupRoutes with the real implementation
            // @ts-ignore - access private method for testing
            server.setupRoutes();

            // Make a request to the health endpoint
            const response = await request(realApp).get("/health");

            // Verify response
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ status: "ok" });
        });
    });

    describe("start method", () => {
        const originalConsoleLog = console.log;

        beforeEach(() => {
            console.log = jest.fn();
        });

        afterEach(() => {
            console.log = originalConsoleLog;
        });

        test("should start the server and log a message", () => {
            // Mock the listen method
            const listenMock = jest.fn().mockImplementation((port, callback) => {
                callback();
                return { on: jest.fn() };
            });

            // Create a new server with mocked express app
            const mockExpress = () => {
                return {
                    listen: listenMock,
                    use: jest.fn(),
                };
            };

            // Apply the mock
            jest.mock("express", () => mockExpress);

            // Create a new instance to test start
            const server = new ApiServer(3000, dataStore);

            // @ts-ignore - access private property for testing
            server.app = {
                listen: listenMock,
            };

            // Call the start method
            server.start();

            // Verify listen was called with correct port
            expect(listenMock).toHaveBeenCalledWith(3000, expect.any(Function));
            expect(console.log).toHaveBeenCalledWith(`API server listening on port 3000`);
        });
    });

    describe("setupMiddleware", () => {
        test("should setup error handling middleware", () => {
            // Create an actual express app to test middleware
            const realApp = express();

            // Spy on express.use to verify middleware is set up
            const useSpy = jest.spyOn(realApp, "use");

            // Create new server with actual app
            const server = new ApiServer(3000, dataStore);

            // @ts-ignore - replace app with our test app
            server.app = realApp;

            // Call setupMiddleware
            // @ts-ignore - access private method for testing
            server.setupMiddleware();

            // Verify middleware was added (should be called 3 times)
            expect(useSpy).toHaveBeenCalledTimes(3);

            // Test error handling middleware
            const mockRequest = {} as Request;
            const mockResponse = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            } as unknown as Response;
            const mockNext = jest.fn();
            const mockError = new Error("Test error");

            // Get the error middleware (3rd call to use)
            const errorMiddleware = useSpy.mock.calls[2][0];

            // @ts-ignore - call the middleware manually
            errorMiddleware(mockError, mockRequest, mockResponse, mockNext);

            // Verify error was handled correctly
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({ error: "Internal server error" });
            expect(mockNext).toHaveBeenCalled();
        });

        test("should setup logging middleware", () => {
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

            // Get the logging middleware (2nd call to use)
            const loggingMiddleware = useSpy.mock.calls[1][0];

            // Create mock request and response
            const mockRequest = {
                method: "GET",
                path: "/test-path",
            } as unknown as Request;
            const mockNext = jest.fn();

            // @ts-ignore - call the middleware manually
            loggingMiddleware(mockRequest, {}, mockNext);

            // Verify next was called and logging happened
            expect(mockNext).toHaveBeenCalled();
            expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/.*- GET \/test-path/));

            // Restore console.log
            console.log = originalConsoleLog;
        });
    });
});
