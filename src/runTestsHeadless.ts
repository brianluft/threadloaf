import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

declare global {
    interface Window {
        runTests: () => Promise<{ passed: number; failed: number; messages: string[] }>;
    }
}

const dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTestsInBrowser(): Promise<void> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    // Intercept test data file requests
    await page.setRequestInterception(true);
    page.on("request", (request) => {
        const url = request.url();
        if (url.includes("test-data/")) {
            // Extract just the test-data/filename.html part from the URL
            const match = url.match(/test-data\/[^/]+\.html$/);
            if (!match) {
                request.respond({
                    status: 404,
                    contentType: "text/plain",
                    body: `Invalid test file path: ${url}`,
                });
                return;
            }
            const filePath = path.join(dirname, match[0]);
            try {
                const content = readFileSync(filePath, "utf8");
                request.respond({
                    status: 200,
                    contentType: "text/html",
                    body: content,
                });
            } catch (error) {
                console.error(`Failed to load test file: ${filePath}`, error);
                request.respond({
                    status: 404,
                    contentType: "text/plain",
                    body: `File not found: ${url}`,
                });
            }
        } else {
            request.continue();
        }
    });

    // Load our test page
    await page.goto(`file:${path.join(dirname, "..", "temp", "test.html")}`);

    // Wait for the test function to be available
    await page.waitForFunction(() => typeof window.runTests === "function");

    // Run the tests
    const results = await page.evaluate(() => window.runTests());

    await browser.close();

    // Print results
    console.log(results.messages.join("\n"));

    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
}

runTestsInBrowser().catch((error) => {
    console.error("Error running tests:", error);
    process.exit(1);
});
