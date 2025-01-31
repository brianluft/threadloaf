import { ThreadloafState } from "./ThreadloafState";
import { MessageInfo } from "./MessageInfo";
import { ContextMenuManager } from "./ContextMenuManager";
import { UserOptionsProvider } from "./UserOptionsProvider";
import { MessageSelector } from "./MessageSelector";

export interface CollapseHandlers {
    isBottomPaneCollapsed: () => boolean;
    uncollapseBottomPane: () => void;
}

/**
 * Handles DOM manipulation and UI element creation for the Threadloaf interface.
 * Responsible for creating message elements, managing styles, hiding Discord's
 * native thread header, and handling all direct modifications to the DOM.
 * Includes utilities for creating and styling message previews and expanded views.
 */
export class DomMutator {
    private state: ThreadloafState;
    private contextMenuManager: ContextMenuManager;
    private messageSelector: MessageSelector;
    private collapseHandlers: CollapseHandlers | null = null;

    public constructor(
        state: ThreadloafState,
        contextMenuManager: ContextMenuManager,
        messageSelector: MessageSelector,
    ) {
        this.state = state;
        this.contextMenuManager = contextMenuManager;
        this.messageSelector = messageSelector;

        // Set up handler for message selection changes
        this.state.onSelectedMessageChange((messageId, source) => {
            if (!messageId) return;

            const message = this.state.getMessageInfo(messageId);
            if (!message) return;

            if (source === "thread") {
                this.scrollToMessage(message);
            } else if (source === "chat") {
                this.scrollThreadViewToMessage(messageId);
            }
        });
    }

    private scrollThreadViewToMessage(messageId: string): void {
        const threadMessage = document.querySelector(`.threadloaf-message[data-msg-id="${messageId}"]`) as HTMLElement;
        if (!threadMessage) {
            return;
        }

        threadMessage.scrollIntoView({ behavior: "auto", block: "center" });
    }

    private scrollToMessage(message: MessageInfo): void {
        if (!message.originalElement) {
            console.error("[Threadloaf] No original element reference found for message");
            return;
        }

        const originalElement = message.originalElement as HTMLElement;

        // If the bottom pane is collapsed, uncollapse it and wait before scrolling
        if (this.collapseHandlers?.isBottomPaneCollapsed()) {
            this.collapseHandlers.uncollapseBottomPane();
            // Wait longer for the pane expansion and layout to stabilize
            setTimeout(() => {
                this.scrollMessageIntoView(originalElement);
            }, 250);
            return;
        }

        // If not collapsed, scroll immediately
        this.scrollMessageIntoView(originalElement);
    }

    private scrollMessageIntoView(messageElement: HTMLElement): void {
        const messageRect = messageElement.getBoundingClientRect();

        // Find the scrollable container by walking up until we find div.scroller_*
        let scrollContainer: Element | null = messageElement;
        while (scrollContainer && !Array.from(scrollContainer.classList).some((cls) => cls.startsWith("scroller_"))) {
            const parent: Element | null = scrollContainer.parentElement;
            if (!parent) break;
            scrollContainer = parent;
        }

        if (!scrollContainer) {
            return;
        }

        const scrollerElement = scrollContainer as HTMLElement;

        // Get the actual visible height of the scroller, accounting for any padding/borders
        const style = window.getComputedStyle(scrollerElement);
        const containerHeight =
            scrollerElement.clientHeight - (parseFloat(style.paddingTop) + parseFloat(style.paddingBottom));

        // If message is taller than the container or close to it (within 50px),
        // align to top to show the author and beginning of the message
        const shouldAlignTop = messageRect.height > containerHeight - 50;

        messageElement.scrollIntoView({
            behavior: "auto",
            block: shouldAlignTop ? "start" : "end",
        });

        // Add padding only when aligning to bottom
        if (!shouldAlignTop) {
            // If the div.jumpToPresentBar_* exists, scroll by 32px instead of 16px.
            const jumpToPresentBar = document.body.querySelector('div[class*="jumpToPresentBar_"]');
            const yOffset = jumpToPresentBar ? 40 : 16;
            scrollerElement.scrollBy(0, yOffset);
        }
    }

    public setCollapseHandlers(handlers: CollapseHandlers): void {
        this.collapseHandlers = handlers;
    }

