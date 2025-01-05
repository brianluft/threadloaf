import { UserOptionsProvider } from "./UserOptionsProvider";
import { runTests } from "./runTests";

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
