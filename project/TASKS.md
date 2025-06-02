# Bugs
- [x] Read project/FINISHED.md to remember what we did about the debounce of the "new thread in thread list" event from the DOM observer. Now, we are issuing the API call _every_ 500 milliseconds, even when the user is idle. We only want to issue the API call on some kind of user-driven transition, where either a new thread div is created, or an existing hidden one is shown.
