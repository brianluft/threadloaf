# Thread list reply preview tweaks (threadloaf)
- [ ] Our DOM watcher debounces new thread list entries so we don't send a lot of API calls when the user scrolls the thread list rapidly. We wait 1000ms. Make it 500ms.
- [ ] Add a special case. When the very first thread list entry appears--the first one we ever see in a given page session--make the debounce 50ms. We want to very quickly kick off the first API call when the user first opens the thread list. After that first API call, return the debounce interval to 500ms.
- [ ] Small changes to the appearance of the replies under each thread list element
    - [ ] Add padding to the left of the replies block, so the purple left border is offset to the right a bit. The user's eye will jump between the threads on the far left side, we don't want the replies there to confuse things.
    - [ ] Remove margin above the reply list and below the thread, we want the reply list (with its purple left border) to actually touch the thread box to ensure the user can visually see that they go together.
    - [ ] In each reply we have "author:text" jammed together just like that; add space after the colon.
    - [ ] The replies should all be clickable, they open the thread just like clicking on the main thread list element for a thread does.