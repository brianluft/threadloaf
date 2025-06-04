# Bugs
- [x] Testing in Chrome, logged in, recent thread replies set to non-zero, I get this error in the console.
      This all works perfectly in Firefox. There are no known bugs in Firefox, but it's totally broke in Chrome.
      We use a background script to perform HTTP calls and I suspect the background script isn't running; I don't know how to tell.
        ```
        [ThreadListReplyFetcher] Error fetching thread replies: Error: Chrome runtime error: Could not establish connection. Receiving end does not exist.
            at ThreadListReplyFetcher.ts:259:32
        fetchAndDisplayReplies	@	ThreadListReplyFetcher.ts:154
        ```
- [ ] We have a single static manifest.json, but we actually need four different configurations, varying by browser and by environment, with two choices each.
  - [ ] By browser: Firefox and Chrome seem mutually incompatible. Firefox has this error: "background.service_worker is currently disabled. Add background.scripts." Meanwhile, background.scripts doesn't work in Chrome and we need to use service_worker there. So it seems a single manifest.json won't work in both browsers.
    - [ ] Split our single manifest.json into two: one for Chrome and one for Firefox, our two supported browsers. Fix the issue with scripts vs. service_worker.
    - [ ] In release.sh, build both versions and zip them separately. Only Firefox needs the source zip.
  - [ ] By environment: We have "http://localhost" for development and "https://api.threadloaf.com" for production. Development builds should only have the former and production builds should only have the latter.
  - [ ] Find a way to manage this without making four duplicate copies of the whole manifest.json. There are only minor differences between these configurations with most of the content being identical between all four.
