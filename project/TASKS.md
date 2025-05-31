When you've completed a cohesive unit of work and the tests are PASSING, make a git commit and check off the task below. If you get stuck, `git reset --hard main` to return to your last git commit. We start off with a working codebase. The API starts off at 100% code/branch test coverage.

# Multi-server support (API)
We support only a single GUILD_ID. We need to support monitoring multiple independent servers.

- [X] Environment file will provide a list of guild IDs instead of just one.
- [X] API: Use a separate DiscordClient and DataStore per guild to keep them separate.
- [X] Update API endpoints so they all take a guild ID in the URL path, at the beginning. e.g. `/:guildId/messages/:channelId`.
- [X] Return a 400 error if the client's guild ID is not one of our configured guild IDs, but don't leak what the right ones are.
- [X] Update readme and test.http with updated endpoints
- [X] Update tests and regain 100% code/branch test coverage.

# Return messages from multiple channels in one request (API)
Our design for `/:guildId/messages/:channelId` forces the client to make lots of requests. Let's fix that.

- [X] Instead of a single channel ID in the url path, make it multiple channel IDs in a JSON POST body.
- [X] Change the JSON response to an object where the channel IDs are keys and the list of messages are values.
- [X] Add a mandatory property to the JSON: `maxMessagesPerChannel`. Limit the response to the most recent messages up to this limit *per channel*.
- [X] Update tests and regain 100% code/branch test coverage.

# OAuth2 authentication (API and browser extension)
Our API does not implement authentication at all, it's open to the public.
We will use one short OAuth2 sign-in the first time a member installs the browser extension; after that, every request the extension makes to our HTTP API is automatically authenticated with a signed JWT that the  back-end knows how to verify.

- [X] Read AUTHENTICATION.md with a complete description of the technique.
- [X] Environment file will provide signing secret. Update Discord Bot Setup readme to describe how to generate this.
- [X] Update readme Discord Bot Setup section, we need a second OAuth2 application for Threadloaf Login. The redirect needs to be some path in http://localhost:3000 for our testing.
- [X] In the browser extension's user options popup, add a group box "Chatty@Home API".
    - [X] Instruction label that explains that members of the Chatty@Home discord server (only) have access to an online API enabling extra features. They must log in for these features to become enabled.
    - [X] Label "Login:", value is a read-only label "not logged in" (which becomes "logged in") and a 
    button "Log in" (which becomes "Log out"). The button kicks off the OAuth2 login process in a new window. If we're logged in, we show that and the button is for logging out. The login must be persisted across sessions.
    - [X] When logged in, the normally-disabled options inside the group box are enabled. For now there's only one, the following:
    - [X] Slider for "Number of most recent thread replies to show in thread list:" (find more concise wording for this) from 0 to 20
- [X] Implement the login flow on the server and client sides both. The client should end up holding a token signed by the server that it can use to make API calls. The client should persist this token.
- [X] We want the token to last forever. We do not implement revocation.
- [X] Update tests and regain 100% code/branch test coverage.

# Authorization (API)
All of our API endpoints need to take an API token and verify that the user is a member of the guild specified in their request.

- [X] Create an authorization cache that remembers that a given token (from which we can get the user id) is a member of a given guild. Cache entries expire after 24 hours.
- [X] Create a function that inquires whether a given token is a member of a given guild. Check the cache first, on cache miss go to the discord API to check.
- [X] Update all API endpoints (except health) so they require an API token. Validate the token and validate that they are a member of the specified guild using the cache.
- [X] Update tests and regain 100% code/branch test coverage.

# Show recent replies underneath threads in the thread list
Read THREAD_LIST_EXAMPLE.html, an export of the Discord forum channel's thread list HTML.
We are going to bulk load the recent replies to the threads we see and display them underneath the thread.
This gives the user a quick at-a-glance preview of each thread's recent activity.

- [X] This functionality is disabled by default and enabled when the user logs into the user options and moves the "Number of most recent thread replies to show in thread list:" slider above zero.
- [X] We already have a DOM watcher, don't add a new one. Modify it to detect when new thread list entries are added to the DOM. It's the li.card_* element.
- [X] Debounce these events for new thread list entries, because they will come in fast when the user is scrolling. Don't fire the debounced event until the events stop for 1 full second.
- [X] When we get the debounced event, collect all the visible thread IDs (these are channel IDs and embedded in the `data-item-id` attribute on the div.mainCard_*, first child of li.card_*).
- [X] Call our API in the background to retrieve the last N messages for those threads. If a previous API call is still in flight, cancel it and issue a new one. N is the number the user configured in the user options, the slider for the number of msot recent thread replies to show in the thread list.
- [X] Update the DOM to show those messages underneath each thread in the thread list. Make sure you update the correct DOM element in case it changed while the API call was in flight; verify the `data-item-id`.
- [X] Don't show errors to the user, just log them to the console.
