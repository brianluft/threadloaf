# Discord 24-Hour Message Ingestion API

This API ingests Discord messages from the last 24 hours in a single Discord server and provides HTTP endpoints to access them.

## Features

- Tracks messages from public text channels and threads (including forum posts)
- Backfills 24 hours of message history on startup
- Provides HTTP API to access messages by channel/thread
- Provides forum thread overviews with their latest replies
- Maintains a rolling 24-hour window of messages

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy the env.example file to .env and update the values:
   ```
   cp env.example .env
   ```
   Then edit the .env file with your Discord bot token, guild ID, and preferred port.
4. Build the application:
   ```
   npm run build
   ```
5. Start the application:
   ```
   npm start
   ```

## Discord Bot Setup

1. Create a new Discord application and bot at [Discord Developer Portal](https://discord.com/developers/applications)
1. Under **General Information**:
   - Add icon.
   - Name: "Threadloaf Bot"
   - Description: "This bot keeps a short recent history of messages to support the Threadloaf browser extension."
   - Application ID: Copy and save
   - Public Key: Copy and save
1. Under **Installation**:
   - Installation Contexts: Guild Install only
   - Install Link: None
1. Under **Bot**:
   - Add icon.
   - Public Bot: uncheck
   - Enable the following Privileged Gateway Intents:
      - Server Members Intent
      - Message Content Intent
   - Generate a Bot Token and add it to your `.env` file and save to your password manager.
1. Under **OAuth2**:
   - Add Redirect: `https://example.com/callback` (it's not used but Discord requires it)
   - Scopes
      - bot
      - guilds
      - messages.read
   - Select Redirect URL: Choose the one entered earlier
   - Bot Permissions
      - View Channels
      - Read Message History
   - Integration Type: Guild Install
   - Copy the generated URL and visit it to grant permission and join the server.

For the Threadloaf Bot app, you should have this information saved in your password manager:
- Application ID
- Public Key
- API Token

### OAuth2 Application Setup (for Browser Extension Authentication)

For browser extension authentication, you'll need a separate OAuth2 application:

1. Create a **second** Discord application at [Discord Developer Portal](https://discord.com/developers/applications) (separate from the bot)
1. Under **General Information**:
   - Add icon.
   - Name: "Threadloaf" (production) or "Threadloaf Dev" (development)
   - Description: "Logging in will allow users of the Chatty@Home discord to access additional features of the Threadloaf browser extension."
   - Application ID: Copy and save
   - Public Key: Copy and save
1. Under **Installation**:
   - Installation Contexts: User Install only
   - Install Link: None
1. Under **OAuth2**:
   - Client ID: Copy and save
   - Client Secret: Reset, Copy, and save
   - Public Client: uncheck
   - Redirects: Add `https://api.threadloaf.com/auth/callback` (production) or `http://localhost:3000/auth/callback` (development)
   - Copy the development Client ID and Client Secret to your `.env` file as `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`
1. Under **Bot**:
   - Add icon.
   - Public Bot: uncheck
1. **Generate a JWT secret**: Create a random 256-bit key for JWT signing and add it to your `.env` file as `JWT_SECRET`. You can generate one using:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
1. Update your `.env` file with the OAuth2 credentials:
   ```
   DISCORD_CLIENT_ID=your_oauth2_client_id_here
   DISCORD_CLIENT_SECRET=your_oauth2_client_secret_here
   DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback
   JWT_SECRET=your_generated_jwt_secret_here
   ```

For the Threadloaf and Threadloaf Dev apps, you should have this information saved in your password manager:
- Application ID
- Public Key
- OAuth2 Client ID
- OAuth2 Client Secret
- JWT Secret
   
## API Endpoints

**Authentication Required**: All endpoints (except `/health`) require Bearer token authentication in the `Authorization` header. Tokens are obtained through the OAuth2 flow via the browser extension.

All endpoints require a `guildId` parameter in the URL path. The API will return a 400 error if an invalid or unconfigured guild ID is provided, and a 403 error if the authenticated user is not a member of the specified guild.

### GET /:guildId/messages/:channelId

Returns all messages from the specified channel or thread from the last 24 hours for the given guild.

**Parameters:**
- `guildId` - Discord guild/server ID that must be configured in the environment
- `channelId` - Discord channel or thread ID

**Response:**
```json
[
  {
    "id": "1234567890123456789",
    "content": "Hello world",
    "authorTag": "User#1234",
    "timestamp": 1693000000000
  },
  ...
]
```

**Error Response (Invalid Guild ID):**
```json
{
  "error": "Invalid guild ID"
}
```

### GET /:guildId/forum-threads

Returns all forum threads with their latest 5 replies from the last 24 hours for the given guild.

**Parameters:**
- `guildId` - Discord guild/server ID that must be configured in the environment

**Response:**
```json
[
  {
    "threadId": "9876543210987654321",
    "title": "Forum Post Title",
    "createdBy": "User#5678",
    "createdAt": 1692950000000,
    "latestReplies": [
      {
        "id": "1111111111111111111",
        "content": "Reply content",
        "authorTag": "User#9012",
        "timestamp": 1692960000000
      },
      ...
    ]
  },
  ...
]
```

**Error Response (Invalid Guild ID):**
```json
{
  "error": "Invalid guild ID"
}
```

### GET /auth/callback

OAuth2 callback endpoint for browser extension authentication. This endpoint handles the Discord OAuth2 authorization code flow and returns a JWT token to the extension.

**Note**: This endpoint is typically called automatically by Discord during the OAuth2 flow and not directly by clients.

### GET /health

Health check endpoint that returns a status of "ok" if the service is running. This endpoint does not require authentication.

## Development

To run the application in development mode with hot reloading:

```
npm run dev
```

## Testing

The API implementation has comprehensive tests to verify it meets the design specifications. The tests are written using Jest and do not depend on the real Discord API, ensuring they can run independently in any environment.

### Test Structure

Tests are organized in the `__tests__` directory with the following components:

1. **Unit Tests**
   - `data-store.test.ts` - Tests the in-memory data storage and pruning functionality
   - `api-server.test.ts` - Tests the HTTP API endpoints
   - `discord-client.test.ts` - Tests the Discord event handling and message ingestion

2. **Integration Tests**
   - `integration.test.ts` - End-to-end tests that verify the entire system works together

### Running Tests

To run all tests:

```bash
cd src/api
npm test
```

To run tests in watch mode during development:

```bash
npm run test:watch
```

### Test Coverage

The tests aim to provide at least 70% coverage of the codebase, focusing on the key functionalities:

1. Real-time message ingestion from channels and threads
2. Startup backfill of 24-hour history
3. In-memory data storage and pruning of old messages
4. HTTP API endpoints (messages and forum-threads)
5. Thread handling (creation, updates, deletion) 