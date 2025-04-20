import { UserOptions } from "./UserOptions";

/**
 * Provides get/set methods for the `UserOptions` stored in chrome.storage.local,
 * and allows registration of change listeners.
 */
export class UserOptionsProvider {
    private static readonly STORAGE_KEY = "userOptions";
    private static instance: UserOptionsProvider | null = null;
    private currentOptions: UserOptions;

    /**
     * A list of callbacks to be invoked whenever the stored options change.
     */
    private changeListeners: Array<(newOptions: UserOptions) => void> = [];

    /**
     * Use a singleton so we only attach one onChanged listener for all consumers.
     * @param initialOptions The initial options to use. Required when creating the instance.
     */
    public static getInstance(initialOptions?: UserOptions): UserOptionsProvider {
        if (!this.instance) {
            if (!initialOptions) {
                throw new Error("Initial options must be provided when creating UserOptionsProvider instance");
            }
            this.instance = new UserOptionsProvider(initialOptions);
        }
        return this.instance;
    }

    private constructor(initialOptions: UserOptions) {
        this.currentOptions = initialOptions;

        // Listen for changes in chrome.storage.local
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === "local" && changes[UserOptionsProvider.STORAGE_KEY]) {
                const newValue = changes[UserOptionsProvider.STORAGE_KEY].newValue;
                const newOptions = UserOptions.fromPlainObject(newValue);
                this.currentOptions = newOptions;
                this.notifyListeners(newOptions);
            }
        });
    }

    /**
     * Get current options synchronously.
     */
    public getOptions(): UserOptions {
        return this.currentOptions;
    }

    /**
     * Save new options into chrome.storage.local.
     */
    public async setOptions(newOptions: UserOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // Convert instance to plain object for storage
            const plainObject = JSON.parse(JSON.stringify(newOptions));
            chrome.storage.local.set({ [UserOptionsProvider.STORAGE_KEY]: plainObject }, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Register a callback to be invoked whenever the user options change.
     */
    public addChangeListener(listener: (newOptions: UserOptions) => void): void {
        this.changeListeners.push(listener);
    }

    /**
     * Unregister an existing change listener.
     */
    public removeChangeListener(listener: (newOptions: UserOptions) => void): void {
        const index = this.changeListeners.indexOf(listener);
        if (index !== -1) {
            this.changeListeners.splice(index, 1);
        }
    }

    /**
     * Invoke all registered listeners with the new options.
     */
    private notifyListeners(newOptions: UserOptions): void {
        for (const listener of this.changeListeners) {
            listener(newOptions);
        }
    }

    /**
     * Load initial options from storage. Should be called once at startup.
     */
    public static async loadInitialOptions(): Promise<UserOptions> {
        return new Promise<UserOptions>((resolve, reject) => {
            chrome.storage.local.get(UserOptionsProvider.STORAGE_KEY, (items) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                }

                const raw = items[UserOptionsProvider.STORAGE_KEY];
                const options = UserOptions.fromPlainObject(raw);
                resolve(options);
            });
        });
    }
}
