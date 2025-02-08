/**
 * Represents the fully typed options your extension manages.
 */
export class UserOptions {
    public showThreadViewOnlyInForumChannels = true;
    public splitterPositions: { [url: string]: number } = {};
    public showReactions = true;
    public highlightOwnName = false;
    public ownName = "";
    public defaultSplit = 60;

    public constructor(init?: Partial<UserOptions>) {
        Object.assign(this, init);
    }

    /**
     * Converts a plain object (from storage) into a fully typed `UserOptions` instance.
     */
    public static fromPlainObject(obj: unknown): UserOptions {
        // Provide safe defaults if any properties are missing
        const defaultOptions = new UserOptions();
        if (typeof obj === "object" && obj !== null) {
            return new UserOptions({
                showThreadViewOnlyInForumChannels:
                    (obj as UserOptions).showThreadViewOnlyInForumChannels ??
                    defaultOptions.showThreadViewOnlyInForumChannels,
                splitterPositions: (obj as UserOptions).splitterPositions ?? defaultOptions.splitterPositions,
                showReactions: (obj as UserOptions).showReactions ?? defaultOptions.showReactions,
                highlightOwnName: (obj as UserOptions).highlightOwnName ?? defaultOptions.highlightOwnName,
                ownName: (obj as UserOptions).ownName ?? defaultOptions.ownName,
                defaultSplit: (obj as UserOptions).defaultSplit ?? defaultOptions.defaultSplit,
            });
        }
        return defaultOptions;
    }
}
