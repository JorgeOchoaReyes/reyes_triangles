/**
 * The smooth prover: a COMPLETE, rigorous decision procedure for the question
 *
 *     "Is there a perfect number all of whose prime factors are <= B?"
 *
 * For odd N this machine-proves theorems of the form "every odd perfect
 * number has a prime factor > B" — a from-scratch version of the factor-chain
 * method behind all modern published bounds (Ochem-Rao etc.).
 *
 * WHY THE SEARCH IS FINITE (the two pillars of rigor):
 *
 * 1. Smoothness of sigma parts. If N is perfect and every prime of N is in
 *    the set T, then for each prime power p^e || N the number sigma(p^e)
 *    divides sigma(N) = 2N, so every odd prime factor of sigma(p^e) must lie
 *    in T. We only need exponents e for which sigma(p^e) is ({2} u T)-smooth.
 *
 * 2. A provable exponent cap. Suppose sigma(p^e) = (p^{e+1}-1)/(p-1) is
 *    ({2} u T)-smooth. By the lifting-the-exponent lemma, for each odd prime
 *    l in T with d = ord_l(p):
 *        v_l(p^{e+1} - 1) <= v_l(p^d - 1) + v_l(e+1),
 *    and for l = 2 (p odd):  v_2(p^{e+1} - 1) <= v_2(p^2 - 1) + v_2(e+1).
 *    Multiplying over all l in {2} u T:
 *        sigma(p^e) <= C_p * (e+1),   C_p = prod_l l^{v_l(p^{d_l} - 1)}
 *    (the product over l of l^{v_l(e+1)} divides e+1). Since also
 *    sigma(p^e) > p^e, any smooth exponent satisfies p^e < C_p * (e+1),
 *    which bounds e explicitly. Everything past the cap is impossible, with
 *    proof — no heuristic cutoff anywhere.
 *
 * With per-prime exponent lists finite, the whole problem is a finite exact
 * search, pruned by:
 *   - Euler's theorem (odd N): exactly one "special" prime q ≡ 1 (mod 4)
 *     with exponent ≡ 1 (mod 4) and v_2(sigma(q^k)) = 1; all other
 *     exponents even.
 *   - factor chains: choosing p^e forces every odd prime of sigma(p^e)
 *     to appear in N.
 *   - monotonicity: sigma(n)/n strictly exceeds 2 forever once the exact
 *     partial product passes 2 (BigInt compare), and a sound float upper
 *     bound on the remaining product prunes unreachable branches.
 *   - the exact equation prod sigma(p^e) = 2 * prod p^e at the leaves.
 *
 * Validation: with --even the same engine (no Euler constraints, prime 2
 * allowed) must REdiscover the actual perfect numbers — run with
 * --max-prime 127 and it finds exactly 6, 28, 496, 8128.
 *
 * Usage:
 *   node opn/smooth-prover.ts [--max-prime B] [--even]
 */
import { powMod } from "./sigma.ts";

export function primesUpTo(B: number): number[] {
  const sieve = new Uint8Array(B + 1);
  const out: number[] = [];
  for (let i = 2; i <= B; i++) {
    if (!sieve[i]) {
      out.push(i);
      for (let j = i * i; j <= B; j += i) sieve[j] = 1;
    }
  }
  return out;
}

function smallPrimeFactors(n: bigint): bigint[] {
  const out: bigint[] = [];
  for (let d = 2n; d * d <= n; d++) {
    if (n % d === 0n) {
      out.push(d);
      while (n % d === 0n) n /= d;
    }
  }
  if (n > 1n) out.push(n);
  return out;
}

function multiplicativeOrder(p: bigint, l: bigint): bigint {
  let d = l - 1n;
  for (const r of smallPrimeFactors(l - 1n)) {
    while (d % r === 0n && powMod(p, d / r, l) === 1n) d /= r;
  }
  return d;
}

