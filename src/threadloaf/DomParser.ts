import { ThreadloafState } from "./ThreadloafState";

/*
 * IMPORTANT: Discord Class/ID Naming Pattern
 *
 * Discord dynamically generates unique suffixes for all classes and IDs.
 * - Classes use underscores: "foo_[random]"  (e.g., "container_c2668b", "scroller_e2e187")
 * - IDs use hyphens: "bar-[random]"  (e.g., "message-content-123456", "chat-messages-789")
 *
 * NEVER do exact matches like:
 *   element.classList.contains("container_")  // WRONG
 *   document.getElementById("message-content") // WRONG
 *
 * ALWAYS use pattern matching:
 *   element.classList.some(cls => cls.startsWith("container_"))  // Correct
 *   document.querySelector('[id^="message-content-"]')  // Correct
 */

/**
 * Handles DOM traversal and element discovery in Discord's interface.
 * Responsible for finding key UI elements, setting up mutation observers
 * to track DOM changes, and providing methods to locate message containers
 * and other important Discord UI components.
 */
export class DomParser {
    private state: ThreadloafState;

    public constructor(state: ThreadloafState) {
        this.state = state;
    }

    // Locate the top-level app container
    public findAppContainer(): HTMLElement | null {
        return document.querySelector("#app-mount");
    }

    // Locate the thread container dynamically
    public findThreadContainer(): HTMLElement | null {
        const elements = document.querySelectorAll<HTMLElement>('ol[class*="scrollerInner_"]');
        const threadContainer =
            Array.from(elements).find((el) => {
                return el.getAttribute("data-list-id") === "chat-messages" && el.children.length > 0;
            }) || null;

        return threadContainer;
    }

    // Attach a MutationObserver to monitor DOM changes
    public setupMutationObserver(renderThread: () => void, onThreadListChange?: () => void): void {
        this.state.observer = new MutationObserver((mutations) => {
            let shouldRerender = false;
            let shouldCheckThreadList = false;

            for (const mutation of mutations) {
                const changedNodes = Array.from(mutation.addedNodes).concat(Array.from(mutation.removedNodes));

                // Check for message changes
                const hasMessageChanges = changedNodes.some(
                    (node) =>
                        node instanceof HTMLElement &&
                        (node.matches('li[id^="chat-messages-"]') || node.querySelector('li[id^="chat-messages-"]')),
                );

                // Check for reactions changes - handle both cozy and compact modes
                const hasReactionChanges = ((): boolean => {
                    if (!(mutation.target instanceof HTMLElement)) {
                        return false;
                    }

                    // First find the containing message li element
                    const messageLi = mutation.target.closest('li[id^="chat-messages-"]');
                    if (!messageLi) {
                        return false;
                    }

                    // Check if the mutation affects a reactions container anywhere within this message
                    return !!messageLi.querySelector('[class*="reactions_"]');
                })();

                // Check for message content edits
                const hasMessageEdits =
                    (mutation.target instanceof HTMLElement && mutation.target.matches('[id^="message-content-"]')) ||
                    (mutation.target instanceof HTMLElement && mutation.target.closest('[id^="message-content-"]'));

                // Check for section element changes in content container
                const hasSectionChanges = changedNodes.some(
                    (node) => node instanceof HTMLElement && node.tagName === "SECTION",
                );

                // Check for addition or removal of .chatContent_* or .membersWrap_ in the content container
                const hasContentContainerChanges = changedNodes.some(
                    (node) =>
                        node instanceof HTMLElement &&
                        Array.from(node.classList).some(
                            (cls: string) => cls.startsWith("chatContent_") || cls.startsWith("membersWrap_"),
                        ),
                );

                // Check for thread list changes (li.card_* elements)
                const hasThreadListChanges = changedNodes.some(
                    (node) =>
                        node instanceof HTMLElement &&
                        (node.matches('li[class*="card_"]') || node.querySelector('li[class*="card_"]')),
                );

                if (
                    hasMessageChanges ||
                    hasReactionChanges ||
                    hasMessageEdits ||
                    hasSectionChanges ||
                    hasContentContainerChanges
                ) {
                    shouldRerender = true;
                }

                if (hasThreadListChanges) {
                    shouldCheckThreadList = true;
                }

                if (shouldRerender) {
                    break;
                }
            }

            if (shouldRerender) {
                const newThreadContainer = this.findThreadContainer();
                if (newThreadContainer) {
                    this.state.threadContainer = newThreadContainer;
                    renderThread();
                }
            }

            if (shouldCheckThreadList && onThreadListChange) {
                onThreadListChange();
            }
        });

        if (this.state.appContainer) {
            this.state.observer.observe(this.state.appContainer, {
                childList: true,
                subtree: true,
                characterData: true, // Needed for text content changes
                attributes: true, // Needed for reaction changes
            });
        }
    }
}
