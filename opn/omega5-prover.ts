/**
 * Machine proof that an odd perfect number has at least FIVE distinct prime
 * factors — mechanizing the Sylvester (1888) tier of results.
 *
 * The proof, every step machine-checked in exact rational arithmetic:
 *
 * Step 1 (enumerate omega = 4 candidates). Choosing primes in increasing
 * order under the strict bound 2 = sigma(N)/N < prod p/(p-1) yields:
 *   - finitely many BOUNDED supports (largest prime <= 251; the extreme
 *     prefix is {3,5,17}, forcing p4 <= 251), and
 *   - exactly three UNBOUNDED families {3,5,7,p}, {3,5,11,p}, {3,5,13,p}
 *     whose prefix product already exceeds 2, so the sup-bound alone cannot
 *     limit p.
 *
 * Step 2 (window analysis of each family). Fix the family {3, 5, q} and the
 * Euler special prime s (s = 5, s = q when q ≡ 1 mod 4, or s = p). Each
 * known prime r contributes h(r^e) = sigma(r^e)/r^e from a DISCRETE ladder
 * (e even for non-special, e ≡ 1 mod 4 for special) climbing toward
 * r/(r-1). The DFS assigns each known prime either an exact ladder value or
 * a tail interval [h(r^E), r/(r-1)), giving exact bounds [lo, hi) for
 * h_rest = h(3^a 5^b q^c). Perfection forces h(p^d) = 2/h_rest, and since
 * h(p^d) lies in [(p+1)/p, p/(p-1)) — with the sharper floor
 * 1 + 1/p + 1/p^2 when p is non-special (d even >= 2) — each leaf pins p
 * into an EXPLICIT FINITE RANGE (empty when lo >= 2). Every branch either
 * dies or emits finitely many concrete supports {3, 5, q, p}.
 *
 * Step 3 (decide the survivors). Every support from steps 1-2, plus the
 * omega <= 3 supports from omega-prover, consists of primes <= B*. One run
 * of the factor-chain prover (smooth-prover.ts) refutes B*-smoothness
 * outright, killing them all — for ALL exponent choices at once, which is
 * why the window DFS never needs to bound the exponents it left as tails.
 *
 * Conclusion: omega(N) >= 5 for every odd perfect number N.
 *
 * Soundness notes: all interval endpoints are exact BigInt fractions and
 * all comparisons cross-multiplied; boundary cases are included on both
 * sides (wider = sound). If any leaf ever straddled 2 (lo < 2 <= hi) the
 * p-range would be unbounded — the prover THROWS in that case rather than
 * truncating, so a completed run is a complete proof.
 *
 * Usage: node opn/omega5-prover.ts
 */
import { isPrimeBig } from "./sigma.ts";
import { proveSmooth } from "./smooth-prover.ts";
import { candidateSupports } from "./omega-prover.ts";

interface Frac {
  n: bigint;
  d: bigint;
}
const F = (n: bigint, d: bigint): Frac => ({ n, d });
const ONE = F(1n, 1n);
const TWO = F(2n, 1n);
const mul = (a: Frac, b: Frac): Frac => F(a.n * b.n, a.d * b.d);
/** sign of a - b */
const cmp = (a: Frac, b: Frac): number => {
  const x = a.n * b.d - b.n * a.d;
  return x < 0n ? -1 : x > 0n ? 1 : 0;
};
const inv2 = (a: Frac): Frac => F(2n * a.d, a.n); // 2/a

/** h(r^e) = sigma(r^e) / r^e, exact. */
function hExact(r: number, e: number): Frac {
  const R = BigInt(r);
  let pe = 1n;
  let sig = 1n;
  for (let i = 0; i < e; i++) {
    pe *= R;
    sig += pe;
  }
  return F(sig, pe);
}
const hSup = (r: number): Frac => F(BigInt(r), BigInt(r - 1));

function nextPrime(n: number): number {
  let p = n + 1;
  if (p <= 2) return 2;
  if (p % 2 === 0) p++;
  while (!isPrimeBig(BigInt(p))) p += 2;
  return p;
}

