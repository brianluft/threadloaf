export interface MessageInfo {
    id: string;
    author: string;
    timestamp: number; // Unix timestamp in milliseconds
    content: string;
    htmlContent: string;
    parentId?: string; // Parent message ID (if reply)
    parentPreview?: { author: string; content: string }; // Preview of parent message if available
    children?: MessageInfo[]; // List of child messages
    messageNumber?: number; // Optional message number
    originalElement?: HTMLElement; // Reference to the original Discord message element
    isError?: boolean; // Whether this is an error message
    isGhost: boolean; // Whether this is a ghost message for an unloaded parent
    authorColor?: string; // Optional color for the author's name from Discord's UI
    isFirstMessage: boolean; // Whether this is the first message in the channel/thread
    reactionsHtml?: string; // HTML content of reactions
    isUnread: boolean; // Whether this message is below the "new messages" bar
}
