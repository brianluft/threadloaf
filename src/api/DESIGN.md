# Design Document: Discord.js Bot for 24-Hour Message Ingestion

## Overview  
This design outlines a Discord bot (written in TypeScript using **discord.js**) that logs the last 24 hours of public messages on a single Discord server. The bot captures messages from standard text channels, public threads (including forum posts), and provides an HTTP API to retrieve recent messages and forum thread overviews. It ignores any direct messages (DMs), private threads, and archived threads. At startup, the bot backfills the last 24 hours of messages (without using persistent storage) and continuously maintains an in-memory, rolling 24-hour window of messages and thread metadata. The bot leverages discord.js’s built-in reconnection and session resume capabilities (no custom reconnect logic) for reliability.

## Key Requirements  
- **Scope:** Operate in a single Discord guild (server) only, with all logic scoped to that guild’s channels.  
- **Message Capture:** Ingest all messages from: 
  - Regular text channels (public guild text channels).  
  - Public threads (both threads created in text channels and threads that represent forum posts in forum channels).  
  - Forum channel posts (each forum post is a thread – capture its metadata and initial post).  
- **Exclusions:** Do *not* capture DMs to the bot, private/locked threads, or any archived threads (ignore these entirely).  
- **Startup Backfill:** On launch, fetch and store all messages from the past 24 hours for each relevant channel/thread (since no database or persistent storage is used). This ensures the bot’s in-memory store initially covers the last day of activity.  
- **In-Memory Store:** Keep an in-memory record (cache) of messages and thread info, covering only a rolling 24-hour window. As time progresses, drop (evict) any messages older than 24 hours from memory.  
- **Reconnection:** Rely on discord.js’s built-in automatic reconnect and session **resume** behavior for maintaining connectivity – no custom reconnection handlers will be implemented.  
- **HTTP API:** Expose two HTTP GET endpoints for external access to the data:  
  1. **GET** `/messages/:channelId` – returns all cached messages from the last 24 hours for the specified channel or thread (by its ID).  
  2. **GET** `/forum-threads` – returns an overview of all tracked forum threads (from the last 24 hours) including thread metadata and the latest 5 replies in each thread.

## Discord.js Client Setup  
We will use the official **discord.js** library (v14+) with TypeScript for robust typings. The bot’s Discord client will be created with appropriate gateway intents to receive message events and thread events. In particular: 

- Enable `GatewayIntentBits.Guilds` and `GatewayIntentBits.GuildMessages` to receive events for messages posted in guild text channels and threads.  
- Enable the privileged `GatewayIntentBits.MessageContent` so that the bot can read the content of messages (required to log message text in message objects).  
- (No DM intent is needed since DMs are ignored, and no `GuildMembers` intent is required unless thread membership events are needed – in our case we only track public threads accessible to the bot.)  

Using discord.js, the client might be initialized as:  
```ts
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent, 
    // ...other intents if needed (e.g., GuildMessageReactions if reactions were relevant)
  ] 
});
```  
The bot will log in with its token via `client.login(token)` and listen for the **`ready`** event to know when it’s fully connected. Because discord.js automatically handles reconnections, we will **not** implement custom reconnect loops – if the connection drops, discord.js will attempt to resume the session (preserving the event stream) or perform a fresh login as needed.

Additionally, to ensure the bot only processes the single target server, we can either deploy the bot to only that guild or programmatically check `message.guild.id` against a configured guild ID in each handler (and ignore events from any other guild, if the bot is invited elsewhere by mistake).

## Real-Time Message Ingestion (Channels & Threads)  
Once the client is ready, the bot will listen to Discord events to ingest new messages in real time:

