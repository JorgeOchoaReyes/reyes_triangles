/**
 * The Euler-form sieve: a COMPLETE search for odd perfect numbers by their
 * square part.
 *
 * Euler proved that any odd perfect number must have the shape
 *
 *     N = q^k * m^2,   q prime,  q ≡ 1 (mod 4),  k ≡ 1 (mod 4),  q ∤ m.
 *
 * Because sigma is multiplicative, sigma(N) = 2N forces
 *
 *     sigma(q^k) / q^k = 2 m^2 / sigma(m^2).
 *
 * The left side is already in lowest terms (q never divides sigma(q^k)), so
 * for a FIXED m the Euler factor is not free: writing 2m^2 / sigma(m^2) in
 * lowest terms as A / B, the only possibility is q^k = B and sigma(q^k) = A.
 *
 * So each odd m admits AT MOST ONE Euler factor, and it is computable in
 * O(1) after factoring m. Scanning all odd m ≤ M therefore decides, with
 * proof, that no odd perfect number has square part m^2 with m ≤ M — which
 * also proves every odd perfect number exceeds M^2, since N > m^2.
 *
 * The same machinery finds Descartes "spoofs": numbers that would be perfect
 * if one composite factor were treated as prime (i.e. A = B + 1 with B
 * composite). Descartes' 1638 example 3^2 * 7^2 * 11^2 * 13^2 * 22021 shows
 * that the perfect-number equation alone cannot rule these out — any proof
 * that OPNs don't exist must genuinely use the primality of q.
 *
 * Usage:
 *   node opn/euler-sieve.ts [--max M] [--spoof]
 */
import {
  spfSieve,
  factorizeWithSieve,
  sigmaFromFactors,
  gcdBig,
  isPrimeBig,
  sigmaPrimePower,
  iroot,
} from "./sigma.ts";

interface Hit {
  m: number;
  eulerFactor: bigint;
  kind: "PERFECT" | "SPOOF";
  note: string;
}

export function eulerSieve(maxM: number, findSpoofs: boolean): Hit[] {
  const hits: Hit[] = [];
  const spf = spfSieve(maxM);
  const started = Date.now();

  for (let m = 3; m <= maxM; m += 2) {
    const factors = factorizeWithSieve(m, spf);
    const mBig = BigInt(m);
    const twoMSq = 2n * mBig * mBig;
    const sigmaMSq = sigmaFromFactors(factors, 2);

    // The Euler factor must satisfy sigma(q^k)/q^k = A/B > 1, so m^2 must be
    // deficient. If it isn't, this m is impossible.
    if (sigmaMSq >= twoMSq) continue;

    const g = gcdBig(twoMSq, sigmaMSq);
    const A = twoMSq / g; // forced value of sigma(q^k)
    const B = sigmaMSq / g; // forced value of q^k
    if (B === 1n) continue; // q^k = 1 is impossible

    // Case k = 1: sigma(q) = q + 1, so A must be exactly B + 1.
    if (A === B + 1n) {
      if (gcdBig(B, mBig) !== 1n) continue; // Euler factor must be coprime to m
      if (isPrimeBig(B)) {
        // A genuine odd perfect number. (Euler's theorem then guarantees
        // B ≡ 1 mod 4 automatically; we record it for verification.)
        hits.push({
          m,
          eulerFactor: B,
          kind: "PERFECT",
          note: `N = ${B} * ${m}^2 is an ODD PERFECT NUMBER (q mod 4 = ${B % 4n})`,
        });
      } else if (findSpoofs && (B & 1n) === 1n) {
        hits.push({
          m,
          eulerFactor: B,
          kind: "SPOOF",
          note: `N = ${B} * ${m}^2 = ${B * mBig * mBig} is perfect IF ${B} were prime (Descartes spoof)`,
        });
      }
      continue;
    }

    // Case k >= 2: B must be a perfect prime power q^k with
    // sigma(q^k) = A. Try every possible exponent.
    if (A > B) {
      const maxK = B < 9n ? 2 : Math.ceil(Number(B).toString(2).length / 1.5);
      for (let k = 2; ; k++) {
        const q = iroot(B, k);
        if (q < 3n) break;
        if (q ** BigInt(k) === B && isPrimeBig(q) && gcdBig(q, mBig) === 1n) {
          if (sigmaPrimePower(q, k) === A) {
            hits.push({
              m,
              eulerFactor: B,
              kind: "PERFECT",
              note: `N = ${q}^${k} * ${m}^2 is an ODD PERFECT NUMBER`,
            });
          }
        }
        if (k > maxK) break;
      }
    }
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`scanned all odd m <= ${maxM} in ${secs}s`);
  return hits;
}

const isMain = process.argv[1] && process.argv[1].endsWith("euler-sieve.ts");
if (isMain) {
  const args = process.argv.slice(2);
  const maxIdx = args.indexOf("--max");
  const maxM = maxIdx >= 0 ? Number(args[maxIdx + 1]) : 10_000_000;
  const findSpoofs = args.includes("--spoof");

  console.log(`Euler-form sieve: testing every odd m <= ${maxM}${findSpoofs ? " (spoof mode)" : ""}`);
  console.log(`For each m this decides ALL possible Euler factors q^k at once.\n`);

  const hits = eulerSieve(maxM, findSpoofs);
  if (hits.length === 0) {
    console.log(`\nRESULT: no odd perfect number has square part m^2 with m <= ${maxM}.`);
    console.log(`Consequence: any odd perfect number N = q^k * m^2 must have m > ${maxM},`);
    console.log(`hence N > ${maxM}^2 = ${BigInt(maxM) ** 2n}.`);
  } else {
    console.log(`\nRESULT: ${hits.length} hit(s):`);
    for (const h of hits) {
      console.log(`  [${h.kind}] m = ${h.m}: ${h.note}`);
    }
  }
}
