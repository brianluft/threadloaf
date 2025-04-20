import { UserOptionsProvider } from "./UserOptionsProvider";
import { ThreadListAppearance } from "./ThreadListAppearance";

document.addEventListener("DOMContentLoaded", async () => {
    const userOptions = await UserOptionsProvider.loadInitialOptions();
    const optionsProvider = UserOptionsProvider.getInstance(userOptions);
    const options = optionsProvider.getOptions();

    // Set initial radio button states
    const forumOnlyRadio = document.getElementById("forumChannelsOnly") as HTMLInputElement;
    const allChannelsRadio = document.getElementById("allChannels") as HTMLInputElement;
    forumOnlyRadio.checked = options.showThreadViewOnlyInForumChannels;
    allChannelsRadio.checked = !options.showThreadViewOnlyInForumChannels;

    // Listen for radio button changes
    forumOnlyRadio.addEventListener("change", async () => {
        options.showThreadViewOnlyInForumChannels = true;
        await optionsProvider.setOptions(options);
    });

    allChannelsRadio.addEventListener("change", async () => {
        options.showThreadViewOnlyInForumChannels = false;
        await optionsProvider.setOptions(options);
    });

    const reactionsCheckbox = document.getElementById("showReactions") as HTMLInputElement;
    reactionsCheckbox.checked = options.showReactions;

    const highlightNameCheckbox = document.getElementById("highlightOwnName") as HTMLInputElement;
    const nameInput = document.getElementById("ownName") as HTMLInputElement;
    highlightNameCheckbox.checked = options.highlightOwnName;
    nameInput.value = options.ownName;
    nameInput.disabled = !options.highlightOwnName;

    // Listen for changes
    reactionsCheckbox.addEventListener("change", async () => {
        options.showReactions = reactionsCheckbox.checked;
        await optionsProvider.setOptions(options);
    });

    highlightNameCheckbox.addEventListener("change", async () => {
        options.highlightOwnName = highlightNameCheckbox.checked;
        nameInput.disabled = !highlightNameCheckbox.checked;
        await optionsProvider.setOptions(options);
    });

    nameInput.addEventListener("change", async () => {
        options.ownName = nameInput.value.trim();
        await optionsProvider.setOptions(options);
    });

    // Setup default thread pane size slider
    const defaultSplitSlider = document.getElementById("defaultSplit") as HTMLInputElement;
    const defaultSplitValueDisplay = document.getElementById("defaultSplitValue") as HTMLElement;
    defaultSplitSlider.value = options.defaultSplit.toString();
    defaultSplitValueDisplay.textContent = options.defaultSplit + "%";
    defaultSplitSlider.addEventListener("input", async () => {
        const newVal = parseInt(defaultSplitSlider.value, 10);
        defaultSplitValueDisplay.textContent = newVal + "%";
        options.defaultSplit = newVal;
        await optionsProvider.setOptions(options);
    });

    // Setup thread list appearance radio buttons
    const threadAppearanceNormal = document.getElementById("threadAppearanceNormal") as HTMLInputElement;
    const threadAppearanceCompact = document.getElementById("threadAppearanceCompact") as HTMLInputElement;
    const threadAppearanceUltraCompact = document.getElementById("threadAppearanceUltraCompact") as HTMLInputElement;

    // Set initial state
    switch (options.threadListAppearance) {
        case ThreadListAppearance.Normal:
            threadAppearanceNormal.checked = true;
            break;
        case ThreadListAppearance.Compact:
            threadAppearanceCompact.checked = true;
            break;
        case ThreadListAppearance.UltraCompact:
            threadAppearanceUltraCompact.checked = true;
            break;
        default:
            threadAppearanceNormal.checked = true;
            break;
    }

    // Add change listeners
    threadAppearanceNormal.addEventListener("change", async () => {
        if (threadAppearanceNormal.checked) {
            options.threadListAppearance = ThreadListAppearance.Normal;
            await optionsProvider.setOptions(options);
        }
    });

    threadAppearanceCompact.addEventListener("change", async () => {
        if (threadAppearanceCompact.checked) {
            options.threadListAppearance = ThreadListAppearance.Compact;
            await optionsProvider.setOptions(options);
        }
    });

    threadAppearanceUltraCompact.addEventListener("change", async () => {
        if (threadAppearanceUltraCompact.checked) {
            options.threadListAppearance = ThreadListAppearance.UltraCompact;
            await optionsProvider.setOptions(options);
        }
    });
});