/**
 * Provable upper bound on e such that sigma(p^e) can be T-smooth
 * (T = the full prime set including 2). See pillar 2 above.
 * The per-(p, l) contribution l^{v_l(p^{d_l}-1)} is support-independent, so
 * it is memoized — callers deciding millions of small prime sets reuse it.
 */
const capTermCache = new Map<string, bigint>();

function capTerm(p: number, l: number): bigint {
  const key = `${p},${l}`;
  const hit = capTermCache.get(key);
  if (hit !== undefined) return hit;
  const P = BigInt(p);
  const L = BigInt(l);
  const d = l === 2 ? 2n : multiplicativeOrder(P, L);
  // v = v_l(p^d - 1): largest k with p^d ≡ 1 (mod l^k)
  let mod = L;
  let v = 0;
  while (powMod(P, d, mod) === 1n) {
    v++;
    mod *= L;
  }
  const term = L ** BigInt(v);
  capTermCache.set(key, term);
  return term;
}

export function exponentCap(p: number, T: number[]): number {
  const P = BigInt(p);
  let C = 1n;
  for (const l of T) {
    if (l === p) continue;
    C *= capTerm(p, l);
  }
  let e = 0;
  let pe = 1n;
  while (pe <= C * BigInt(e + 1)) {
    e++;
    pe *= P;
  }
  return e; // p^e > C*(e+1) here, so every smooth exponent is < e
}

export interface ExpOption {
  e: number;
  sigma: bigint; // sigma(p^e), exact
  pe: bigint; // p^e, exact
  needs: number[]; // odd primes forced into N by this choice
  hUpper: number; // log(sigma/p^e) upper-ish estimate for pruning
}

/**
 * All exponents e (respecting parity constraints) up to the provable cap for
 * which sigma(p^e) factors entirely over T (with the 2-part required by the
 * role): "even" mode allows any e; odd-mode non-special primes need e even
 * (sigma then odd automatically); the special prime needs e ≡ 1 (mod 4) and
 * v_2(sigma) = 1.
 */
export function allowedExponents(
  p: number,
  T: number[],
  role: "even-mode" | "nonspecial" | "special"
): ExpOption[] {
  const cap = exponentCap(p, T);
  const P = BigInt(p);
  const out: ExpOption[] = [];
  const start = role === "nonspecial" ? 2 : 1;
  const step = role === "nonspecial" ? 2 : role === "special" ? 4 : 1;
  // maintain sigma(p^e) incrementally: recomputing per e would be O(cap^2)
  let sig = 1n;
  let term = 1n;
  let sigAt = 0;
  for (let e = start; e <= cap; e += step) {
    while (sigAt < e) {
      term *= P;
      sig += term;
      sigAt++;
    }
    let rest = sig;
    if (role === "special") {
      if (rest % 2n !== 0n || (rest / 2n) % 2n === 0n) continue; // need v_2 = 1
      rest /= 2n;
    }
    const needs: number[] = [];
    for (const l of T) {
      const L = BigInt(l);
      if (rest % L === 0n) {
        if (l !== 2) needs.push(l);
        while (rest % L === 0n) rest /= L;
      }
    }
    if (rest !== 1n) continue; // sigma(p^e) is not T-smooth: impossible choice
    if (role === "nonspecial" && sig % 2n === 0n) continue; // safety; never fires
    const pe = P ** BigInt(e);
    // ratio rounded UP so the reachability prune is a sound upper bound
    out.push({ e, sigma: sig, pe, needs, hUpper: (Number((sig * 1000000n) / pe) + 1) / 1e6 });
  }
  return out;
}

export interface Solution {
  n: bigint;
  parts: string;
}

interface SearchState {
  nodes: number;
  solutions: Solution[];
}

const LOG2 = Math.log(2);

