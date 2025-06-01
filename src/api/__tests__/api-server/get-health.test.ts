import request from "supertest";
import express from "express";
import { createShared } from "./shared";
import { ApiServer } from "../../api-server";
import { DataStore } from "../../data-store";
jest.mock("../../data-store");

describe("ApiServer GET /health", () => {
    let app: express.Express;
    let dataStore: jest.Mocked<DataStore>;

    beforeEach(() => {
        jest.clearAllMocks();

        const x = createShared();
        app = x.app;
        dataStore = x.dataStore;
    });

    test("should return status ok", async () => {
        const response = await request(app).get("/health");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "ok" });
    });

    test("should directly test the health endpoint route handler", () => {
        // Create a Map with the test DataStore
        const dataStoresByGuild = new Map<string, DataStore>();
        dataStoresByGuild.set("test-guild-id", dataStore);

        // Create mock Discord clients map
        const discordClientsByGuild = new Map();

        // Create a server instance with authentication disabled for tests
        const server = new ApiServer(3000, dataStoresByGuild, discordClientsByGuild, false);

        // Create a mock Express app
        const mockApp = {
            get: jest.fn(),
            post: jest.fn(),
        };

        // Replace the app with our mock
        // @ts-ignore - access private property
        server.app = mockApp;

        // Call setupRoutes to register the routes with our mock app
        // @ts-ignore - access private method
        server.setupRoutes();

        // Get the health route handler (it should be the last GET route)
        const getCalls = mockApp.get.mock.calls;
        const healthRouteCall = getCalls.find((call) => call[0] === "/health");
        const healthHandler = healthRouteCall[1];

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
