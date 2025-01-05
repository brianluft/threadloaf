import { ThreadloafState } from "./ThreadloafState";
import { DomParser } from "./DomParser";
import { DomMutator } from "./DomMutator";
import { MessageParser } from "./MessageParser";
import { MessageTreeBuilder } from "./MessageTreeBuilder";
import { MessageInfo } from "./MessageInfo";
import { UserOptionsProvider } from "./UserOptionsProvider";

/**
 * Manages the rendering of threaded message views in the Discord interface.
 * Responsible for creating and updating the thread UI, handling message
 * expansion/collapse, managing the load more button, and coordinating
 * between the message tree structure and DOM representation.
 */
export class ThreadRenderer {
    private static readonly SPLITTER_HEIGHT = 24; // Match the CSS height
    private static readonly DEFAULT_POSITION = 60; // Default split position

    private state: ThreadloafState;
    private domParser: DomParser;
    private domMutator: DomMutator;
    private messageParser: MessageParser;
    private messageTreeBuilder: MessageTreeBuilder;
    private optionsProvider: UserOptionsProvider;
    private lastUrl: string = "";
    private lastSplitPercent: number = ThreadRenderer.DEFAULT_POSITION;
    private previousSplitPercent: number = ThreadRenderer.DEFAULT_POSITION;
    private isCollapsed: boolean = false;
    private startY: number = 0;
    private startHeight: number = 0;

    constructor(
        state: ThreadloafState,
        domParser: DomParser,
        domMutator: DomMutator,
        messageParser: MessageParser,
        messageTreeBuilder: MessageTreeBuilder,
        optionsProvider: UserOptionsProvider,
    ) {
        this.state = state;
        this.domParser = domParser;
        this.domMutator = domMutator;
        this.messageParser = messageParser;
        this.messageTreeBuilder = messageTreeBuilder;
        this.optionsProvider = optionsProvider;
    }

    private updatePositions(splitPercent: number): void {
        const contentParent = document.querySelector('div[class^="content_"]') as HTMLElement;
        if (!contentParent) return;

        const splitterHeightPercent =
            (ThreadRenderer.SPLITTER_HEIGHT / contentParent.getBoundingClientRect().height) * 100;
        const halfSplitterPercent = splitterHeightPercent / 2;
        const minPosition = halfSplitterPercent;

        console.log("updatePositions called with:", {
            splitPercent,
            minPosition,
            currentLastSplitPercent: this.lastSplitPercent,
        });

        // Add half splitter height to the minimum position to align top edge
        const clampedPercent = Math.min(Math.max(splitPercent, minPosition), 90);

        console.log("Position calculations:", {
            splitterHeight: ThreadRenderer.SPLITTER_HEIGHT,
            splitterHeightPercent,
            halfSplitterPercent,
            minPosition,
            clampedPercent,
        });

        const bottomPercent = 100 - clampedPercent;

        // Update the container position (top pane) - stop above the splitter
        const container = document.getElementById("threadloaf-container");
        if (container) {
            container.style.top = "0";
            container.style.bottom = `calc(${bottomPercent}% + ${ThreadRenderer.SPLITTER_HEIGHT / 2}px)`;
        }

        // Update the main element position (bottom pane) and splitter
        let styleElement = document.getElementById("threadloaf-main-style");
        if (!styleElement) {
            styleElement = document.createElement("style");
            styleElement.id = "threadloaf-main-style";
            document.head.appendChild(styleElement);
        }

        const contentClass = Array.from(contentParent.classList).find((cls) => cls.startsWith("content_"));
        if (!contentClass) return;

        styleElement.textContent = `
            div.${contentClass} > main {
                position: absolute;
                top: calc(${clampedPercent}% + ${ThreadRenderer.SPLITTER_HEIGHT / 2}px);
                left: 0;
                right: 0;
                bottom: 0;
                height: auto !important;
            }

            #threadloaf-splitter {
                top: ${clampedPercent}%;
                transform: translateY(-50%);
            }

            #threadloaf-splitter .collapse-button:first-child {
                cursor: pointer;
                opacity: ${clampedPercent >= 90 ? "1" : clampedPercent <= minPosition ? "0.3" : "1"};
                pointer-events: ${clampedPercent >= 90 ? "auto" : clampedPercent <= minPosition ? "none" : "auto"};
            }

            #threadloaf-splitter .collapse-button:last-child {
                cursor: pointer;
                opacity: ${clampedPercent <= minPosition ? "1" : clampedPercent >= 90 ? "0.3" : "1"};
                pointer-events: ${clampedPercent <= minPosition ? "auto" : clampedPercent >= 90 ? "none" : "auto"};
            }
        `;

        // Store the position for future renders
        this.lastSplitPercent = clampedPercent;

        // Save the position for this URL
        const options = this.optionsProvider.getOptions();
        options.splitterPositions[window.location.href] = clampedPercent;
        this.optionsProvider.setOptions(options).catch(console.error);
    }

