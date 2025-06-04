#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

type Browser = "chrome" | "firefox";
type Environment = "development" | "production";

interface ManifestConfig {
    browser: Browser;
    environment: Environment;
}

function generateManifest(config: ManifestConfig): object {
    // Read the template
    const templatePath = path.join(currentDir, "manifest.template.json");
    const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));

    // Clone the template
    const manifest = JSON.parse(JSON.stringify(template));

    // Add browser-specific settings
    if (config.browser === "firefox") {
        manifest.browser_specific_settings = {
            gecko: {
                id: "{6384c57b-f03b-4de7-b146-d0159cde0ca2}",
                strict_min_version: "130.0",
            },
        };
        manifest.background = {
            scripts: ["background.js"],
        };
    } else {
        manifest.background = {
            service_worker: "background.js",
        };
    }

    // Add environment-specific settings
    if (config.environment === "development") {
        manifest.host_permissions = ["http://localhost/*", "https://api.threadloaf.com/*"];
        manifest.content_scripts.push({
            matches: ["http://localhost/auth/callback*", "https://api.threadloaf.com/auth/callback*"],
            js: ["oauth_callback.js"],
        });
    } else {
        manifest.host_permissions = ["https://api.threadloaf.com/*"];
        manifest.content_scripts.push({
            matches: ["https://api.threadloaf.com/auth/callback*"],
            js: ["oauth_callback.js"],
        });
    }

    return manifest;
}

function main(): void {
    const args = process.argv.slice(2);

    if (args.length !== 3) {
        console.error("Usage: generate-manifest.ts <browser> <environment> <output-file>");
        console.error("Browser: chrome | firefox");
        console.error("Environment: development | production");
        process.exit(1);
    }

    const [browser, environment, outputFile] = args;

    if (!["chrome", "firefox"].includes(browser)) {
        console.error("Invalid browser. Must be chrome or firefox");
        process.exit(1);
    }

    if (!["development", "production"].includes(environment)) {
        console.error("Invalid environment. Must be development or production");
        process.exit(1);
    }

    const config: ManifestConfig = {
        browser: browser as Browser,
        environment: environment as Environment,
    };

    const manifest = generateManifest(config);
    fs.writeFileSync(outputFile, JSON.stringify(manifest, null, 2));
    console.log(`Generated ${browser} ${environment} manifest: ${outputFile}`);
}

// Run main if this file is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
