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

    test("should configure CORS to allow browser extension origins", async () => {
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

        // Add a simple test route
        app.get("/test", (req, res) => {
            res.json({ success: true });
        });

        // Test valid origins
        const validOrigins = [
            "chrome-extension://abcdefghijklmnopqrstuvwxyz123456",
            "moz-extension://abcdefghijklmnopqrstuvwxyz123456",
            "http://localhost:3000",
            "https://localhost:8080",
        ];

        for (const origin of validOrigins) {
            const response = await request(app).get("/test").set("Origin", origin);

            expect(response.status).toBe(200);
            expect(response.headers["access-control-allow-origin"]).toBe(origin);
        }

        // Test request with no origin (should be allowed)
        const noOriginResponse = await request(app).get("/test");
        expect(noOriginResponse.status).toBe(200);
    });

    test("should configure CORS to reject invalid origins", async () => {
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

        // Add a simple test route
        app.get("/test", (req, res) => {
            res.json({ success: true });
        });

        // Test invalid origin
        const response = await request(app).get("/test").set("Origin", "https://malicious-site.com");

        expect(response.status).toBe(500); // CORS error results in server error
    });
});
