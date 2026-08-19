/**
 * The general omega prover: machine proofs that an odd perfect number has at
 * least K distinct prime factors, for K as large as the search will bear.
 * K = 5 reproduces omega5-prover; K = 6 mechanizes the Gradstein (1925)
 * tier; higher K is limited only by combinatorial growth.
 *
 * The engine generalizes the window method of omega5-prover.ts to ANY number
 * of unknown ("symbolic") primes:
 *
 * 1. Enumerate supports for omega = K-1 by choosing primes in increasing
 *    order under 2 < prod p/(p-1). The moment a prefix's product exceeds 2,
 *    the remaining slots become symbolic — the sup-bound can no longer limit
 *    them — and the prefix is emitted as a TASK with nSym symbolic primes.
 *    Full-length prefixes with product > 2 are concrete supports.
 *
 * 2. Resolve each task. For each choice of Euler's special prime (a concrete
 *    prime ≡ 1 mod 4 or one of the symbolic slots), DFS over the concrete
 *    primes' exponent ladders (exact values then a tail interval), obtaining
 *    exact bounds [lo, hi] for the known part of sigma(N)/N. At a leaf the
 *    symbolic primes must supply exactly 2/h_known in ((2/hi, 2/lo]):
 *      - the SMALLEST symbolic prime r satisfies (r/(r-1))^nSym >= 2/hi,
 *        which bounds r explicitly — enumerate r, branch its ladder, recurse
 *        with nSym-1;
 *      - the last symbolic prime p is pinned into a finite range by its
 *        envelope [(p+1)/p or (p^2+p+1)/p^2, p/(p-1)).
 *    Every branch either dies (h_known >= 2) or emits finitely many concrete
 *    supports. The prover THROWS rather than truncates whenever a leaf fails
 *    to bound a symbolic prime, so a completed run is a complete proof.
 *
 * 3. Every emitted support uses primes <= B*; a single factor-chain run
 *    (smooth-prover.ts) refutes B*-smoothness, killing them all for every
 *    exponent assignment at once.
 *
 * All comparisons are exact (BigInt cross-multiplication); interval
 * endpoints are included on both sides where truncation would otherwise
 * threaten soundness (wider = sound).
 *
 * Usage: node opn/omega-n-prover.ts [K]     (default K = 6)
 */
import { isPrimeBig } from "./sigma.ts";
import { proveSmoothForPrimes } from "./smooth-prover.ts";

interface Frac {
  n: bigint;
  d: bigint;
}
const F = (n: bigint, d: bigint): Frac => ({ n, d });
const ONE = F(1n, 1n);
const TWO = F(2n, 1n);
const gcdB = (a: bigint, b: bigint): bigint => {
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
};
// reduce on every multiply: deep recursions otherwise balloon the BigInts
const mul = (a: Frac, b: Frac): Frac => {
  const n = a.n * b.n;
  const d = a.d * b.d;
  const g = gcdB(n, d);
  return F(n / g, d / g);
};
const cmp = (a: Frac, b: Frac): number => {
  const x = a.n * b.d - b.n * a.d;
  return x < 0n ? -1 : x > 0n ? 1 : 0;
};
const inv2 = (a: Frac): Frac => F(2n * a.d, a.n);

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

const EXACT_STEPS = 24;
// supports are decided individually (proveSmoothForPrimes), so large leaf
// primes cost microseconds instead of forcing a giant contiguous smooth run
const MAX_LEAF_PRIME = 1_000_000;

export interface Task {
  concrete: number[];
  nSym: number;
}

/** Step 1: supports and symbolic tasks for omega = w. */
export function enumerateTasks(w: number): { pure: number[][]; tasks: Task[] } {
  const pure: number[][] = [];
  const tasks: Task[] = [];

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
    if (num > 2n * den) {
      if (chosen.length === w) pure.push([...chosen]);
      else tasks.push({ concrete: [...chosen], nSym: w - chosen.length });
      return;
    }
    if (chosen.length === w) return; // product never reached 2: infeasible
    for (let p = nextPrime(last); ; p = nextPrime(p)) {
      if (!bestCompletion(num, den, p - 1, w - chosen.length)) break;
      chosen.push(p);
      rec(p, chosen, num * BigInt(p), den * BigInt(p - 1));
      chosen.pop();
    }
  };
  rec(2, [], 1n, 1n);
  return { pure, tasks };
}

