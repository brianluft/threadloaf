AIs do not update this file. Humans only.

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

# Bugs
- [x] UI improvements to the browser extension's user options popup, in the new Chatty@Home API section
    - [x] Remove the "Login:" label and simply write "Not logged in" or "Logged in" with the button.
    - [x] Capitalize "Discord"
    - [x] Make the instructions ("Members of the...") more succinct. One sentence only.
- [x] OAuth2 debugging
    - [x] When I click the log in button, the login window doesn't appear, and this is logged to the console: "Cross-Origin Request Blocked: The Same Originl Policy disallows reading the remote resource at http://localhost:3000/auth/config. (Reason: CORS header 'Access-Control-Allow-Origin' missing). Status code: 200.
- [x] In the extension user options popup, if the user clicks Log In button, and request for /auth/config fails, show an error message. *Something* must happen when clicking the button, either the login window appears or an error does. An alert is fine as this is rare. 
- [x] We have an alert() in our extension's user options popup. eslint doesn't like that and it fails the build. Replace it with a red error label underneath the line containing the Log In button.
- [x] After clicking "Log in" in the extension's user options popup and then completing Discord's OAuth2 login flow, we redirect to http://localhost:3000/auth/callback. This is just a blank page and logs the following to the console. The user options don't get updated to show that we are logged in.
    Uncaught TypeError: window.opener is null
        <anonymous> http://localhost:3000/auth/callback?code=pfkQfc2ozQJinIXEAifakIJEf3lPk8&state=bb4841d0-dbe9-4f23-85fa-f7ed1c987885:3
    callback:3:25
- [x] Extension user options popup - our login OAuth2 flow redirects back to our callback and then closes the login window, as expected. But then the user options popup's "Not logged in" label doesn't change. It doesn't seem to have gotten the message that we are logged in. Reloading the extension doesn't change it either; it seems the token was not persisted either.

# Thread list reply preview tweaks (threadloaf)
- [x] Our DOM watcher debounces new thread list entries so we don't send a lot of API calls when the user scrolls the thread list rapidly. We wait 1000ms. Make it 500ms.
- [x] Add a special case. When the very first thread list entry appears--the first one we ever see in a given page session--make the debounce 50ms. We want to very quickly kick off the first API call when the user first opens the thread list. After that first API call, return the debounce interval to 500ms.
- [x] Small changes to the appearance of the replies under each thread list element
    - [x] Add padding to the left of the replies block, so the purple left border is offset to the right a bit. The user's eye will jump between the threads on the far left side, we don't want the replies there to confuse things.
    - [x] Remove margin above the reply list and below the thread, we want the reply list (with its purple left border) to actually touch the thread box to ensure the user can visually see that they go together.
    - [x] In each reply we have "author:text" jammed together just like that; add space after the colon.
    - [x] The replies should all be clickable, they open the thread just like clicking on the main thread list element for a thread does.

# Bugs
- [x] The first time I open the thread list for a forum channel, our reply previews show correctly. If I switch to a chat channel and then return to the forum channel, our reply previews do not show. The reply previews never return after that. No further API calls are made. I have Dev Tools and can poke around if you need.
- [x] *Every* time we get a (debounced) "new thread in the thread list" event, we need to send the API call for *all* visible threads. Even if we've seen them all before. Keep a cache for quick reaction so the replies appear immediately, but always update that cache from the server on this event and update the previews asynchronously when the response comes in.

# Thread list reply previews
- [x] When a thread list is visible, show a "Refresh Previews" button to the right of the existing "Sort & View" button. Read context/THREAD_LIST_EXAMPLE.html for the HTML. The button will do the same thing that our DOM watcher's "new thread list element" event does: it collects all the visible thread IDs, issues the API call, and when the API call comes back it updates the displayed thread replies. The button itself is disabled while the API call is in flight so the user can't keep clicking it.

# Bugs
- [x] Read project/FINISHED.md to remember what we did about the debounce of the "new thread in thread list" event from the DOM observer. Now, we are issuing the API call _every_ 500 milliseconds, even when the user is idle. We only want to issue the API call on some kind of user-driven transition, where either a new thread div is created, or an existing hidden one is shown.
- [x] In the thread list, our thread reply preview list is currently newest-first. It needs to be oldest-first. We are showing the most recent N replies, with the most recent one at the bottom. Yet, when we hit Refresh and get new posts, _those_ show up at the bottom. Make sure the replies preview list is _always_ sorted in ascending chronological order.
- [x] Our "Refresh Previews" button has an SVG icon, replace it with the ↻ symbol. Make sure the symbol and the text are always on a single line; right now the SVG is on the first line and the text is on a second line, making the button taller than intended.
- [x] The API's {{baseUrl}}/{{guildId}}/messages endpoint is returning the _oldest_ N messages per channel. It needs to return the _newest_ N messages per channel. Prove it to yourself:
    - Run the server with scripts/start-api.sh
    - Test this; we expect this to return the 1 most recent post.
        ```
        curl -X POST http://localhost:3000/1334738912756895836/messages -H "Content-Type: application/json" -d '{"channelIds": ["1378262084390883328"],"maxMessagesPerChannel": 1}'
        ```
    - Now test it again with `"maxMessagesPerChannel": 2`. We expect to get the same 1 most recent post plus one _older_ post. But look at the timestamps! The additional post we get is _newer_ than the one we got before.
    - FYI: The oldest message is "Testing, testing, 1, 2, 3". The second-oldest message is "Another message". The _newest_ message is "Testing 5" which does not appear. You should see "Testing 5" appear when requesting the 1 most recent message.
- [x] The "Refresh Previews" API request is super fast. We disable the button while the request is in flight, but it's so fast that the user doesn't see it. Keep the button disabled for an additional 1 second after the response comes in.
- [x] The "Refresh Previews" button currently has no feedback when it's disabled. It should visibly gray out, the border should lighten, and the cursor should be the default instead of the hand.
- [x] The "Refresh Previews" button should only appear when the user is logged into our API from the user options and they have set the number of thread replies > 0.
- [x] Read project/FINISHED.md to remind yourself about when we fixed an issue where the replies list would stop appearing when switching away from a forum channel and then switching back. That's still OK, but there's a related issue. If I switch from a forum channel to a _thread_, then no forum channel _on that server_ ever shows the replies list or the "Refresh Previews" button again, and no API call is made. But forum channels on _other_ servers do continue to work and those API calls are made. You may need my help with Dev Tools for this; if so, add console logging, tell me how to test it, and I'll give you the log.
