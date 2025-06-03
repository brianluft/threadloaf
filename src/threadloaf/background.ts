// This will be replaced at build time via esbuild --define
declare const API_BASE_URL: string;

interface ApiMessage {
    id: string;
    content: string;
    authorTag: string;
    timestamp: number;
}

interface ApiMessagesResponse {
    [channelId: string]: ApiMessage[];
}

interface FetchMessagesRequest {
    type: "FETCH_MESSAGES";
    guildId: string;
    channelIds: string[];
    maxMessagesPerChannel: number;
    authToken: string;
}

interface FetchMessagesResponse {
    success: boolean;
    data?: ApiMessagesResponse;
    error?: string;
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener(
    (
        request: FetchMessagesRequest,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: FetchMessagesResponse) => void,
    ) => {
        if (request.type === "FETCH_MESSAGES") {
            handleFetchMessages(request)
                .then((data) => sendResponse({ success: true, data }))
                .catch((error) =>
                    sendResponse({
                        success: false,
                        error: error instanceof Error ? error.message : "Unknown error",
                    }),
                );

            // Return true to indicate we'll respond asynchronously
            return true;
        }
    },
);

async function handleFetchMessages(request: FetchMessagesRequest): Promise<ApiMessagesResponse> {
    const response = await fetch(`${API_BASE_URL}/${request.guildId}/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${request.authToken}`,
        },
        body: JSON.stringify({
            channelIds: request.channelIds,
            maxMessagesPerChannel: request.maxMessagesPerChannel,
        }),
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}