function dfs(
  primes: number[], // processing order
  lists: Map<number, ExpOption[]>,
  idx: number,
  A: bigint, // product of chosen sigma(p^e)
  Nprod: bigint, // product of chosen p^e
  logCur: number,
  suffixMaxLog: number[],
  required: Set<number>,
  zeroed: Set<number>,
  mustUse: Set<number>, // primes that may not take exponent 0 (the special prime)
  state: SearchState
): void {
  state.nodes++;
  if (A > 2n * Nprod) return; // abundancy already exceeds 2; it only grows
  if (logCur + suffixMaxLog[idx] < LOG2 - 1e-9) return; // 2 is unreachable
  if (idx === primes.length) {
    if (A === 2n * Nprod && [...required].every((r) => !zeroed.has(r))) {
      state.solutions.push({ n: Nprod, parts: "" });
    }
    return;
  }
  const p = primes[idx];
  const opts = lists.get(p)!;
  const forced = required.has(p) || mustUse.has(p);
  if (!forced) {
    zeroed.add(p);
    dfs(primes, lists, idx + 1, A, Nprod, logCur, suffixMaxLog, required, zeroed, mustUse, state);
    zeroed.delete(p);
  }
  for (const o of opts) {
    // a choice is invalid if it forces a prime we already excluded
    if (o.needs.some((l) => zeroed.has(l))) continue;
    const added = o.needs.filter((l) => !required.has(l));
    for (const l of added) required.add(l);
    dfs(
      primes,
      lists,
      idx + 1,
      A * o.sigma,
      Nprod * o.pe,
      logCur + Math.log(o.hUpper),
      suffixMaxLog,
      required,
      zeroed,
      mustUse,
      state
    );
    for (const l of added) required.delete(l);
  }
}

export interface ProverResult {
  B: number;
  mode: "odd" | "even";
  solutions: bigint[];
  nodes: number;
  specialTried?: number;
}

/**
 * Decide: does any perfect number exist whose prime factors all lie <= B?
 * mode "odd" restricts to odd N (and applies Euler's theorem);
 * mode "even" is the validation mode over all N.
 */
export function proveSmooth(B: number, mode: "odd" | "even"): ProverResult {
  return proveSmoothForPrimes(primesUpTo(B).filter((p) => p !== 2), mode, B);
}

/**
 * Same decision over an ARBITRARY finite set of odd primes: does any perfect
 * number exist whose prime factors all lie in the set? (In "even" mode the
 * prime 2 is additionally allowed as a factor of N.) The LTE exponent-cap
 * argument is valid for any finite smoothness set, so this is exactly as
 * rigorous as the contiguous version — and lets callers decide a single
 * candidate support in microseconds instead of sweeping every prime below
 * its maximum.
 */
