import { DomParser } from "./DomParser";
import { ThreadloafState } from "./ThreadloafState";
import { ThreadRenderer } from "./ThreadRenderer";
import { DomMutator } from "./DomMutator";

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

    public constructor(
        state: ThreadloafState,
        domParser: DomParser,
        domMutator: DomMutator,
        threadRenderer: ThreadRenderer,
    ) {
        this.state = state;
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
}
