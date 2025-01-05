import { MessageParserTest } from "./MessageParserTest";
import { Test } from "./test_utils";

interface TestSuite {
    name: string;
    tests: Test[];
}

class TestRunner {
    private suites: TestSuite[] = [];
    private messages: string[] = [];

    private log(message: string): void {
        this.messages.push(message);
    }

    public registerSuite(name: string, tests: Test[]): void {
        this.suites.push({ name, tests });
    }

    public async runAll(): Promise<{ passed: number; failed: number; messages: string[] }> {
        this.messages = [];
        this.log("🧪 Running all test suites...\n");
        let totalPassed = 0;
        let totalFailed = 0;

        for (const suite of this.suites) {
            this.log(`=== Running ${suite.name} Tests ===`);
            let suitePassed = 0;
            let suiteFailed = 0;

            for (const test of suite.tests) {
                try {
                    await test.fn();
                    this.log(`✅ PASS: ${test.name}`);
                    suitePassed++;
                    totalPassed++;
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    this.log(`❌ FAIL: ${test.name}\n   ${errorMessage}`);
                    suiteFailed++;
                    totalFailed++;
                }
            }

            this.log(`\n${suite.name} Summary:`);
            this.log(`  Passed: ${suitePassed}`);
            this.log(`  Failed: ${suiteFailed}\n`);
        }

        this.log("=== Test Suite Summary ===");
        this.log(`✅ Total Passed: ${totalPassed}`);
        this.log(`❌ Total Failed: ${totalFailed}`);

        return { passed: totalPassed, failed: totalFailed, messages: this.messages };
    }
}

export async function runTests(): Promise<{ passed: number; failed: number; messages: string[] }> {
    const runner = new TestRunner();

    runner.registerSuite("MessageParser", await new MessageParserTest().getTests());

    return await runner.runAll();
}
