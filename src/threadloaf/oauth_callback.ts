/**
 * OAuth callback content script
 * Runs on the OAuth callback page to extract JWT token and save it to extension storage
 */

import { UserOptionsProvider } from "./UserOptionsProvider";

async function handleOAuthCallback(): Promise<void> {
    console.log("handleOAuthCallback called");

    try {
        // Look for the OAuth data in the DOM
        const oauthDataElement = document.getElementById("threadloaf-oauth-data");

        if (!oauthDataElement) {
            console.log("No threadloaf-oauth-data element found in DOM");
            setTimeout(() => {
                window.close();
            }, 3000);
            return;
        }

        console.log("Found threadloaf-oauth-data element:", oauthDataElement);

        const status = oauthDataElement.getAttribute("data-status");
        const state = oauthDataElement.getAttribute("data-state");

        if (status === "success") {
            const jwt = oauthDataElement.getAttribute("data-jwt");

            if (!jwt) {
                console.error("JWT token not found in data element");
                setTimeout(() => {
                    window.close();
                }, 3000);
                return;
            }

            console.log("Found OAuth success data - JWT:", jwt.substring(0, 20) + "...", "State:", state);

            // Load current options and update them
            const userOptions = await UserOptionsProvider.loadInitialOptions();
            const optionsProvider = UserOptionsProvider.getInstance(userOptions);
            const options = optionsProvider.getOptions();

            options.isLoggedIn = true;
            options.authToken = jwt;

            await optionsProvider.setOptions(options);

            console.log("OAuth login successful - token saved to extension storage");

            // Close the window
            window.close();
            return;
        } else if (status === "error") {
            const error = oauthDataElement.getAttribute("data-error");
            console.log("Found OAuth error data - Error:", error, "State:", state);
            console.error("OAuth login failed:", error);

            // Close the window after a short delay to show the error message
            setTimeout(() => {
                window.close();
            }, 3000);
            return;
        } else {
            console.log("Unknown OAuth status:", status);
            setTimeout(() => {
                window.close();
            }, 3000);
            return;
        }
    } catch (error) {
        console.error("Error handling OAuth callback:", error);
        // Close the window even if there's an error
        setTimeout(() => {
            window.close();
        }, 3000);
    }
}

// Add debugging to confirm the script is loading
console.log("Threadloaf OAuth callback content script loaded!");
console.log("Current URL:", window.location.href);
console.log("Document ready state:", document.readyState);

// Run the callback handler when the page loads
if (document.readyState === "loading") {
    console.log("Document still loading, adding DOMContentLoaded listener");
    document.addEventListener("DOMContentLoaded", handleOAuthCallback);
} else {
    console.log("Document already loaded, running callback handler immediately");
    handleOAuthCallback();
}
