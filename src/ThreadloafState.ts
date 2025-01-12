/**
 * Manages the global state of the Threadloaf extension.
 * Maintains references to key DOM elements, observers, and UI state flags
 * that need to be accessed across different components of the extension.
 */
export class ThreadloafState {
    public appContainer: HTMLElement | null = null;
    public threadContainer: HTMLElement | null = null;
    public observer: MutationObserver | null = null;
    public headerObserver: MutationObserver | null = null;
    public isThreadViewActive = false;
    public isLoadingMore = false;
    public newestMessageId: string | null = null;
    public pendingScrollToNewest: { shouldExpand: boolean } | null = null;
}
