import { UserOptionsProvider } from "./UserOptionsProvider";

interface ApiMessage {
    id: string;
    content: string;
    authorTag: string;
    timestamp: number;
}

interface ApiMessagesResponse {
    [channelId: string]: ApiMessage[];
}

/**
 * Handles fetching and displaying recent replies underneath threads in the thread list.
 * This functionality is enabled when the user sets the thread replies count above zero
 * in the user options.
 */
export class ThreadListReplyFetcher {
    private userOptionsProvider: UserOptionsProvider;
    private currentAbortController: AbortController | null = null;
    private debounceTimeout: ReturnType<typeof setTimeout> | null = null;
    private isFirstThreadListCall = true;
    private repliesCache = new Map<string, ApiMessage[]>();
    private apiCompleteCallback: (() => void) | null = null;

    public constructor(userOptionsProvider: UserOptionsProvider) {
        this.userOptionsProvider = userOptionsProvider;
    }

    /**
     * Resets the first thread list call flag. This should be called when navigating to a new channel
     * to ensure reply previews load quickly when returning to forum channels.
     */
    public resetFirstCallFlag(): void {
        this.isFirstThreadListCall = true;
    }

    /**
     * Returns whether an API call is currently in progress.
     */
    public isApiInProgress(): boolean {
        const inProgress = this.currentAbortController !== null;
        console.log("[ThreadListReplyFetcher] isApiInProgress() called, returning:", inProgress);
        return inProgress;
    }

    /**
     * Sets a callback to be called when API operations complete.
     */
    public setApiCompleteCallback(callback: (() => void) | null): void {
        console.log(
            "[ThreadListReplyFetcher] setApiCompleteCallback() called with callback:",
            callback ? "function" : "null",
        );
        this.apiCompleteCallback = callback;
    }

    /**
     * Handles new thread list entries being added to the DOM.
     * Debounces calls and fetches replies for visible threads.
     */
    public handleThreadListChange(): void {
        console.log("[ThreadListReplyFetcher] handleThreadListChange() called");

        // Early check: if there are no visible thread cards, don't even start the debounce timer
        const hasVisibleThreadCards = document.querySelectorAll('li[class*="card_"]').length > 0;
        if (!hasVisibleThreadCards) {
            console.log("[ThreadListReplyFetcher] No visible thread cards, returning early");
            // Clear any existing timeout and return early
            if (this.debounceTimeout !== null) {
                clearTimeout(this.debounceTimeout);
                this.debounceTimeout = null;
            }
            return;
        }

        // Clear existing debounce timeout
        if (this.debounceTimeout !== null) {
            console.log("[ThreadListReplyFetcher] Clearing existing debounce timeout");
            clearTimeout(this.debounceTimeout);
        }

        // Use shorter debounce for the very first call in a page session
        const debounceTime = this.isFirstThreadListCall ? 50 : 500;
        console.log("[ThreadListReplyFetcher] Setting debounce timeout for", debounceTime, "ms");

        this.debounceTimeout = setTimeout(() => {
            console.log("[ThreadListReplyFetcher] Debounce timeout fired, calling fetchAndDisplayReplies()");
            this.fetchAndDisplayReplies();
            // After the first call, set flag to false for subsequent calls
            this.isFirstThreadListCall = false;
        }, debounceTime);
    }

