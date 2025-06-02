/**
 * Let's Encrypt certificate management
 * Handles certificate generation, renewal, and HTTP-01 challenges
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as crypto from "crypto";
import { Express } from "express";
import * as acme from "acme-client";

export interface LetsEncryptConfig {
    enabled: boolean;
    email: string;
    domain: string;
    acmeDirectory: string;
    certsDir: string;
}

export interface CertificateFiles {
    cert: string;
    key: string;
    chain?: string;
}

export class LetsEncryptManager {
    private config: LetsEncryptConfig;
    private client?: acme.Client;
    private challengeTokens = new Map<string, string>(); // token -> keyAuth

    constructor(config: LetsEncryptConfig) {
        this.config = config;
    }

    /**
     * Initialize the ACME client and account
     */
    async initialize(): Promise<void> {
        if (!this.config.enabled) {
            console.log("Let's Encrypt is disabled");
            return;
        }

        console.log("Initializing Let's Encrypt ACME client...");

        // Ensure certificates directory exists
        if (!fs.existsSync(this.config.certsDir)) {
            fs.mkdirSync(this.config.certsDir, { recursive: true });
        }

        const accountKeyPath = path.join(this.config.certsDir, "account.key");
        let accountKey: Buffer;

        // Load or create account key
        if (fs.existsSync(accountKeyPath)) {
            console.log("Loading existing ACME account key...");
            accountKey = fs.readFileSync(accountKeyPath);
        } else {
            console.log("Creating new ACME account key...");
            accountKey = await acme.crypto.createPrivateKey();
            fs.writeFileSync(accountKeyPath, accountKey);
        }

        // Initialize ACME client
        this.client = new acme.Client({
            directoryUrl: this.config.acmeDirectory,
            accountKey,
        });

        // Create account (will use existing if already created with this key)
        console.log("Ensuring ACME account exists...");
        await this.client.createAccount({
            termsOfServiceAgreed: true,
            contact: [`mailto:${this.config.email}`],
        });

        console.log("Let's Encrypt ACME client initialized successfully");
    }

    /**
     * Get certificate files if they exist and are valid
     */
    getCertificateFiles(): CertificateFiles | null {
        if (!this.config.enabled) {
            return null;
        }

        const certPath = path.join(this.config.certsDir, `${this.config.domain}.crt`);
        const keyPath = path.join(this.config.certsDir, `${this.config.domain}.key`);
        const chainPath = path.join(this.config.certsDir, `${this.config.domain}.chain.crt`);

        if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
            return null;
        }

        // Check if certificate files are readable
        try {
            const cert = fs.readFileSync(certPath, "utf8");
            const key = fs.readFileSync(keyPath, "utf8");

            // Simple validation: check if files contain certificate/key headers
            if (!cert.includes("BEGIN CERTIFICATE") || !key.includes("BEGIN PRIVATE KEY")) {
                console.log("Certificate or key file appears invalid");
                return null;
            }

            // For now, assume certificate is valid if files exist and have proper format
            // In production, you might want to use a library like 'node-forge' for proper validation
            console.log("Certificate files found and appear valid");

            return {
                cert: certPath,
                key: keyPath,
                chain: fs.existsSync(chainPath) ? chainPath : undefined,
            };
        } catch (error) {
            console.error("Error reading certificate:", error);
            return null;
        }
    }

    /**
     * Request a new certificate using HTTP-01 challenge
     */
    async requestCertificate(): Promise<CertificateFiles | null> {
        if (!this.config.enabled || !this.client) {
            return null;
        }

        console.log(`Requesting certificate for domain: ${this.config.domain}`);

        try {
            // Create certificate order
            const order = await this.client.createOrder({
                identifiers: [{ type: "dns", value: this.config.domain }],
            });

            // Get authorization challenges
            const authorizations = await this.client.getAuthorizations(order);

            for (const authz of authorizations) {
                // Find HTTP-01 challenge
                const challenge = authz.challenges.find((c: any) => c.type === "http-01");
                if (!challenge) {
                    throw new Error("No HTTP-01 challenge found");
                }

                // Prepare challenge response
                const keyAuth = await this.client.getChallengeKeyAuthorization(challenge);
                this.challengeTokens.set(challenge.token, keyAuth);

                console.log(`HTTP-01 challenge prepared for token: ${challenge.token}`);

                // Verify challenge
                await this.client.verifyChallenge(authz, challenge);

                // Complete challenge
                await this.client.completeChallenge(challenge);
                await this.client.waitForValidStatus(challenge);

                // Clean up challenge token
                this.challengeTokens.delete(challenge.token);
            }

            // Generate certificate key pair
            const [key, csr] = await acme.crypto.createCsr({
                commonName: this.config.domain,
            });

            // Finalize order and get certificate
            await this.client.finalizeOrder(order, csr);
            const cert = await this.client.getCertificate(order);

            // Save certificate files
            const certPath = path.join(this.config.certsDir, `${this.config.domain}.crt`);
            const keyPath = path.join(this.config.certsDir, `${this.config.domain}.key`);

            fs.writeFileSync(certPath, cert);
            fs.writeFileSync(keyPath, key);

            console.log("Certificate successfully obtained and saved");

            return {
                cert: certPath,
                key: keyPath,
            };
        } catch (error) {
            console.error("Error requesting certificate:", error);
            // Clean up any challenge tokens
            this.challengeTokens.clear();
            return null;
        }
    }

    /**
     * Set up HTTP-01 challenge route on Express app
     */
    setupChallengeRoute(app: Express): void {
        app.get("/.well-known/acme-challenge/:token", (req, res) => {
            const { token } = req.params;
            const keyAuth = this.challengeTokens.get(token);

            if (keyAuth) {
                console.log(`Serving ACME challenge for token: ${token}`);
                res.type("text/plain").send(keyAuth);
            } else {
                console.log(`ACME challenge token not found: ${token}`);
                res.status(404).send("Challenge not found");
            }
        });
    }

    /**
     * Create HTTPS server with certificates
     */
    createHttpsServer(app: Express): https.Server | null {
        const certFiles = this.getCertificateFiles();
        if (!certFiles) {
            return null;
        }

        try {
            const httpsOptions = {
                cert: fs.readFileSync(certFiles.cert),
                key: fs.readFileSync(certFiles.key),
            };

            return https.createServer(httpsOptions, app);
        } catch (error) {
            console.error("Error creating HTTPS server:", error);
            return null;
        }
    }

    /**
     * Schedule automatic certificate renewal
     */
    scheduleRenewal(): void {
        if (!this.config.enabled) {
            return;
        }

        // Check for renewal every 12 hours
        const RENEWAL_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

        setInterval(async () => {
            console.log("Checking if certificate needs renewal...");
            const certFiles = this.getCertificateFiles();

            if (!certFiles) {
                console.log("Certificate needs renewal, attempting to renew...");
                await this.requestCertificate();
            }
        }, RENEWAL_INTERVAL);

        console.log("Automatic certificate renewal scheduled");
    }
}
