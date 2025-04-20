/**
 * Manages scroll-to-top and scroll-to-bottom buttons for both the thread view and chat view.
 * Adds circular buttons with arrow icons that appear next to the scrollbar.
 */
export class ScrollButtonManager {
    private static readonly UP_ARROW = "&#x2912;";
    private static readonly DOWN_ARROW = "&#x2913;";
    private static readonly MIN_HEIGHT_FOR_BUTTONS = 100; // Minimum height in pixels to show buttons

    private createScrollButton(className: string, isTop: boolean, scrollTarget: HTMLElement): HTMLElement {
        const button = document.createElement("div");
        button.className = `${className} ${isTop ? "top" : "bottom"}`;
        button.innerHTML = isTop ? ScrollButtonManager.UP_ARROW : ScrollButtonManager.DOWN_ARROW;
        button.title = isTop ? "Scroll to top" : "Scroll to bottom";

        button.addEventListener("click", () => {
            scrollTarget.scrollTo({ top: isTop ? 0 : scrollTarget.scrollHeight });
        });

        return button;
    }

    private updateButtonVisibility(buttons: HTMLElement[], container: HTMLElement): void {
        const height = container.getBoundingClientRect().height;
        const shouldShow = height >= ScrollButtonManager.MIN_HEIGHT_FOR_BUTTONS;
        buttons.forEach((button) => {
            button.style.display = shouldShow ? "flex" : "none";
        });
    }

    private setupVisibilityHandling(buttons: HTMLElement[], container: HTMLElement): void {
        // Initial visibility check
        this.updateButtonVisibility(buttons, container);

        // Watch for size changes
        const resizeObserver = new ResizeObserver(() => {
            this.updateButtonVisibility(buttons, container);
        });
        resizeObserver.observe(container);
    }

    /**
     * Add scroll buttons to the thread view container
     */
    public addThreadViewButtons(threadContent: HTMLElement, threadContainer: HTMLElement): void {
        // Remove any existing scroll buttons first
        threadContainer.querySelectorAll(".threadloaf-scroll-button").forEach((button) => button.remove());

        // Ensure container has relative positioning for absolute buttons
        if (window.getComputedStyle(threadContainer).position === "static") {
            threadContainer.style.position = "relative";
        }

        // Create and add buttons
        const topButton = this.createScrollButton("threadloaf-scroll-button", true, threadContent);
        const bottomButton = this.createScrollButton("threadloaf-scroll-button", false, threadContent);
        const buttons = [topButton, bottomButton];

        threadContainer.appendChild(topButton);
        threadContainer.appendChild(bottomButton);

        this.setupVisibilityHandling(buttons, threadContainer);
    }

    /**
     * Add scroll buttons to the chat view, positioned relative to the content parent
     */
    public addChatViewButtons(chatScroller: HTMLElement, contentParent: HTMLElement): void {
        // Remove any existing chat view buttons
        contentParent.querySelectorAll(".threadloaf-chat-scroll-button").forEach((button) => button.remove());

        // Get scroller's position and dimensions for bottom button
        const scrollerRect = chatScroller.getBoundingClientRect();
        const contentRect = contentParent.getBoundingClientRect();
        const scrollerBottom = ((scrollerRect.bottom - contentRect.top) / contentRect.height) * 100;

        // Create buttons
        const topButton = this.createScrollButton("threadloaf-chat-scroll-button", true, chatScroller);
        const bottomButton = this.createScrollButton("threadloaf-chat-scroll-button", false, chatScroller);
        const buttons = [topButton, bottomButton];

        bottomButton.style.top = `calc(${scrollerBottom}% - 32px)`;

        // Add buttons to content parent
        contentParent.appendChild(topButton);
        contentParent.appendChild(bottomButton);

        this.setupVisibilityHandling(buttons, chatScroller);
    }
}