/** Exponent ladder for prime r under special prime s: start and step. */
const ladder = (r: number, s: number | "p") => (s === r ? { start: 1, step: 4 } : { start: 2, step: 2 });

// ---------------------------------------------------------------------------
// Step 1: enumerate omega = 4 candidates
// ---------------------------------------------------------------------------

export interface Omega4Candidates {
  boundedSets: number[][];
  families: number[][]; // 3-element prefixes with prefix product > 2
}

export function enumerateOmega4(): Omega4Candidates {
  const boundedSets: number[][] = [];
  const families: number[][] = [];

  const bestCompletion = (num: bigint, den: bigint, last: number, slots: number): boolean => {
    let p = last;
    for (let i = 0; i < slots; i++) {
      p = nextPrime(p);
      num *= BigInt(p);
      den *= BigInt(p - 1);
    }
    return num > 2n * den;
  };

  const rec = (last: number, chosen: number[], num: bigint, den: bigint) => {
    if (chosen.length === 3) {
      if (num > 2n * den) {
        families.push([...chosen]); // unbounded in the 4th prime
        return;
      }
      // bounded: p/(p-1) > 2*den/num  =>  p < num / (num - ... ) — iterate.
      for (let p = nextPrime(last); ; p = nextPrime(p)) {
        const P = BigInt(p);
        if (num * P <= 2n * den * (P - 1n)) break; // fails for all larger p too
        boundedSets.push([...chosen, p]);
      }
      return;
    }
    for (let p = nextPrime(last); ; p = nextPrime(p)) {
      if (!bestCompletion(num, den, p - 1, 4 - chosen.length)) break;
      chosen.push(p);
      rec(p, chosen, num * BigInt(p), den * BigInt(p - 1));
      chosen.pop();
    }
  };
  rec(2, [], 1n, 1n);
  return { boundedSets, families };
}

// ---------------------------------------------------------------------------
// Step 2: window DFS over one unbounded family {3, 5, q, p}
// ---------------------------------------------------------------------------

const EXACT_STEPS = 40; // ladder values taken exactly before switching to a tail

/**
 * All finite supports {...family, p} that survive the window analysis.
 * Throws if any leaf leaves p unbounded (never happens; see module comment).
 */
export function refuteFamily(fam: number[], maxLeafPrime: number): number[][] {
  const q = fam[fam.length - 1];
  const supports: number[][] = [];
  const specials: Array<number | "p"> = [5];
  if (q % 4 === 1) specials.push(q);
  specials.push("p");

  for (const s of specials) {
    const mins = fam.map((r) => hExact(r, ladder(r, s).start));

    const leaf = (lo: Frac, hi: Frac) => {
      if (cmp(lo, TWO) >= 0) return; // abundancy of the known part already >= 2
      if (cmp(hi, TWO) >= 0) {
        throw new Error(`leaf straddles 2 in family {${fam}} (special ${s}) — refine EXACT_STEPS`);
      }
      // h(p^d) must lie in [2/hi, 2/lo]; envelope of h(p^d) is
      // [(p+1)/p, p/(p-1)) (special) or [(p^2+p+1)/p^2, p/(p-1)) (non-special).
      const tHi = inv2(lo); // largest value h(p^d) may need to reach
      const tLo = inv2(hi); // smallest
      // p/(p-1) >= tLo  =>  p <= tLo.n / (tLo.n - tLo.d)
      if (tLo.n <= tLo.d) throw new Error(`p unbounded in family {${fam}} — refine`);
      const pMax = Number(tLo.n / (tLo.n - tLo.d)) + 1;
      if (pMax > maxLeafPrime) {
        throw new Error(`leaf p-range up to ${pMax} exceeds limit in family {${fam}}`);
      }
      for (let p = nextPrime(q); p <= pMax; p = nextPrime(p)) {
        if (s === "p" && p % 4 !== 1) continue; // special prime must be 1 mod 4
        const P = BigInt(p);
        const floor =
          s === "p" ? F(P + 1n, P) : F(P * P + P + 1n, P * P); // min achievable h(p^d)
        const ceil = F(P, P - 1n); // sup, not attained
        // envelope intersects [tLo, tHi]? (closed on both sides — wider = sound)
        if (cmp(floor, tHi) <= 0 && cmp(ceil, tLo) >= 0) {
          supports.push([...fam, p]);
        }
      }
    };

    const dfs = (idx: number, lo: Frac, hi: Frac) => {
      if (idx === fam.length) {
        leaf(lo, hi);
        return;
      }
      const r = fam[idx];
      const { start, step } = ladder(r, s);
      let minRem = ONE;
      for (let j = idx + 1; j < fam.length; j++) minRem = mul(minRem, mins[j]);
      let e = start;
      for (let k = 0; k < EXACT_STEPS; k++) {
        const h = hExact(r, e);
        // h is monotone in e: once even the minimal completion hits 2, all
        // larger e are dead as well
        if (cmp(mul(mul(lo, h), minRem), TWO) >= 0) return;
        dfs(idx + 1, mul(lo, h), mul(hi, h));
        e += step;
      }
      // tail: every remaining exponent at once, as one interval
      dfs(idx + 1, mul(lo, hExact(r, e)), mul(hi, hSup(r)));
    };

    dfs(0, ONE, ONE);
  }
  return supports;
}

