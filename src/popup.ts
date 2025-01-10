import { UserOptionsProvider } from "./UserOptionsProvider";
import { runTests } from "./runTests";

document.addEventListener("DOMContentLoaded", async () => {
    const userOptions = await UserOptionsProvider.loadInitialOptions();
    const optionsProvider = UserOptionsProvider.getInstance(userOptions);
    const options = optionsProvider.getOptions();

    // Set initial checkbox states
    const forumCheckbox = document.getElementById("showThreadViewOnlyInForumChannels") as HTMLInputElement;
    forumCheckbox.checked = options.showThreadViewOnlyInForumChannels;

    const reactionsCheckbox = document.getElementById("showReactions") as HTMLInputElement;
    reactionsCheckbox.checked = options.showReactions;

    // Listen for changes
    forumCheckbox.addEventListener("change", async () => {
        options.showThreadViewOnlyInForumChannels = forumCheckbox.checked;
        await optionsProvider.setOptions(options);
    });

    reactionsCheckbox.addEventListener("change", async () => {
        options.showReactions = reactionsCheckbox.checked;
        await optionsProvider.setOptions(options);
    });

    // Set up test button
    const testButton = document.getElementById("runTestsButton") as HTMLButtonElement;
    const testResults = document.getElementById("testResults") as HTMLDivElement;

    testButton.addEventListener("click", async () => {
        testButton.disabled = true;
        testResults.textContent = "Running tests...";

        try {
            const results = await runTests();
            testResults.innerHTML = results.messages.join("<br>");
        } catch (error) {
            testResults.textContent = `Error running tests: ${error}`;
        } finally {
            testButton.disabled = false;
        }
    });
});
