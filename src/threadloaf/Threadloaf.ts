import { DomParser } from "./DomParser";
import { ThreadloafState } from "./ThreadloafState";
import { ThreadRenderer } from "./ThreadRenderer";
import { DomMutator } from "./DomMutator";
import { ThreadListReplyFetcher } from "./ThreadListReplyFetcher";
import { ThreadListRefreshButton } from "./ThreadListRefreshButton";

/**
 * Main entry point and controller for the Threadloaf extension.
 * Coordinates between different components to initialize the extension,
 * set up observers and event handlers, and manage the overall flow
 * of the application. Handles setup of keyboard navigation and polling
 * for Discord's dynamic content loading.
 */
export class Threadloaf {
    private state: ThreadloafState;
    private domParser: DomParser;
    private domMutator: DomMutator;
    private threadRenderer: ThreadRenderer;
    private threadListReplyFetcher: ThreadListReplyFetcher;
    private threadListRefreshButton: ThreadListRefreshButton;
    private navigationInterval: ReturnType<typeof setInterval> | null = null;

    public constructor(
        state: ThreadloafState,
        domParser: DomParser,
        domMutator: DomMutator,
        threadRenderer: ThreadRenderer,
        threadListReplyFetcher: ThreadListReplyFetcher,
        threadListRefreshButton: ThreadListRefreshButton,
    ) {
        this.state = state;
        this.domParser = domParser;
        this.domMutator = domMutator;
        this.threadRenderer = threadRenderer;
        this.threadListReplyFetcher = threadListReplyFetcher;
        this.threadListRefreshButton = threadListRefreshButton;

        // Note: ThreadListRefreshButton sets up its own API complete callback
        // to handle the 1-second delay and re-enabling the button

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
        this.domParser.setupMutationObserver(
            () => this.threadRenderer.renderThread(),
            () => this.handleThreadListChange(),
        );
        this.setupPolling();

        // Find initial thread container and set up initial view
        const initialThreadContainer = this.domParser.findThreadContainer();
        if (initialThreadContainer) {
            this.state.threadContainer = initialThreadContainer;
            // Show the chat view and create float button
            this.state.threadContainer.style.display = "block";
            this.threadRenderer.renderThread(); // This will create the button in chat view mode
        }
    }

    // Handle thread list changes by updating both reply fetcher and refresh button
    private handleThreadListChange(): void {
        this.threadListReplyFetcher.handleThreadListChange();
        this.threadListRefreshButton.updateRefreshButton();
    }

    // Fallback: Polling to handle delayed loading or missed events
    private setupPolling(): void {
        let lastUrl = window.location.href;

        // Set up continuous navigation monitoring
        this.navigationInterval = setInterval(() => {
            const currentUrl = window.location.href;

            // Check if we've navigated to a new channel/thread
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                // Reset the first call flag to ensure quick loading of replies when returning to forum channels
                this.threadListReplyFetcher.resetFirstCallFlag();

                // Reinitialize mutation observer to ensure it's still working after navigation
                if (this.state.observer) {
                    this.state.observer.disconnect();
                }
                this.domParser.setupMutationObserver(
                    () => this.threadRenderer.renderThread(),
                    () => this.handleThreadListChange(),
                );

                // Manually trigger thread list change check after navigation
                // This handles cases where Discord reuses cached DOM elements without triggering mutations
                // Only do this if there are actually visible thread cards
                setTimeout(() => {
                    const hasVisibleThreadCards = document.querySelectorAll('li[class*="card_"]').length > 0;
                    if (hasVisibleThreadCards) {
                        this.handleThreadListChange();
                    }
                }, 100);
            }
        }, 1000);

        // Set up initial thread container detection with limited attempts
        let attempts = 0;
        const maxAttempts = 30; // Try for 30 seconds
        const initializationInterval = setInterval(() => {
            attempts++;
            const newThreadContainer = this.domParser.findThreadContainer();

            if (newThreadContainer && newThreadContainer !== this.state.threadContainer) {
                this.state.threadContainer = newThreadContainer;
                this.threadRenderer.renderThread();
            }

            // Only stop initialization polling if we've found messages or exceeded max attempts
            // Navigation polling continues indefinitely
            if ((newThreadContainer && newThreadContainer.children.length > 0) || attempts >= maxAttempts) {
                clearInterval(initializationInterval);
            }
        }, 1000);
    }
}
