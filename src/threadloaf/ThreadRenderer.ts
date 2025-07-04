import { ThreadloafState } from "./ThreadloafState";
import { DomParser } from "./DomParser";
import { DomMutator } from "./DomMutator";
import { MessageParser } from "./MessageParser";
import { MessageTreeBuilder } from "./MessageTreeBuilder";
import { MessageInfo } from "./MessageInfo";
import { UserOptionsProvider } from "./UserOptionsProvider";
import { ScrollButtonManager } from "./ScrollButtonManager";
import { ThreadListAppearance } from "./ThreadListAppearance";

/**
 * Manages the rendering of threaded message views in the Discord interface.
 * Responsible for creating and updating the thread UI, handling message
 * expansion/collapse, managing the load more button, and coordinating
 * between the message tree structure and DOM representation.
 */
export class ThreadRenderer {
    private static readonly SPLITTER_HEIGHT = 24; // Match the CSS height
    private static readonly DEFAULT_POSITION = 60; // Default split position
    private static readonly THREADLOAF_VISIBLE_CLASS = "threadloaf-visible";
    private static readonly THREAD_LIST_COMPACT_CLASS = "threadloaf-thread-list-compact";
    private static readonly THREAD_LIST_ULTRA_COMPACT_CLASS = "threadloaf-thread-list-ultra-compact";
    private static readonly THREAD_LIST_ANY_COMPACT_CLASS = "threadloaf-thread-list-compact-or-ultra-compact";

    private state: ThreadloafState;
    private domParser: DomParser;
    private domMutator: DomMutator;
    private messageParser: MessageParser;
    private messageTreeBuilder: MessageTreeBuilder;
    private optionsProvider: UserOptionsProvider;
    private scrollButtonManager: ScrollButtonManager;
    private lastUrl = "";
    private lastSplitPercent = ThreadRenderer.DEFAULT_POSITION;
    private previousSplitPercent = ThreadRenderer.DEFAULT_POSITION;
    private isCollapsed = false;

    public constructor(
        state: ThreadloafState,
        domParser: DomParser,
        domMutator: DomMutator,
        messageParser: MessageParser,
        messageTreeBuilder: MessageTreeBuilder,
        optionsProvider: UserOptionsProvider,
        scrollButtonManager: ScrollButtonManager,
    ) {
        this.state = state;
        this.domParser = domParser;
        this.domMutator = domMutator;
        this.messageParser = messageParser;
        this.messageTreeBuilder = messageTreeBuilder;
        this.optionsProvider = optionsProvider;
        this.scrollButtonManager = scrollButtonManager;

        // Set initial thread list appearance class
        this.updateThreadListAppearanceClasses(optionsProvider.getOptions().threadListAppearance);

        // Listen for option changes
        optionsProvider.addChangeListener((newOptions) => {
            this.updateThreadListAppearanceClasses(newOptions.threadListAppearance);
        });
    }

    private updateThreadListAppearanceClasses(appearance: ThreadListAppearance): void {
        document.body.classList.remove(
            ThreadRenderer.THREAD_LIST_COMPACT_CLASS,
            ThreadRenderer.THREAD_LIST_ULTRA_COMPACT_CLASS,
            ThreadRenderer.THREAD_LIST_ANY_COMPACT_CLASS,
        );
        switch (appearance) {
            case ThreadListAppearance.Compact:
                document.body.classList.add(ThreadRenderer.THREAD_LIST_COMPACT_CLASS);
                document.body.classList.add(ThreadRenderer.THREAD_LIST_ANY_COMPACT_CLASS);
                break;
            case ThreadListAppearance.UltraCompact:
                document.body.classList.add(ThreadRenderer.THREAD_LIST_ULTRA_COMPACT_CLASS);
                document.body.classList.add(ThreadRenderer.THREAD_LIST_ANY_COMPACT_CLASS);
                break;
            default:
                // Normal mode - no additional classes needed
                break;
        }
    }

