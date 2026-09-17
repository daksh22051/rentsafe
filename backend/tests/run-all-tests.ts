import { TestRunner } from "./test-utils";
import { runValidationSuite } from "./validation-suite.test";
import { runSecuritySuite } from "./security-suite.test";
import { runIdorAndAuthSuite } from "./idor-and-authorization.test";

async function main() {
  console.log("==========================================");
  console.log("🛡️  RENTSAFE STEP 18 QA TEST SUITE");
  console.log("==========================================");
  console.log(`Timestamp:   ${new Date().toISOString()}`);
  console.log(`Environment: Node ${process.version}`);
  console.log("==========================================\n");

  const runner = new TestRunner();

  try {
    await runValidationSuite(runner);
    await runSecuritySuite(runner);
    await runIdorAndAuthSuite(runner);

    runner.printSummary();

    const summary = runner.getSummary();
    if (summary.failed > 0) {
      console.error(`💥 QA Tests Failed: ${summary.failed} errors.`);
      process.exit(1);
    } else {
      console.log("🎉 ALL QA CHECKS PASSED SUCCESSFULLY!");
      process.exit(0);
    }
  } catch (error) {
    console.error("Fatal Test Suite Error:", error);
    process.exit(1);
  }
}

main();
