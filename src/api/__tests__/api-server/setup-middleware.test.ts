import { ApiServer } from "../../api-server";
import { DataStore } from "../../data-store";
import express from "express";
import { createShared } from "./shared";

jest.mock("../../data-store");

describe("ApiServer setupMiddleware", () => {
    let dataStore: jest.Mocked<DataStore>;

    beforeEach(() => {
        jest.clearAllMocks();

        const x = createShared();
        dataStore = x.dataStore;
    });

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