    public isBottomPaneCollapsed(): boolean {
        return this.isCollapsed;
    }

    public collapseBottomPane(): void {
        if (!this.isCollapsed && this.lastSplitPercent > 2) {
            this.previousSplitPercent = this.lastSplitPercent;
            // When collapsing bottom, move splitter to bottom (100% minus half splitter height)
            const contentParent = document.querySelector('div[class^="content_"]') as HTMLElement;
            if (!contentParent) return;
            const splitterHeightPercent =
                (ThreadRenderer.SPLITTER_HEIGHT / contentParent.getBoundingClientRect().height) * 100;
            const bottomPosition = 100 - splitterHeightPercent / 2;
            this.updatePositions(bottomPosition);
            this.isCollapsed = true;
        }
    }

    public uncollapseBottomPane(): void {
        if (this.isCollapsed) {
            const targetPosition =
                this.previousSplitPercent > 2 && this.previousSplitPercent < 90
                    ? this.previousSplitPercent
                    : ThreadRenderer.DEFAULT_POSITION;
            this.updatePositions(targetPosition);
            this.isCollapsed = false;
        }
    }

    public collapseTopPane(): void {
        if (!this.isCollapsed && this.lastSplitPercent < 90) {
            this.previousSplitPercent = this.lastSplitPercent;
            // When collapsing top, move splitter to top (just half splitter height)
            const contentParent = document.querySelector('div[class^="content_"]') as HTMLElement;
            if (!contentParent) return;
            const splitterHeightPercent =
                (ThreadRenderer.SPLITTER_HEIGHT / contentParent.getBoundingClientRect().height) * 100;
            const topPosition = splitterHeightPercent / 2;
            this.updatePositions(topPosition);
            this.isCollapsed = true;
        }
    }

    public uncollapseTopPane(): void {
        if (this.isCollapsed) {
            const targetPosition =
                this.previousSplitPercent > 2 && this.previousSplitPercent < 90
                    ? this.previousSplitPercent
                    : ThreadRenderer.DEFAULT_POSITION;
            this.updatePositions(targetPosition);
            this.isCollapsed = false;
        }
    }