/** Step 2: resolve one task into the concrete supports that survive. */
export function resolveTask(task: Task, emit: (support: number[]) => void): void {
  const { concrete, nSym } = task;
  const lastConcrete = concrete[concrete.length - 1];

  // Euler's special prime: a concrete prime ≡ 1 (mod 4), or a symbolic slot.
  const specials: Array<number | string> = concrete.filter((r) => r % 4 === 1);
  for (let j = 0; j < nSym; j++) specials.push(`sym${j}`);

  for (const s of specials) {
    const ladder = (r: number, symIdx: number | null) => {
      const isSpecial = symIdx === null ? s === r : s === `sym${symIdx}`;
      return isSpecial ? { start: 1, step: 4, special: true } : { start: 2, step: 2, special: false };
    };

    /**
     * Resolve the symbolic primes given exact bounds [lo, hi] on the h-value
     * of everything chosen so far. symIdx counts symbolic slots already
     * resolved; minP is the strict lower bound for the next symbolic prime.
     */
    const resolveSym = (symIdx: number, minP: number, lo: Frac, hi: Frac, chosen: number[]) => {
      if (cmp(lo, TWO) >= 0) return; // h of the known part already >= 2
      const remaining = nSym - symIdx;
      const target = inv2(hi); // symbolic primes must together reach at least this

      if (remaining === 1) {
        // pin the final prime p by its envelope
        if (cmp(hi, TWO) >= 0) {
          throw new Error(`leaf straddles 2 in task {${concrete}}+${nSym}sym (special ${s})`);
        }
        const tHi = inv2(lo);
        const tLo = target;
        if (tLo.n <= tLo.d) throw new Error(`final prime unbounded in task {${concrete}}`);
        const pMax = Number(tLo.n / (tLo.n - tLo.d)) + 1;
        if (pMax > MAX_LEAF_PRIME) throw new Error(`leaf p-range up to ${pMax} in task {${concrete}}`);
        const { special } = ladder(0, symIdx);
        for (let p = nextPrime(minP); p <= pMax; p = nextPrime(p)) {
          if (special && p % 4 !== 1) continue;
          const P = BigInt(p);
          const floor = special ? F(P + 1n, P) : F(P * P + P + 1n, P * P);
          const ceil = F(P, P - 1n);
          if (cmp(floor, tHi) <= 0 && cmp(ceil, tLo) >= 0) emit([...concrete, ...chosen, p]);
        }
        return;
      }

      // enumerate the smallest remaining symbolic prime r:
      // (r/(r-1))^remaining must reach 2/hi, which bounds r
      const { start, step, special } = ladder(0, symIdx);
      for (let r = nextPrime(minP); ; r = nextPrime(r)) {
        let env = ONE;
        for (let i = 0; i < remaining; i++) env = mul(env, hSup(r));
        if (cmp(env, target) < 0) break; // fails for all larger r too
        if (r > MAX_LEAF_PRIME) throw new Error(`symbolic prime range too wide in task {${concrete}}`);
        if (special && r % 4 !== 1) continue;
        // branch r's exponent ladder: exact values, then one tail interval.
        // For large r the whole ladder spans an interval of width ~1/r^3, so
        // exact splitting is pointless — use the envelope alone (steps = 0).
        const steps = r < 150 ? EXACT_STEPS : 0;
        let e = start;
        let dead = false;
        for (let k = 0; k < steps; k++) {
          const h = hExact(r, e);
          if (cmp(mul(lo, h), TWO) >= 0) {
            dead = true;
            break; // larger exponents of r are dead too
          }
          chosen.push(r);
          resolveSym(symIdx + 1, r, mul(lo, h), mul(hi, h), chosen);
          chosen.pop();
          e += step;
        }
        if (!dead) {
          chosen.push(r);
          resolveSym(symIdx + 1, r, mul(lo, hExact(r, e)), mul(hi, hSup(r)), chosen);
          chosen.pop();
        }
      }
    };

    // DFS over the concrete primes' ladders
    const mins = concrete.map((r) => {
      const { start } = ladder(r, null);
      return hExact(r, start);
    });
    const dfs = (idx: number, lo: Frac, hi: Frac) => {
      if (idx === concrete.length) {
        resolveSym(0, lastConcrete, lo, hi, []);
        return;
      }
      const r = concrete[idx];
      const { start, step } = ladder(r, null);
      let minRem = ONE;
      for (let j = idx + 1; j < concrete.length; j++) minRem = mul(minRem, mins[j]);
      let e = start;
      for (let k = 0; k < EXACT_STEPS; k++) {
        const h = hExact(r, e);
        if (cmp(mul(mul(lo, h), minRem), TWO) >= 0) return; // larger e dead too
        dfs(idx + 1, mul(lo, h), mul(hi, h));
        e += step;
      }
      dfs(idx + 1, mul(lo, hExact(r, e)), mul(hi, hSup(r)));
    };
    dfs(0, ONE, ONE);
  }
}

