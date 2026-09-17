/**
 * RentSafe Lightweight API Test Runner Utilities
 * Zero external dependencies. Uses standard Node.js & TypeScript.
 */

export interface TestResult {
  name: string;
  suite: string;
  status: "PASS" | "FAIL" | "BLOCKED";
  durationMs: number;
  error?: string;
}

export class TestRunner {
  private currentSuite = "Default";
  public results: TestResult[] = [];

  public async suite(name: string, fn: () => void | Promise<void>): Promise<void> {
    this.currentSuite = name;
    console.log(`\n📦 SUITE: ${name}`);
    await fn();
  }

  public async test(name: string, fn: () => void | Promise<void>): Promise<void> {
    const start = Date.now();
    try {
      await fn();
      const durationMs = Date.now() - start;
      this.results.push({
        name,
        suite: this.currentSuite,
        status: "PASS",
        durationMs,
      });
      console.log(`  ✅ PASS: ${name} (${durationMs}ms)`);
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.results.push({
        name,
        suite: this.currentSuite,
        status: "FAIL",
        durationMs,
        error: errorMsg,
      });
      console.error(`  ❌ FAIL: ${name} (${durationMs}ms)`);
      console.error(`     Error: ${errorMsg}`);
    }
  }

  public getSummary() {
    const total = this.results.length;
    const passed = this.results.filter((r) => r.status === "PASS").length;
    const failed = this.results.filter((r) => r.status === "FAIL").length;
    const blocked = this.results.filter((r) => r.status === "BLOCKED").length;

    return {
      total,
      passed,
      failed,
      blocked,
      passRate: total > 0 ? ((passed / total) * 100).toFixed(1) + "%" : "0%",
    };
  }

  public printSummary() {
    const summary = this.getSummary();
    console.log("\n==========================================");
    console.log("🏁 TEST EXECUTION SUMMARY");
    console.log("==========================================");
    console.log(`Total Checks:  ${summary.total}`);
    console.log(`Passed:        ${summary.passed} ✅`);
    console.log(`Failed:        ${summary.failed} ❌`);
    console.log(`Blocked:       ${summary.blocked} ⚠️`);
    console.log(`Pass Rate:     ${summary.passRate}`);
    console.log("==========================================\n");

    if (summary.failed > 0) {
      console.log("Failed Tests:");
      this.results
        .filter((r) => r.status === "FAIL")
        .forEach((r) => console.log(` - [${r.suite}] ${r.name}: ${r.error}`));
      console.log("");
    }
  }
}

export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertThrows(
  fn: () => unknown,
  expectedSubstring?: string
): void {
  try {
    fn();
    throw new Error("Expected function to throw, but it succeeded");
  } catch (err: unknown) {
    if (
      expectedSubstring &&
      err instanceof Error &&
      !err.message.includes(expectedSubstring)
    ) {
      throw new Error(
        `Expected error to contain "${expectedSubstring}", but got "${err.message}"`
      );
    }
  }
}

export async function assertThrowsAsync(
  fn: () => Promise<unknown>,
  expectedSubstring?: string
): Promise<void> {
  try {
    await fn();
    throw new Error("Expected async function to throw, but it succeeded");
  } catch (err: unknown) {
    if (
      expectedSubstring &&
      err instanceof Error &&
      !err.message.includes(expectedSubstring)
    ) {
      throw new Error(
        `Expected error to contain "${expectedSubstring}", but got "${err.message}"`
      );
    }
  }
}