    // Render the thread UI
    public renderThread(): void {
        if (!this.state.threadContainer) return;

        // Check if we've changed threads by comparing URLs
        const currentUrl = window.location.href;
        const isNewThread = currentUrl !== this.lastUrl;
        this.lastUrl = currentUrl;

        // When changing threads, either use saved position or default to 60%
        if (isNewThread) {
            const options = this.optionsProvider.getOptions();
            const savedPosition = options.splitterPositions[currentUrl];
            this.lastSplitPercent = savedPosition ?? ThreadRenderer.DEFAULT_POSITION;
        }

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

        // Check if we're in a DM channel
        const isDMChannel = currentUrl.includes("/channels/@me");
        if (isDMChannel || this.isChatOnlyChannel()) {
            // Hide thread container and splitter for DMs
            const threadContainer = document.getElementById("threadloaf-container");
            const splitter = document.getElementById("threadloaf-splitter");
            if (threadContainer) threadContainer.style.display = "none";
            if (splitter) splitter.style.display = "none";

            // Reset main chat view to full size
            let styleElement = document.getElementById("threadloaf-main-style");
            if (styleElement) {
                styleElement.textContent = `
                    div.${contentClass} > main {
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        height: auto !important;
                    }
                `;
            }
            return;
        }

        // Store scroll position before re-render
        const existingThreadContent = document.getElementById("threadloaf-content");

        // Store position of newest visible message relative to viewport
        let recentMessageId: string | null = null;
        let recentMessageViewportOffset: number | null = null;
        if (existingThreadContent) {
            const allMessages = Array.from(
                existingThreadContent.querySelectorAll(".threadloaf-message"),
            ) as HTMLElement[];
            // Find the newest visible message by checking which messages are in the viewport
            const viewportMessages = allMessages.filter((msg) => {
                const rect = msg.getBoundingClientRect();
                return rect.top >= 0 && rect.bottom <= window.innerHeight;
            });
            if (viewportMessages.length > 0) {
                // Among visible messages, find the one with the highest message number
                const newestVisible = viewportMessages.reduce((newest, current) => {
                    const currentNum = parseInt(current.getAttribute("data-msg-number") || "0", 10);
                    const newestNum = parseInt(newest.getAttribute("data-msg-number") || "0", 10);
                    return currentNum > newestNum ? current : newest;
                });
                recentMessageId = newestVisible.getAttribute("data-msg-id");
                const rect = newestVisible.getBoundingClientRect();
                recentMessageViewportOffset = rect.top;
            } else if (allMessages.length > 0) {
                // If no messages are visible, use the last message as fallback
                const lastMessage = allMessages[allMessages.length - 1];
                recentMessageId = lastMessage.getAttribute("data-msg-id");
                const rect = lastMessage.getBoundingClientRect();
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

        // Set initial inline styles for sizing
        const bottomPercent = 100 - this.lastSplitPercent;
        newThreadloafContainer.style.top = "0";
        newThreadloafContainer.style.bottom = `calc(${bottomPercent}% + ${ThreadRenderer.SPLITTER_HEIGHT / 2}px)`;

        // Create the splitter (but don't attach it yet)
        const splitter = document.createElement("div");
        splitter.id = "threadloaf-splitter";

        // Parse messages and build tree
        const rawMessages = this.messageParser.parseMessages(this.state.threadContainer);

        // Build the tree (which includes coalescing)
        const rootMessages = this.messageTreeBuilder.buildMessageTree(rawMessages);

        // Flatten the tree to get all messages in display order
        function getAllMessages(): MessageInfo[] {
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
        }

        const allMessages = getAllMessages();

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

            // Create a map of message ID to row index
            const messageRowIndices = new Map<string, number>();
            flatMessages.forEach(([msg], index) => {
                messageRowIndices.set(msg.id, index);
            });

            // Helper to find if a message is the last child of its parent
            const isLastChild = (msg: MessageInfo): boolean => {
                if (!msg.parentId) return true;
                const parent = allMessages.find((m) => m.id === msg.parentId);
                if (!parent || !parent.children) return true;
                return parent.children[parent.children.length - 1].id === msg.id;
            };

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
            flatMessages.forEach(([message, depth], rowIndex) => {
                const messageContainer = document.createElement("div");
                messageContainer.style.display = "flex";
                messageContainer.style.alignItems = "flex-start";
                messageContainer.style.minWidth = "0"; // Allow container to shrink below children's natural width

                // Create indent spacers
                for (let cellIndex = 0; cellIndex < depth; cellIndex++) {
                    const spacer = document.createElement("div");
                    spacer.classList.add("thread-line-spacer");
                    spacer.dataset.rowIndex = rowIndex.toString();
                    spacer.dataset.cellIndex = cellIndex.toString();
                    spacer.style.display = "inline-block";
                    spacer.style.width = `${getIncrementalIndent(cellIndex + 1)}px`;
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
                );
                messageEl.style.minWidth = "0"; // Allow message to shrink
                messageEl.style.flexShrink = "1"; // Allow message to shrink
                messageEl.style.flexGrow = "1"; // Allow message to grow
                messageEl.style.overflow = "hidden";

                messageContainer.appendChild(messageEl);
                container.appendChild(messageContainer);
            });

            // Set box-drawing characters after all messages are rendered
            // First pass: set fork characters
            flatMessages.forEach(([message, depth], rowIndex) => {
                if (depth === 0) return; // Skip root messages

                // Draw the fork character
                const forkCell = container.querySelector(
                    `.thread-line-spacer[data-row-index="${rowIndex}"][data-cell-index="${depth - 1}"]`,
                ) as HTMLElement;
                if (forkCell) {
                    forkCell.dataset.line = isLastChild(message)
                        ? String.fromCodePoint(9492)
                        : String.fromCodePoint(9500);
                }
            });

            // Second pass: draw vertical lines between forks
            // For each column (except the last one which only has horizontal lines)
            const maxDepth = Math.max(...flatMessages.map((array) => array[1]));
            for (let col = 0; col < maxDepth - 1; col++) {
                let isDrawingLine = false;
                // Go through each row in this column
                for (let row = 0; row < flatMessages.length; row++) {
                    const cell = container.querySelector(
                        `.thread-line-spacer[data-row-index="${row}"][data-cell-index="${col}"]`,
                    ) as HTMLElement;
                    if (!cell) continue;

                    const line = cell.dataset.line;
                    if (line === String.fromCodePoint(9500)) {
                        isDrawingLine = true;
                    } else if (line === String.fromCodePoint(9492)) {
                        isDrawingLine = false;
                    } else if (isDrawingLine) {
                        cell.dataset.line = String.fromCodePoint(9474);
                    }
                }
            }

            return container;
        };

        threadContent.appendChild(renderMessages(rootMessages));

        // Always show both views
        this.state.threadContainer.style.display = "block";

        // Update or create the style element for main positioning
        let styleElement = document.getElementById("threadloaf-main-style");
        if (!styleElement) {
            styleElement = document.createElement("style");
            styleElement.id = "threadloaf-main-style";
            document.head.appendChild(styleElement);
        }

        // Add drag handling
        let isDragging = false;

        // Helper function to update all positions consistently
        this.updatePositions = (splitPercent: number): void => {
            const contentParent = document.querySelector('div[class^="content_"]') as HTMLElement;
            if (!contentParent) return;

            const splitterHeightPercent =
                (ThreadRenderer.SPLITTER_HEIGHT / contentParent.getBoundingClientRect().height) * 100;
            const halfSplitterPercent = splitterHeightPercent / 2;
            const minPosition = halfSplitterPercent;

            console.log("updatePositions called with:", {
                splitPercent,
                minPosition,
                currentLastSplitPercent: this.lastSplitPercent,
            });

            // Add half splitter height to the minimum position to align top edge
            const clampedPercent = Math.min(Math.max(splitPercent, minPosition), 90);

            console.log("Position calculations:", {
                splitterHeight: ThreadRenderer.SPLITTER_HEIGHT,
                splitterHeightPercent,
                halfSplitterPercent,
                minPosition,
                clampedPercent,
            });

            const bottomPercent = 100 - clampedPercent;

            // Update the container position (top pane) - stop above the splitter
            const container = document.getElementById("threadloaf-container");
            if (container) {
                container.style.top = "0";
                container.style.bottom = `calc(${bottomPercent}% + ${ThreadRenderer.SPLITTER_HEIGHT / 2}px)`;
            }

            // Update the main element position (bottom pane) and splitter
            styleElement.textContent = `
                div.${contentClass} > main {
                    position: absolute;
                    top: calc(${clampedPercent}% + ${ThreadRenderer.SPLITTER_HEIGHT / 2}px);
                    left: 0;
                    right: 0;
                    bottom: 0;
                    height: auto !important;
                }

                #threadloaf-splitter {
                    top: ${clampedPercent}%;
                    transform: translateY(-50%);
                }

                #threadloaf-splitter .collapse-button:first-child {
                    cursor: pointer;
                    opacity: ${clampedPercent >= 90 ? "1" : clampedPercent <= minPosition ? "0.3" : "1"};
                    pointer-events: ${clampedPercent >= 90 ? "auto" : clampedPercent <= minPosition ? "none" : "auto"};
                }

                #threadloaf-splitter .collapse-button:last-child {
                    cursor: pointer;
                    opacity: ${clampedPercent <= minPosition ? "1" : clampedPercent >= 90 ? "0.3" : "1"};
                    pointer-events: ${clampedPercent <= minPosition ? "auto" : clampedPercent >= 90 ? "none" : "auto"};
                }
            `;

            // Store the position for future renders
            this.lastSplitPercent = clampedPercent;

            // Save the position for this URL
            const options = this.optionsProvider.getOptions();
            options.splitterPositions[window.location.href] = clampedPercent;
            this.optionsProvider.setOptions(options).catch(console.error);
        };

        const onMouseDown = (e: MouseEvent) => {
            isDragging = true;
            this.startY = e.clientY;
            const containerRect = newThreadloafContainer.getBoundingClientRect();
            this.startHeight = containerRect.height;
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

            this.updatePositions(splitPercent);
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
        this.updatePositions(this.lastSplitPercent);

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
            } else {
                // If we can't find the reference message, scroll to newest
                this.scrollToNewestMessage();
            }
        } else if (isNewThread || this.state.pendingScrollToNewest) {
            // If we've changed threads or have a pending scroll request, scroll to newest
            this.scrollToNewestMessage();
        }

        // Try to hide header again after rendering
        this.domMutator.findAndHideHeader();

        // Create collapse buttons
        const upButton = document.createElement("div");
        upButton.className = "collapse-button";
        upButton.textContent = String.fromCodePoint(0x1f781);
        upButton.title = "Collapse top panel";
        upButton.style.fontSize = "16px";

        const downButton = document.createElement("div");
        downButton.className = "collapse-button";
        downButton.textContent = String.fromCodePoint(0x1f783);
        downButton.title = "Collapse bottom panel";
        downButton.style.fontSize = "16px";

        // Add click handlers
        upButton.addEventListener("click", () => {
            console.log("Up button clicked:", {
                lastSplitPercent: this.lastSplitPercent,
                previousSplitPercent: this.previousSplitPercent,
                isCollapsed: this.isCollapsed,
            });

            if (this.isCollapsed) {
                this.uncollapseBottomPane();
            } else {
                this.collapseTopPane();
            }
        });

        downButton.addEventListener("click", () => {
            console.log("Down button clicked:", {
                lastSplitPercent: this.lastSplitPercent,
                previousSplitPercent: this.previousSplitPercent,
                isCollapsed: this.isCollapsed,
            });

            if (this.isCollapsed) {
                this.uncollapseTopPane();
            } else {
                this.collapseBottomPane();
            }
        });

        // Add buttons to splitter
        splitter.appendChild(upButton);
        splitter.appendChild(downButton);
    }

