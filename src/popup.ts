import { UserOptionsProvider } from "./UserOptionsProvider";

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
});
