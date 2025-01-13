import { MessageInfo } from "./MessageInfo";

/**
 * Manages the global state of the Threadloaf extension.
 * Maintains references to key DOM elements, observers, and UI state flags
 * that need to be accessed across different components of the extension.
 */
export class ThreadloafState {
    public appContainer: HTMLElement | null = null;
    private _threadContainer: HTMLElement | null = null;
    private threadContainerChangeHandlers: Array<(container: HTMLElement | null) => void> = [];
    private _selectedMessageId: string | null = null;
    private selectedMessageChangeHandlers: Array<(messageId: string | null) => void> = [];
    private messageInfoMap = new Map<string, MessageInfo>();
    public observer: MutationObserver | null = null;
    public headerObserver: MutationObserver | null = null;
    public isThreadViewActive = false;
    public isLoadingMore = false;
    public newestMessageId: string | null = null;
    public pendingScrollToNewest: { shouldExpand: boolean } | null = null;

    public get threadContainer(): HTMLElement | null {
        return this._threadContainer;
    }

    public set threadContainer(container: HTMLElement | null) {
        this._threadContainer = container;
        this.threadContainerChangeHandlers.forEach((handler) => handler(container));
    }

    public onThreadContainerChange(handler: (container: HTMLElement | null) => void): void {
        this.threadContainerChangeHandlers.push(handler);
    }

    public get selectedMessageId(): string | null {
        return this._selectedMessageId;
    }

    public set selectedMessageId(messageId: string | null) {
        if (this._selectedMessageId === messageId) {
            this._selectedMessageId = null;
        } else {
            this._selectedMessageId = messageId;
        }
        this.selectedMessageChangeHandlers.forEach((handler) => handler(messageId));
    }

    public onSelectedMessageChange(handler: (messageId: string | null) => void): void {
        this.selectedMessageChangeHandlers.push(handler);
    }

    public setMessageInfoMap(messages: MessageInfo[]): void {
        this.messageInfoMap.clear();
        messages.forEach((msg) => this.messageInfoMap.set(msg.id, msg));
    }

    public getMessageInfo(messageId: string): MessageInfo | undefined {
        return this.messageInfoMap.get(messageId);
    }
}