    // Create a message element
    public createMessageElement(
        message: MessageInfo,
        depth: number,
        color: string,
        isBold: boolean,
        commentNumber: number,
    ): HTMLElement {
        const el = document.createElement("div");
        el.classList.add("threadloaf-message");

        // Add ghost message styling
        if (message.isGhost) {
            el.style.opacity = "0.7";
            el.style.fontStyle = "italic";
        }

        if (message.isError) {
            el.dataset.isError = "true";
        }
        el.style.width = "100%";

        // Preview container (always visible)
        const previewContainer = document.createElement("div");
        previewContainer.classList.add("preview-container");

        const contentPreview = document.createElement("span");
        contentPreview.classList.add("message-content", "preview");

        // Handle emojis specially
        // Create a temporary container to parse the content
        const temp = document.createElement("div");
        temp.innerHTML = message.htmlContent;

        // Remove reactions
        temp.querySelectorAll('[class*="reactions_"]').forEach((el) => el.remove());

        // Replace spoiler content
        temp.querySelectorAll('span[class*="spoilerContent_"]').forEach((spoiler) => {
            const ch = String.fromCodePoint(9601);
            spoiler.replaceWith(ch + ch + ch + ch);
        });

        // Replace emoji images with their alt text
        temp.querySelectorAll('img[class*="emoji"]').forEach((img) => {
            if (img instanceof HTMLImageElement) {
                const text = img.alt || img.getAttribute("aria-label") || "";
                if (text) {
                    img.replaceWith(text);
                }
            }
        });

        // Replace <br> and block-level elements with spaces
        temp.querySelectorAll("br, p, div").forEach((el) => {
            el.replaceWith(" " + (el.textContent || "") + " ");
        });

        // Get text and normalize whitespace
        contentPreview.textContent = temp.textContent?.replace(/\s+/g, " ").trim() || "";

        if (isBold) {
            contentPreview.style.fontWeight = "bold";
        }
        // Apply age-based shading to message content
        contentPreview.style.color = color;

        const separator = document.createElement("span");
        separator.classList.add("separator");
        separator.textContent = " : ";

        const authorSpan = document.createElement("span");
        authorSpan.classList.add("message-author");
        authorSpan.textContent = message.author;
        authorSpan.style.color = message.authorColor || "var(--text-normal)";
        if (isBold) {
            authorSpan.style.fontWeight = "bold";
        }

        // Add reactions if present
        const reactionsSpan = document.createElement("span");
        reactionsSpan.classList.add("message-reactions");

        // Get the current reaction display mode
        const options = UserOptionsProvider.getInstance().getOptions();
        if (message.reactionsHtml && options.showReactions) {
            const temp = document.createElement("div");
            temp.innerHTML = message.reactionsHtml;

            // Get all reaction images, limit to first 3
            const reactionElements = Array.from(temp.querySelectorAll('[class*="reaction_"]')).slice(0, 3);

            reactionElements.forEach((reactionEl) => {
                const img = reactionEl.querySelector("img");
                const count = reactionEl.querySelector('[class*="reactionCount_"]');

                if (img) {
                    const container = document.createElement("span");
                    container.classList.add("reaction-container");

                    const imgClone = img.cloneNode(true) as HTMLElement;
                    container.appendChild(imgClone);

                    if (count) {
                        const countSpan = document.createElement("span");
                        countSpan.classList.add("reaction-count");
                        countSpan.textContent = count.textContent;
                        container.appendChild(countSpan);
                    }

                    reactionsSpan.appendChild(container);
                }
            });
        }

        previewContainer.appendChild(contentPreview);
        previewContainer.appendChild(separator);
        previewContainer.appendChild(authorSpan);
        previewContainer.appendChild(reactionsSpan);

        el.appendChild(previewContainer);
        el.dataset.msgId = message.id;
        el.dataset.msgNumber = commentNumber.toString();
        el.dataset.timestamp = message.timestamp.toString();

        el.addEventListener("click", () => {
            this.messageSelector.selectMessage(message.id, "thread");
            this.state.threadContainer?.focus();
        });

        el.addEventListener("contextmenu", (event) => {
            this.messageSelector.selectMessage(message.id, "thread");
            this.state.threadContainer?.focus();
            this.contextMenuManager.handleContextMenu(event, message);
        });

        return el;
    }

    // Inject CSS styles for the thread UI
    public injectStyles(): void {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.type = "text/css";
        link.href = chrome.runtime.getURL("styles.css");
        document.head.appendChild(link);
    }
}
