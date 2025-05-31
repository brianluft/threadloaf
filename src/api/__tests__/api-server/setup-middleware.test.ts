import express from "express";
import { ApiServer } from "../../api-server";
import { DataStore } from "../../data-store";
import request from "supertest";

jest.mock("../../data-store");

describe("ApiServer setupMiddleware", () => {
    test("should setup express.json middleware", async () => {
        // Create a mocked DataStore
        const dataStore = new DataStore() as jest.Mocked<DataStore>;

        // Create a Map with the test DataStore
        const dataStoresByGuild = new Map<string, DataStore>();
        dataStoresByGuild.set("test-guild-id", dataStore);

        // Create the server
        const discordClientsByGuild = new Map();
        const server = new ApiServer(3000, dataStoresByGuild, discordClientsByGuild, false);

        // Create a new express app for testing
        const app = express();

        // Access the private setupMiddleware method
        // @ts-ignore - access private method for testing
        server.app = app;
        // @ts-ignore - access private method for testing
        server.setupMiddleware();

        // Add a simple test route that expects JSON
        app.post("/test", (req, res) => {
            res.json({ received: req.body });
        });

        // Test that JSON parsing works
        const response = await request(app)
            .post("/test")
            .send({ test: "data" })
            .set("Content-Type", "application/json");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ received: { test: "data" } });
    });

    test("should use default authenticationEnabled value when not specified", () => {
        // Create a mocked DataStore
        const dataStore = new DataStore() as jest.Mocked<DataStore>;

        // Create a Map with the test DataStore
        const dataStoresByGuild = new Map<string, DataStore>();
        dataStoresByGuild.set("test-guild-id", dataStore);

        // Create the server WITHOUT passing authenticationEnabled parameter
        const discordClientsByGuild = new Map();
        const server = new ApiServer(3000, dataStoresByGuild, discordClientsByGuild);

        // Verify the server was created successfully (which means the default value was used)
        expect(server).toBeDefined();

        // Access the private property to verify the default value was set correctly
        // @ts-ignore - access private property for testing
        expect(server.authenticationEnabled).toBe(true);
    });
});
