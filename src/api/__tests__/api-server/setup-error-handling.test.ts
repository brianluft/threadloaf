import { ApiServer } from "../../api-server";
import { DataStore } from "../../data-store";
import express from "express";
import { createShared } from "./shared";

jest.mock("../../data-store");

describe("ApiServer setupErrorHandling", () => {
    let dataStore: jest.Mocked<DataStore>;

    beforeEach(() => {
        jest.clearAllMocks();

        const x = createShared();
        dataStore = x.dataStore;
    });

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
});
