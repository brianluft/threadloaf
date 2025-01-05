/**
 * Simple in-browser testing infrastructure for Threadloaf.
 *
 * Theory of Operation:
 * This testing system is designed to run directly in the browser, making it easy to test DOM
 * operations and browser-specific functionality. Each test class provides an array of test
 * functions that are run by the TestRunner. Assertion functions are provided to validate
 * test conditions and throw descriptive errors on failure.
 */

export type Test = { name: string; fn: () => void | Promise<void> };

export class AssertionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AssertionError";
    }
}

/**
 * Special symbol used to mark fields that should be ignored during deep comparison tests.
 */
export const IGNORE = Symbol("IGNORE");

// Assertion functions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepEqual(actual: any, expected: any, message?: string, depth = 0): void {
    // Handle IGNORE symbol
    if (expected === IGNORE) return;

    // If equal, return early
    if (actual === expected) return;

    const errors: string[] = [];
    const indent = "  ".repeat(depth);

    // Handle null/undefined cases
    if (actual === null && expected !== null) {
        errors.push(`${indent}Expected ${formatValue(expected)}, but got null`);
    }
    if (expected === null && actual !== null) {
        errors.push(`${indent}Expected null, but got ${formatValue(actual)}`);
    }
    if (actual === undefined && expected !== undefined) {
        errors.push(`${indent}Expected ${formatValue(expected)}, but got undefined`);
    }
    if (expected === undefined && actual !== undefined) {
        errors.push(`${indent}Expected undefined, but got ${formatValue(actual)}`);
    }

    // Handle different types
    if (typeof actual !== typeof expected) {
        errors.push(`${indent}Type mismatch: expected ${typeof expected}, but got ${typeof actual}`);
    }

    // Handle arrays
    if (Array.isArray(actual) && Array.isArray(expected)) {
        if (actual.length !== expected.length) {
            errors.push(`${indent}Array length mismatch: expected ${expected.length}, but got ${actual.length}`);
        }
        for (let i = 0; i < Math.max(actual.length, expected.length); i++) {
            try {
                deepEqual(actual[i], expected[i], undefined, depth + 1);
            } catch (error) {
                errors.push(
                    `${indent}Array mismatch at index ${i}: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }
    }

    // Handle objects
    if (typeof actual === "object" && typeof expected === "object") {
        const actualKeys = Object.keys(actual);
        const expectedKeys = Object.keys(expected);

        // Check for extra or missing keys
        for (const key of actualKeys) {
            if (!expectedKeys.includes(key) && actual[key] !== undefined) {
                errors.push(`${indent}Unexpected key "${key}" in actual object`);
            }
        }
        for (const key of expectedKeys) {
            if (!actualKeys.includes(key) && expected[key] !== undefined) {
                errors.push(`${indent}Missing key "${key}" in actual object`);
            }
        }

        // Compare values
        for (const key of expectedKeys) {
            if (expected[key] === IGNORE) continue;
            try {
                deepEqual(actual[key], expected[key], undefined, depth + 1);
            } catch (error) {
                errors.push(
                    `${indent}Mismatch at key "${key}": ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }
    }

    // Handle primitives
    if (typeof actual !== "object" && actual !== expected) {
        errors.push(`${indent}Expected ${formatValue(expected)}, but got ${formatValue(actual)}`);
    }

    // If any errors were found, throw them all together
    if (errors.length > 0) {
        throw new AssertionError(
            message ||
                `${errors.length} difference${errors.length > 1 ? "s" : ""} found:\n` +
                    errors.map((e) => e).join("\n") +
                    "\n\nActual:\n" +
                    formatValue(actual) +
                    "\n\nExpected:\n" +
                    formatValue(expected),
        );
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assertEqual(actual: any, expected: any, message?: string): void {
    if (actual !== expected) {
        throw new AssertionError(message || `Expected ${formatValue(expected)}, but got ${formatValue(actual)}`);
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
                    throw new AssertionError(`Error message "${errorMessage}" did not match pattern ${expectedError}`);
                }
            } else if (errorMessage !== expectedError) {
                throw new AssertionError(`Expected error "${expectedError}", but got "${errorMessage}"`);
            }
        }
        return;
    }
    throw new AssertionError("Expected function to throw an error");
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
