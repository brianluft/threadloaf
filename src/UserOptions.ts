/**
 * Represents the fully typed options your extension manages.
 */
export class UserOptions {
    public showThreadViewOnlyInForumChannels: boolean = true;
    public splitterPositions: { [url: string]: number } = {};

    constructor(init?: Partial<UserOptions>) {
        Object.assign(this, init);
    }

    /**
     * Converts a plain object (from storage) into a fully typed `UserOptions` instance.
     */
    static fromPlainObject(obj: unknown): UserOptions {
        // Provide safe defaults if any properties are missing
        const defaultOptions = new UserOptions();
        if (typeof obj === "object" && obj != null) {
            return new UserOptions({
                showThreadViewOnlyInForumChannels:
                    (obj as UserOptions).showThreadViewOnlyInForumChannels ??
                    defaultOptions.showThreadViewOnlyInForumChannels,
                splitterPositions: (obj as UserOptions).splitterPositions ?? defaultOptions.splitterPositions,
            });
        }
        return defaultOptions;
    }
}
