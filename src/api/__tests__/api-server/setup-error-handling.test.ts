import express from "express";
import { ApiServer } from "../../api-server";
import { DataStore } from "../../data-store";
import request from "supertest";

jest.mock("../../data-store");

describe("ApiServer setupErrorHandling", () => {
    let dataStore: jest.Mocked<DataStore>;
    let dataStoresByGuild: Map<string, DataStore>;

    beforeEach(() => {
        jest.clearAllMocks();
        dataStore = new DataStore() as jest.Mocked<DataStore>;
        dataStoresByGuild = new Map<string, DataStore>();
        dataStoresByGuild.set("test-guild-id", dataStore);
    });

    test("should setup error handling middleware", () => {
        // Create the server
        const server = new ApiServer(3000, dataStoresByGuild);

        // Create a mock Express app
        const mockApp = {
            use: jest.fn(),
        };

        // Replace the app with our mock
        // @ts-ignore - access private property
        server.app = mockApp;

        // Call setupErrorHandling
        // @ts-ignore - access private method
        server.setupErrorHandling();

        // Verify error handling middleware was added
        expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function));
    });

    test("should handle errors by logging and returning 500", async () => {
        // Create actual express app
        const app = express();
        
        // Setup JSON middleware
        app.use(express.json());
        
        // Add a route that throws an error
        app.get("/error", () => {
            throw new Error("Test error");
        });

        // Create the server
        const server = new ApiServer(3000, dataStoresByGuild);
        
        // Get the error handler by calling setupErrorHandling
        // @ts-ignore - access private method to get error handler
        const errorHandler = server.errorHandler.bind(server);
        
        // Add the error handler manually after the route
        app.use(errorHandler);

        // Mock console.error
        const consoleErrorSpy = jest.spyOn(console, "error");
        consoleErrorSpy.mockImplementation(() => {});

        // Test the error handling
        const response = await request(app).get("/error");

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Internal server error" });
        expect(consoleErrorSpy).toHaveBeenCalledWith("API error:", "Test error");

        // Restore console.error
        consoleErrorSpy.mockRestore();
    });

    test("should handle non-Error objects by logging them", async () => {
        // Create actual express app
        const app = express();
        
        // Setup JSON middleware
        app.use(express.json());
        
        // Add a route that throws a non-Error object
        app.get("/error", () => {
            throw "string error";
        });

        // Create the server
        const server = new ApiServer(3000, dataStoresByGuild);
        
        // Get the error handler by calling setupErrorHandling
        // @ts-ignore - access private method to get error handler
        const errorHandler = server.errorHandler.bind(server);
        
        // Add the error handler manually after the route
        app.use(errorHandler);

        // Mock console.error
        const consoleErrorSpy = jest.spyOn(console, "error");
        consoleErrorSpy.mockImplementation(() => {});

        // Test the error handling
        const response = await request(app).get("/error");

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Internal server error" });
        expect(consoleErrorSpy).toHaveBeenCalledWith("API error:", "string error");

        // Restore console.error
        consoleErrorSpy.mockRestore();
    });
});
