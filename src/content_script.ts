import { DomParser } from "./DomParser";
import { MessageParser } from "./MessageParser";
import { MessageTreeBuilder } from "./MessageTreeBuilder";
import { ThreadloafState } from "./ThreadloafState";
import { ThreadRenderer } from "./ThreadRenderer";
import { Threadloaf } from "./Threadloaf";
import { DomMutator } from "./DomMutator";
import { ContextMenuManager } from "./ContextMenuManager";
import { runTests } from "./runTests";
import { UserOptionsProvider } from "./UserOptionsProvider";

(async function () {
    const userOptions = await UserOptionsProvider.loadInitialOptions();
    const userOptionsProvider = UserOptionsProvider.getInstance(userOptions);

    const state = new ThreadloafState();
    const contextMenuManager = new ContextMenuManager();
    const domMutator = new DomMutator(state, contextMenuManager);
    const messageParser = new MessageParser();
    const messageTreeBuilder = new MessageTreeBuilder();
    const domParser = new DomParser(domMutator, state);
    const threadRenderer = new ThreadRenderer(
        state,
        domParser,
        domMutator,
        messageParser,
        messageTreeBuilder,
        userOptionsProvider,
    );

    // Set up collapse handlers after creating ThreadRenderer
    domMutator.setCollapseHandlers({
        isBottomPaneCollapsed: () => threadRenderer.isBottomPaneCollapsed(),
        uncollapseBottomPane: () => threadRenderer.uncollapseBottomPane(),
    });

    new Threadloaf(state, domParser, domMutator, threadRenderer);
    runTests();
})();
