import { MessageInfo } from "./MessageInfo";

export class ContextMenuManager {
    private static readonly STYLE_ID = "threadloaf-menu-position";

    public handleContextMenu(event: MouseEvent, message: MessageInfo): void {
        if (!message.originalElement) {
            console.error("No original element reference found for message");
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        // Set up menu positioning style
        this.setupMenuStyle(event);

        // Set up mutation observer for menu cleanup
        this.setupMenuObserver();

        // Try to trigger context menu on each ancestor until one responds
        let currentElement: Element | null = message.originalElement.querySelector('[id^="message-content-"]');
        if (!currentElement) {
            console.error("Message content element not found in:", message.originalElement);
            return;
        }

        while (currentElement && currentElement !== message.originalElement.parentElement) {
            const contextEvent = new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 2,
                buttons: 2,
                clientX: event.clientX,
                clientY: event.clientY,
            });

            const wasHandled = !currentElement.dispatchEvent(contextEvent);

            if (wasHandled) {
                break;
            }
            currentElement = currentElement.parentElement;
        }
    }

    private setupMenuStyle(event: MouseEvent): void {
        let styleEl = document.getElementById(ContextMenuManager.STYLE_ID);
        if (!styleEl) {
            styleEl = document.createElement("style");
            styleEl.id = ContextMenuManager.STYLE_ID;
            document.head.appendChild(styleEl);
        }

        // Calculate menu position
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const isBottomHalf = event.clientY > viewportHeight / 2;
        const isRightHalf = event.clientX > viewportWidth / 2;

        // Position menu near cursor while keeping it on screen
        styleEl.textContent = `
            div[class*="menu_"]:not([class*="submenu_"]) {
                position: fixed !important;
                ${isBottomHalf ? "bottom: " + (viewportHeight - event.clientY) + "px" : "top: " + event.clientY + "px"} !important;
                ${isRightHalf ? "right: " + (viewportWidth - event.clientX) + "px" : "left: " + event.clientX + "px"} !important;
            }
        `;
    }

    private setupMenuObserver(): void {
        const observer = new MutationObserver(() => {
            // Check if menu still exists
            const menuExists = document.querySelector('div[class*="menu_"]');
            if (!menuExists) {
                // Menu was removed, clean up our styles
                const styleEl = document.getElementById(ContextMenuManager.STYLE_ID);
                if (styleEl) {
                    styleEl.remove();
                }
                observer.disconnect();
            }
        });

        // Start observing the document body for removed nodes
        observer.observe(document.body, { childList: true, subtree: true });
    }
}