    private updatePositions(splitPercent: number): void {
        const contentParent = document.querySelector('div[class^="content_"]') as HTMLElement;
        if (!contentParent) return;

        const splitterHeightPercent =
            (ThreadRenderer.SPLITTER_HEIGHT / contentParent.getBoundingClientRect().height) * 100;
        const halfSplitterPercent = splitterHeightPercent / 2;
        const minPosition = halfSplitterPercent;

        // Add half splitter height to the minimum position to align top edge
        const clampedPercent = Math.min(Math.max(splitPercent, minPosition), 90);

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

            .threadloaf-chat-scroll-button.top {
                top: calc(${clampedPercent}% + ${ThreadRenderer.SPLITTER_HEIGHT / 2}px + 8px);
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

    /**
     * Adds or removes a class from the document body to indicate when Threadloaf UI is visible.
     * This allows us to scope CSS rules to only apply when Threadloaf is present, particularly
     * for embedded content like images and videos that need different styling when the chat
     * view is compressed.
     */
    private setThreadloafVisibleBodyClass(visible: boolean): void {
        if (visible) {
            document.body.classList.add(ThreadRenderer.THREADLOAF_VISIBLE_CLASS);
        } else {
            document.body.classList.remove(ThreadRenderer.THREADLOAF_VISIBLE_CLASS);
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
            this.lastSplitPercent = savedPosition ?? options.defaultSplit;
        }

        // Find the content div by traversing up from thread container
        let currentElement = this.state.threadContainer.parentElement;
        let contentParent: HTMLElement | null = null;

        while (currentElement) {
            const chatContentClass = Array.from(currentElement.classList).find((cls) => cls.startsWith("chatContent_"));
            if (chatContentClass) {
                contentParent = currentElement.parentElement;
                break;
            }

            currentElement = currentElement.parentElement;
        }

        if (!contentParent) {
            console.error("Could not find the channel parent; cannot render Threadloaf.");
            return;
        }

        // Check if we're in a non-thread channel
        const isDMChannel = currentUrl.includes("/channels/@me");
        if (isDMChannel || this.isChatOnlyChannel() || this.hasSectionSibling()) {
            // Hide thread container and splitter for DMs
            const threadContainer = document.getElementById("threadloaf-container");
            const splitter = document.getElementById("threadloaf-splitter");
            if (threadContainer) threadContainer.style.display = "none";
            if (splitter) splitter.style.display = "none";

            // Reset main chat view to full size
            const styleElement = document.getElementById("threadloaf-main-style");
            if (styleElement) {
                styleElement.remove();
            }

            this.setThreadloafVisibleBodyClass(false);
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

        // Build the tree
        const rootMessages = this.messageTreeBuilder.buildMessageTree(rawMessages);

        // Flatten the tree to get all messages in display order
        function getAllMessages(): MessageInfo[] {
            const result: MessageInfo[] = [];
            const flatten = (msgs: MessageInfo[]): void => {
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

        // Update the message map in state
        this.state.setMessageInfoMap(allMessages);

        // Sort for color grading (newest first)
        const colorSortedMessages = [...allMessages].sort((a, b) => b.timestamp - a.timestamp);
        const messageColors = new Map<string, string>();
        const messageBold = new Map<string, boolean>();

        const numGradientMessages = Math.min(30, colorSortedMessages.length);

        // Store the newest message ID if we have messages
        if (colorSortedMessages.length > 0) {
            this.state.newestMessageId = colorSortedMessages[0].id;
        }

        colorSortedMessages.forEach((msg, index) => {
            let color;
            if (index === 0) {
                // Newest message gets text-normal color and bold
                color = "var(--text-default)";
                messageColors.set(msg.id, color);
                messageBold.set(msg.id, true);
            } else if (index < numGradientMessages) {
                // Next messages get a gradient blend between text-normal and background-primary
                const ratio = Math.min(50, Math.round((index / numGradientMessages) * 100));
                color = `color-mix(in oklab, var(--text-default), var(--bg-overlay-4,var(--background-base-low)) ${ratio}%)`;
                messageColors.set(msg.id, color);
                messageBold.set(msg.id, false);
            } else {
                // Older messages get 50% blend
                color = "color-mix(in oklab, var(--text-default), var(--bg-overlay-4,var(--background-base-low)) 50%)";
                messageColors.set(msg.id, color);
                messageBold.set(msg.id, false);
            }
        });

        // Clear only the thread content
        threadContent.innerHTML = "";

        // Add Load More button at the top
        const loadMoreButton = document.createElement("button");
        loadMoreButton.classList.add("threadloaf-load-more");

        // Check if any message has isFirstMessage=true
        const hasFirstMessage = allMessages.some((msg) => msg.isFirstMessage);

        loadMoreButton.textContent = hasFirstMessage ? "Top of thread" : "Load more";
        loadMoreButton.disabled = hasFirstMessage;
        loadMoreButton.style.width = "100%";
        loadMoreButton.style.padding = "8px";
        loadMoreButton.style.margin = "8px 0";
        loadMoreButton.style.border = "none";
        loadMoreButton.style.borderRadius = "4px";
        loadMoreButton.style.backgroundColor = "var(--bg-surface-raised)";
        loadMoreButton.style.color = "var(--text-default)";
        loadMoreButton.style.cursor = hasFirstMessage ? "default" : "pointer";
        loadMoreButton.style.opacity = hasFirstMessage ? "0.5" : "1";
        loadMoreButton.style.transition = "background-color 0.1s ease, opacity 0.1s ease";

        // Add hover and pressed styles
        loadMoreButton.addEventListener("mouseenter", () => {
            if (!loadMoreButton.disabled) {
                loadMoreButton.style.backgroundColor = "var(--background-modifier-hover)";
            }
        });
        loadMoreButton.addEventListener("mouseleave", () => {
            if (!loadMoreButton.disabled) {
                loadMoreButton.style.backgroundColor = "var(--bg-surface-raised)";
            }
        });
        loadMoreButton.addEventListener("mousedown", () => {
            if (!loadMoreButton.disabled) {
                loadMoreButton.style.backgroundColor = "var(--background-modifier-active)";
            }
        });
        loadMoreButton.addEventListener("mouseup", () => {
            if (!loadMoreButton.disabled) {
                loadMoreButton.style.backgroundColor = "var(--background-modifier-hover)";
            }
        });

        if (!hasFirstMessage) {
            loadMoreButton.addEventListener("click", () => {
                // Disable the button immediately
                loadMoreButton.disabled = true;
                loadMoreButton.style.cursor = "default";
                loadMoreButton.style.opacity = "0.5";

                // Start from the thread container and traverse up to find the scroller
                const threadContainer = this.state.threadContainer;

                if (threadContainer) {
                    let currentElement: HTMLElement | null = threadContainer;
                    while (currentElement) {
                        if (Array.from(currentElement.classList).some((cls) => cls.startsWith("scroller_"))) {
                            currentElement.scrollTo({ top: 0, behavior: "auto" });
                            break;
                        }
                        currentElement = currentElement.parentElement;
                    }
                }
            });
        }

        threadContent.appendChild(loadMoreButton);

        const renderMessages = (messages: MessageInfo[], depth = 0): HTMLDivElement => {
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
                messageEl.dataset.isUnread = message.isUnread.toString();
                messageEl.style.minWidth = "0"; // Allow message to shrink
                messageEl.style.flexShrink = "1"; // Allow message to shrink
                messageEl.style.flexGrow = "1"; // Allow message to grow

                // Add name highlighting if enabled
                const options = this.optionsProvider.getOptions();
                if (options.highlightOwnName && options.ownName) {
                    const authorEl = messageEl.querySelector(".message-author");
                    if (authorEl && authorEl.textContent?.toLowerCase() === options.ownName.toLowerCase()) {
                        authorEl.classList.add("highlight-own-name");
                    }
                }

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
        this.setThreadloafVisibleBodyClass(true);

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

            // Add half splitter height to the minimum position to align top edge
            const clampedPercent = Math.min(Math.max(splitPercent, minPosition), 90);

            const bottomPercent = 100 - clampedPercent;

            // Update the container position (top pane) - stop above the splitter
            const container = document.getElementById("threadloaf-container");
            if (container) {
                container.style.top = "0";
                container.style.bottom = `calc(${bottomPercent}% + ${ThreadRenderer.SPLITTER_HEIGHT / 2}px)`;
            }

            // Update the main element position (bottom pane) and splitter
            styleElement.textContent = `
                main[class^="chatContent_"], section[class^="chatContent_"] {
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

                .threadloaf-chat-scroll-button.top {
                    top: calc(${clampedPercent}% + ${ThreadRenderer.SPLITTER_HEIGHT / 2}px + 8px);
                }
            `;

            // Store the position for future renders
            this.lastSplitPercent = clampedPercent;

            // Save the position for this URL
            const options = this.optionsProvider.getOptions();
            options.splitterPositions[window.location.href] = clampedPercent;
            this.optionsProvider.setOptions(options).catch(console.error);
        };

        const onMouseDown = (): void => {
            isDragging = true;
            splitter.classList.add("dragging");
            document.body.style.cursor = "row-resize";
            document.body.style.userSelect = "none";
        };

        const onMouseMove = (e: MouseEvent): void => {
            if (!isDragging) return;

            const parentRect = contentParent.getBoundingClientRect();

            // Calculate new split position directly from mouse position
            const splitPosition = e.clientY - parentRect.top;
            const splitPercent = (splitPosition / parentRect.height) * 100;

            this.updatePositions(splitPercent);
        };

        const onMouseUp = (): void => {
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

            if (!threadloafContainer) {
                console.error("Threadloaf container not found");
                return;
            }

            threadloafContainer.replaceWith(newThreadloafContainer);
            contentParent.appendChild(newThreadloafContainer);
            contentParent.appendChild(splitter);
        }

        // Add scroll buttons to thread view
        if (threadContent) {
            this.scrollButtonManager.addThreadViewButtons(threadContent, newThreadloafContainer);
        }

        // Add scroll buttons to chat view
        const chatScroller = document.querySelector('div[class^="messagesWrapper_"] div[class^="scroller_"]');
        if (chatScroller instanceof HTMLElement && contentParent) {
            this.scrollButtonManager.addChatViewButtons(chatScroller, contentParent);
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

        // Create collapse buttons
        const upButton = document.createElement("div");
        upButton.className = "collapse-button";
        upButton.innerHTML = `<svg class="collapse-button-svg" width="512" height="512" version="1.1" viewBox="0 0 135.47 135.47" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(-.36513 19.705)" stroke-width=".76872" aria-label="🞁">
                <path fill="currentColor" d="m10.684 76.661 57.414-57.266 57.414 57.266z"/>
            </g>
        </svg>`;
        upButton.title = "Collapse top panel";

        const downButton = document.createElement("div");
        downButton.className = "collapse-button";
        downButton.innerHTML = `<svg class="collapse-button-svg" width="512" height="512" version="1.1" viewBox="0 0 135.47 135.47" xmlns="http://www.w3.org/2000/svg">
            <g transform="matrix(1 0 0 -1 -.36513 115.76)" stroke-width=".76872" aria-label="🞁">
                <path fill="currentColor" d="m10.684 76.661 57.414-57.266 57.414 57.266z"/>
            </g>
        </svg>`;
        downButton.title = "Collapse bottom panel";

        // Add click handlers
        upButton.addEventListener("click", () => {
            if (this.isCollapsed) {
                this.uncollapseBottomPane();
            } else {
                this.collapseTopPane();
            }
        });

        downButton.addEventListener("click", () => {
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
        if (this.optionsProvider.getOptions().showThreadViewOnlyInForumChannels) {
            // With this option, non-forum channels are chat only.
            const forumEl1 = document.querySelector(
                "div[class^='base_'] div[class^='chat_'] div[class^='subtitleContainer_'] div[class^='titleWrapper_'] h2[class*='parentChannelName_']",
            );
            const forumEl2 = document.querySelector(
                "div[class^='chatLayerWrapper_'] div[class^='upperContainer_'] div[class^='titleWrapper_']",
            );
            return !forumEl1 && !forumEl2;
        } else {
            // Otherwise, all channels are chat + thread.
            return false;
        }
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
        // The chatContent_ class is added when a thread is opened in the split view.
        const children = Array.from(contentParent.children);
        const hasSection = children.some(
            (child) =>
                child.tagName === "SECTION" &&
                !Array.from(child.classList).some((cls) => cls.startsWith("chatContent_")),
        );

        // If the member list is open anywhere, it messes us up, so bail out.
        const hasMemberList = !!document.querySelector('div[class*="membersWrap_"]');

        return hasSection || hasMemberList;
    }
}
