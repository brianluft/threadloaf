# Bugs
- [x] In the extension's user options, set the default "Recent thread replies to show" to 5 (currently 0).
- [ ] Testing in Chrome, logged in, recent thread replies set to non-zero, I get this error in the console.
      This all works perfectly in Firefox. There are no known bugs in Firefox, but it's totally broke in Chrome.
      We use a background script to perform HTTP calls and I suspect the background script isn't running; I don't know how to tell.
        ```
        [ThreadListReplyFetcher] Error fetching thread replies: Error: Chrome runtime error: Could not establish connection. Receiving end does not exist.
            at ThreadListReplyFetcher.ts:259:32
        fetchAndDisplayReplies	@	ThreadListReplyFetcher.ts:154
        ```
