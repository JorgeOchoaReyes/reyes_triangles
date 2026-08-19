/**
 * Machine proof that an odd perfect number has at least 4 distinct prime
 * factors (a from-scratch, mechanized version of results going back to
 * Peirce 1832 / Servais 1888).
 *
 * Structure of the proof, every step machine-checked in exact arithmetic:
 *
 * Step 1 (enumeration). For N odd perfect with distinct primes
 * p_1 < ... < p_w, the abundancy satisfies 2 = sigma(N)/N < prod p_i/(p_i-1).
 * For w <= 3, enumerate ALL prime tuples with prod p/(p-1) > 2: choose
 * primes in increasing order; a prefix is viable only if its product times
 * the best possible completion (the next remaining-slots primes immediately
 * above the last choice) still exceeds 2 — and that best completion shrinks
 * monotonically as the next prime grows, so each slot terminates. This
 * yields a FINITE list of candidate supports; all its primes turn out
 * to be <= 13.
 *
 * Step 2 (decision). Every candidate support consists of primes <= 13, so
 * an OPN with w <= 3 would be 13-smooth. The factor-chain prover
 * (smooth-prover.ts) decides 13-smoothness exhaustively — with provable
 * exponent caps — and finds nothing.
 *
 * Conclusion: omega(N) >= 4 for every odd perfect number N.
 *
 * Usage: node opn/omega-prover.ts
 */
import { isPrimeBig } from "./sigma.ts";
import { proveSmooth } from "./smooth-prover.ts";

function nextPrime(n: number): number {
  let p = n + 1;
  if (p <= 2) return 2;
  if (p % 2 === 0) p++;
  while (!isPrimeBig(BigInt(p))) p += 2;
  return p;
}

/** Exact comparison: prefixNum/prefixDen * (best completion with `slots` primes > last) > 2 ? */
function bestCompletionExceedsTwo(num: bigint, den: bigint, last: number, slots: number): boolean {
  let p = last;
  for (let i = 0; i < slots; i++) {
    p = nextPrime(p);
    num *= BigInt(p);
    den *= BigInt(p - 1);
  }
  return num > 2n * den;
}

/**
 * All supports {p_1 < ... < p_w} of odd primes with prod p/(p-1) > 2,
 * for a fixed w. Throws if a branch is unbounded (prefix product alone
 * already exceeds 2 with slots remaining — happens from w = 4 on).
 */
export function candidateSupports(w: number): number[][] {
  const out: number[][] = [];
  const rec = (last: number, slots: number, num: bigint, den: bigint, chosen: number[]) => {
    if (slots === 0) {
      if (num > 2n * den) out.push([...chosen]);
      return;
    }
    if (num > 2n * den) {
      throw new Error(
        `unbounded family: {${chosen.join(",")}} already exceeds 2 with ${slots} slot(s) free`
      );
    }
    for (let p = nextPrime(last); ; p = nextPrime(p)) {
      // monotone in p: once the best completion using p fails, all larger p fail
      if (!bestCompletionExceedsTwo(num, den, p - 1, slots)) break;
      chosen.push(p);
      rec(p, slots - 1, num * BigInt(p), den * BigInt(p - 1), chosen);
      chosen.pop();
    }
  };
  rec(2, w, 1n, 1n, []);
  return out;
}

const isMain = process.argv[1] && process.argv[1].endsWith("omega-prover.ts");
if (isMain) {
  console.log("THEOREM: every odd perfect number has at least 4 distinct prime factors.\n");

  console.log("Step 1 — exact enumeration of possible supports for omega <= 3:");
  let maxPrime = 0;
  for (let w = 1; w <= 3; w++) {
    const sets = candidateSupports(w);
    console.log(
      `  omega = ${w}: ${sets.length === 0 ? "no prime set reaches abundancy 2" : sets.map((s) => `{${s.join(",")}}`).join(", ")}`
    );
    for (const s of sets) maxPrime = Math.max(maxPrime, ...s);
  }
  console.log(`  => any OPN with omega <= 3 would be ${maxPrime}-smooth.\n`);

  console.log(`Step 2 — factor-chain decision of ${maxPrime}-smoothness:`);
  const r = proveSmooth(maxPrime, "odd");
  console.log(
    `  exhaustive search (${r.nodes} nodes, ${r.specialTried} viable Euler primes): ${r.solutions.length} perfect numbers.\n`
  );

  if (r.solutions.length === 0) {
    console.log("Both steps verified. QED: omega(N) >= 4 for every odd perfect N.");
  } else {
    console.log("!!! smoothness search found solutions — investigate immediately:");
    for (const n of r.solutions) console.log(`  ${n}`);
  }
}