// ---------------------------------------------------------------------------
// Step 3: assemble the theorem
// ---------------------------------------------------------------------------

export interface Omega5Result {
  boundedSets: number[][];
  families: number[][];
  familySupports: number[][];
  bStar: number;
  smoothNodes: number;
  proved: boolean;
}

export function proveOmega5(): Omega5Result {
  const { boundedSets, families } = enumerateOmega4();

  const seen = new Set<string>();
  const familySupports: number[][] = [];
  for (const fam of families) {
    for (const s of refuteFamily(fam, 5000)) {
      const key = s.join(",");
      if (!seen.has(key)) {
        seen.add(key);
        familySupports.push(s);
      }
    }
  }

  let bStar = 13; // covers the omega <= 3 supports from omega-prover
  for (let w = 1; w <= 3; w++) {
    for (const s of candidateSupports(w)) bStar = Math.max(bStar, ...s);
  }
  for (const s of boundedSets) bStar = Math.max(bStar, ...s);
  for (const s of familySupports) bStar = Math.max(bStar, ...s);

  const smooth = proveSmooth(bStar, "odd");
  return {
    boundedSets,
    families,
    familySupports,
    bStar,
    smoothNodes: smooth.nodes,
    proved: smooth.solutions.length === 0,
  };
}

const isMain = process.argv[1] && process.argv[1].endsWith("omega5-prover.ts");
if (isMain) {
  console.log("THEOREM: every odd perfect number has at least 5 distinct prime factors.\n");
  const started = Date.now();
  const r = proveOmega5();

  console.log("Step 1 — omega = 4 candidate enumeration (exact rationals):");
  console.log(`  bounded supports: ${r.boundedSets.length} (e.g. ${r.boundedSets.slice(0, 3).map((s) => `{${s}}`).join(", ")}, ...)`);
  console.log(`  unbounded families: ${r.families.map((f) => `{${f},p}`).join(", ")}\n`);

  console.log("Step 2 — window analysis of the unbounded families:");
  console.log(`  every branch either dies (abundancy pinned away from 2) or pins p`);
  console.log(`  into a finite range; surviving supports: ${r.familySupports.length}`);
  const shown = r.familySupports.slice(0, 8).map((s) => `{${s}}`).join(", ");
  console.log(`  ${shown}${r.familySupports.length > 8 ? ", ..." : ""}\n`);

  console.log(`Step 3 — all surviving supports use primes <= ${r.bStar}:`);
  console.log(`  factor-chain refutation of ${r.bStar}-smoothness: ${r.smoothNodes} nodes.\n`);

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (r.proved) {
    console.log(`All steps verified in ${secs}s. QED: omega(N) >= 5 for every odd perfect N.`);
  } else {
    console.log("!!! smoothness search found solutions — investigate immediately.");
  }
}
