import { ApiServer } from "../../api-server";
import { DataStore } from "../../data-store";
import { LetsEncryptConfig } from "../../lets-encrypt";
import { createShared } from "./shared";
import * as http from "http";
import request from "supertest";

jest.mock("../../data-store");
jest.mock("../../lets-encrypt");

describe("ApiServer start", () => {
    let dataStore: jest.Mocked<DataStore>;

    beforeEach(() => {
        jest.clearAllMocks();

        const x = createShared();
        dataStore = x.dataStore;
    });

    test("should start the API server listening on the specified port", async () => {
        // Mock the listen method of app
        const listenMock = jest.fn().mockImplementation((port, callback) => {
            // Call the callback to simulate server start
            callback();
            return { on: jest.fn() };
        });

        // Create a Map with the test DataStore
        const dataStoresByGuild = new Map<string, DataStore>();
        dataStoresByGuild.set("test-guild-id", dataStore);

        // Create server with mocked app
        const discordClientsByGuild = new Map();
        const server = new ApiServer(3456, dataStoresByGuild, discordClientsByGuild, false);

        // @ts-ignore - replace app.listen with mock
        server.app.listen = listenMock;

        // Spy on console.log
        const consoleLogSpy = jest.spyOn(console, "log");
        consoleLogSpy.mockImplementation(() => {});

        // Call start method (now async but in test mode it should be synchronous)
        await server.start();

        // Verify server was started on the correct port
        expect(listenMock).toHaveBeenCalledWith(3456, expect.any(Function));
        expect(consoleLogSpy).toHaveBeenCalledWith("API server listening on HTTP port 3456 (debug mode)");

        // Restore console.log
        consoleLogSpy.mockRestore();
    });

    test("should initialize LetsEncryptManager when letsEncryptConfig is provided and enabled", async () => {
        // Create a Map with the test DataStore
        const dataStoresByGuild = new Map<string, DataStore>();
        dataStoresByGuild.set("test-guild-id", dataStore);

        const discordClientsByGuild = new Map();

        // Create LetsEncrypt config with enabled: true
        const letsEncryptConfig: LetsEncryptConfig = {
            enabled: true,
            email: "test@example.com",
            domain: "test.example.com",
            acmeDirectory: "https://acme-staging-v02.api.letsencrypt.org/directory",
            certsDir: "/tmp/certs",
        };

        // Create server with LetsEncrypt config
        const server = new ApiServer(3456, dataStoresByGuild, discordClientsByGuild, false, letsEncryptConfig);

        // Verify that the server was created successfully (this tests line 77)
        expect(server).toBeInstanceOf(ApiServer);
        expect(server.app).toBeDefined();
    });

    test("should call startWithHttps when letsEncryptManager is present", async () => {
        // Create a Map with the test DataStore
        const dataStoresByGuild = new Map<string, DataStore>();
        dataStoresByGuild.set("test-guild-id", dataStore);

        const discordClientsByGuild = new Map();

        // Create LetsEncrypt config with enabled: true
        const letsEncryptConfig: LetsEncryptConfig = {
            enabled: true,
            email: "test@example.com",
            domain: "test.example.com",
            acmeDirectory: "https://acme-staging-v02.api.letsencrypt.org/directory",
            certsDir: "/tmp/certs",
        };

        // Create server with LetsEncrypt config
        const server = new ApiServer(3456, dataStoresByGuild, discordClientsByGuild, false, letsEncryptConfig);

        // Mock the startWithHttps method to avoid actual HTTPS setup
        const startWithHttpsSpy = jest.spyOn(server as any, "startWithHttps");
        startWithHttpsSpy.mockResolvedValue(undefined);

        // Call start - this should call startWithHttps() (line 90)
        await server.start();

        // Verify startWithHttps was called
        expect(startWithHttpsSpy).toHaveBeenCalledTimes(1);

        // Clean up
        startWithHttpsSpy.mockRestore();
    });

    test("should handle startWithHttps functionality with Let's Encrypt", async () => {
        // Create a Map with the test DataStore
        const dataStoresByGuild = new Map<string, DataStore>();
        dataStoresByGuild.set("test-guild-id", dataStore);

        const discordClientsByGuild = new Map();

        // Create LetsEncrypt config with enabled: true
        const letsEncryptConfig: LetsEncryptConfig = {
            enabled: true,
            email: "test@example.com",
            domain: "test.example.com",
            acmeDirectory: "https://acme-staging-v02.api.letsencrypt.org/directory",
            certsDir: "/tmp/certs",
        };

        // Create server with LetsEncrypt config
        const server = new ApiServer(3456, dataStoresByGuild, discordClientsByGuild, false, letsEncryptConfig);

        // Mock console.log and console.error
        const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

        // Mock HTTP server creation
        const mockHttpServer = {
            listen: jest.fn().mockImplementation((port, callback) => {
                if (callback) callback();
                return mockHttpServer;
            }),
            on: jest.fn(),
        };

        // Mock HTTPS server creation
        const mockHttpsServer = {
            listen: jest.fn().mockImplementation((port, callback) => {
                if (callback) callback();
                return mockHttpsServer;
            }),
            on: jest.fn(),
        };

        // Mock the http.createServer function
        const httpCreateServerSpy = jest.spyOn(require("http"), "createServer");
        httpCreateServerSpy.mockReturnValue(mockHttpServer);

        // Get the letsEncryptManager from the server and mock its methods
        const letsEncryptManager = (server as any).letsEncryptManager;

        // Mock the LetsEncryptManager methods
        const initializeSpy = jest.spyOn(letsEncryptManager, "initialize").mockResolvedValue(undefined);
        const createHttpsServerSpy = jest
            .spyOn(letsEncryptManager, "createHttpsServer")
            .mockReturnValue(mockHttpsServer);
        const scheduleRenewalSpy = jest.spyOn(letsEncryptManager, "scheduleRenewal").mockImplementation();

        // Call start - this should execute the startWithHttps method
        await server.start();

        // Verify the Let's Encrypt initialization was called
        expect(initializeSpy).toHaveBeenCalledTimes(1);

        // Verify HTTP server was created for ACME challenges
        expect(httpCreateServerSpy).toHaveBeenCalledWith(server.app);
        expect(mockHttpServer.listen).toHaveBeenCalledWith(80, expect.any(Function));
        expect(consoleLogSpy).toHaveBeenCalledWith("HTTP server listening on port 80 (ACME challenges only)");

        // Verify HTTPS server was created and started
        expect(createHttpsServerSpy).toHaveBeenCalledWith(server.app);
        expect(mockHttpsServer.listen).toHaveBeenCalledWith(443, expect.any(Function));
        expect(consoleLogSpy).toHaveBeenCalledWith("HTTPS server listening on port 443");

        // Verify automatic renewal was scheduled
        expect(scheduleRenewalSpy).toHaveBeenCalledTimes(1);

        // Clean up
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        httpCreateServerSpy.mockRestore();
        initializeSpy.mockRestore();
        createHttpsServerSpy.mockRestore();
        scheduleRenewalSpy.mockRestore();
    });

    test("should handle startWithHttps when certificate request is needed", async () => {
        // Create a Map with the test DataStore
        const dataStoresByGuild = new Map<string, DataStore>();
        dataStoresByGuild.set("test-guild-id", dataStore);

        const discordClientsByGuild = new Map();

        // Create LetsEncrypt config with enabled: true
        const letsEncryptConfig: LetsEncryptConfig = {
            enabled: true,
            email: "test@example.com",
            domain: "test.example.com",
            acmeDirectory: "https://acme-staging-v02.api.letsencrypt.org/directory",
            certsDir: "/tmp/certs",
        };

        // Create server with LetsEncrypt config
        const server = new ApiServer(3456, dataStoresByGuild, discordClientsByGuild, false, letsEncryptConfig);

        // Mock console.log and console.error
        const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

        // Mock HTTP server creation
        const mockHttpServer = {
            listen: jest.fn().mockImplementation((port, callback) => {
                if (callback) callback();
                return mockHttpServer;
            }),
            on: jest.fn(),
        };

        // Mock HTTPS server creation
        const mockHttpsServer = {
            listen: jest.fn().mockImplementation((port, callback) => {
                if (callback) callback();
                return mockHttpsServer;
            }),
            on: jest.fn(),
        };

        // Mock the http.createServer function
        const httpCreateServerSpy = jest.spyOn(require("http"), "createServer");
        httpCreateServerSpy.mockReturnValue(mockHttpServer);

        // Get the letsEncryptManager from the server and mock its methods
        const letsEncryptManager = (server as any).letsEncryptManager;

        // Mock the LetsEncryptManager methods - first call returns null, second returns server
        const initializeSpy = jest.spyOn(letsEncryptManager, "initialize").mockResolvedValue(undefined);
        const createHttpsServerSpy = jest
            .spyOn(letsEncryptManager, "createHttpsServer")
            .mockReturnValueOnce(null) // First call returns null (no existing cert)
            .mockReturnValueOnce(mockHttpsServer); // Second call returns server (after cert request)
        const requestCertificateSpy = jest.spyOn(letsEncryptManager, "requestCertificate").mockResolvedValue({
            cert: "/tmp/certs/test.crt",
            key: "/tmp/certs/test.key",
            chain: "/tmp/certs/test.chain.crt",
        });
        const scheduleRenewalSpy = jest.spyOn(letsEncryptManager, "scheduleRenewal").mockImplementation();

        // Call start - this should execute the startWithHttps method
        await server.start();

        // Verify the certificate request flow was executed
        expect(consoleLogSpy).toHaveBeenCalledWith("No valid certificate found, requesting new certificate...");
        expect(requestCertificateSpy).toHaveBeenCalledTimes(1);
        expect(createHttpsServerSpy).toHaveBeenCalledTimes(2); // Called twice - before and after cert request

        // Clean up
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        httpCreateServerSpy.mockRestore();
        initializeSpy.mockRestore();
        createHttpsServerSpy.mockRestore();
        requestCertificateSpy.mockRestore();
        scheduleRenewalSpy.mockRestore();
    });

    test("should handle startWithHttps when certificate request fails", async () => {
        // Create a Map with the test DataStore
        const dataStoresByGuild = new Map<string, DataStore>();
        dataStoresByGuild.set("test-guild-id", dataStore);

        const discordClientsByGuild = new Map();

        // Create LetsEncrypt config with enabled: true
        const letsEncryptConfig: LetsEncryptConfig = {
            enabled: true,
            email: "test@example.com",
            domain: "test.example.com",
            acmeDirectory: "https://acme-staging-v02.api.letsencrypt.org/directory",
            certsDir: "/tmp/certs",
        };

        // Create server with LetsEncrypt config
        const server = new ApiServer(3456, dataStoresByGuild, discordClientsByGuild, false, letsEncryptConfig);

        // Mock console.log and console.error
        const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

        // Mock HTTP server creation
        const mockHttpServer = {
            listen: jest.fn().mockImplementation((port, callback) => {
                if (callback) callback();
                return mockHttpServer;
            }),
            on: jest.fn(),
        };

        // Mock the http.createServer function
        const httpCreateServerSpy = jest.spyOn(require("http"), "createServer");
        httpCreateServerSpy.mockReturnValue(mockHttpServer);

        // Get the letsEncryptManager from the server and mock its methods
        const letsEncryptManager = (server as any).letsEncryptManager;

        // Mock the LetsEncryptManager methods - certificate request fails
        const initializeSpy = jest.spyOn(letsEncryptManager, "initialize").mockResolvedValue(undefined);
        const createHttpsServerSpy = jest.spyOn(letsEncryptManager, "createHttpsServer").mockReturnValue(null);
        const requestCertificateSpy = jest.spyOn(letsEncryptManager, "requestCertificate").mockResolvedValue(null);

        // Call start - this should execute the startWithHttps method
        await server.start();

        // Verify the failure case was handled
        expect(consoleLogSpy).toHaveBeenCalledWith("No valid certificate found, requesting new certificate...");
        expect(requestCertificateSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to start HTTPS server - no valid certificate available");
        expect(consoleLogSpy).toHaveBeenCalledWith("Continuing with HTTP-only server for ACME challenges");

        // Clean up
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        httpCreateServerSpy.mockRestore();
        initializeSpy.mockRestore();
        createHttpsServerSpy.mockRestore();
        requestCertificateSpy.mockRestore();
    });

    test("should throw error when startWithHttps is called without letsEncryptManager", async () => {
        // Create a Map with the test DataStore
        const dataStoresByGuild = new Map<string, DataStore>();
        dataStoresByGuild.set("test-guild-id", dataStore);

        const discordClientsByGuild = new Map();

        // Create server WITHOUT letsEncryptConfig (so letsEncryptManager will be null)
        const server = new ApiServer(3456, dataStoresByGuild, discordClientsByGuild, false);

        // Manually set letsEncryptManager to null to simulate the error condition
        (server as any).letsEncryptManager = null;

        // Try to call the private startWithHttps method directly and expect it to throw
        await expect((server as any).startWithHttps()).rejects.toThrow("Let's Encrypt manager not initialized");
    });

    test("should enforce HTTPS middleware when Let's Encrypt is enabled", async () => {
        // Create a Map with the test DataStore
        const dataStoresByGuild = new Map<string, DataStore>();
        dataStoresByGuild.set("test-guild-id", dataStore);

        const discordClientsByGuild = new Map();

        // Create LetsEncrypt config with enabled: true
        const letsEncryptConfig: LetsEncryptConfig = {
            enabled: true,
            email: "test@example.com",
            domain: "test.example.com",
            acmeDirectory: "https://acme-staging-v02.api.letsencrypt.org/directory",
            certsDir: "/tmp/certs",
        };

        // Create server with LetsEncrypt config to enable HTTPS middleware
        const server = new ApiServer(3456, dataStoresByGuild, discordClientsByGuild, false, letsEncryptConfig);

        // Test that non-secure requests to regular endpoints are blocked
        const response1 = await request(server.app).get("/health").expect(400);

        expect(response1.body).toEqual({
            error: "HTTPS required. This API only accepts secure connections.",
        });

        // Test that ACME challenge requests are allowed through (even without HTTPS)
        const response2 = await request(server.app).get("/.well-known/acme-challenge/test-challenge").expect(404); // 404 because no actual ACME challenge is set up, but it passes the HTTPS middleware

        // Test that requests with HTTPS headers are allowed through
        const response3 = await request(server.app).get("/health").set("X-Forwarded-Proto", "https").expect(200);

        expect(response3.body).toEqual({ status: "ok" });
    });
});
