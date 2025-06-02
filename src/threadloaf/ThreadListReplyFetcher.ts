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

    public constructor(userOptionsProvider: UserOptionsProvider) {
        this.userOptionsProvider = userOptionsProvider;
    }

    /**
     * Handles new thread list entries being added to the DOM.
     * Debounces calls and fetches replies for visible threads.
     */
    public handleThreadListChange(): void {
        // Clear existing debounce timeout
        if (this.debounceTimeout !== null) {
            clearTimeout(this.debounceTimeout);
        }

        // Use shorter debounce for the very first call in a page session
        const debounceTime = this.isFirstThreadListCall ? 50 : 500;

        this.debounceTimeout = setTimeout(() => {
            this.fetchAndDisplayReplies();
            // After the first call, set flag to false for subsequent calls
            this.isFirstThreadListCall = false;
        }, debounceTime);
    }

    /**
     * Fetches replies for all visible threads and displays them.
     */
    private async fetchAndDisplayReplies(): Promise<void> {
        const options = this.userOptionsProvider.getOptions();

        // Only proceed if logged in and count > 0
        if (!options.isLoggedIn || options.threadRepliesCount === 0) {
            return;
        }

        // Collect all visible thread IDs
        const threadIds = this.collectVisibleThreadIds();
        if (threadIds.length === 0) {
            return;
        }

        // Cancel previous request if still in flight
        if (this.currentAbortController) {
            this.currentAbortController.abort();
        }

        // Create new abort controller for this request
        this.currentAbortController = new AbortController();

        try {
            const messages = await this.fetchMessages(
                threadIds,
                options.threadRepliesCount,
                this.currentAbortController.signal,
            );
            this.displayReplies(messages);
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                // Request was cancelled, this is expected
                return;
            }
            console.error("[Threadloaf] Error fetching thread replies:", error);
        } finally {
            this.currentAbortController = null;
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

        // Use message passing to background script to avoid CSP issues
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

        // Add each message
        for (const message of messages) {
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
