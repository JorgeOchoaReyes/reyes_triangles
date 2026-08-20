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
import { candidateSupports } from "./omega-prover.ts";
import { enumerateOmega4, refuteFamily, proveOmega5 } from "./omega5-prover.ts";
import { proveSmoothForPrimes } from "./smooth-prover.ts";
import { enumerateTasks, proveOmegaAtLeast } from "./omega-n-prover.ts";
import { verifyTouchard } from "./touchard.ts";

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok: ${name}`);
}

await test("sigma on known values", () => {
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

await test("sigma of squares via power parameter", () => {
  const spf = spfSieve(100);
  // sigma(15^2) = sigma(225) = (1+3+9)(1+5+25) = 13 * 31 = 403
  assert.equal(sigmaFromFactors(factorizeWithSieve(15, spf), 2), 403n);
});

await test("sigmaBig with Pollard rho factoring", () => {
  assert.equal(sigmaBig(2n ** 61n - 1n), 2n ** 61n); // Mersenne prime
  assert.equal(sigmaBig(1000000007n * 1000000009n), 1000000008n * 1000000010n);
});

await test("Miller-Rabin primality", () => {
  assert.equal(isPrimeBig(2n ** 61n - 1n), true);
  assert.equal(isPrimeBig(22021n), false); // Descartes' fake prime = 19^2 * 61
  assert.equal(isPrimeBig(1n), false);
  assert.equal(isPrimeBig(5n), true);
});

await test("integer roots", () => {
  assert.equal(iroot(3n ** 10n, 10), 3n);
  assert.equal(iroot(3n ** 10n - 1n, 10), 2n);
  assert.equal(iroot(10n ** 14n, 2), 10n ** 7n);
});

await test("factorizeBig recovers Descartes' fake prime", () => {
  assert.deepEqual(factorizeBig(22021n), [
    [19n, 2],
    [61n, 1],
  ]);
});

await test("brute force finds exactly the even perfect numbers below 10^6", () => {
  assert.deepEqual(bruteForcePerfect(1_000_000), [6, 28, 496, 8128]);
});

await test("Euler sieve: no odd perfect number with square part <= (10^5)^2", () => {
  const hits = eulerSieve(100_000, false);
  assert.deepEqual(hits, []);
});

await test("Euler sieve rediscovers Descartes' 1638 spoof", () => {
  const hits = eulerSieve(5000, true);
  const spoofs = hits.filter((h) => h.kind === "SPOOF");
  assert.ok(
    spoofs.some((h) => h.m === 3003 && h.eulerFactor === 22021n),
    `expected the spoof at m = 3003, got ${spoofs.map((h) => `m=${h.m},B=${h.eulerFactor}`).join("; ")}`
  );
  assert.equal(hits.filter((h) => h.kind === "PERFECT").length, 0);
});

await test("constraint analyzer flags Descartes' spoof as not perfect", () => {
  const descartes = 3n ** 2n * 7n ** 2n * 11n ** 2n * 13n ** 2n * 22021n;
  const report = analyzeCandidate(descartes);
  assert.equal(report.isPerfect, false);
  // It passes Touchard's congruence and 105 ∤ N — the "spoof obstruction".
  const touchard = report.checks.find((c) => c.name.startsWith("N ≡ 1 (mod 12)"));
  assert.equal(touchard?.passed, true);
});

await test("constraint analyzer confirms an even perfect number's sigma", () => {
  const report = analyzeCandidate(33550336n); // 2^12 * 8191
  assert.equal(report.isPerfect, true);
  assert.equal(report.checks.find((c) => c.name === "N is odd")?.passed, false);
});

await test("omega lower bounds match classical elementary results", () => {
  // (3/2)(5/4) = 15/8 < 2 but (3/2)(5/4)(7/6) = 35/16 > 2:
  assert.equal(minOmegaForSmallestPrime(3n).k, 3);
  // An OPN not divisible by 3 needs at least 7 distinct primes:
  const r5 = minOmegaForSmallestPrime(5n);
  assert.equal(r5.k, 7);
  assert.deepEqual(r5.primes, [5n, 7n, 11n, 13n, 17n, 19n, 23n]);
});

await test("smooth prover exponent caps are finite and correct", () => {
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

await test("smooth prover: special-prime exponent lists respect v_2 = 1", () => {
  const T = [2, ...primesUpTo(31).filter((p) => p !== 2)];
  const es = allowedExponents(5, T, "special").map((o) => o.e);
  assert.ok(es.includes(1), "sigma(5) = 6 = 2 * 3");
  assert.ok(es.includes(5), "sigma(5^5) = 3906 = 2 * 3^2 * 7 * 31");
});

await test("smooth prover (even mode) rediscovers the real perfect numbers", () => {
  assert.deepEqual(proveSmooth(31, "even").solutions, [6n, 28n, 496n]);
});

await test("smooth prover: no odd perfect number is 60-smooth", () => {
  const r = proveSmooth(60, "odd");
  assert.deepEqual(r.solutions, []);
  assert.ok(r.nodes > 0);
});

await test("omega prover: support enumeration is exact", () => {
  assert.deepEqual(candidateSupports(1), []);
  assert.deepEqual(candidateSupports(2), []);
  assert.deepEqual(candidateSupports(3), [
    [3, 5, 7],
    [3, 5, 11],
    [3, 5, 13],
  ]);
  // from omega = 4 on, families like {3,5,7,p} are unbounded in p — the
  // enumeration must refuse rather than silently truncate
  assert.throws(() => candidateSupports(4), /unbounded family/);
});

await test("omega-5 prover: omega = 4 candidate enumeration", () => {
  const { boundedSets, families } = enumerateOmega4();
  assert.deepEqual(families, [
    [3, 5, 7],
    [3, 5, 11],
    [3, 5, 13],
  ]);
  const maxPrime = Math.max(...boundedSets.flat());
  assert.equal(maxPrime, 251); // extreme case {3,5,17,251}
  assert.ok(boundedSets.some((s) => s.join() === [3, 7, 11, 13].join()));
  assert.ok(boundedSets.every((s) => s.length === 4));
});

await test("omega-5 prover: family {3,5,7,p} dies entirely by windows", () => {
  assert.deepEqual(refuteFamily([3, 5, 7], 5000), []);
});

await test("omega-5 prover: full proof goes through", () => {
  const r = proveOmega5();
  assert.equal(r.proved, true);
  assert.equal(r.bStar, 251);
  assert.ok(r.familySupports.length > 0); // windows alone don't kill everything
  assert.ok(r.familySupports.every((s) => Math.max(...s) <= 251));
});

await test("proveSmoothForPrimes decides arbitrary prime sets", () => {
  // even-mode set {2,3} admits exactly 6 = 2*3
  assert.deepEqual(proveSmoothForPrimes([3], "even").solutions, [6n]);
  // odd support {3,5,11,137} (the omega-5 sole survivor) is impossible
  assert.deepEqual(proveSmoothForPrimes([3, 5, 11, 137], "odd").solutions, []);
});

await test("general omega prover matches the dedicated omega-5 proof", async () => {
  const { pure, tasks } = enumerateTasks(4);
  assert.equal(pure.length, 76);
  assert.deepEqual(tasks.map((t) => t.concrete), [
    [3, 5, 7],
    [3, 5, 11],
    [3, 5, 13],
  ]);
  assert.ok(tasks.every((t) => t.nSym === 1));
  const r = await proveOmegaAtLeast(5);
  assert.equal(r.proved, true);
  assert.deepEqual(r.resolvedSupports, [[3, 5, 11, 137]]);
});

await test("Touchard congruence lemmas verify exhaustively", () => {
  const { holds, checks } = verifyTouchard();
  assert.equal(holds, true);
  assert.equal(checks.length, 4);
  assert.ok(checks.every((c) => c.cases > 0));
});

console.log(`\n${passed} tests passed.`);
