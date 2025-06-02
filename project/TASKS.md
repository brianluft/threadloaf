# Bugs
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
- [ ] Read project/FINISHED.md to remind yourself about when we fixed an issue where the replies list would stop appearing when switching away from a forum channel and then switching back. That's still OK, but there's a related issue. If I switch from a forum channel to a _thread_, then no forum channel _on that server_ ever shows the replies list or the "Refresh Previews" button again, and no API call is made. But forum channels on _other_ servers do continue to work and those API calls are made. You may need my help with Dev Tools for this; if so, add console logging, tell me how to test it, and I'll give you the log.
