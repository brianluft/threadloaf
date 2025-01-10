import { DomMutator } from "./DomMutator";
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
    private domMutator: DomMutator;
    private state: ThreadloafState;

    public constructor(domMutator: DomMutator, state: ThreadloafState) {
        this.domMutator = domMutator;
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
    public setupMutationObserver(renderThread: () => void): void {
        this.state.observer = new MutationObserver((mutations) => {
            let shouldRerender = false;

            for (const mutation of mutations) {
                // Check for new messages
                const hasNewMessages = Array.from(mutation.addedNodes).some(
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
                const hasSectionChanges =
                    Array.from(mutation.addedNodes).some(
                        (node) => node instanceof HTMLElement && node.tagName === "SECTION",
                    ) ||
                    Array.from(mutation.removedNodes).some(
                        (node) => node instanceof HTMLElement && node.tagName === "SECTION",
                    );

                // Check for addition or removal of div.content_* in the content container
                const hasContentContainerChanges =
                    Array.from(mutation.addedNodes).some(
                        (node) =>
                            node instanceof HTMLElement &&
                            node.tagName === "DIV" &&
                            Array.from(node.classList).some((cls: string) => cls.startsWith("content_")),
                    ) ||
                    Array.from(mutation.removedNodes).some(
                        (node) =>
                            node instanceof HTMLElement &&
                            node.tagName === "DIV" &&
                            Array.from(node.classList).some((cls: string) => cls.startsWith("content_")),
                    );

                if (
                    hasNewMessages ||
                    hasReactionChanges ||
                    hasMessageEdits ||
                    hasSectionChanges ||
                    hasContentContainerChanges
                ) {
                    shouldRerender = true;
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

    public checkIfTopLoaded(): boolean {
        if (!this.state.threadContainer) {
            return false;
        }

        // Check if there's a container div with a heading-xxl/extrabold class as a direct child
        const topContainer = Array.from(this.state.threadContainer.children).find((child) => {
            if (!(child instanceof HTMLElement)) {
                return false;
            }

            const hasContainerClass = Array.from(child.classList).some((cls) => cls.startsWith("container_"));
            if (!hasContainerClass) {
                return false;
            }

            const hasHeading = Array.from(child.children).some((grandChild) => {
                if (!(grandChild instanceof HTMLElement)) {
                    return false;
                }

                const isHeading =
                    grandChild.tagName === "H3" &&
                    Array.from(grandChild.classList).some(
                        (cls) => cls.startsWith("heading-xxl") || cls.startsWith("extrabold"),
                    );

                return isHeading;
            });

            return hasHeading;
        });

        const result = !!topContainer;
        return result;
    }

    /**
     * Checks if there is a section element as a direct child of the content container
     * that is a sibling to our threadloaf container
     */
    public hasSectionSibling(): boolean {
        const threadloafContainer = document.getElementById("threadloaf-container");
        if (!threadloafContainer) return false;

        const contentParent = threadloafContainer.parentElement;
        if (!contentParent) return false;

        // Look for any section element that is a direct child of the content container.
        // This fixes search results.
        const hasSection = Array.from(contentParent.children).some((child) => child.tagName === "SECTION");

        // Also look for a div.container_* sibling.
        // This fixes member lists.
        const hasContainer = Array.from(contentParent.children).some(
            (child) =>
                child.tagName === "DIV" &&
                Array.from(child.classList).some((cls: string) => cls.startsWith("container_")),
        );

        return hasSection || hasContainer;
    }
}