export interface OmegaNResult {
  k: number;
  pureSupports: number[][];
  tasks: Task[];
  resolvedSupports: number[][];
  bStar: number;
  smoothNodes: number;
  proved: boolean;
}

/** Prove: every odd perfect number has at least k distinct prime factors. */
export function proveOmegaAtLeast(k: number, log: (msg: string) => void = () => {}): OmegaNResult {
  const seen = new Set<string>();
  const allSupports: number[][] = [];
  const addSupport = (s: number[]) => {
    const key = s.join(",");
    if (!seen.has(key)) {
      seen.add(key);
      allSupports.push(s);
    }
  };

  let allTasks: Task[] = [];
  const pureAll: number[][] = [];
  for (let w = 1; w <= k - 1; w++) {
    const { pure, tasks } = enumerateTasks(w);
    pure.forEach(addSupport);
    pureAll.push(...pure);
    allTasks = allTasks.concat(tasks);
    log(`omega = ${w}: ${pure.length} concrete supports, ${tasks.length} symbolic tasks`);
  }

  const resolvedSupports: number[][] = [];
  for (const task of allTasks) {
    resolveTask(task, (sup) => {
      const key = sup.join(",");
      if (!seen.has(key)) {
        seen.add(key);
        allSupports.push(sup);
        resolvedSupports.push(sup);
      }
    });
  }
  log(`symbolic resolution: ${resolvedSupports.length} surviving supports`);

  const bStar = Math.max(13, ...allSupports.flat());
  log(`deciding ${allSupports.length} supports individually (largest prime ${bStar})...`);
  let smoothNodes = 0;
  let failures = 0;
  for (const sup of allSupports) {
    const r = proveSmoothForPrimes(sup, "odd");
    smoothNodes += r.nodes;
    if (r.solutions.length > 0) {
      failures++;
      log(`!!! PERFECT NUMBER with support {${sup}}: ${r.solutions.join(", ")}`);
    }
  }
  return {
    k,
    pureSupports: pureAll,
    tasks: allTasks,
    resolvedSupports,
    bStar,
    smoothNodes,
    proved: failures === 0,
  };
}

const isMain = process.argv[1] && process.argv[1].endsWith("omega-n-prover.ts");
if (isMain) {
  const k = Number(process.argv[2] ?? 6);
  console.log(`THEOREM: every odd perfect number has at least ${k} distinct prime factors.\n`);
  const started = Date.now();
  const r = proveOmegaAtLeast(k, (m) => console.log(`  ${m}`));
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\nfactor-chain run: ${r.smoothNodes} nodes; B* = ${r.bStar}.`);
  if (r.proved) {
    console.log(`All steps verified in ${secs}s. QED: omega(N) >= ${k} for every odd perfect N.`);
  } else {
    console.log("!!! smoothness search found solutions — investigate immediately.");
  }
}
