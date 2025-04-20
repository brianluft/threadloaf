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
const requiredEnvVars = ["DISCORD_TOKEN", "GUILD_ID", "PORT"];
const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error(`Missing required environment variables: ${missingEnvVars.join(", ")}`);
    console.error("Please create a .env file with these variables or set them in your environment");
    process.exit(1);
}

// Get environment variables
const token = process.env.DISCORD_TOKEN!;
const guildId = process.env.GUILD_ID!;
const port = parseInt(process.env.PORT!) || 3000;

// Initialize the data store
const dataStore = new DataStore();

// Initialize the Discord client
const discordClient = new DiscordClient(token, guildId, dataStore);

// Initialize and start the API server
const apiServer = new ApiServer(port, dataStore);
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
