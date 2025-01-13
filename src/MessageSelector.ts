import { ThreadloafState } from "./ThreadloafState";

/**
 * Manages the currently selected message in Threadloaf.
 * Handles selection state and styling of selected messages in both thread and chat views.
 */
export class MessageSelector {
    private state: ThreadloafState;
    private readonly STYLE_ELEMENT_ID = "threadloaf-message-selection-style";

    public constructor(state: ThreadloafState) {
        this.state = state;
    }

    public selectMessage(messageId: string): void {
        this.state.selectedMessageId = messageId;
        this.updateSelectionStyle();
    }

    public clearSelection(): void {
        this.state.selectedMessageId = null;
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