    /**
     * Fetches replies for all visible threads and displays them.
     * Shows cached replies immediately if available, then updates with fresh data from API.
     */
    private async fetchAndDisplayReplies(): Promise<void> {
        console.log("[ThreadListReplyFetcher] fetchAndDisplayReplies() called");

        const options = this.userOptionsProvider.getOptions();

        // Only proceed if logged in and count > 0
        if (!options.isLoggedIn || options.threadRepliesCount === 0) {
            console.log("[ThreadListReplyFetcher] Not logged in or count is 0, returning");
            return;
        }

        // Collect all visible thread IDs
        const threadIds = this.collectVisibleThreadIds();
        if (threadIds.length === 0) {
            console.log("[ThreadListReplyFetcher] No thread IDs found, returning");
            return;
        }

        console.log("[ThreadListReplyFetcher] Found", threadIds.length, "thread IDs");

        // First, display cached replies immediately for quick reaction
        this.displayCachedReplies(threadIds);

        // Then always fetch fresh data from the API to update the cache
        // Cancel previous request if still in flight
        if (this.currentAbortController) {
            console.log("[ThreadListReplyFetcher] Aborting previous request");
            this.currentAbortController.abort();
        }

        // Create new abort controller for this request
        this.currentAbortController = new AbortController();
        console.log("[ThreadListReplyFetcher] Created new AbortController, API is now in progress");

        try {
            const messages = await this.fetchMessages(
                threadIds,
                options.threadRepliesCount,
                this.currentAbortController.signal,
            );

            console.log("[ThreadListReplyFetcher] API request completed successfully");

            // Update cache with fresh data
            this.updateCache(messages);

            // Display the fresh replies
            this.displayReplies(messages);
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                console.log("[ThreadListReplyFetcher] Request was cancelled (aborted)");
                // Request was cancelled, this is expected
                return;
            }
            console.error("[ThreadListReplyFetcher] Error fetching thread replies:", error);
        } finally {
            console.log("[ThreadListReplyFetcher] Setting currentAbortController to null, API no longer in progress");
            this.currentAbortController = null;
            // Notify callback that API operation is complete
            if (this.apiCompleteCallback) {
                console.log("[ThreadListReplyFetcher] Calling API complete callback");
                try {
                    this.apiCompleteCallback();
                } catch (error) {
                    console.error("[ThreadListReplyFetcher] Error in API complete callback:", error);
                }
            } else {
                console.log("[ThreadListReplyFetcher] No API complete callback set");
            }
        }
    }

    /**
     * Displays cached replies immediately for visible threads.
     */
    private displayCachedReplies(threadIds: string[]): void {
        const cachedMessages: ApiMessagesResponse = {};

        for (const threadId of threadIds) {
            const cachedReplies = this.repliesCache.get(threadId);
            if (cachedReplies) {
                cachedMessages[threadId] = cachedReplies;
            }
        }

        // Only display if we have some cached data
        if (Object.keys(cachedMessages).length > 0) {
            this.displayReplies(cachedMessages);
        }
    }

    /**
     * Updates the replies cache with fresh data from the API.
     */
    private updateCache(messagesData: ApiMessagesResponse): void {
        for (const [threadId, messages] of Object.entries(messagesData)) {
            this.repliesCache.set(threadId, messages);
        }
    }

    /**
     * Collects all visible thread IDs from the DOM.
     */
    private collectVisibleThreadIds(): string[] {
        const threadIds: string[] = [];

        // Find all thread list items
        const cardElements = document.querySelectorAll('li[class*="card_"]');

        for (const cardElement of cardElements) {
            const mainCard = cardElement.querySelector('div[class*="mainCard_"][data-item-id]');
            if (mainCard && mainCard instanceof HTMLElement) {
                const threadId = mainCard.dataset.itemId;
                if (threadId) {
                    threadIds.push(threadId);
                }
            }
        }

        return threadIds;
    }

    /**
     * Fetches messages from the API for the given thread IDs using message passing to background script.
     */
    private async fetchMessages(
        threadIds: string[],
        maxMessages: number,
        signal: AbortSignal,
    ): Promise<ApiMessagesResponse> {
        const options = this.userOptionsProvider.getOptions();

        // Extract guild ID from current URL
        const guildId = this.extractGuildId();

        if (!guildId) {
            throw new Error("Could not determine guild ID from URL");
        }

        return new Promise((resolve, reject) => {
            // Handle abort signal
            const abortHandler = (): void => {
                reject(new Error("Request aborted"));
            };
            signal.addEventListener("abort", abortHandler);

            chrome.runtime.sendMessage(
                {
                    type: "FETCH_MESSAGES",
                    guildId,
                    channelIds: threadIds,
                    maxMessagesPerChannel: maxMessages,
                    authToken: options.authToken,
                },
                (response: { success: boolean; data?: ApiMessagesResponse; error?: string }): void => {
                    // Clean up abort handler
                    signal.removeEventListener("abort", abortHandler);

                    if (chrome.runtime.lastError) {
                        reject(new Error(`Chrome runtime error: ${chrome.runtime.lastError.message}`));
                        return;
                    }

                    if (response.success && response.data) {
                        resolve(response.data);
                    } else {
                        reject(new Error(response.error || "Unknown error"));
                    }
                },
            );
        });
    }

    /**
     * Extracts the guild ID from the current Discord URL.
     */
    private extractGuildId(): string | null {
        const url = window.location.pathname;
        const match = url.match(/\/channels\/(\d+)/);
        return match ? match[1] : null;
    }

    /**
     * Displays the fetched replies underneath each thread in the thread list.
     */
    private displayReplies(messagesData: ApiMessagesResponse): void {
        // Find all thread list items again to ensure we're working with current DOM
        const cardElements = document.querySelectorAll('li[class*="card_"]');

        for (const cardElement of cardElements) {
            const mainCard = cardElement.querySelector('div[class*="mainCard_"][data-item-id]');
            if (mainCard && mainCard instanceof HTMLElement) {
                const threadId = mainCard.dataset.itemId;
                if (threadId && messagesData[threadId]) {
                    this.displayRepliesForThread(cardElement as HTMLElement, messagesData[threadId]);
                }
            }
        }
    }

    /**
     * Displays replies for a specific thread underneath its thread list entry.
     */
    private displayRepliesForThread(cardElement: HTMLElement, messages: ApiMessage[]): void {
        // Remove existing replies container if present
        const existingReplies = cardElement.querySelector(".threadloaf-thread-replies");
        if (existingReplies) {
            existingReplies.remove();
        }

        // Skip if no messages
        if (messages.length === 0) {
            return;
        }

        // Sort messages by timestamp in ascending chronological order (oldest first)
        const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);

        // Create replies container
        const repliesContainer = document.createElement("div");
        repliesContainer.classList.add("threadloaf-thread-replies");

        // Find the main thread card for click delegation
        const mainCard = cardElement.querySelector('div[class*="mainCard_"]') as HTMLElement;

        // Add click handler to the replies container
        repliesContainer.addEventListener("click", (event) => {
            event.stopPropagation();
            if (mainCard) {
                mainCard.click();
            }
        });

        // Add each message in sorted order
        for (const message of sortedMessages) {
            const messageElement = this.createMessageElement(message);

            // Add click handler to individual reply
            messageElement.addEventListener("click", (event) => {
                event.stopPropagation();
                if (mainCard) {
                    mainCard.click();
                }
            });

            repliesContainer.appendChild(messageElement);
        }

        // Append to card element
        cardElement.appendChild(repliesContainer);
    }

    /**
     * Creates a DOM element for a single message reply.
     */
    private createMessageElement(message: ApiMessage): HTMLElement {
        const element = document.createElement("div");
        element.classList.add("threadloaf-thread-reply");

        // Create author span
        const authorSpan = document.createElement("span");
        authorSpan.classList.add("threadloaf-reply-author");
        authorSpan.textContent = message.authorTag || "Unknown";

        // Create content span
        const contentSpan = document.createElement("span");
        contentSpan.classList.add("threadloaf-reply-content");
        contentSpan.textContent = message.content || "";

        // Create separator with space after colon
        const separator = document.createElement("span");
        separator.classList.add("threadloaf-reply-separator");
        separator.textContent = ": ";

        // Assemble the element
        element.appendChild(authorSpan);
        element.appendChild(separator);
        element.appendChild(contentSpan);

        return element;
    }
}
