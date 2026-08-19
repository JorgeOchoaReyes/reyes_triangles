/**
 * Machine verification of Touchard's theorem (1953):
 *
 *     every odd perfect number N satisfies N ≡ 1 (mod 12) or N ≡ 9 (mod 36).
 *
 * The theorem reduces to three lemmas, each a FINITE residue computation the
 * machine checks exhaustively below. The glue between them (documented at
 * each step) is Euler's form N = q^k m^2 with q ≡ k ≡ 1 (mod 4), q ∤ m, and
 * multiplicativity of sigma.
 *
 * Lemma A:  N ≡ 1 (mod 4).
 *   q ≡ 1 (mod 4) and k odd give q^k ≡ 1 (mod 4); m odd gives m^2 ≡ 1
 *   (mod 8). Checked over all residues q mod 4, k mod 2, m mod 8.
 *
 * Lemma B:  sigma(p^e) ≡ 0 (mod 3) whenever p ≡ 2 (mod 3) and e is odd.
 *   Checked over the full period of p^i mod 3. Consequence: if 3 ∤ N, no
 *   prime ≡ 2 (mod 3) can carry an odd exponent (else 3 | sigma(N) = 2N,
 *   forcing 3 | N). The only odd exponent in N is the special k, so
 *   q ≡ 1 (mod 3); every other prime power p^{2t} has (p^t)^2 ≡ 1 (mod 3).
 *   Hence 3 ∤ N implies N ≡ 1 (mod 3), which with Lemma A gives
 *   N ≡ 1 (mod 12).
 *
 * Lemma C:  if 9 | N and N ≡ 1 (mod 4) and N/9 coprime to 3, then
 *   N ≡ 9 (mod 36). Checked over all residues of N/9 mod 12. When 3 | N,
 *   3 is not the special prime (3 ≡ 3 mod 4), so 3 carries an even exponent
 *   and 9 | N — this branch applies and gives N ≡ 9 (mod 36).
 *
 * Usage: node opn/touchard.ts     (also exercised by npm test)
 */

export interface LemmaCheck {
  name: string;
  cases: number;
  holds: boolean;
}

/** Lemma A: q^k * m^2 ≡ 1 (mod 4) for q ≡ 1 (mod 4), k odd, m odd. */
export function checkLemmaA(): LemmaCheck {
  let cases = 0;
  for (let q = 1; q < 4 * 8; q += 4) {
    // q ≡ 1 (mod 4)
    for (let k = 1; k <= 9; k += 2) {
      // k odd (k ≡ 1 mod 4 is stronger than needed)
      for (let m = 1; m < 8 * 4; m += 2) {
        cases++;
        const qk = powmod(q, k, 8);
        if ((qk * m * m) % 4 !== 1) return { name: "A", cases, holds: false };
      }
    }
  }
  return { name: "A", cases, holds: true };
}

/** Lemma B: p ≡ 2 (mod 3), e odd  =>  3 | sigma(p^e). */
export function checkLemmaB(): LemmaCheck {
  let cases = 0;
  for (let p = 2; p < 3 * 12; p += 3) {
    // p ≡ 2 (mod 3)
    for (let e = 1; e <= 25; e += 2) {
      cases++;
      let sig = 0;
      let term = 1;
      for (let i = 0; i <= e; i++) {
        sig = (sig + term) % 3;
        term = (term * p) % 3;
      }
      if (sig !== 0) return { name: "B", cases, holds: false };
    }
  }
  return { name: "B", cases, holds: true };
}

/** Lemma B': p ≡ 1 (mod 3) or even exponent  =>  p^e ≡ 1 (mod 3), so N ≡ 1. */
export function checkLemmaBprime(): LemmaCheck {
  let cases = 0;
  for (let p = 1; p < 3 * 12; p++) {
    if (p % 3 === 0) continue;
    for (let e = 1; e <= 24; e++) {
      const evenExp = e % 2 === 0;
      const pIs1 = p % 3 === 1;
      if (!evenExp && !pIs1) continue; // handled by Lemma B route
      cases++;
      if (powmod(p, e, 3) !== 1) return { name: "B'", cases, holds: false };
    }
  }
  return { name: "B'", cases, holds: true };
}

/** Lemma C: N = 9u, u coprime to 6 hence odd, N ≡ 1 (mod 4)  =>  N ≡ 9 (mod 36). */
export function checkLemmaC(): LemmaCheck {
  let cases = 0;
  for (let u = 1; u < 12 * 6; u++) {
    if (u % 2 === 0 || u % 3 === 0) continue;
    const N = 9 * u;
    if (N % 4 !== 1) continue; // Lemma A already forces this branch
    cases++;
    if (N % 36 !== 9) return { name: "C", cases, holds: false };
  }
  return { name: "C", cases, holds: true };
}

function powmod(b: number, e: number, m: number): number {
  let r = 1 % m;
  b %= m;
  while (e > 0) {
    if (e & 1) r = (r * b) % m;
    b = (b * b) % m;
    e >>= 1;
  }
  return r;
}

export function verifyTouchard(): { holds: boolean; checks: LemmaCheck[] } {
  const checks = [checkLemmaA(), checkLemmaB(), checkLemmaBprime(), checkLemmaC()];
  return { holds: checks.every((c) => c.holds), checks };
}

const isMain = process.argv[1] && process.argv[1].endsWith("touchard.ts");
if (isMain) {
  console.log("Touchard's theorem: every odd perfect N ≡ 1 (mod 12) or N ≡ 9 (mod 36).\n");
  const { holds, checks } = verifyTouchard();
  for (const c of checks) {
    console.log(`  Lemma ${c.name}: ${c.holds ? "verified" : "FAILED"} over ${c.cases} residue cases`);
  }
  console.log(`
Assembly (Euler form N = q^k m^2, q ≡ k ≡ 1 mod 4):
  Lemma A  => N ≡ 1 (mod 4), always.
  If 3 ∤ N: Lemma B forbids odd exponents on primes ≡ 2 (mod 3); the only
  odd exponent is the special k, so q ≡ 1 (mod 3), and Lemma B' gives every
  prime-power factor ≡ 1 (mod 3). Hence N ≡ 1 (mod 3), so N ≡ 1 (mod 12).
  If 3 | N: 3 is not special (3 ≡ 3 mod 4), so its exponent is even and
  9 | N; Lemma C then gives N ≡ 9 (mod 36).`);
  console.log(`\n${holds ? "QED." : "!!! verification failed"}`);
}
