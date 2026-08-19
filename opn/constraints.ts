/**
 * Constraint analyzer: test any candidate N against the definition of
 * perfection AND against the strongest published necessary conditions for an
 * odd perfect number. Useful for triaging any candidate a search produces,
 * and as an executable survey of the state of the art.
 *
 * Usage: node opn/constraints.ts <N>
 *        node opn/constraints.ts            (demos on Descartes' spoof)
 */
import { factorizeBig, sigmaPrimePower, gcdBig } from "./sigma.ts";

export interface Report {
  n: bigint;
  factorization: string;
  sigma: bigint;
  isPerfect: boolean;
  checks: Array<{ name: string; source: string; passed: boolean; detail: string }>;
}

export function analyzeCandidate(n: bigint): Report {
  const factors = factorizeBig(n);
  const factorization = factors.map(([p, e]) => (e === 1 ? `${p}` : `${p}^${e}`)).join(" * ");
  let sigma = 1n;
  for (const [p, e] of factors) sigma *= sigmaPrimePower(p, e);

  const checks: Report["checks"] = [];
  const add = (name: string, source: string, passed: boolean, detail: string) =>
    checks.push({ name, source, passed, detail });

  add("N is odd", "definition of the problem", n % 2n === 1n, `N mod 2 = ${n % 2n}`);

  add(
    "sigma(N) = 2N",
    "definition of perfect",
    sigma === 2n * n,
    `sigma(N) = ${sigma}, 2N = ${2n * n}, sigma(N) - 2N = ${sigma - 2n * n}`
  );

  // Euler (posthumous, 1849): N = q^k * m^2 with q ≡ k ≡ 1 (mod 4), q ∤ m.
  const oddExp = factors.filter(([, e]) => e % 2 === 1);
  const eulerOk =
    oddExp.length === 1 && oddExp[0][0] % 4n === 1n && oddExp[0][1] % 4 === 1;
  add(
    "Euler form q^k * m^2, q ≡ k ≡ 1 (mod 4)",
    "Euler",
    eulerOk,
    oddExp.length === 1
      ? `special prime q = ${oddExp[0][0]} (q mod 4 = ${oddExp[0][0] % 4n}), k = ${oddExp[0][1]}`
      : `${oddExp.length} primes with odd exponent (need exactly 1)`
  );

  add(
    "N ≡ 1 (mod 12) or N ≡ 9 (mod 36)",
    "Touchard 1953",
    n % 12n === 1n || n % 36n === 9n,
    `N mod 12 = ${n % 12n}, N mod 36 = ${n % 36n}`
  );

  add(
    "105 does not divide N",
    "classical (via the Euler form)",
    n % 105n !== 0n,
    `N mod 105 = ${n % 105n}`
  );

  add(
    "N > 10^1500",
    "Ochem & Rao 2012",
    n > 10n ** 1500n,
    `N has ${n.toString().length} digits (need > 1500)`
  );

  add(
    "at least 10 distinct prime factors",
    "Nielsen 2015",
    factors.length >= 10,
    `omega(N) = ${factors.length}`
  );

  const bigOmega = factors.reduce((acc, [, e]) => acc + e, 0);
  add(
    "at least 101 prime factors with multiplicity",
    "Ochem & Rao 2012",
    bigOmega >= 101,
    `Omega(N) = ${bigOmega}`
  );

  const sorted = [...factors].sort((a, b) => (a[0] > b[0] ? -1 : 1));
  add(
    "largest prime factor > 10^8",
    "Goto & Ohno 2008",
    sorted.length > 0 && sorted[0][0] > 100_000_000n,
    `largest prime factor = ${sorted[0]?.[0] ?? "-"}`
  );
  add(
    "second largest prime factor > 10^4",
    "Iannucci 1999",
    sorted.length > 1 && sorted[1][0] > 10_000n,
    `second largest = ${sorted[1]?.[0] ?? "-"}`
  );
  add(
    "third largest prime factor > 10^2",
    "Iannucci 2000",
    sorted.length > 2 && sorted[2][0] > 100n,
    `third largest = ${sorted[2]?.[0] ?? "-"}`
  );

  return { n, factorization, sigma, isPerfect: sigma === 2n * n, checks };
}

export function printReport(r: Report): void {
  console.log(`N = ${r.n}`);
  console.log(`  = ${r.factorization}`);
  console.log(`sigma(N) = ${r.sigma}${r.isPerfect ? "  -> PERFECT" : ""}`);
  console.log("");
  for (const c of r.checks) {
    console.log(`  [${c.passed ? "pass" : "FAIL"}] ${c.name}  (${c.source})`);
    console.log(`         ${c.detail}`);
  }
  const failed = r.checks.filter((c) => !c.passed).length;
  console.log(`\n${failed === 0 ? "All checks pass." : `${failed} check(s) failed.`}`);
}

const isMain = process.argv[1] && process.argv[1].endsWith("constraints.ts");
if (isMain) {
  const arg = process.argv[2];
  if (arg) {
    printReport(analyzeCandidate(BigInt(arg)));
  } else {
    console.log("No candidate given; analyzing Descartes' 1638 spoof as a demo.\n");
    const descartes = 3n ** 2n * 7n ** 2n * 11n ** 2n * 13n ** 2n * 22021n;
    printReport(analyzeCandidate(descartes));
    console.log(
      "\nNote: 22021 = 19^2 * 61. If 22021 WERE prime, sigma(N) would come out to" +
        "\nexactly 2N — the spoof satisfies every constraint that doesn't inspect" +
        "\nthe primality of the Euler factor. gcd sanity: gcd(22021, 3*7*11*13) = " +
        gcdBig(22021n, 3n * 7n * 11n * 13n)
    );
  }
}
