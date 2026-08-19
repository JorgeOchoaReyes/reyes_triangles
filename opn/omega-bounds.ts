/**
 * Rigorous elementary lower bounds on omega(N) for an odd perfect number N,
 * proved by exact rational arithmetic (no floating point).
 *
 * The abundancy of N = prod p_i^{e_i} satisfies a STRICT inequality
 *
 *     sigma(N) / N  =  prod sigma(p_i^{e_i}) / p_i^{e_i}  <  prod p_i / (p_i - 1)
 *
 * because sigma(p^e)/p^e = (1 + 1/p + ... + 1/p^e) < p/(p-1) always.
 * A perfect number needs sigma(N)/N = 2 exactly. So if the k smallest odd
 * primes >= p0 give  prod p/(p-1) <= 2,  then NO odd perfect number can have
 * smallest prime factor >= p0 and only k distinct prime factors.
 *
 * For each smallest prime p0 this program finds the least k whose product
 * exceeds 2 — proving: every OPN with smallest prime factor >= p0 has
 * omega(N) >= k. Each row of the output is a theorem, machine-proved with
 * exact arithmetic.
 *
 * Usage: node opn/omega-bounds.ts [maxP0]
 */
import { isPrimeBig } from "./sigma.ts";

function nextPrime(n: bigint): bigint {
  let p = n + 1n;
  if (p <= 2n) return 2n;
  if (p % 2n === 0n) p++;
  while (!isPrimeBig(p)) p += 2n;
  return p;
}

/**
 * Least k such that the k smallest primes >= p0 give prod p/(p-1) > 2,
 * compared exactly: num/den > 2  <=>  num > 2*den.
 */
export function minOmegaForSmallestPrime(p0: bigint): { k: number; primes: bigint[] } {
  let num = 1n;
  let den = 1n;
  const primes: bigint[] = [];
  let p = isPrimeBig(p0) ? p0 : nextPrime(p0 - 1n);
  while (num <= 2n * den) {
    primes.push(p);
    num *= p;
    den *= p - 1n;
    p = nextPrime(p);
  }
  return { k: primes.length, primes };
}

const isMain = process.argv[1] && process.argv[1].endsWith("omega-bounds.ts");
if (isMain) {
  const maxP0 = BigInt(process.argv[2] ?? "100");
  console.log("Machine-proved theorems (exact rational arithmetic):\n");
  console.log("If an odd perfect number N has smallest prime factor >= p0,");
  console.log("then N has at least k distinct prime factors, because k-1");
  console.log("primes starting at p0 cannot push sigma(N)/N up to 2.\n");
  console.log("  p0     k    primes whose product of p/(p-1) first exceeds 2");
  console.log("  -----  ---  --------------------------------------------------");
  for (let p0 = 3n; p0 <= maxP0; p0 = nextPrime(p0)) {
    const { k, primes } = minOmegaForSmallestPrime(p0);
    const list = primes.length <= 10 ? primes.join(", ") : `${primes.slice(0, 8).join(", ")}, ... (${primes.length} primes, up to ${primes[primes.length - 1]})`;
    console.log(`  ${p0.toString().padEnd(5)}  ${String(k).padEnd(3)}  ${list}`);
  }
  console.log("\nRow p0 = 3 recovers the classical fact omega(N) >= 3;");
  console.log("row p0 = 5 proves: an OPN not divisible by 3 has omega(N) >= 7.");
}
