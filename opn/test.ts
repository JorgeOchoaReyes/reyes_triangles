/**
 * Test suite for the OPN toolkit. Run with: npm test
 */
import assert from "node:assert/strict";
import {
  spfSieve,
  factorizeWithSieve,
  sigmaFromFactors,
  sigmaBig,
  isPrimeBig,
  factorizeBig,
  iroot,
} from "./sigma.ts";
import { eulerSieve } from "./euler-sieve.ts";
import { bruteForcePerfect } from "./brute.ts";
import { analyzeCandidate } from "./constraints.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok: ${name}`);
}

test("sigma on known values", () => {
  const spf = spfSieve(10000);
  const sigma = (n: number) => sigmaFromFactors(factorizeWithSieve(n, spf));
  assert.equal(sigma(1), 1n);
  assert.equal(sigma(6), 12n); // 6 is perfect
  assert.equal(sigma(28), 56n); // 28 is perfect
  assert.equal(sigma(496), 992n); // 496 is perfect
  assert.equal(sigma(8128), 16256n); // 8128 is perfect
  assert.equal(sigma(12), 28n);
  assert.equal(sigma(9973), 9974n); // prime
});

test("sigma of squares via power parameter", () => {
  const spf = spfSieve(100);
  // sigma(15^2) = sigma(225) = (1+3+9)(1+5+25) = 13 * 31 = 403
  assert.equal(sigmaFromFactors(factorizeWithSieve(15, spf), 2), 403n);
});

test("sigmaBig with Pollard rho factoring", () => {
  assert.equal(sigmaBig(2n ** 61n - 1n), 2n ** 61n); // Mersenne prime
  assert.equal(sigmaBig(1000000007n * 1000000009n), 1000000008n * 1000000010n);
});

test("Miller-Rabin primality", () => {
  assert.equal(isPrimeBig(2n ** 61n - 1n), true);
  assert.equal(isPrimeBig(22021n), false); // Descartes' fake prime = 19^2 * 61
  assert.equal(isPrimeBig(1n), false);
  assert.equal(isPrimeBig(5n), true);
});

test("integer roots", () => {
  assert.equal(iroot(3n ** 10n, 10), 3n);
  assert.equal(iroot(3n ** 10n - 1n, 10), 2n);
  assert.equal(iroot(10n ** 14n, 2), 10n ** 7n);
});

test("factorizeBig recovers Descartes' fake prime", () => {
  assert.deepEqual(factorizeBig(22021n), [
    [19n, 2],
    [61n, 1],
  ]);
});

test("brute force finds exactly the even perfect numbers below 10^6", () => {
  assert.deepEqual(bruteForcePerfect(1_000_000), [6, 28, 496, 8128]);
});

test("Euler sieve: no odd perfect number with square part <= (10^5)^2", () => {
  const hits = eulerSieve(100_000, false);
  assert.deepEqual(hits, []);
});

test("Euler sieve rediscovers Descartes' 1638 spoof", () => {
  const hits = eulerSieve(5000, true);
  const spoofs = hits.filter((h) => h.kind === "SPOOF");
  assert.ok(
    spoofs.some((h) => h.m === 3003 && h.eulerFactor === 22021n),
    `expected the spoof at m = 3003, got ${spoofs.map((h) => `m=${h.m},B=${h.eulerFactor}`).join("; ")}`
  );
  assert.equal(hits.filter((h) => h.kind === "PERFECT").length, 0);
});

test("constraint analyzer flags Descartes' spoof as not perfect", () => {
  const descartes = 3n ** 2n * 7n ** 2n * 11n ** 2n * 13n ** 2n * 22021n;
  const report = analyzeCandidate(descartes);
  assert.equal(report.isPerfect, false);
  // It passes Touchard's congruence and 105 ∤ N — the "spoof obstruction".
  const touchard = report.checks.find((c) => c.name.startsWith("N ≡ 1 (mod 12)"));
  assert.equal(touchard?.passed, true);
});

test("constraint analyzer confirms an even perfect number's sigma", () => {
  const report = analyzeCandidate(33550336n); // 2^12 * 8191
  assert.equal(report.isPerfect, true);
  assert.equal(report.checks.find((c) => c.name === "N is odd")?.passed, false);
});

console.log(`\n${passed} tests passed.`);
