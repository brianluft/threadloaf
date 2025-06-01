import { ApiServer } from "../../api-server";
import { DataStore } from "../../data-store";
import { DiscordClient } from "../../discord-client";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import axios from "axios";

jest.mock("../../data-store");
jest.mock("axios");
jest.mock("jsonwebtoken");

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe("ApiServer OAuth2", () => {
    let app: express.Express;
    let dataStore: jest.Mocked<DataStore>;
    let discordClient: jest.Mocked<DiscordClient>;
    let mockFetch: jest.Mock;
    const TEST_GUILD_ID = "test-guild-id";

    beforeEach(() => {
        jest.clearAllMocks();

        // Set up environment variables for tests
        process.env.JWT_SECRET = "test-secret";
        process.env.DISCORD_CLIENT_ID = "test-client-id";
        process.env.DISCORD_CLIENT_SECRET = "test-client-secret";
        process.env.DISCORD_REDIRECT_URI = "http://localhost:3000/auth/callback";

        dataStore = new DataStore() as jest.Mocked<DataStore>;

        // Create mock Discord client
        mockFetch = jest.fn();
        const mockGuild = {
            members: {
                fetch: mockFetch,
            },
        };

        discordClient = {
            getClient: jest.fn().mockReturnValue({
                guilds: {
                    cache: {
                        get: jest.fn().mockReturnValue(mockGuild),
                    },
                },
            }),
        } as unknown as jest.Mocked<DiscordClient>;

        const dataStoresByGuild = new Map<string, DataStore>();
        const discordClientsByGuild = new Map<string, DiscordClient>();
        dataStoresByGuild.set(TEST_GUILD_ID, dataStore);
        discordClientsByGuild.set(TEST_GUILD_ID, discordClient);

        // Create API server with authentication ENABLED
        const apiServer = new ApiServer(3000, dataStoresByGuild, discordClientsByGuild, true);
        // @ts-ignore - access private property for testing
        app = apiServer.app;
    });

    describe("OAuth2 config endpoint", () => {
        test("should return OAuth2 configuration", async () => {
            const response = await request(app).get("/auth/config");

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                clientId: "test-client-id",
                redirectUri: "http://localhost:3000/auth/callback",
            });
        });
    });

    describe("OAuth2 callback endpoint", () => {
        test("should handle successful OAuth2 callback", async () => {
            const mockTokenResponse = {
                data: {
                    access_token: "mock-access-token",
                },
            };

            const mockUserResponse = {
                data: {
                    id: "user-123",
                },
            };

            mockedAxios.post.mockResolvedValueOnce(mockTokenResponse);
            mockedAxios.get.mockResolvedValueOnce(mockUserResponse);
            mockedJwt.sign.mockReturnValue("mock-jwt-token" as any);

            // Mock guild membership check
            mockFetch.mockResolvedValue({ id: "user-123" });

            const response = await request(app).get("/auth/callback").query({ code: "test-code", state: "test-state" });

            expect(response.status).toBe(200);
            expect(response.text).toContain("mock-jwt-token");
            expect(mockedAxios.post).toHaveBeenCalledWith(
                "https://discord.com/api/oauth2/token",
                expect.any(URLSearchParams),
                expect.any(Object),
            );
            expect(mockedAxios.get).toHaveBeenCalledWith("https://discord.com/api/users/@me", {
                headers: { Authorization: "Bearer mock-access-token" },
            });
        });

        test("should return 400 for missing code parameter", async () => {
            const response = await request(app).get("/auth/callback").query({ state: "test-state" });

            expect(response.status).toBe(400);
            expect(response.text).toBe("Missing code or state parameter");
        });

        test("should return 400 for missing state parameter", async () => {
            const response = await request(app).get("/auth/callback").query({ code: "test-code" });

            expect(response.status).toBe(400);
            expect(response.text).toBe("Missing code or state parameter");
        });

        test("should return 403 for user not in guild", async () => {
            const mockTokenResponse = {
                data: {
                    access_token: "mock-access-token",
                },
            };

            const mockUserResponse = {
                data: {
                    id: "user-123",
                },
            };

            mockedAxios.post.mockResolvedValueOnce(mockTokenResponse);
            mockedAxios.get.mockResolvedValueOnce(mockUserResponse);

            // Mock guild membership check - user not found
            mockFetch.mockRejectedValue(new Error("Member not found"));

            const response = await request(app).get("/auth/callback").query({ code: "test-code", state: "test-state" });

            expect(response.status).toBe(403);
            expect(response.text).toBe("User is not a member of any configured guild");
        });

        test("should handle OAuth errors gracefully", async () => {
            mockedAxios.post.mockRejectedValueOnce(new Error("Discord API error"));

            const response = await request(app).get("/auth/callback").query({ code: "test-code", state: "test-state" });

            expect(response.status).toBe(500);
            expect(response.text).toBe("Authentication failed");
        });
    });

    describe("Authentication middleware", () => {
        test("should require authentication for protected routes", async () => {
            const response = await request(app)
                .post(`/${TEST_GUILD_ID}/messages`)
                .send({ channelIds: ["test"], maxMessagesPerChannel: 10 });

            expect(response.status).toBe(401);
            expect(response.body).toEqual({ error: "Authentication required" });
        });

        test("should accept valid JWT token", async () => {
            const mockPayload = { sub: "user-123" };
            mockedJwt.verify.mockReturnValue(mockPayload as any);

            // Mock guild membership check
            mockFetch.mockResolvedValue({ id: "user-123" });

            dataStore.getMessagesForChannel.mockReturnValue([]);

            const response = await request(app)
                .post(`/${TEST_GUILD_ID}/messages`)
                .set("Authorization", "Bearer valid-token")
                .send({ channelIds: ["test"], maxMessagesPerChannel: 10 });

            expect(response.status).toBe(200);
            expect(mockedJwt.verify).toHaveBeenCalledWith("valid-token", "test-secret");
        });

        test("should reject invalid JWT token", async () => {
            mockedJwt.verify.mockImplementation(() => {
                throw new Error("Invalid token");
            });

            const response = await request(app)
                .post(`/${TEST_GUILD_ID}/messages`)
                .set("Authorization", "Bearer invalid-token")
                .send({ channelIds: ["test"], maxMessagesPerChannel: 10 });

            expect(response.status).toBe(401);
            expect(response.body).toEqual({ error: "Invalid token" });
        });

        test("should deny access if user not in guild", async () => {
            const mockPayload = { sub: "user-123" };
            mockedJwt.verify.mockReturnValue(mockPayload as any);

            // Mock guild membership check - user not found
            mockFetch.mockRejectedValue(new Error("Member not found"));

            const response = await request(app)
                .post(`/${TEST_GUILD_ID}/messages`)
                .set("Authorization", "Bearer valid-token")
                .send({ channelIds: ["test"], maxMessagesPerChannel: 10 });

            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: "Access denied" });
        });
    });

    describe("Guild membership caching", () => {
        test("should cache guild membership checks", async () => {
            const mockPayload = { sub: "user-123" };
            mockedJwt.verify.mockReturnValue(mockPayload as any);

            // Mock guild membership check
            mockFetch.mockResolvedValue({ id: "user-123" });

            dataStore.getMessagesForChannel.mockReturnValue([]);

            // First request
            await request(app)
                .post(`/${TEST_GUILD_ID}/messages`)
                .set("Authorization", "Bearer valid-token")
                .send({ channelIds: ["test"], maxMessagesPerChannel: 10 });

            // Second request - should use cache
            await request(app)
                .post(`/${TEST_GUILD_ID}/messages`)
                .set("Authorization", "Bearer valid-token")
                .send({ channelIds: ["test"], maxMessagesPerChannel: 10 });

            // Guild membership should only be checked once (cached on second call)
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe("Edge cases", () => {
        test("should handle Discord client not found", async () => {
            const mockPayload = { sub: "user-123" };
            mockedJwt.verify.mockReturnValue(mockPayload as any);

            // Create API server with no Discord clients
            const emptyDataStores = new Map<string, DataStore>();
            const emptyDiscordClients = new Map<string, DiscordClient>();
            emptyDataStores.set(TEST_GUILD_ID, dataStore);

            const testApiServer = new ApiServer(3001, emptyDataStores, emptyDiscordClients, true);
            // @ts-ignore - access private property for testing
            const testApp = testApiServer.app;

            const response = await request(testApp)
                .post(`/${TEST_GUILD_ID}/messages`)
                .set("Authorization", "Bearer valid-token")
                .send({ channelIds: ["test"], maxMessagesPerChannel: 10 });

            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: "Access denied" });
        });

        test("should handle guild not found in Discord client", async () => {
            const mockPayload = { sub: "user-123" };
            mockedJwt.verify.mockReturnValue(mockPayload as any);

            // Mock Discord client with no guild
            const noGuildClient = {
                getClient: jest.fn().mockReturnValue({
                    guilds: {
                        cache: {
                            get: jest.fn().mockReturnValue(null), // No guild found
                        },
                    },
                }),
            } as unknown as jest.Mocked<DiscordClient>;

            const dataStoresByGuild = new Map<string, DataStore>();
            const discordClientsByGuild = new Map<string, DiscordClient>();
            dataStoresByGuild.set(TEST_GUILD_ID, dataStore);
            discordClientsByGuild.set(TEST_GUILD_ID, noGuildClient);

            const testApiServer = new ApiServer(3002, dataStoresByGuild, discordClientsByGuild, true);
            // @ts-ignore - access private property for testing
            const testApp = testApiServer.app;

            const response = await request(testApp)
                .post(`/${TEST_GUILD_ID}/messages`)
                .set("Authorization", "Bearer valid-token")
                .send({ channelIds: ["test"], maxMessagesPerChannel: 10 });

            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: "Access denied" });
        });

        test("should handle guild membership check error", async () => {
            const mockPayload = { sub: "user-123" };
            mockedJwt.verify.mockReturnValue(mockPayload as any);

            // Mock to throw an error during guild membership check
            const errorFetch = jest.fn().mockRejectedValue(new Error("Discord API error"));
            const errorClient = {
                getClient: jest.fn().mockReturnValue({
                    guilds: {
                        cache: {
                            get: jest.fn().mockReturnValue({
                                members: {
                                    fetch: errorFetch,
                                },
                            }),
                        },
                    },
                }),
            } as unknown as jest.Mocked<DiscordClient>;

            const dataStoresByGuild = new Map<string, DataStore>();
            const discordClientsByGuild = new Map<string, DiscordClient>();
            dataStoresByGuild.set(TEST_GUILD_ID, dataStore);
            discordClientsByGuild.set(TEST_GUILD_ID, errorClient);

            const testApiServer = new ApiServer(3003, dataStoresByGuild, discordClientsByGuild, true);
            // @ts-ignore - access private property for testing
            const testApp = testApiServer.app;

            const response = await request(testApp)
                .post(`/${TEST_GUILD_ID}/messages`)
                .set("Authorization", "Bearer valid-token")
                .send({ channelIds: ["test"], maxMessagesPerChannel: 10 });

            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: "Access denied" });
        });

        test("should deny access in forum-threads endpoint", async () => {
            const mockPayload = { sub: "user-123" };
            mockedJwt.verify.mockReturnValue(mockPayload as any);

            // Mock guild membership check to fail
            mockFetch.mockRejectedValue(new Error("Member not found"));

            const response = await request(app)
                .get(`/${TEST_GUILD_ID}/forum-threads`)
                .set("Authorization", "Bearer valid-token");

            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: "Access denied" });
        });

        test("should log errors during guild membership check", async () => {
            const mockPayload = { sub: "user-123" };
            mockedJwt.verify.mockReturnValue(mockPayload as any);

            // Mock console.error to verify it's called
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            // Mock to throw an error that reaches the catch block
            const errorFetch = jest.fn().mockRejectedValue(new Error("Network error"));
            const errorClient = {
                getClient: jest.fn().mockReturnValue({
                    guilds: {
                        cache: {
                            get: jest.fn().mockReturnValue({
                                members: {
                                    fetch: errorFetch,
                                },
                            }),
                        },
                    },
                }),
            } as unknown as jest.Mocked<DiscordClient>;

            const dataStoresByGuild = new Map<string, DataStore>();
            const discordClientsByGuild = new Map<string, DiscordClient>();
            dataStoresByGuild.set(TEST_GUILD_ID, dataStore);
            discordClientsByGuild.set(TEST_GUILD_ID, errorClient);

            const testApiServer = new ApiServer(3004, dataStoresByGuild, discordClientsByGuild, true);
            // @ts-ignore - access private property for testing
            const testApp = testApiServer.app;

            await request(testApp)
                .post(`/${TEST_GUILD_ID}/messages`)
                .set("Authorization", "Bearer valid-token")
                .send({ channelIds: ["test"], maxMessagesPerChannel: 10 });

            expect(consoleErrorSpy).toHaveBeenCalledWith("Error checking guild membership:", expect.any(Error));
            consoleErrorSpy.mockRestore();
        });

        test("should access Discord client via getClient method", () => {
            // Test the getClient method on DiscordClient
            const client = discordClient.getClient();
            expect(client).toBeDefined();
            expect(discordClient.getClient).toHaveBeenCalled();
        });
    });
});
