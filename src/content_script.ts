import { DomParser } from "./DomParser";
import { MessageParser } from "./MessageParser";
import { MessageTreeBuilder } from "./MessageTreeBuilder";
import { ThreadloafState } from "./ThreadloafState";
import { ThreadRenderer } from "./ThreadRenderer";
import { Threadloaf } from "./Threadloaf";
import { DomMutator } from "./DomMutator";
import { runTests } from "./runTests";

(function () {
    const state = new ThreadloafState();
    const messageParser = new MessageParser();
    const messageTreeBuilder = new MessageTreeBuilder();
    const domMutator = new DomMutator(state);
    const domParser = new DomParser(domMutator, state);
    const threadRenderer = new ThreadRenderer(state, domParser, domMutator, messageParser, messageTreeBuilder);
    new Threadloaf(state, domParser, domMutator, threadRenderer);
    //runTests();
})();
