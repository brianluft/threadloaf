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

    // Setup Chatty@Home API group box
    const loginStatus = document.getElementById("loginStatus") as HTMLElement;
    const loginButton = document.getElementById("loginButton") as HTMLButtonElement;
    const loginError = document.getElementById("loginError") as HTMLElement;
    const threadRepliesSlider = document.getElementById("threadRepliesSlider") as HTMLInputElement;
    const threadRepliesValue = document.getElementById("threadRepliesValue") as HTMLElement;

    // Show/hide login error message
    function showLoginError(message: string): void {
        loginError.textContent = message;
        loginError.style.display = "block";
    }

    function hideLoginError(): void {
        loginError.style.display = "none";
    }

    // Update UI based on login status
    function updateLoginUI(): void {
        const currentOptions = optionsProvider.getOptions();
        if (currentOptions.isLoggedIn) {
            loginStatus.textContent = "Logged in";
            loginButton.textContent = "Log out";
            threadRepliesSlider.disabled = false;
            hideLoginError(); // Hide any previous error message
        } else {
            loginStatus.textContent = "Not logged in";
            loginButton.textContent = "Log in";
            threadRepliesSlider.disabled = true;
        }
        // Update thread replies slider value
        threadRepliesSlider.value = currentOptions.threadRepliesCount.toString();
        threadRepliesValue.textContent = currentOptions.threadRepliesCount.toString();
    }

    // Listen for storage changes to update the UI when login state changes
    optionsProvider.addChangeListener(() => {
        updateLoginUI();
    });

    // Set initial state
    updateLoginUI();

    // Handle login/logout button click
    loginButton.addEventListener("click", async () => {
        const currentOptions = optionsProvider.getOptions();
        if (currentOptions.isLoggedIn) {
            // Log out
            currentOptions.isLoggedIn = false;
            currentOptions.authToken = "";
            await optionsProvider.setOptions(currentOptions);
            updateLoginUI();
        } else {
            // Log in - start OAuth2 flow
            hideLoginError(); // Hide any previous error message
            try {
                await startOAuth2Flow(optionsProvider);
                updateLoginUI();
            } catch (error) {
                console.error("Login failed:", error);
                showLoginError(`Login failed: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
        }
    });

    // Handle thread replies slider change
    threadRepliesSlider.addEventListener("input", async () => {
        const newVal = parseInt(threadRepliesSlider.value, 10);
        threadRepliesValue.textContent = newVal.toString();
        const currentOptions = optionsProvider.getOptions();
        currentOptions.threadRepliesCount = newVal;
        await optionsProvider.setOptions(currentOptions);
    });
});

async function startOAuth2Flow(optionsProvider: UserOptionsProvider): Promise<void> {
    return new Promise(async (resolve, reject) => {
        try {
            // Fetch OAuth2 configuration from the API
            let configResponse: Response;
            try {
                configResponse = await fetch("http://localhost:3000/auth/config");
            } catch (fetchError) {
                // This typically happens with CORS or network errors
                throw new Error(
                    `Cannot connect to API server. Make sure it's running on localhost:3000. Error: ${fetchError instanceof Error ? fetchError.message : "Network error"}`,
                );
            }

            if (!configResponse.ok) {
                throw new Error(`Failed to fetch OAuth2 config: HTTP ${configResponse.status}`);
            }
            const config = await configResponse.json();

            // Generate a random state parameter for security
            const state = crypto.randomUUID();

            // Construct the Discord OAuth2 authorization URL
            const params = new URLSearchParams({
                client_id: config.clientId,
                redirect_uri: config.redirectUri,
                response_type: "code",
                scope: "identify guilds",
                state: state,
            });

            const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;

            // Open OAuth2 popup
            const popup = window.open(authUrl, "oauth2-login", "width=500,height=600,scrollbars=yes,resizable=yes");

            if (!popup) {
                reject(new Error("Failed to open popup window"));
                return;
            }

            // Function to handle successful OAuth callback
            const handleOAuthSuccess = (jwt: string): void => {
                clearInterval(checkClosed);
                clearInterval(statusPolling);
                if (!popup.closed) {
                    popup.close();
                }

                const options = optionsProvider.getOptions();
                options.isLoggedIn = true;
                options.authToken = jwt;
                optionsProvider
                    .setOptions(options)
                    .then(() => {
                        resolve();
                    })
                    .catch((error) => {
                        console.error("Failed to save options to storage:", error);
                        reject(error);
                    });
            };

            // Function to handle OAuth error (currently not used but kept for potential future error handling)
            // const handleOAuthError = (error: string): void => {
            //     clearInterval(checkClosed);
            //     clearInterval(statusPolling);
            //     if (!popup.closed) {
            //         popup.close();
            //     }
            //     reject(new Error(error || "OAuth2 authentication failed"));
            // };

            // Poll the API server for authentication status
            const statusPolling = setInterval(async () => {
                try {
                    const response = await fetch(`http://localhost:3000/auth/status/${state}`);
                    if (response.ok) {
                        const result = await response.json();
                        handleOAuthSuccess(result.jwt);
                    } else if (response.status === 404) {
                        // Authentication not complete yet, continue polling
                    } else {
                        console.error("Error polling authentication status:", response.status);
                    }
                } catch (error) {
                    console.error("Error polling authentication status:", error);
                }
            }, 1000);

            // Listen for popup to close without successful auth
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    clearInterval(statusPolling);
                    reject(new Error("OAuth2 authentication was cancelled"));
                }
            }, 1000);
        } catch (error) {
            reject(error);
        }
    });
}
