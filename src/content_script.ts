/// <reference path="./DomParser.ts" />
/// <reference path="./MessageInfo.ts" />
/// <reference path="./MessageParser.ts" />
/// <reference path="./MessageTreeBuilder.ts" />
/// <reference path="./ThreadloafState.ts" />
/// <reference path="./ThreadRenderer.ts" />

/*
 * IMPORTANT: Discord Class/ID Naming Pattern
 *
 * Discord dynamically generates unique suffixes for all classes and IDs.
 * - Classes use underscores: "foo_[random]"  (e.g., "container_c2668b", "scroller_e2e187")
 * - IDs use hyphens: "bar-[random]"  (e.g., "message-content-123456", "chat-messages-789")
 *
 * NEVER do exact matches like:
 *   element.classList.contains("container_")  // WRONG
 *   document.getElementById("message-content") // WRONG
 *
 * ALWAYS use pattern matching:
 *   element.classList.some(cls => cls.startsWith("container_"))  // Correct
 *   document.querySelector('[id^="message-content-"]')  // Correct
 */

class Threadloaf {
    private state: ThreadloafState;
    private messageParser: MessageParser;
    private messageTreeBuilder: MessageTreeBuilder;
    private domParser: DomParser;
    private domMutator: DomMutator;
    private threadRenderer: ThreadRenderer;

    constructor(
        state: ThreadloafState,
        messageParser: MessageParser,
        messageTreeBuilder: MessageTreeBuilder,
        domParser: DomParser,
        domMutator: DomMutator,
        threadRenderer: ThreadRenderer,
    ) {
        this.state = state;
        this.messageParser = messageParser;
        this.messageTreeBuilder = messageTreeBuilder;
        this.domParser = domParser;
        this.domMutator = domMutator;
        this.threadRenderer = threadRenderer;
        this.initialize();
    }

    // Entry point for initialization
    private initialize(): void {
        this.state.appContainer = this.domParser.findAppContainer();
        if (!this.state.appContainer) {
            console.error("Threadloaf: Failed to find app container. Aborting initialization.");
            return;
        }
        this.domMutator.injectStyles();
        this.setupHeaderObserver();
        this.domParser.setupMutationObserver(() => this.threadRenderer.renderThread());
        this.setupPolling();
        this.setupKeyboardNavigation();

        // Find initial thread container and set up initial view
        const initialThreadContainer = this.domParser.findThreadContainer();
        if (initialThreadContainer) {
            this.state.threadContainer = initialThreadContainer;
            // Show the chat view and create float button
            this.state.threadContainer.style.display = "block";
            this.threadRenderer.renderThread(); // This will create the button in chat view mode
        }
    }

    // Fallback: Polling to handle delayed loading or missed events
    private setupPolling(): void {
        let attempts = 0;
        const maxAttempts = 30; // Try for 30 seconds
        const interval = setInterval(() => {
            attempts++;
            const newThreadContainer = this.domParser.findThreadContainer();

            if (newThreadContainer && newThreadContainer !== this.state.threadContainer) {
                this.state.threadContainer = newThreadContainer;
                this.threadRenderer.renderThread();
            }

            // Only stop polling if we've found messages or exceeded max attempts
            if ((newThreadContainer && newThreadContainer.children.length > 0) || attempts >= maxAttempts) {
                clearInterval(interval);
            }
        }, 1000);
    }

    private setupHeaderObserver(): void {
        // Initial attempt to hide header
        this.domMutator.findAndHideHeader();

        // Keep watching for header changes
        this.state.headerObserver = new MutationObserver(() => {
            this.domMutator.findAndHideHeader();
        });

        this.state.headerObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    private setupKeyboardNavigation(): void {
        document.addEventListener(
            "keydown",
            (e) => {
                // Only handle A/Z if we have an expanded post
                const expandedPost = document.querySelector(".threadloaf-message.expanded");
                if (!expandedPost) return;

                // Don't handle navigation if we're typing in an input
                const activeElement = document.activeElement;
                if (
                    activeElement &&
                    (activeElement.tagName === "INPUT" ||
                        activeElement.tagName === "TEXTAREA" ||
                        activeElement.getAttribute("contenteditable") === "true")
                ) {
                    return;
                }

                if (e.key.toLowerCase() === "a" || e.key.toLowerCase() === "z") {
                    // Prevent the keypress from being handled by Discord
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();

                    // Keep focus on body to prevent Discord from focusing the text input
                    document.body.focus();

                    // Find all messages
                    const allMessages = Array.from(document.querySelectorAll(".threadloaf-message"));
                    const currentIndex = allMessages.indexOf(expandedPost as HTMLElement);

                    // Calculate target index
                    let targetIndex = currentIndex;
                    if (e.key.toLowerCase() === "a" && currentIndex > 0) {
                        targetIndex = currentIndex - 1;
                    } else if (e.key.toLowerCase() === "z" && currentIndex < allMessages.length - 1) {
                        targetIndex = currentIndex + 1;
                    }

                    if (targetIndex !== currentIndex) {
                        // Collapse current post
                        expandedPost.classList.remove("expanded");
                        const currentPreview = expandedPost.querySelector(".preview-container") as HTMLElement;
                        const currentFull = expandedPost.querySelector(".full-content") as HTMLElement;
                        if (currentPreview) currentPreview.style.display = "flex";
                        if (currentFull) currentFull.style.display = "none";

                        // Expand target post
                        const targetPost = allMessages[targetIndex] as HTMLElement;
                        targetPost.classList.add("expanded");
                        const targetPreview = targetPost.querySelector(".preview-container") as HTMLElement;
                        const targetFull = targetPost.querySelector(".full-content") as HTMLElement;
                        if (targetPreview) targetPreview.style.display = "none";
                        if (targetFull) targetFull.style.display = "block";

                        // Scroll target into view
                        targetPost.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                }
            },
            true,
        ); // Use capture phase to handle event before Discord
    }
}

(function () {
    const state = new ThreadloafState();
    const messageParser = new MessageParser(state);
    const messageTreeBuilder = new MessageTreeBuilder();
    const domMutator = new DomMutator(state);
    const domParser = new DomParser(domMutator, state);
    const threadRenderer = new ThreadRenderer(state, domParser, domMutator, messageParser, messageTreeBuilder);
    new Threadloaf(state, messageParser, messageTreeBuilder, domParser, domMutator, threadRenderer);
})();