    private scrollToNewestMessage(): void {
        if (!this.state.newestMessageId) {
            // If we don't have any messages yet, set the flag to try again later
            this.state.pendingScrollToNewest = { shouldExpand: false };
            return;
        }

        // Find the newest message by its ID
        const newestMessage = document.querySelector(
            `.threadloaf-message[data-msg-id="${this.state.newestMessageId}"]`,
        ) as HTMLElement;

        if (newestMessage) {
            // Scroll to show it (without animation), aligned to top
            newestMessage.scrollIntoView({ behavior: "auto", block: "start" });
            // Clear the flag since we successfully scrolled
            this.state.pendingScrollToNewest = null;
        } else {
            // Message not found, set flag to try again later
            this.state.pendingScrollToNewest = { shouldExpand: false };
        }
    }

    private isChatOnlyChannel(): boolean {
        console.log("Options:", this.optionsProvider.getOptions());
        if (this.optionsProvider.getOptions().showThreadViewOnlyInForumChannels) {
            // With this option, non-forum channels are chat only.
            const forumChannelNameEl = document.querySelector(
                "div[class^='base_'] div[class^='chat_'] div[class^='subtitleContainer_'] div[class^='titleWrapper_'] h2[class*='parentChannelName_']",
            );
            return !forumChannelNameEl;
        } else {
            // Otherwise, all channels are chat + thread.
            return false;
        }
    }
}