- **Message Creation:** Register an event handler for `client.on('messageCreate', ...)` to capture every new message posted in the guild. The callback receives a `Message` object. Within this handler, the bot will filter out any irrelevant messages:  
  - Ignore messages that are DMs (i.e. `message.guild` is `null`).  
  - Ignore messages in threads that are private (check if `message.channel.type === ChannelType.PrivateThread`, and skip if so).  
  - All other messages (those in normal text channels or in public threads) will be processed. The bot can identify if a message came from a thread by checking `message.channel.isThread()` or the channel’s type. For example, `ChannelType.PublicThread` indicates a thread channel ([javascript - How to extract forum channel ID from message using discordjs 14 - Stack Overflow](https://stackoverflow.com/questions/75532858/how-to-extract-forum-channel-id-from-message-using-discordjs-14#:~:text=You%20can%20check%20the%20channel%27s,parentId)). If needed, we can further distinguish forum threads: a forum thread message will have `message.channel.parent?.type === ChannelType.GuildForum` ([javascript - How to extract forum channel ID from message using discordjs 14 - Stack Overflow](https://stackoverflow.com/questions/75532858/how-to-extract-forum-channel-id-from-message-using-discordjs-14#:~:text=You%20can%20check%20the%20channel%27s,parentId)). This ensures we capture messages from forum posts as well.  

  For each incoming eligible message, the bot will insert it into the in-memory store (described later) and then immediately prune any messages older than 24h from that store. The `Message` object provides the necessary data (e.g., `message.id`, `message.content`, `message.author.id` or tag, and `message.createdTimestamp`). We will extract and store the relevant fields for memory efficiency.  

- **Thread Creation:** In addition to message events, we handle new thread events via `client.on('threadCreate', ...)`. This is crucial for capturing **forum posts** (which are implemented as threads under a forum channel) and any thread started from a message in a text channel. The handler will run whenever a new thread is created (and the bot gains access to it) ([Threads | discord.js Guide](https://discordjs.guide/popular-topics/threads#:~:text=Threads%20introduce%20a%20number%20of,events%2C%20which%20are%20listed%20below)). In the callback, we receive a `ThreadChannel` object:  
  - If the new thread’s type is `GUILD_PUBLIC_THREAD` (discord.js enum `ChannelType.GuildPublicThread`), and it is in a public context (not a private thread), we proceed to log it ([javascript - Extracting complete forum data from a thread starter message with Discord.js 14 - Stack Overflow](https://stackoverflow.com/questions/76363519/extracting-complete-forum-data-from-a-thread-starter-message-with-discord-js-14#:~:text=client.on%28%27threadCreate%27%2C%20async%20%28thread%29%20%3D,)). For forum channels, all threads are effectively public forum posts, so they will meet this condition. We ignore `GUILD_PRIVATE_THREAD` types entirely.  
  - **Thread Metadata:** We record key metadata about the thread, such as its `id`, `name` (title), parent channel (forum or text channel) via `thread.parentId` or `thread.parent`, and creation timestamp. This information is stored in a separate in-memory structure for thread tracking (especially used for the forum overview API).  
  - **Root Post Message:** We also fetch the thread’s initial message (the first message that started the thread). Discord.js provides a method `ThreadChannel.fetchStarterMessage()` to get this first message easily ([ThreadChannel (discord.js - main) | discord.js](https://discord.js.org/docs/packages/discord.js/main/ThreadChannel:Class#:~:text=fetchStarterMessage)). Alternatively, we could fetch the latest messages in the thread and grab the earliest, since the thread is new (e.g., `const messages = await thread.messages.fetch(); const firstMessage = messages.first();` as shown in an example ([javascript - Extracting complete forum data from a thread starter message with Discord.js 14 - Stack Overflow](https://stackoverflow.com/questions/76363519/extracting-complete-forum-data-from-a-thread-starter-message-with-discord-js-14#:~:text=const%20,js))). Using `fetchStarterMessage()` is straightforward to retrieve the root post content. This root message (if available and not deleted) will be added to the message store as well, so that our logs include the initial post content of forum threads.  
  - Optionally, for completeness, the bot can call `thread.join()` on new threads if needed to ensure it continues to receive `messageCreate` events for that thread (in most cases, if the bot has the proper permissions to view the thread, it will receive events without explicitly joining, but joining guarantees subscription to the thread’s updates).  

By combining `messageCreate` and `threadCreate` events, we handle both regular messages and the creation of new threads. This covers forum posts (which may otherwise not emit a normal message event for the initial post, depending on Discord’s event sequence) and ensures no messages are missed. The bot does not need to handle `messageUpdate` (edits) for this use-case, as we only log creation time content. It also does not handle reactions or typing events, keeping implementation simple.

## Startup Backfill (24-Hour History)  
On startup (in the `ready` event handler), the bot will perform a one-time backfill of the last 24 hours of messages for all relevant channels. Since we are not using any persistent database, this bootstrap ensures the in-memory cache is pre-populated with recent history. The steps are:

1. **Identify Guild and Channels:** Obtain the `Guild` object for the single target server (for example, via `client.guilds.cache.get(GUILD_ID)` if the guild ID is known/configured). From the guild, get all text-based channels. This includes:  
   - Standard text channels (`GuildText`), and announcement/news channels (`GuildAnnouncement`), which can also have messages.  
   - Forum channels (`GuildForum`), which themselves don’t contain messages directly but contain threads (each thread is a forum post).  
   - We will exclude any channel types that are not relevant (voice channels, categories, etc.).  

2. **Fetch Messages from Text Channels:** For each normal text channel, fetch recent messages via the Discord API. We can use `channel.messages.fetch()` with a limit and then filter by time. For example:  
   ```ts
   const now = Date.now();
   const messages = await textChannel.messages.fetch({ limit: 100 });
   const recentMessages = messages.filter(m => now - m.createdTimestamp < 24 * 60 * 60 * 1000);
   ```  
   This fetches up to the last 100 messages and then filters those from the past 24h. If the channel had more than 100 messages in 24h, we might need to fetch in batches (e.g., keep fetching older messages using `fetch({ before: oldestMessageId })` until reaching beyond 24h). For simplicity, we assume typical channels where 100 is sufficient, but the design can accommodate looping fetch calls until the time threshold is met. We then add all these recent messages to the in-memory store for that channel. 

3. **Fetch Active Threads:** We need to capture threads (both forum posts and threads in text channels). Discord provides an API to list active (unarchived) threads. We will call `guild.channels.fetchActiveThreads()` to get all active thread channels in the guild ([GuildChannelManager (discord.js - 14.14.0)](https://discord.js.org/docs/packages/discord.js/14.14.0/GuildChannelManager:Class#:~:text=Obtains%20all%20active%20thread%20channels,then%28fetched)). This returns an object containing a collection of `ThreadChannel` objects that are currently open (not archived). We iterate through each thread in this collection:  
   - Skip any thread that is private (`thread.type === ChannelType.GuildPrivateThread`), to adhere to the “ignore private threads” rule. All others are public threads (either in a forum or a normal text channel).  
   - For each remaining thread, fetch recent messages from it similar to above. We can use `thread.messages.fetch({ limit: 100 })` to get the latest messages in that thread and filter those from the last 24 hours. Since these threads are active, any recent activity will be captured. (If a thread has had no activity in >24h, it might still appear in active threads if not auto-archived yet, but its messages will all be older than 24h – after filtering, we may end up with none, effectively skipping it.)  
   - Also, for each thread (particularly forum threads), record its metadata (ID, name, parent forum, creation time) in the thread metadata store. If the thread was created within the last 24h, its initial message would be fetched and included; if it was created earlier but has recent replies, we’ll have those replies in store but possibly not the very first message if it’s older than 24h. (We only guarantee storing content from the last day.)  

4. **Skip Archived Threads:** By using `fetchActiveThreads()`, we inherently skip archived threads. We do not attempt to fetch messages from archived threads, even if they had recent posts just before archiving, per requirements to ignore them. This simplifies the backfill and ensures we only track currently active conversations.

After this startup routine, the in-memory store will contain up to 24 hours of recent messages for each text channel and thread (including forum posts). The data structures for storage are described next.

## In-Memory Data Storage & Pruning Strategy  
All ingested data is stored in memory (e.g., in JS objects/structures) and constrained to a 24-hour window to limit memory usage.

**Message Storage Structure:** We use a JavaScript `Map` (or dictionary) to map each channel or thread ID to the recent messages in that channel. For example:  
```ts
type StoredMessage = { id: string, content: string, authorTag: string, timestamp: number };  
const messagesByChannel: Map<string, StoredMessage[]> = new Map();
```  
Each key is a channel ID (could be a text channel ID or a thread ID, since threads are channels too). The value is an array (acting as a queue) of message objects in that channel, sorted by chronological order (oldest first). We will store only minimal necessary fields for each message (e.g., message ID, content, author username or tag, and timestamp) to keep memory usage efficient, rather than storing the full discord.js `Message` object. 

**Thread Metadata:** We maintain a separate structure for forum thread tracking. For instance, a `Map` of thread ID to a metadata object:  
```ts
type ThreadMeta = { id: string, title: string, parentChannel: string, createdAt: number, createdBy: string };  
const forumThreads: Map<string, ThreadMeta> = new Map();
```  
This `forumThreads` map will only contain entries for threads that are forum posts (we can identify those by checking if the thread’s parent channel is of type Forum). The metadata includes the thread’s title (which is the forum post title), the parent forum channel ID (for reference), creation timestamp, and perhaps the creator’s tag or ID. This info is logged on thread creation. We do *not* necessarily need to track non-forum threads here, since the `/forum-threads` API specifically targets forum posts. (However, if desired, a similar map could track all active thread channels, but we focus on forum threads per requirements.)

**Adding Messages:** When a new message event is received or on initial backfill, we insert the message into the appropriate array in `messagesByChannel`. We ensure the array remains sorted by time. If we always append new messages (which arrive in real-time chronological order) and we initially sorted the backfilled messages, the invariant holds. For example, upon receiving a new message via `messageCreate`, we do:  
```ts
const list = messagesByChannel.get(channelId) ?? [];  
list.push(newMsgObject);  
messagesByChannel.set(channelId, list);
```  
Before or after adding, we perform pruning on that list.

**Pruning Old Messages:** Every time a message is added, the bot will remove any messages older than 24 hours from that channel’s list. Since the list is sorted by age, this can be done by checking the first element(s). We compute a cutoff timestamp = (current time - 24 hours). Then, in a loop, while the oldest message’s timestamp is less than the cutoff, remove it (e.g., use `list.shift()` to drop the first element). This efficiently maintains the 24h window per channel. For example:  
```ts
const cutoff = Date.now() - 24*60*60*1000;  
while(list.length && list[0].timestamp < cutoff) {
    list.shift();
}
```  
This operation is O(n) in the number of expired messages, which should be acceptable as pruning happens incrementally. Additionally, we can schedule a periodic cleanup (say every hour) to prune any stale messages across all channels, in case a channel becomes inactive (no new messages to trigger pruning) – this ensures memory is freed even if no new events occur. The periodic job would iterate all `messagesByChannel` entries and perform the same check/removal of old messages.

If after pruning, a channel’s list becomes empty (meaning no messages in the last 24h), we can optionally remove that key from the map to avoid clutter. Particularly for threads: if a thread has no recent messages left, we might remove its entry. For forum threads, we would also remove its metadata from `forumThreads` at that point, since it no longer has relevant data (the thread either went inactive >24h or was archived/deleted).

**Dropping Archived/Deleted Threads:** To complement the above, we listen for thread updates and deletions:  
- On `threadUpdate` events, if a thread transitions to an archived state (`newThread.archived === true`), we will remove that thread’s data from both `messagesByChannel` and `forumThreads` (if present). This ensures we immediately stop tracking an archived thread (even if some messages were within 24h) – fulfilling the “ignore archived threads” rule. (Note: archived threads won’t get new messages anyway, but this cleans up any recent messages that were logged from just before archiving.)  
- On `threadDelete` events, similarly, we drop all data for that thread from memory. This handles cases where a thread is deleted manually or the parent channel is deleted. 

These removals keep the in-memory structures consistent and bounded in size. All modifications to the in-memory store occur within the single-threaded Node.js event loop, so we avoid race conditions by design (discussed more under Thread Safety). 

## HTTP API Endpoints (Express)  
We will create a lightweight HTTP server to expose the required endpoints. **Express.js** is a suitable choice (npm package `express`) for its simplicity and familiarity. We’ll set up an Express app and define two GET routes:

1. **GET `/messages/:channelId`:** Returns the recent messages (last 24h) from the specified channel or thread.  
   - **Input:** `channelId` path param – this can be a text channel ID or a thread ID.  
   - **Operation:** Look up the `channelId` in the `messagesByChannel` map. If found, retrieve the array of stored messages. If not found (e.g., unknown ID or no recent messages), return an empty list (or a 404 if we want to signal invalid channel).  
   - **Output:** A JSON array of message objects from that channel. Each object will include fields like message ID, content, author (could be author tag or username), and timestamp. For example:  
     ```json
     [
       {
         "id": "111111111111111111",
         "content": "Hello world",
         "authorTag": "User#1234",
         "timestamp": 1693000000000
       },
       ...
     ]
     ```  
     This represents all messages from that channel in the last 24h, sorted by time (oldest first or newest first – we can choose, but likely chronological order). We might choose to return them in chronological order (oldest to newest) for natural reading.  
   - This endpoint treats thread IDs the same as any channel ID. So if the `channelId` is a thread, it returns that thread’s messages. (Clients can differentiate by looking at the channel ID or by knowing which IDs are threads.)

2. **GET `/forum-threads`:** Returns an overview of all active forum threads (posts) tracked in the last 24h, with their latest 5 replies.  
   - **Operation:** We iterate over the `forumThreads` map (which contains metadata for forum posts that have been active in the last day). For each thread in this map:  
     - Get the thread’s metadata (title, etc.).  
     - Fetch the corresponding messages from `messagesByChannel` (using the thread ID as key). This gives all recent messages in that thread. From these, we will extract up to the last 5 **replies**. By “replies” we mean messages in the thread **excluding** the initial post. Typically, the first message in a forum thread is the root post, and subsequent messages are replies. So we can skip the first message in that thread’s list (if it represents the root) and take the last 5 of the remaining messages. (If a thread has fewer than 5 replies in the last 24h, we will return all of them. If it has none – i.e., no replies, only the root post – then the replies list could be empty.)  
     - Construct an object for the thread. For example:  
       ```json
       {
         "threadId": "222222222222222222",
         "title": "Forum Post Title",
         "createdBy": "AuthorUser#0001",
         "createdAt": 1692950000000,
         "latestReplies": [
           { "id": "...", "content": "...", "authorTag": "...", "timestamp": ... },
           ... up to 5 objects
         ]
       }
       ```  
       We include the thread’s title and maybe creator for context, and the array of latest reply messages (each with similar fields as above). We intentionally separate the initial post (metadata) from the replies. If desired, we could also include the content of the root post here, but since the requirement phrased it as replies, we keep the root content out (the client could fetch the full thread via the first endpoint if needed).  
   - **Output:** A JSON array of these thread summary objects for all forum threads active in the last day. The list can be in no particular guaranteed order (or sorted by creation or activity time if we want). It provides a quick snapshot of recent forum discussions.  

We will use Express to implement these endpoints, utilizing `app.get('/messages/:channelId', ...)` and `app.get('/forum-threads', ...)`. The Express app will run on a specified port (e.g., 3000). Since this is a simple GET-only API, we don’t need body parsing middleware; we may use `express.json()` for consistency. We might also include CORS support (`cors` package) if these endpoints are called from a browser, but that depends on the use-case (not strictly required in design).

**Recommended NPM Packages:**  
- **express** – for the HTTP server and routing.  
- **@types/express** – TypeScript type definitions for Express.  
- (Optionally **cors** for cross-origin resource sharing if needed, and maybe **dotenv** to load config like the bot token and server port from a .env file.)

Each route handler will be careful to read from the in-memory store (which is updated by the bot) but not modify it. The data returned is a snapshot of the recent messages. 

## Concurrency and Thread-Safety Considerations  
Node.js operates on a single-threaded event loop, which simplifies thread safety – our Discord event handlers and HTTP request handlers do not run in parallel threads. However, since the bot will be handling Discord events and HTTP requests interleavedly, we ensure the design is safe from race conditions:

- **Atomic Operations:** Updates to the in-memory store (adding and pruning messages) occur within the synchronous execution of event callbacks (`messageCreate`, `threadCreate`, etc.). Reads (for HTTP responses) happen in Express route handlers. Because both types of handlers execute in the same event loop, one cannot preempt the other mid-operation. For example, if a message event is being processed and updating the store, an incoming HTTP request will wait until that tick completes before its handler runs. This means we won’t encounter simultaneous read/write on the data structure in pure Node.js execution. We will avoid using any `setTimeout` or asynchronous file I/O that could intermix in unsafe ways around data mutation without careful order. 

- **Data Locking:** We do not need explicit locks or mutexes due to the above. Each update (like removing old messages) is done quickly and the data remains consistent. It’s good practice to keep these operations efficient to minimize blocking of the event loop. Our use of array operations and map access is O(n) in the number of messages which is bounded by the volume of 24h data. This is manageable for typical server activity. If extremely high traffic is expected, we could consider more efficient data structures (like a min-heap for global oldest message or a deque per channel) to drop old messages even faster, but that adds complexity. Simplicity is prioritized here.

- **Thread-Safe Patterns:** If the bot’s environment ever used worker threads or clustering (not planned), we would need a different approach (like a shared external store or message passing). In our single-process design, the pattern of “modify on events, read on request” is safe. We ensure to *never* modify the data structure while iterating it in another context. For example, when building the `/forum-threads` response, we only read from the `forumThreads` map and each thread’s message list; we do not modify them in that moment. If an event comes in during that time, it will queue until the response is finished assembling.

In summary, the design leverages Node’s single-thread model to keep the implementation straightforward and inherently thread-safe for our purposes. Care will be taken to handle promise rejections (e.g., if a fetch fails) so as not to crash the app, but these are peripheral concerns.

## Discord.js Event Handlers Summary  
For clarity, here are the Discord client event handlers we will register and their roles:

- **`client.on('ready', ...)`:** On bot startup, trigger the backfill routine to load the last 24h of messages from all channels and active threads. Also log that the bot is connected and perhaps set the bot’s presence/status if desired.  

- **`client.on('messageCreate', message => {...})`:** Handle every new message in guild channels/threads. Filters out DMs and private threads, then stores the message in memory and prunes old entries. This uses the `Message` class from discord.js (with properties like `message.content`, `message.author`, etc.).  

- **`client.on('threadCreate', thread => {...})`:** Handle newly created threads. If it’s a forum post or other public thread, record its metadata (`ThreadChannel.name`, `id`, etc.) and fetch the starter message to store. Possibly call `thread.join()` to subscribe to future messages (ensuring subsequent `messageCreate` events for that thread will fire). This uses the `ThreadChannel` class and its methods like `fetchStarterMessage()` ([ThreadChannel (discord.js - main) | discord.js](https://discord.js.org/docs/packages/discord.js/main/ThreadChannel:Class#:~:text=fetchStarterMessage)) or `thread.messages.fetch()`.  

- **`client.on('threadUpdate', (oldThread, newThread) => {...})`:** Monitor thread state changes. If a thread was open and now `newThread.archived` is true (archived) ([Threads | discord.js Guide](https://discordjs.guide/popular-topics/threads#:~:text=%2A%20Client,open%20in%20new%20window%3A%20Emitted)), purge that thread’s data from memory (both messages and metadata). Also, if needed, handle name changes (we could update the thread title in metadata if `newThread.name` differs, though not critical for functionality).  

- **`client.on('threadDelete', thread => {...})`:** When a thread is deleted, remove its messages and metadata from the store. This prevents orphan data lingering for a deleted channel.  

*(We do not register handlers for things like `messageDelete` or `channelDelete` in this design, but those could be added to clean up data if messages or entire channels are removed. The current requirements didn’t call for that explicitly, so we keep the implementation minimal.)*

By utilizing these event handlers and data management routines, the bot will meet the requirements with clarity. The approach uses direct discord.js methods and classes (like `TextChannel.messages.fetch`, `ThreadManager.fetchActive()`, `Message` and `ThreadChannel` objects, etc.) to keep the logic straightforward. The HTTP API layer remains separate and simple via Express.

## Conclusion  
This design emphasizes simplicity and clarity. It relies on discord.js’s robust event system and collections to gather data, and uses plain in-memory JavaScript structures to store and retrieve recent messages. With proper filtering and pruning, it fulfills the 24-hour window constraint. The separation of concerns (Discord event handling vs. HTTP serving) and careful use of built-in features (such as automatic resume and thread events) ensure the bot is both easy to implement and maintain. The next step would be to translate this design into a concrete TypeScript implementation following these guidelines. 

