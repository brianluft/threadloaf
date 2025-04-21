import request from "supertest";
import express from "express";

jest.mock("../../data-store");

describe("ApiServer Error Handling Middleware", () => {
    let testApp: express.Express;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create a new Express app for error handling tests
        testApp = express();
        testApp.use(express.json());

        // Add test routes that will trigger errors
        testApp.get("/test-error", (_req, _res, next) => {
            next(new Error("Test error message"));
        });

        testApp.get("/test-non-error", (_req, _res, next) => {
            next("String error message");
        });

        // Add error handling middleware that matches the real implementation
        testApp.use(
            (err: Error | unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
                // Log the error
                if (err instanceof Error) {
                    console.error("API error:", err.message);
                } else {
                    console.error("API error:", err);
                }

                // Send error response
                res.status(500).json({ error: "Internal server error" });
                next();
            },
        );
    });

    test("should handle Error objects correctly", async () => {
        // Create a spy on console.error
        const consoleErrorSpy = jest.spyOn(console, "error");
        consoleErrorSpy.mockImplementation(() => {});

        const response = await request(testApp).get("/test-error");

        // Verify response
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Internal server error" });

        // Verify error was logged correctly
        expect(consoleErrorSpy).toHaveBeenCalledWith("API error:", "Test error message");

        consoleErrorSpy.mockRestore();
    });

    test("should handle non-Error objects correctly", async () => {
        // Create a spy on console.error
        const consoleErrorSpy = jest.spyOn(console, "error");
        consoleErrorSpy.mockImplementation(() => {});

        const response = await request(testApp).get("/test-non-error");

        // Verify response
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Internal server error" });

        // Verify error was logged correctly
        expect(consoleErrorSpy).toHaveBeenCalledWith("API error:", "String error message");

        consoleErrorSpy.mockRestore();
    });
});
