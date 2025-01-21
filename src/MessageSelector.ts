import { ThreadloafState } from "./ThreadloafState";

/**
 * Manages the currently selected message in Threadloaf.
 * Handles selection state and styling of selected messages in both thread and chat views.
 */
export class MessageSelector {
    private state: ThreadloafState;
    private readonly STYLE_ELEMENT_ID = "threadloaf-message-selection-style";
    private currentKeydownHandler: ((event: KeyboardEvent) => void) | null = null;

    public constructor(state: ThreadloafState) {
        this.state = state;
        this.setupChatViewClickHandler();
        this.state.onThreadContainerChange((container) => this.handleThreadContainerChange(container));
    }

    private handleThreadContainerChange(container: HTMLElement | null): void {
        // Remove handler from old container if it exists
        if (this.currentKeydownHandler && this.state.threadContainer) {
            this.state.threadContainer.removeEventListener("keydown", this.currentKeydownHandler, true);
            this.state.threadContainer.tabIndex = -1;
        }

        // Set up handler for new container
        if (container) {
            this.currentKeydownHandler = (event: KeyboardEvent): void => {
                if (!document.body.classList.contains("threadloaf-visible")) return;
                if (event.key === "a" || event.key === "z") {
                    event.preventDefault();
                    event.stopPropagation();
                    this.moveSelection(event.key === "a" ? "up" : "down");
                }
            };
            container.addEventListener("keydown", this.currentKeydownHandler, true);
            container.tabIndex = 0;
        }
    }

    private moveSelection(direction: "up" | "down"): void {
        if (!this.state.selectedMessageId) {
            // If nothing is selected, select the first/last message
            const messages = document.querySelectorAll("div.threadloaf-message");
            if (messages.length === 0) return;

            const message = direction === "up" ? messages[messages.length - 1] : messages[0];
            const messageId = message.getAttribute("data-msg-id");
            if (messageId) this.selectMessage(messageId, "thread");
            return;
        }

        // Find the current message element
        const currentMessage = document.querySelector(
            `div.threadloaf-message[data-msg-id="${this.state.selectedMessageId}"]`,
        );
        if (!currentMessage) return;

        // Get all messages and find current index
        const messages = Array.from(document.querySelectorAll("div.threadloaf-message"));
        const currentIndex = messages.indexOf(currentMessage);
        if (currentIndex === -1) return;

        // Calculate next index
        const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (nextIndex < 0 || nextIndex >= messages.length) return;

        // Select the next message
        const nextMessageId = messages[nextIndex].getAttribute("data-msg-id");
        if (nextMessageId) {
            this.selectMessage(nextMessageId, "thread");
            // Ensure the newly selected message is visible
            messages[nextIndex].scrollIntoView({ block: "nearest", behavior: "auto" });
        }
    }

    private setupChatViewClickHandler(): void {
        // Attach to the highest stable point in Discord's DOM
        document.body.addEventListener("click", (event) => {
            if (!document.body.classList.contains("threadloaf-visible")) return;
            const target = event.target as HTMLElement;
            if (!target) return;

            // Find closest message container by walking up the tree
            const messageContainer = target.closest('div[class*="message_"][aria-labelledby*="message-content-"]');
            if (!messageContainer) return;

            // Extract message ID from aria-labelledby
            const ariaLabelledBy = messageContainer.getAttribute("aria-labelledby");
            if (!ariaLabelledBy) return;

            const match = ariaLabelledBy.match(/message-content-([^-\s]+)/);
            if (!match) return;

            const messageId = match[1];
            this.selectMessage(messageId, "chat");
        });
    }

    public selectMessage(messageId: string, source: "chat" | "thread"): void {
        this.state.setSelectedMessageId(messageId, source);
        this.updateSelectionStyle();
    }

    public clearSelection(source: "chat" | "thread"): void {
        this.state.setSelectedMessageId(null, source);
        this.updateSelectionStyle();
    }

    private updateSelectionStyle(): void {
        let styleEl = document.getElementById(this.STYLE_ELEMENT_ID);
        if (!styleEl) {
            styleEl = document.createElement("style");
            styleEl.id = this.STYLE_ELEMENT_ID;
            document.head.appendChild(styleEl);
        }

        if (!this.state.selectedMessageId) {
            styleEl.textContent = "";
            return;
        }

        // Create CSS rules for both thread view and chat view
        styleEl.textContent = `
            div.threadloaf-message[data-msg-id="${this.state.selectedMessageId}"] {
                background-color: color-mix(in oklab, var(--text-normal) 10%, transparent) !important;
            }
            div[class*="message_"][aria-labelledby*="message-content-${this.state.selectedMessageId}"] {
                background-color: color-mix(in oklab, var(--text-normal) 10%, transparent) !important;
            }
        `;
    }
}
