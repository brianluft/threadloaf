import { ThreadloafState } from "./ThreadloafState";
import { DomParser } from "./DomParser";
import { DomMutator } from "./DomMutator";
import { MessageParser } from "./MessageParser";
import { MessageTreeBuilder } from "./MessageTreeBuilder";
import { MessageInfo } from "./MessageInfo";

/**
 * Manages the rendering of threaded message views in the Discord interface.
 * Responsible for creating and updating the thread UI, handling message
 * expansion/collapse, managing the load more button, and coordinating
 * between the message tree structure and DOM representation.
 */
export class ThreadRenderer {
    private state: ThreadloafState;
    private domParser: DomParser;
    private domMutator: DomMutator;
    private messageParser: MessageParser;
    private messageTreeBuilder: MessageTreeBuilder;
    private lastUrl: string = "";
    private lastSplitPercent: number = 34; // Store the split position, default to 34%

    constructor(
        state: ThreadloafState,
        domParser: DomParser,
        domMutator: DomMutator,
        messageParser: MessageParser,
        messageTreeBuilder: MessageTreeBuilder,
    ) {
        this.state = state;
        this.domParser = domParser;
        this.domMutator = domMutator;
        this.messageParser = messageParser;
        this.messageTreeBuilder = messageTreeBuilder;
    }

