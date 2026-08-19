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
import { minOmegaForSmallestPrime } from "./omega-bounds.ts";
import { proveSmooth, allowedExponents, exponentCap, primesUpTo } from "./smooth-prover.ts";

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

test("omega lower bounds match classical elementary results", () => {
  // (3/2)(5/4) = 15/8 < 2 but (3/2)(5/4)(7/6) = 35/16 > 2:
  assert.equal(minOmegaForSmallestPrime(3n).k, 3);
  // An OPN not divisible by 3 needs at least 7 distinct primes:
  const r5 = minOmegaForSmallestPrime(5n);
  assert.equal(r5.k, 7);
  assert.deepEqual(r5.primes, [5n, 7n, 11n, 13n, 17n, 19n, 23n]);
});

test("smooth prover exponent caps are finite and correct", () => {
  const T = [2, ...primesUpTo(100).filter((p) => p !== 2)];
  const cap = exponentCap(3, T);
  assert.ok(cap >= 4 && cap < 10000, `cap = ${cap}`);
  const opts = allowedExponents(3, T, "nonspecial");
  const es = opts.map((o) => o.e);
  assert.ok(es.includes(2), "sigma(3^2) = 13 is 100-smooth"); // forces 13 | N
  assert.ok(es.includes(4), "sigma(3^4) = 121 = 11^2 is 100-smooth");
  assert.ok(!es.includes(6), "sigma(3^6) = 1093 is prime > 100");
  const e2 = opts.find((o) => o.e === 2)!;
  assert.deepEqual(e2.needs, [13]);
});

test("smooth prover: special-prime exponent lists respect v_2 = 1", () => {
  const T = [2, ...primesUpTo(31).filter((p) => p !== 2)];
  const es = allowedExponents(5, T, "special").map((o) => o.e);
  assert.ok(es.includes(1), "sigma(5) = 6 = 2 * 3");
  assert.ok(es.includes(5), "sigma(5^5) = 3906 = 2 * 3^2 * 7 * 31");
});

test("smooth prover (even mode) rediscovers the real perfect numbers", () => {
  assert.deepEqual(proveSmooth(31, "even").solutions, [6n, 28n, 496n]);
});

test("smooth prover: no odd perfect number is 60-smooth", () => {
  const r = proveSmooth(60, "odd");
  assert.deepEqual(r.solutions, []);
  assert.ok(r.nodes > 0);
});

console.log(`\n${passed} tests passed.`);
