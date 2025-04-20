/**
 * Simple in-browser testing infrastructure for Threadloaf.
 *
 * Theory of Operation:
 * This testing system is designed to run directly in the browser, making it easy to test DOM
 * operations and browser-specific functionality. Each test class provides an array of test
 * functions that are run by the TestRunner. Assertion functions are provided to validate
 * test conditions and throw descriptive errors on failure.
 */

export interface Test {
    name: string;
    fn: () => void | Promise<void>;
}

export class AssertionError extends Error {
    public constructor(
        message: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        public readonly actual?: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        public readonly expected?: any,
    ) {
        const fullMessage = [
            message,
            actual !== undefined ? `\nActual: ${formatValue(actual)}` : "",
            expected !== undefined ? `\nExpected: ${formatValue(expected)}` : "",
        ].join("");
        super(fullMessage);
        this.name = "AssertionError";
    }
}

/**
 * Special symbol used to mark fields that should be ignored during deep comparison tests.
 */
export const IGNORE = Symbol("IGNORE");

// Assertion functions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepEqual(actual: any, expected: any): void {
    // Handle IGNORE symbol
    if (expected === IGNORE) return;

    // If equal, return early
    if (actual === expected) return;

    // Handle null/undefined cases
    if (actual === null && expected !== null) {
        throw new AssertionError(`Expected ${formatValue(expected)}, but got null`, actual, expected);
    }
    if (expected === null && actual !== null) {
        throw new AssertionError(`Expected null, but got ${formatValue(actual)}`, actual, expected);
    }
    if (actual === undefined && expected !== undefined) {
        throw new AssertionError(`Expected ${formatValue(expected)}, but got undefined`, actual, expected);
    }
    if (expected === undefined && actual !== undefined) {
        throw new AssertionError(`Expected undefined, but got ${formatValue(actual)}`, actual, expected);
    }

    // Handle different types
    if (typeof actual !== typeof expected) {
        throw new AssertionError(
            `Type mismatch: expected ${typeof expected}, but got ${typeof actual}`,
            actual,
            expected,
        );
    }

    // Handle strings and include the index of the first character mismatch and the remainder of the actual and expected strings.
    if (typeof actual === "string" && typeof expected === "string" && actual !== expected) {
        const minLength = Math.min(actual.length, expected.length);
        for (let i = 0; i < minLength; i++) {
            if (actual[i] !== expected[i]) {
                // Make a slice of the remainder of both strings starting here.
                const actualSlice = actual.slice(i);
                const expectedSlice = expected.slice(i);
                throw new AssertionError(
                    `Mismatch at index ${i}: "${actualSlice}" !== "${expectedSlice}"`,
                    actual,
                    expected,
                );
            }
        }
    }

    // Handle arrays
    if (Array.isArray(actual) && Array.isArray(expected)) {
        if (actual.length !== expected.length) {
            throw new AssertionError(
                `Array length mismatch: expected ${expected.length}, but got ${actual.length}`,
                actual,
                expected,
            );
        }
        for (let i = 0; i < Math.max(actual.length, expected.length); i++) {
            deepEqual(actual[i], expected[i]);
        }
    }

    // Handle objects
    if (typeof actual === "object" && typeof expected === "object") {
        const actualKeys = Object.keys(actual);
        const expectedKeys = Object.keys(expected);

        // Check for extra or missing keys
        for (const key of actualKeys) {
            if (!expectedKeys.includes(key) && actual[key] !== undefined) {
                throw new AssertionError(`Unexpected key "${key}" in actual object`, actual, expected);
            }
        }
        for (const key of expectedKeys) {
            if (!actualKeys.includes(key) && expected[key] !== undefined) {
                throw new AssertionError(`Missing key "${key}" in actual object`, actual, expected);
            }
        }

        // Compare values
        for (const key of expectedKeys) {
            if (expected[key] === IGNORE) continue;
            deepEqual(actual[key], expected[key]);
        }
    }

    // Handle primitives
    if (typeof actual !== "object" && actual !== expected) {
        throw new AssertionError(`Expected ${formatValue(expected)}, but got ${formatValue(actual)}`, actual, expected);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assertEqual(actual: any, expected: any, message?: string): void {
    if (actual !== expected) {
        throw new AssertionError(
            message || `Expected ${formatValue(expected)}, but got ${formatValue(actual)}`,
            actual,
            expected,
        );
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assertThrows(fn: () => any, expectedError?: string | RegExp): void {
    try {
        fn();
    } catch (error) {
        if (expectedError) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (expectedError instanceof RegExp) {
                if (!expectedError.test(errorMessage)) {
                    throw new AssertionError(
                        `Error message "${errorMessage}" did not match pattern ${expectedError}`,
                        errorMessage,
                        expectedError,
                    );
                }
            } else if (errorMessage !== expectedError) {
                throw new AssertionError(
                    `Expected error "${expectedError}", but got "${errorMessage}"`,
                    errorMessage,
                    expectedError,
                );
            }
        }
        return;
    }
    throw new AssertionError("Expected function to throw an error", undefined, "an error");
}

// Helper functions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatValue(value: any): string {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}
