/**
 * Represents the fully typed options your extension manages.
 */
export class UserOptions {
    public showThreadViewOnlyInForumChannels: boolean = true;

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
            });
        }
        return defaultOptions;
    }
}
