/**
 * Core number theory for the odd perfect number (OPN) search.
 *
 * A number N is *perfect* when sigma(N) = 2N, where sigma is the sum of all
 * divisors of N. Every even perfect number is 2^(p-1) * (2^p - 1) with 2^p - 1
 * a Mersenne prime (Euclid-Euler). Whether an ODD perfect number exists is an
 * open problem, and the subject of everything in this folder.
 */

/** Smallest-prime-factor sieve: spf[n] = smallest prime dividing n (spf[1] = 1). */
export function spfSieve(limit: number): Uint32Array {
  const spf = new Uint32Array(limit + 1);
  for (let i = 2; i <= limit; i++) {
    if (spf[i] === 0) {
      for (let j = i; j <= limit; j += i) {
        if (spf[j] === 0) spf[j] = i;
      }
    }
  }
  spf[1] = 1;
  return spf;
}

/** Factor n using a precomputed SPF sieve. Returns [prime, exponent] pairs. */
export function factorizeWithSieve(n: number, spf: Uint32Array): Array<[number, number]> {
  const factors: Array<[number, number]> = [];
  while (n > 1) {
    const p = spf[n];
    let e = 0;
    while (n % p === 0) {
      n /= p;
      e++;
    }
    factors.push([p, e]);
  }
  return factors;
}

/** sigma(prime^exp) = 1 + p + p^2 + ... + p^exp, exactly, as a BigInt. */
export function sigmaPrimePower(p: bigint, exp: number): bigint {
  let term = 1n;
  let sum = 1n;
  for (let i = 0; i < exp; i++) {
    term *= p;
    sum += term;
  }
  return sum;
}

/** sigma(n^power) from the factorization of n (sigma is multiplicative). */
export function sigmaFromFactors(factors: Array<[number, number]>, power: number = 1): bigint {
  let result = 1n;
  for (const [p, e] of factors) {
    result *= sigmaPrimePower(BigInt(p), e * power);
  }
  return result;
}

export function gcdBig(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export function powMod(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    base = (base * base) % mod;
    exp >>= 1n;
  }
  return result;
}

/**
 * Deterministic Miller-Rabin. The base set [2..37] is proven sufficient for
 * every n < 3.3 * 10^24, far above anything we test here.
 */
export function isPrimeBig(n: bigint): boolean {
  if (n < 2n) return false;
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n;
  let r = 0n;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    r++;
  }
  for (const a of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    let x = powMod(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    let composite = true;
    for (let i = 1n; i < r; i++) {
      x = (x * x) % n;
      if (x === n - 1n) {
        composite = false;
        break;
      }
    }
    if (composite) return false;
  }
  return true;
}

/** Pollard's rho (Brent variant) for factoring numbers too big for a sieve. */
function pollardRho(n: bigint): bigint {
  if ((n & 1n) === 0n) return 2n;
  let c = 1n;
  while (true) {
    let x = 2n;
    let y = 2n;
    let d = 1n;
    while (d === 1n) {
      x = (x * x + c) % n;
      y = (y * y + c) % n;
      y = (y * y + c) % n;
      const diff = x > y ? x - y : y - x;
      d = gcdBig(diff, n);
    }
    if (d !== n) return d;
    c++;
  }
}

/** Full factorization of a BigInt via trial division + Pollard rho. */
export function factorizeBig(n: bigint): Array<[bigint, number]> {
  const counts = new Map<bigint, number>();
  const stack: bigint[] = [];
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n]) {
    while (n % p === 0n) {
      counts.set(p, (counts.get(p) ?? 0) + 1);
      n /= p;
    }
  }
  if (n > 1n) stack.push(n);
  while (stack.length > 0) {
    const v = stack.pop()!;
    if (v === 1n) continue;
    if (isPrimeBig(v)) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
      continue;
    }
    const d = pollardRho(v);
    stack.push(d, v / d);
  }
  return [...counts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/** sigma(n) for an arbitrary BigInt n, by factoring it. */
export function sigmaBig(n: bigint): bigint {
  if (n === 1n) return 1n;
  let result = 1n;
  for (const [p, e] of factorizeBig(n)) {
    result *= sigmaPrimePower(p, e);
  }
  return result;
}

/** Integer k-th root of a BigInt (floor). */
export function iroot(n: bigint, k: number): bigint {
  if (n < 2n) return n;
  const K = BigInt(k);
  // Newton iteration seeded from a float estimate.
  let x = BigInt(Math.max(1, Math.floor(Number(n) ** (1 / k))));
  while (true) {
    const xk = x ** (K - 1n);
    const next = ((K - 1n) * x + n / xk) / K;
    if (next >= x) break;
    x = next;
  }
  while (x ** K > n) x--;
  while ((x + 1n) ** K <= n) x++;
  return x;
}
