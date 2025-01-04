import { MessageInfo } from "./MessageInfo";

/**
 * Parses Discord message elements into structured MessageInfo objects.
 * Responsible for extracting message content, metadata, and relationships
 * from Discord's DOM structure, handling both regular and system messages.
 * Includes special handling for embeds, reactions, and reply contexts.
 */
export class MessageParser {
    // Parse all messages in the thread container
    public parseMessages(threadContainer: HTMLElement | null): MessageInfo[] {
        if (!threadContainer) return [];
        let lastAuthor: string | undefined;
        let lastAuthorColor: string | undefined;

        const messages = Array.from(threadContainer.querySelectorAll('li[id^="chat-messages-"]')).map((el) => {
            try {
                const id = el.id.split("-").pop() || "";

                const contentsEl = el.querySelector('[class^="contents_"]');
                if (!contentsEl) {
                    throw new Error("Failed to find contents element");
                }

                // Try to parse as a system message first
                const systemContainer = contentsEl.querySelector('[class*="container_"]');
                if (systemContainer) {
                    // This is a system message (like boosts, joins, etc)
                    // Clone the container and remove any header div before processing
                    const containerClone = systemContainer.cloneNode(true) as HTMLElement;
                    const headerEl = containerClone.querySelector("h3");
                    if (headerEl) {
                        headerEl.remove();
                    }

                    // Replace every <br> with a span containing a space.
                    containerClone.querySelectorAll("br").forEach((br) => {
                        const span = document.createElement("span");
                        span.textContent = " ";
                        br.parentNode?.replaceChild(span, br);
                    });

                    // Append a span containing a space to the end of every <div>.
                    containerClone.querySelectorAll("div").forEach((div) => {
                        const span = document.createElement("span");
                        span.textContent = " ";
                        div.appendChild(span);
                    });

                    const messageContent =
                        containerClone.querySelector('[class*="content_"]')?.textContent?.trim() || "";
                    const timestampEl = systemContainer.querySelector("time");
                    if (!timestampEl) {
                        throw new Error("Failed to find timestamp in system message");
                    }

                    const dateTime = timestampEl.getAttribute("datetime");
                    if (!dateTime) {
                        throw new Error("Failed to find datetime attribute in system message");
                    }

                    const timestamp = new Date(dateTime).getTime();

                    // For system messages, we'll use "System" as the author
                    return {
                        id,
                        author: "System",
                        timestamp,
                        content: messageContent,
                        htmlContent: containerClone.outerHTML,
                        children: [],
                        originalElement: el as HTMLElement,
                    };
                }

                // If not a system message, proceed with regular message parsing
                const headerEl = contentsEl.querySelector('[class^="header_"]');
                let author: string | undefined;
                let authorColor: string | undefined;
                let timestampEl: Element | null = null;

                if (headerEl) {
                    // Standard message parsing with header
                    const usernameEl = headerEl.querySelector(
                        '[id^="message-username-"] > span[class^="username_"]',
                    ) as HTMLElement;
                    author = usernameEl?.textContent?.trim();
                    // Capture the author's color from the style attribute
                    authorColor = usernameEl?.style.color;
                    timestampEl = headerEl.querySelector("time");
                    if (author) {
                        lastAuthor = author;
                        lastAuthorColor = authorColor;
                    }
                } else {
                    // Check for system messages first
                    const messageWrapper = contentsEl.closest('[class*="systemMessage_"]');
                    if (messageWrapper) {
                        // First try to find username element directly
                        const usernameEl = messageWrapper.querySelector('[class*="username_"]') as HTMLElement;
                        if (usernameEl) {
                            author = usernameEl.textContent?.trim();
                            authorColor = usernameEl.style.color;
                            if (author) {
                                lastAuthor = author;
                                lastAuthorColor = authorColor;
                            }
                        } else {
                            // For continuation messages, get username from aria-labelledby
                            const labelledBy = messageWrapper.getAttribute("aria-labelledby");
                            if (labelledBy) {
                                // Find the username element ID in the aria-labelledby attribute
                                const usernameId = labelledBy
                                    .split(" ")
                                    .find((id) => id.startsWith("message-username-"));
                                if (usernameId) {
                                    // Look up the username element in the thread container
                                    const referenceUsernameEl = threadContainer.querySelector(
                                        `#${usernameId} [class*="username_"]`,
                                    ) as HTMLElement;
                                    author = referenceUsernameEl?.textContent?.trim();
                                    authorColor = referenceUsernameEl?.style.color;
                                    if (author) {
                                        lastAuthor = author;
                                        lastAuthorColor = authorColor;
                                    }
                                }
                            }
                        }
                        timestampEl = contentsEl.querySelector("time");
                    } else {
                        // Check for follow-up messages in cozy mode
                        timestampEl = contentsEl.querySelector('span[class*="timestamp_"] time');
                        author = lastAuthor;
                        authorColor = lastAuthorColor;
                    }
                }

                if (!author) {
                    throw new Error("Failed to find author element");
                }

                if (!timestampEl) {
                    throw new Error("Failed to find timestamp element");
                }

                const dateTime = timestampEl.getAttribute("datetime");
                if (!dateTime) {
                    throw new Error("Failed to find datetime attribute");
                }

                const timestamp = new Date(dateTime).getTime();

                const messageContentEl = contentsEl.querySelector('[id^="message-content-"]');
                if (!messageContentEl) {
                    throw new Error("Failed to find message content element");
                }

                // Find accessories/embeds container
                const accessoriesId = `message-accessories-${id}`;
                const accessoriesEl = el.querySelector(`#${accessoriesId}`);

                // Find reactions container
                const reactionsEl = el.querySelector('[class*="reactions_"]');
                let reactionsHtml: string | undefined;
                if (reactionsEl) {
                    const reactionsClone = reactionsEl.cloneNode(true) as HTMLElement;
                    // Remove the "add reaction" button
                    const addReactionBtn = reactionsClone.querySelector('div[class*="reactionBtn_"]');
                    if (addReactionBtn) {
                        addReactionBtn.remove();
                    }
                    reactionsHtml = reactionsClone.outerHTML;
                }

                // Debug image detection in both content and accessories
                const contentImages = messageContentEl.querySelectorAll("img:not([class*='emoji_'])");
                const accessoryImages = accessoriesEl
                    ? accessoriesEl.querySelectorAll("img:not([class*='emoji_']):not([class*='reaction'])")
                    : [];
                const totalImages = contentImages.length + accessoryImages.length;

                // Get text content for preview, handling image-only messages
                let textContent = messageContentEl.textContent || "";

                // If there's no text content, check if it's just emojis
                if (!textContent) {
                    const emojiContent = Array.from(messageContentEl.querySelectorAll('img[class*="emoji"]'))
                        .map(
                            (img) =>
                                (img instanceof HTMLImageElement ? img.alt : "") ||
                                img.getAttribute("aria-label") ||
                                "",
                        )
                        .join("");

                    if (emojiContent) {
                        textContent = emojiContent;
                    } else if (totalImages > 0) {
                        textContent = "🖼️ Image";
                    } else if (accessoriesEl) {
                        const links = accessoriesEl.querySelectorAll("a[href]");
                        if (links.length > 0) {
                            textContent = "🔗 Link";
                        }
                    }
                } else {
                    // Create a temporary container to handle spoilers and line breaks
                    const tempContainer = document.createElement("div");
                    tempContainer.innerHTML = messageContentEl.innerHTML;

                    // Replace spoiler content
                    tempContainer.querySelectorAll('span[class*="spoilerContent_"]').forEach((spoiler) => {
                        const ch = String.fromCodePoint(9601);
                        spoiler.replaceWith(ch + ch + ch + ch);
                    });

                    // Convert line breaks to spaces for preview
                    textContent = tempContainer.textContent?.replace(/\s*[\r\n]+\s*/g, " ").trim() || "";

                    // Add embed indicators to the preview if present
                    if (totalImages > 0) {
                        textContent += " 🖼️ Image";
                    } else if (accessoriesEl) {
                        const links = accessoriesEl.querySelectorAll("a[href]");
                        if (links.length > 0) {
                            textContent += " 🔗 Link";
                        }
                    }
                }

                // Clone both content and accessories
                const contentClone = messageContentEl.cloneNode(true) as HTMLElement;
                let fullContent = contentClone;

                if (accessoriesEl) {
                    // Convert embeds to plain text links (excluding reactions)
                    const links = Array.from(
                        accessoriesEl.querySelectorAll<HTMLAnchorElement>(
                            'a[href]:not([class*="reaction"]):not([class*="originalLink_"]):not(article *)',
                        ),
                    ).map((a) => a.href);

                    // Handle image wrappers specially
                    const imageWrappers = Array.from(
                        accessoriesEl.querySelectorAll('div[class*="imageWrapper_"]:not(article *)'),
                    );
                    const imageLinks = imageWrappers
                        .map((wrapper) => {
                            const link = wrapper.querySelector('a[class*="originalLink_"]');
                            return link instanceof HTMLAnchorElement ? link.href : null;
                        })
                        .filter((url): url is string => url !== null);

                    // Handle regular images (not in wrappers)
                    const standaloneImages = Array.from(
                        accessoriesEl.querySelectorAll<HTMLImageElement>(
                            'img[src]:not([data-type="emoji"]):not(.lazyImg_)',
                        ),
                    ).map((img) => img.src);

                    // Create a container for content, links, and reactions
                    const container = document.createElement("div");
                    container.appendChild(contentClone);

                    // Add reactions if present
                    if (reactionsEl) {
                        const reactionsClone = reactionsEl.cloneNode(true) as HTMLElement;
                        // Remove the "add reaction" button
                        const addReactionBtn = reactionsClone.querySelector('div[class*="reactionBtn_"]');
                        if (addReactionBtn) {
                            addReactionBtn.remove();
                        }
                        container.appendChild(reactionsClone);
                    }

                    // Add all unique links
                    const uniqueLinks = [...new Set([...links, ...imageLinks])];
                    if (uniqueLinks.length > 0) {
                        const linkList = document.createElement("div");
                        linkList.classList.add("embed-links");

                        uniqueLinks.forEach((url) => {
                            const link = document.createElement("a");
                            link.href = url;
                            // Add indicator based on URL pattern
                            let prefix = "🔗";
                            if (imageLinks.includes(url)) {
                                prefix = "🖼️";
                            }
                            // Truncate long URLs
                            if (url.length > 70) {
                                const start = url.slice(0, 35);
                                const end = url.slice(-30);
                                link.textContent = `${prefix}\u00A0${start}...${end}`;
                                link.title = url; // Show full URL on hover
                            } else {
                                link.textContent = `${prefix}\u00A0${url}`;
                            }
                            link.target = "_blank";
                            link.rel = "noopener noreferrer";

                            const linkContainer = document.createElement("div");
                            linkContainer.appendChild(link);
                            linkList.appendChild(linkContainer);
                        });

                        container.appendChild(linkList);
                    }

                    fullContent = container;
                }

                // Fix all image sources in the cloned content
                fullContent.querySelectorAll("img").forEach((img, idx) => {
                    const originalSrc = img.src;
                    if (img.src) {
                        img.src = img.src; // Force a re-assignment to resolve any relative URLs
                    }
                    if (img.getAttribute("aria-label")) {
                        img.alt = img.getAttribute("aria-label") || "";
                    }
                });

                let parentId: string | undefined = undefined;
                let parentPreview: { author: string; content: string } | undefined = undefined;
                const replyContextMaybe = el.querySelector('[id^="message-reply-context-"]');
                if (replyContextMaybe) {
                    const parentContentEl = replyContextMaybe.querySelector('[id^="message-content-"]');
                    parentId = parentContentEl?.id.split("-").pop() || "";

                    // Extract parent preview content and author
                    const repliedTextContent = replyContextMaybe.querySelector('[class*="repliedTextContent_"]');
                    const parentAuthorEl = replyContextMaybe.querySelector('[class*="username_"]');
                    if (repliedTextContent && parentAuthorEl) {
                        parentPreview = {
                            author: parentAuthorEl.textContent?.trim().replace(/^@/, "") || "Unknown",
                            content: repliedTextContent.innerHTML,
                        };
                    }
                }

                return {
                    id,
                    author,
                    timestamp,
                    content: textContent,
                    htmlContent: fullContent.innerHTML,
                    parentId,
                    parentPreview,
                    children: [],
                    originalElement: el as HTMLElement,
                    authorColor,
                    reactionsHtml,
                };
            } catch (error) {
                console.error("Error parsing message:", error);
                // Create an error message that shows what went wrong
                const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
                return {
                    id: el.id.split("-").pop() || "",
                    author: "Error",
                    timestamp: Date.now(), // Use current time for error messages
                    content: `Failed to parse message: ${errorMessage}`,
                    htmlContent: `<div class="error-message">Failed to parse message: ${errorMessage}</div>`,
                    children: [],
                    originalElement: el as HTMLElement,
                    isError: true, // Mark this as an error message
                };
            }
        });

        // Filter out any null messages and sort by timestamp
        return messages.filter((msg) => msg !== null).sort((a, b) => a.timestamp - b.timestamp);
    }
}
