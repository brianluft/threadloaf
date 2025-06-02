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
            button.style.opacity = isApiInProgress ? "0.6" : "1";
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

        // Add refresh icon (using Discord's refresh icon)
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        icon.setAttribute("aria-hidden", "true");
        icon.setAttribute("role", "img");
        icon.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        icon.setAttribute("width", "16");
        icon.setAttribute("height", "16");
        icon.setAttribute("fill", "none");
        icon.setAttribute("viewBox", "0 0 24 24");

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("fill", "currentColor");
        path.setAttribute(
            "d",
            "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.19 0 2.34-.21 3.41-.6.39-.14.59-.55.45-.94-.14-.39-.55-.59-.94-.45-.89.32-1.85.49-2.92.49-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8c0 .55.45 1 1 1s1-.45 1-1c0-5.52-4.48-10-10-10z",
        );
        icon.appendChild(path);

        const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path2.setAttribute("fill", "currentColor");
        path2.setAttribute("d", "M16.5 7.5l-2.5 2.5 2.5 2.5 1-1-1.5-1.5 1.5-1.5z");
        icon.appendChild(path2);

        contents.appendChild(icon);

        // Add text
        const text = document.createElement("div");
        text.className = "text-sm/medium_cf4812";
        text.style.color = "var(--interactive-normal)";
        text.setAttribute("data-text-variant", "text-sm/medium");
        text.textContent = "Refresh Previews";
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
