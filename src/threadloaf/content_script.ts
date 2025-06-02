import { DomParser } from "./DomParser";
import { MessageParser } from "./MessageParser";
import { MessageTreeBuilder } from "./MessageTreeBuilder";
import { ThreadloafState } from "./ThreadloafState";
import { ThreadRenderer } from "./ThreadRenderer";
import { Threadloaf } from "./Threadloaf";
import { DomMutator } from "./DomMutator";
import { ContextMenuManager } from "./ContextMenuManager";
import { UserOptionsProvider } from "./UserOptionsProvider";
import { ScrollButtonManager } from "./ScrollButtonManager";
import { MessageSelector } from "./MessageSelector";
import { ThreadListReplyFetcher } from "./ThreadListReplyFetcher";
import { ThreadListRefreshButton } from "./ThreadListRefreshButton";

(async function (): Promise<void> {
    const userOptions = await UserOptionsProvider.loadInitialOptions();
    const userOptionsProvider = UserOptionsProvider.getInstance(userOptions);

    const state = new ThreadloafState();
    const contextMenuManager = new ContextMenuManager();
    const messageSelector = new MessageSelector(state);
    const domMutator = new DomMutator(state, contextMenuManager, messageSelector);
    const messageParser = new MessageParser();
    const messageTreeBuilder = new MessageTreeBuilder();
    const domParser = new DomParser(state);
    const scrollButtonManager = new ScrollButtonManager();
    const threadListReplyFetcher = new ThreadListReplyFetcher(userOptionsProvider);
    const threadListRefreshButton = new ThreadListRefreshButton(threadListReplyFetcher, userOptionsProvider);
    const threadRenderer = new ThreadRenderer(
        state,
        domParser,
        domMutator,
        messageParser,
        messageTreeBuilder,
        userOptionsProvider,
        scrollButtonManager,
    );

    // Set up collapse handlers after creating ThreadRenderer
    domMutator.setCollapseHandlers({
        isBottomPaneCollapsed: () => threadRenderer.isBottomPaneCollapsed(),
        uncollapseBottomPane: () => threadRenderer.uncollapseBottomPane(),
    });

    new Threadloaf(state, domParser, domMutator, threadRenderer, threadListReplyFetcher, threadListRefreshButton);
})();