export function proveSmoothForPrimes(
  oddPrimes: number[],
  mode: "odd" | "even",
  B?: number,
  exactSupport = false
): ProverResult {
  const odd = oddPrimes;
  const all = [2, ...odd];
  const state: SearchState = { nodes: 0, solutions: [] };

  const runDfs = (primesUsed: number[], lists: Map<number, ExpOption[]>, mustUse: Set<number>) => {
    // decide small primes first: they carry the largest sigma(p^e)/p^e
    // leverage, so both the excess prune (A > 2N) and the reachability prune
    // fire near the root instead of deep in the tree
    const order = [...primesUsed].sort((a, b) => a - b);
    const maxLog = order.map((p) =>
      Math.max(0, ...lists.get(p)!.map((o) => Math.log(o.hUpper)))
    );
    const suffix = new Array(order.length + 1).fill(0);
    for (let i = order.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + maxLog[i];
    dfs(order, lists, 0, 1n, 1n, 0, suffix, new Set(), new Set(), mustUse, state);
  };

  if (mode === "even") {
    const T = all;
    const lists = new Map<number, ExpOption[]>();
    for (const p of T) lists.set(p, allowedExponents(p, T, "even-mode"));
    runDfs(T, lists, new Set());
    return { B: B ?? Math.max(2, ...odd), mode, solutions: state.solutions.map((s) => s.n).sort((a, b) => (a < b ? -1 : 1)), nodes: state.nodes };
  }

  // odd mode: T never contains 2 as a factor of N, but sigma parts may use
  // one factor of 2 (via the special prime); smoothness is over {2} u odd.
  //
  // With exactSupport (every prime in the set MUST divide N — valid when the
  // caller separately enumerates all smaller supports), two exact rejections
  // decide most candidates without building any exponent lists:
  //   (a) Euler's theorem requires a special prime ≡ 1 (mod 4);
  //   (b) minimal Euler-legal exponents (special e = 1, others e = 2)
  //       already give sigma(N)/N its least value; if that exceeds 2 for
  //       every choice of special prime, no exponent assignment reaches 2.
  if (exactSupport) {
    const eligible = odd.filter((p) => p % 4 === 1);
    if (eligible.length === 0) {
      return { B: B ?? Math.max(2, ...odd), mode, solutions: [], nodes: 0, specialTried: 0 };
    }
    let baseN = 1n; // prod (p^2 + p + 1)
    let baseD = 1n; // prod p^2
    for (const p of odd) {
      const P = BigInt(p);
      baseN *= P * P + P + 1n;
      baseD *= P * P;
    }
    const anyReachable = eligible.some((q) => {
      const Q = BigInt(q);
      // swap q's factor (q^2+q+1)/q^2 for (q+1)/q: min = base * q(q+1)/(q^2+q+1)
      const n = baseN * Q * (Q + 1n);
      const d = baseD * (Q * Q + Q + 1n);
      return n <= 2n * d; // minimal abundancy can still be <= 2
    });
    if (!anyReachable) {
      return { B: B ?? Math.max(2, ...odd), mode, solutions: [], nodes: 0, specialTried: 0 };
    }
  }
  const T = [2, ...odd];
  const evenLists = new Map<number, ExpOption[]>();
  for (const p of odd) evenLists.set(p, allowedExponents(p, T, "nonspecial"));
  const specials = odd.filter((p) => p % 4 === 1);
  let tried = 0;
  for (const q of specials) {
    const specialList = allowedExponents(q, T, "special");
    if (specialList.length === 0) continue; // this q can never be the Euler prime
    tried++;
    const lists = new Map(evenLists);
    lists.set(q, specialList);
    runDfs(odd, lists, exactSupport ? new Set(odd) : new Set([q]));
  }
  return {
    B: B ?? Math.max(2, ...odd),
    mode,
    solutions: state.solutions.map((s) => s.n).sort((a, b) => (a < b ? -1 : 1)),
    nodes: state.nodes,
    specialTried: tried,
  };
}

const isMain = process.argv[1] && process.argv[1].endsWith("smooth-prover.ts");
if (isMain) {
  const args = process.argv.slice(2);
  const bIdx = args.indexOf("--max-prime");
  const B = bIdx >= 0 ? Number(args[bIdx + 1]) : 100;
  const mode = args.includes("--even") ? "even" : "odd";

  console.log(`Smooth prover: complete search for ${mode} perfect numbers with all prime factors <= ${B}`);
  const started = Date.now();
  const result = proveSmooth(B, mode);
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`search tree: ${result.nodes} nodes${result.specialTried !== undefined ? `, ${result.specialTried} viable Euler primes` : ""}, ${secs}s`);
  if (result.solutions.length === 0) {
    if (mode === "odd") {
      console.log(`\nTHEOREM (machine-proved): every odd perfect number has a prime factor > ${B}.`);
      console.log(`Proof: finite exhaustive search with provable exponent caps (LTE lemma),`);
      console.log(`sigma-smoothness factor chains, and Euler's form; no branch reaches sigma(N) = 2N.`);
    } else {
      console.log(`\nNo perfect number (even or odd) has all prime factors <= ${B}.`);
    }
  } else {
    console.log(`\nPerfect numbers found (all prime factors <= ${B}):`);
    for (const n of result.solutions) console.log(`  ${n}`);
  }
}
