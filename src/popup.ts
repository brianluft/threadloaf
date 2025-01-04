import { UserOptionsProvider } from "./UserOptionsProvider";

document.addEventListener("DOMContentLoaded", async () => {
    const optionsProvider = UserOptionsProvider.getInstance();
    const options = await optionsProvider.getOptions();

    // Set initial checkbox state
    const checkbox = document.getElementById("showThreadViewOnlyInForumChannels") as HTMLInputElement;
    checkbox.checked = options.showThreadViewOnlyInForumChannels;

    // Listen for changes
    checkbox.addEventListener("change", async () => {
        options.showThreadViewOnlyInForumChannels = checkbox.checked;
        await optionsProvider.setOptions(options);
    });
});