    // Render the thread UI
    public renderThread(): void {
        if (!this.state.threadContainer) return;

        // Check if we've changed threads by comparing URLs
        const currentUrl = window.location.href;
        const isNewThread = currentUrl !== this.lastUrl;
        this.lastUrl = currentUrl;

        // Store scroll position before re-render
        const existingThreadContent = document.getElementById("threadloaf-content");

        // Store position of most recent message relative to viewport
        let recentMessageId: string | null = null;
        let recentMessageViewportOffset: number | null = null;
        if (existingThreadContent) {
            const allMessages = Array.from(existingThreadContent.querySelectorAll(".threadloaf-message"));
            const mostRecentMessage = allMessages[allMessages.length - 1] as HTMLElement;
            if (mostRecentMessage) {
                recentMessageId = mostRecentMessage.getAttribute("data-msg-id");
                const rect = mostRecentMessage.getBoundingClientRect();
                recentMessageViewportOffset = rect.top;
            }
        }

        // Check if we're at the top of the thread
        this.state.isTopLoaded = this.domParser.checkIfTopLoaded();

        // Get existing container or create new one
        let threadloafContainer = document.getElementById("threadloaf-container");
        const isNewContainer = !threadloafContainer;

        if (isNewContainer) {
            threadloafContainer = document.createElement("div");
            threadloafContainer.id = "threadloaf-container";
        }

        // Create a new container for thread content
        const threadContent = document.createElement("div");
        threadContent.id = "threadloaf-content";

        // Build the new DOM tree
        const newThreadloafContainer = document.createElement("div");
        newThreadloafContainer.id = "threadloaf-container";
        newThreadloafContainer.appendChild(threadContent);

        // Create the splitter (but don't attach it yet)
        const splitter = document.createElement("div");
        splitter.id = "threadloaf-splitter";

        // Parse messages and build tree
        const rawMessages = this.messageParser.parseMessages(this.state.threadContainer);

        // Build the tree (which includes coalescing)
        const rootMessages = this.messageTreeBuilder.buildMessageTree(rawMessages);

        // Flatten the tree to get all messages in display order
        const getAllMessages = (messages: MessageInfo[]): MessageInfo[] => {
            const result: MessageInfo[] = [];
            const flatten = (msgs: MessageInfo[]) => {
                msgs.forEach((msg) => {
                    result.push(msg);
                    if (msg.children && msg.children.length > 0) {
                        flatten(msg.children);
                    }
                });
            };
            flatten(rootMessages);
            return result;
        };

        const allMessages = getAllMessages(rootMessages);

        // Now assign numbers to all messages in display order
        allMessages.forEach((msg, index) => {
            msg.messageNumber = index + 1;
        });

        // Sort for color grading (newest first)
        const colorSortedMessages = [...allMessages].sort((a, b) => b.timestamp - a.timestamp);
        const messageColors = new Map<string, string>();
        const messageBold = new Map<string, boolean>();

        const numGradientMessages = Math.min(15, colorSortedMessages.length);

        // Store the newest message ID if we have messages
        if (colorSortedMessages.length > 0) {
            this.state.newestMessageId = colorSortedMessages[0].id;
        }

        colorSortedMessages.forEach((msg, index) => {
            let color;
            if (index === 0) {
                // Newest message gets text-normal color and bold
                color = "var(--text-normal)";
                messageColors.set(msg.id, color);
                messageBold.set(msg.id, true);
            } else if (index < numGradientMessages) {
                // Next messages get a gradient blend between text-normal and background-primary
                const ratio = Math.min(50, Math.round((index / numGradientMessages) * 100));
                color = `color-mix(in oklab, var(--text-normal), var(--background-primary) ${ratio}%)`;
                messageColors.set(msg.id, color);
                messageBold.set(msg.id, false);
            } else {
                // Older messages get 50% blend
                color = "color-mix(in oklab, var(--text-normal), var(--background-primary) 50%)";
                messageColors.set(msg.id, color);
                messageBold.set(msg.id, false);
            }
        });

        // Clear only the thread content
        threadContent.innerHTML = "";

        const renderMessages = (messages: MessageInfo[], depth = 0) => {
            const container = document.createElement("div");
            container.classList.add("message-thread");

            // Helper function to recursively flatten the tree
            const flattenMessages = (msgs: MessageInfo[], currentDepth: number): Array<[MessageInfo, number]> => {
                const result: Array<[MessageInfo, number]> = [];
                msgs.forEach((msg) => {
                    result.push([msg, currentDepth]);
                    if (msg.children && msg.children.length > 0) {
                        result.push(...flattenMessages(msg.children, currentDepth + 1));
                    }
                });
                return result;
            };

            // Get flattened list of [message, depth] pairs
            const flatMessages = flattenMessages(messages, depth);

            // Calculate incremental indents
            const MAX_INDENT = 350;
            const FIRST_LEVEL_INDENT = 40;
            const DECAY_RATE = -Math.log(1 - FIRST_LEVEL_INDENT / MAX_INDENT);
            const getIncrementalIndent = (level: number): number => {
                const totalIndentPrev =
                    level === 0 ? 0 : Math.round(MAX_INDENT * (1 - Math.exp(-DECAY_RATE * (level - 1))));
                const totalIndentCurr = Math.round(MAX_INDENT * (1 - Math.exp(-DECAY_RATE * level)));
                return totalIndentCurr - totalIndentPrev;
            };

            // Create message elements
            flatMessages.forEach(([message, depth]) => {
                const messageContainer = document.createElement("div");
                messageContainer.style.display = "flex";
                messageContainer.style.alignItems = "flex-start";
                messageContainer.style.minWidth = "0"; // Allow container to shrink below children's natural width

                // Create indent spacers
                for (let i = 0; i < depth; i++) {
                    const spacer = document.createElement("div");
                    spacer.style.display = "inline-block";
                    spacer.style.width = `${getIncrementalIndent(i + 1)}px`;
                    spacer.style.flexShrink = "0"; // Prevent spacer from shrinking
                    spacer.style.alignSelf = "stretch";
                    messageContainer.appendChild(spacer);
                }

                const messageEl = this.domMutator.createMessageElement(
                    message,
                    0, // depth is now 0 since we handle indentation here
                    messageColors.get(message.id) || "",
                    messageBold.get(message.id) || false,
                    message.messageNumber || 0,
                    allMessages.length,
                );
                messageEl.style.minWidth = "0"; // Allow message to shrink
                messageEl.style.flexShrink = "1"; // Allow message to shrink
                messageEl.style.flexGrow = "1"; // Allow message to grow
                messageEl.style.overflow = "hidden";

                messageContainer.appendChild(messageEl);
                container.appendChild(messageContainer);
            });

            return container;
        };

        // Store the previous set of message IDs before we update
        const previousMessageIds = new Set(
            Array.from(document.querySelectorAll(".threadloaf-message"))
                .map((el) => el.getAttribute("data-msg-id"))
                .filter((id): id is string => id !== null),
        );

        threadContent.appendChild(renderMessages(rootMessages));

        // Check if we have a completely different set of messages
        const currentMessageIds = new Set(
            Array.from(document.querySelectorAll(".threadloaf-message"))
                .map((el) => el.getAttribute("data-msg-id"))
                .filter((id): id is string => id !== null),
        );

        // Always show both views
        this.state.threadContainer.style.display = "block";

        // Find the content div by traversing up from thread container
        let currentElement = this.state.threadContainer.parentElement;
        let contentParent: HTMLElement | null = null;
        let contentClass: string | null = null;

        while (currentElement) {
            // Check if this is a div with content_* class and has a main child
            if (
                currentElement.tagName === "DIV" &&
                Array.from(currentElement.classList).some((cls) => {
                    if (cls.startsWith("content_")) {
                        contentClass = cls;
                        return true;
                    }
                    return false;
                }) &&
                currentElement.querySelector("main")
            ) {
                contentParent = currentElement as HTMLElement;
                break;
            }

            currentElement = currentElement.parentElement;
        }

        if (!contentParent || !contentClass) {
            console.error("Could not find parent div with class content_* and main child, cannot render threadloaf");
            return;
        }

        // Update or create the style element for main positioning
        let styleElement = document.getElementById("threadloaf-main-style");
        if (!styleElement) {
            styleElement = document.createElement("style");
            styleElement.id = "threadloaf-main-style";
            document.head.appendChild(styleElement);
        }

        // Add drag handling
        let isDragging = false;
        let startY = 0;
        let startHeight = 0;

        // Helper function to update all positions consistently
        const updatePositions = (splitPercent: number) => {
            const clampedPercent = Math.min(Math.max(splitPercent, 10), 90);
            const bottomPercent = 100 - clampedPercent;
            const splitterHeight = 24; // Match the CSS height
            const splitterHeightPercent = (splitterHeight / contentParent.getBoundingClientRect().height) * 100;
            const halfSplitterPercent = splitterHeightPercent / 2;

            // Update the container position (bottom pane) - stop below the splitter
            newThreadloafContainer.style.top = `calc(${clampedPercent}% + ${splitterHeight / 2}px)`;

            // Update the main element position (top pane) and splitter
            styleElement.textContent = `
                div.${contentClass} > main {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: calc(${100 - clampedPercent}% + ${splitterHeight / 2}px);
                    height: auto !important;
                }

                #threadloaf-splitter {
                    position: absolute;
                    top: ${clampedPercent}%;
                    left: 0;
                    right: 0;
                    transform: translateY(-50%);
                }
            `;

            // Store the position for future renders
            this.lastSplitPercent = clampedPercent;
        };

        const onMouseDown = (e: MouseEvent) => {
            isDragging = true;
            startY = e.clientY;
            const containerRect = newThreadloafContainer.getBoundingClientRect();
            startHeight = containerRect.height;
            splitter.classList.add("dragging");
            document.body.style.cursor = "row-resize";
            document.body.style.userSelect = "none";
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;

            const parentRect = contentParent.getBoundingClientRect();

            // Calculate new split position directly from mouse position
            const splitPosition = e.clientY - parentRect.top;
            const splitPercent = (splitPosition / parentRect.height) * 100;

            updatePositions(splitPercent);
        };

        const onMouseUp = () => {
            if (!isDragging) return;
            isDragging = false;
            splitter.classList.remove("dragging");
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };

        splitter.addEventListener("mousedown", onMouseDown);
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);

