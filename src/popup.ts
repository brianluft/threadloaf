import { UserOptionsProvider } from "./UserOptionsProvider";

document.addEventListener("DOMContentLoaded", async () => {
    const userOptions = await UserOptionsProvider.loadInitialOptions();
    const optionsProvider = UserOptionsProvider.getInstance(userOptions);
    const options = optionsProvider.getOptions();

    // Set initial checkbox state
    const checkbox = document.getElementById("showThreadViewOnlyInForumChannels") as HTMLInputElement;
    checkbox.checked = options.showThreadViewOnlyInForumChannels;

    // Listen for changes
    checkbox.addEventListener("change", async () => {
        options.showThreadViewOnlyInForumChannels = checkbox.checked;
        await optionsProvider.setOptions(options);
    });
});
