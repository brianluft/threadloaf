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
2. Enable the following Privileged Gateway Intents:
   - SERVER MEMBERS
   - MESSAGE CONTENT
3. Generate a Bot Token and add it to your `.env` file
4. Invite the bot to your server with the following permissions:
   - Read Messages/View Channels
   - Read Message History
   - Use Public Threads

## API Endpoints

### GET /messages/:channelId

Returns all messages from the specified channel or thread from the last 24 hours.

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

### GET /forum-threads

Returns all forum threads with their latest 5 replies from the last 24 hours.

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

### GET /health

Health check endpoint that returns a status of "ok" if the service is running.

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