        // Set initial positions using the stored split percentage
        updatePositions(this.lastSplitPercent);

        contentParent.style.position = "relative";

        if (isNewContainer) {
            // First render - append both container and splitter
            contentParent.appendChild(newThreadloafContainer);
            contentParent.appendChild(splitter);
        } else {
            const existingSplitter = document.getElementById("threadloaf-splitter");
            if (existingSplitter) {
                existingSplitter.remove();
            }
            threadloafContainer!.replaceWith(newThreadloafContainer);
            contentParent.appendChild(splitter);
        }

        // Restore scroll position if we have a recent message
        if (recentMessageId && recentMessageViewportOffset !== null && !isNewThread) {
            // Only restore position if we haven't changed threads
            const recentMessage = document.querySelector(`[data-msg-id="${recentMessageId}"]`) as HTMLElement;
            if (recentMessage) {
                const newRect = recentMessage.getBoundingClientRect();
                const currentOffset = newRect.top;
                const scrollContainer = document.getElementById("threadloaf-content");
                if (scrollContainer) {
                    scrollContainer.scrollTop += currentOffset - recentMessageViewportOffset;
                }
            }
        } else if (isNewThread) {
            // If we've changed threads, scroll to newest
            this.scrollToNewestMessage();
        } else {
            // Set flag to scroll to newest once messages are loaded
            this.state.pendingScrollToNewest = { shouldExpand: false };
        }

        // Try to hide header again after rendering
        this.domMutator.findAndHideHeader();
    }

    private scrollToNewestMessage(): void {
        if (!this.state.newestMessageId) {
            return;
        }

        // Find the newest message by its ID
        const newestMessage = document.querySelector(
            `.threadloaf-message[data-msg-id="${this.state.newestMessageId}"]`,
        ) as HTMLElement;

        if (newestMessage) {
            // Scroll to show it (without animation)
            newestMessage.scrollIntoView({ behavior: "auto", block: "center" });
            // Clear any pending scroll
            this.state.pendingScrollToNewest = null;
        } else {
            // Message not found, set flag to try again later
            this.state.pendingScrollToNewest = { shouldExpand: false };
        }
    }
}
