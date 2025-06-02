import { ThreadListReplyFetcher } from "./ThreadListReplyFetcher";

/**
 * Manages the "Refresh Previews" button in thread lists.
 * The button appears next to the "Sort & View" button and allows users to manually
 * refresh thread reply previews.
 */
export class ThreadListRefreshButton {
    private threadListReplyFetcher: ThreadListReplyFetcher;
    private currentButton: HTMLElement | null = null;

    public constructor(threadListReplyFetcher: ThreadListReplyFetcher) {
        this.threadListReplyFetcher = threadListReplyFetcher;
    }

    /**
     * Adds or updates the refresh button in thread lists.
     * Should be called when thread list DOM changes.
     */
    public updateRefreshButton(): void {
        // Remove existing button if present
        this.removeButton();

        // Find the thread list header
        const headerRow = document.querySelector('div[class*="headerRow_"][class*="card_"]');
        if (!headerRow) {
            return;
        }

        // Find the tags container with the Sort & View button
        const tagsContainer = headerRow.querySelector('div[class*="tagsContainer_"]');
        if (!tagsContainer) {
            return;
        }

        // Create and add the refresh button
        this.currentButton = this.createRefreshButton();
        tagsContainer.appendChild(this.currentButton);

        // Update button state based on current API status
        this.updateButtonState();
    }

    /**
     * Removes the refresh button from the DOM.
     */
    public removeButton(): void {
        if (this.currentButton) {
            this.currentButton.remove();
            this.currentButton = null;
        }
    }

    /**
     * Updates the button's enabled/disabled state based on whether an API call is in progress.
     */
    public updateButtonState(): void {
        if (!this.currentButton) {
            return;
        }

        const isApiInProgress = this.threadListReplyFetcher.isApiInProgress();
        const button = this.currentButton.querySelector("button");

        if (button) {
            button.disabled = isApiInProgress;
        }
    }

    /**
     * Creates the refresh button element.
     */
    private createRefreshButton(): HTMLElement {
        const button = document.createElement("button");
        button.setAttribute("aria-label", "Refresh Previews");
        button.setAttribute("type", "button");
        button.className = "threadloaf-refresh-button button__201d5 lookFilled__201d5 sizeMin__201d5 grow__201d5";

        // Create button contents
        const contents = document.createElement("div");
        contents.className = "contents__201d5";

        // Add text with refresh symbol
        const text = document.createElement("div");
        text.className = "text-sm/medium_cf4812";
        text.style.color = "var(--interactive-normal)";
        text.setAttribute("data-text-variant", "text-sm/medium");
        text.style.whiteSpace = "nowrap";
        text.textContent = "↻ Refresh Previews";
        contents.appendChild(text);

        button.appendChild(contents);

        // Add click handler
        button.addEventListener("click", () => {
            if (!button.disabled) {
                this.handleRefreshClick();
            }
        });

        return button;
    }

    /**
     * Handles the refresh button click.
     */
    private handleRefreshClick(): void {
        // Update button state immediately to show it's disabled
        this.updateButtonState();

        // Trigger the same functionality as the DOM watcher
        this.threadListReplyFetcher.handleThreadListChange();

        // Update button state again after a short delay to ensure it reflects the API call status
        setTimeout(() => {
            this.updateButtonState();
        }, 100);
    }
}
