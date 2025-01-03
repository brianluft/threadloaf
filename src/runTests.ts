import { MessageParserTest } from "./MessageParserTest";
import { Test } from "./test_utils";

type TestSuite = {
    name: string;
    tests: Test[];
};

class TestRunner {
    private suites: TestSuite[] = [];

    registerSuite(name: string, tests: Test[]) {
        this.suites.push({ name, tests });
    }

    async runAll() {
        console.log("🧪 Running all test suites...\n");
        let totalPassed = 0;
        let totalFailed = 0;

        for (const suite of this.suites) {
            console.log(`=== Running ${suite.name} Tests ===`);
            let suitePassed = 0;
            let suiteFailed = 0;

            for (const test of suite.tests) {
                try {
                    await test.fn();
                    console.log(`✅ PASS: ${test.name}`);
                    suitePassed++;
                    totalPassed++;
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.log(`❌ FAIL: ${test.name}\n   ${errorMessage}`);
                    suiteFailed++;
                    totalFailed++;
                }
            }

            console.log(`\n${suite.name} Summary:`);
            console.log(`  Passed: ${suitePassed}`);
            console.log(`  Failed: ${suiteFailed}\n`);
        }

        console.log("=== Test Suite Summary ===");
        console.log(`✅ Total Passed: ${totalPassed}`);
        console.log(`❌ Total Failed: ${totalFailed}`);

        return { passed: totalPassed, failed: totalFailed };
    }
}

export async function runTests() {
    const runner = new TestRunner();

    runner.registerSuite("MessageParser", await new MessageParserTest().getTests());

    return await runner.runAll();
}
