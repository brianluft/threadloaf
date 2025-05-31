/**
 * Discord Bot API
 * Ingests the last 24 hours of Discord messages and provides an HTTP API to access them
 */

import dotenv from "dotenv";
import { DataStore } from "./data-store";
import { DiscordClient } from "./discord-client";
import { ApiServer } from "./api-server";

// Load environment variables
dotenv.config();

// Check for required environment variables
const requiredEnvVars = [
    "DISCORD_TOKEN",
    "GUILD_IDS",
    "PORT",
    "JWT_SECRET",
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "DISCORD_REDIRECT_URI",
];
const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error(`Missing required environment variables: ${missingEnvVars.join(", ")}`);
    console.error("Please create a .env file with these variables or set them in your environment");
    process.exit(1);
}

// Get environment variables
const token = process.env.DISCORD_TOKEN!;
const guildIdsString = process.env.GUILD_IDS!;
const port = parseInt(process.env.PORT!) || 3000;

// Parse guild IDs from comma-separated string
const guildIds = guildIdsString
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

if (guildIds.length === 0) {
    console.error("No valid guild IDs found in GUILD_IDS environment variable");
    process.exit(1);
}

console.log(`Monitoring ${guildIds.length} guild(s): ${guildIds.join(", ")}`);

// Create separate DataStore and DiscordClient instances for each guild
const dataStoresByGuild = new Map<string, DataStore>();
const discordClientsByGuild = new Map<string, DiscordClient>();

for (const guildId of guildIds) {
    // Initialize the data store for this guild
    const dataStore = new DataStore();
    dataStoresByGuild.set(guildId, dataStore);

    // Initialize the Discord client for this guild
    const discordClient = new DiscordClient(token, guildId, dataStore);
    discordClientsByGuild.set(guildId, discordClient);
}

// Initialize and start the API server with all data stores and Discord clients
const apiServer = new ApiServer(port, dataStoresByGuild, discordClientsByGuild);
apiServer.start();

// Handle process termination
process.on("SIGINT", () => {
    console.log("Shutting down...");
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.log("Shutting down...");
    process.exit(0);
});

// Handle uncaught exceptions and rejections
process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled rejection at:", promise, "reason:", reason);
});
