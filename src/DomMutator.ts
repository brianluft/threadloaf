import { ThreadloafState } from "./ThreadloafState";
import { MessageInfo } from "./MessageInfo";
import { ContextMenuManager } from "./ContextMenuManager";

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
    private collapseHandlers: CollapseHandlers | null = null;

    public constructor(state: ThreadloafState, contextMenuManager: ContextMenuManager) {
        this.state = state;
        this.contextMenuManager = contextMenuManager;
    }

    public setCollapseHandlers(handlers: CollapseHandlers): void {
        this.collapseHandlers = handlers;
    }

    public addScrollerStyle(): void {
        const elements = document.querySelectorAll<HTMLElement>('ol[class*="scrollerInner_"]');
        const threadContainer = Array.from(elements).find((el) => {
            return el.getAttribute("data-list-id") === "chat-messages" && el.children.length > 0;
        });

        if (!threadContainer) {
            console.error("Thread container not found.");
            return;
        }

        const scrollerElement = threadContainer.closest('div[class*="scroller_"]');
        if (scrollerElement) {
            const scrollerClass = Array.from(scrollerElement.classList).find((className) =>
                className.startsWith("scroller_"),
            );
            if (scrollerClass) {
                const styleId = `threadloaf-scroller-style-${scrollerClass}`;
                // Remove any existing style first
                const existingStyle = document.getElementById(styleId);
                if (existingStyle) {
                    existingStyle.remove();
                }

                const style = document.createElement("style");
                style.id = styleId;
                style.textContent = `
                    div.${scrollerClass} {
                        margin-bottom: 16px !important;
                    }
                `;
                document.head.appendChild(style);
            }
        }
    }

    public removeScrollerStyle(scrollerClass: string): void {
        const styleId = `threadloaf-scroller-style-${scrollerClass}`;
        const existingStyle = document.getElementById(styleId);
        if (existingStyle) {
            existingStyle.remove();
        }
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
        if (message.reactionsHtml) {
            const temp = document.createElement("div");
            temp.innerHTML = message.reactionsHtml;

            // Get all reaction images, limit to first 3
            const reactionImages = Array.from(temp.querySelectorAll('[class*="reaction_"] img')).slice(0, 3);

            reactionImages.forEach((img) => {
                const imgClone = img.cloneNode(true) as HTMLElement;
                reactionsSpan.appendChild(imgClone);
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
            if (!message.originalElement) {
                console.error("No original element reference found for message");
                return;
            }

            const originalElement = message.originalElement as HTMLElement;

            // Function to apply highlight effect
            const applyHighlight = (element: HTMLElement): void => {
                element.style.transition = "background-color 0.5s";
                element.style.backgroundColor = "color-mix(in oklab, var(--text-normal) 30%, transparent)";

                setTimeout(() => {
                    element.style.backgroundColor = "";
                    // Clean up after animation
                    setTimeout(() => {
                        element.style.transition = "";
                    }, 500);
                }, 1000);
            };

            // If the bottom pane is collapsed, uncollapse it and wait before scrolling
            if (this.collapseHandlers?.isBottomPaneCollapsed()) {
                this.collapseHandlers.uncollapseBottomPane();
                // Wait longer for the pane expansion and layout to stabilize
                setTimeout(() => {
                    originalElement.scrollIntoView({ behavior: "auto", block: "end" });
                    // Add 16px padding to the bottom
                    originalElement.closest('[class*="chat_"]')?.scrollBy(0, 16);
                    applyHighlight(originalElement);
                    applyHighlight(el);
                }, 250);
                return;
            }

            // If not collapsed, scroll and highlight immediately
            originalElement.scrollIntoView({ behavior: "auto", block: "end" });
            // Add 16px padding to the bottom
            originalElement.closest('[class*="chat_"]')?.scrollBy(0, 16);

            // Highlight both the original message and the clicked preview
            applyHighlight(originalElement);
            applyHighlight(el);
        });

        el.addEventListener("contextmenu", (event) => {
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

    public findAndHideHeader(): void {
        const headers = document.querySelectorAll('div[class*=" "]');
        for (const header of Array.from(headers)) {
            const classes = Array.from(header.classList);
            const hasContainerClass = classes.some((cls) => cls.startsWith("container_"));
            const hasHeaderClass = classes.some((cls) => cls.startsWith("header_"));
            if (hasContainerClass && hasHeaderClass && header instanceof HTMLElement) {
                header.style.display = "none";
                break;
            }
        }
    }
}
