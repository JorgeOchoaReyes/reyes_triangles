/**
 * Brute-force perfect number search: sieve sigma(n) for every n up to a bound
 * and report each n with sigma(n) = 2n. This is the slow, assumption-free
 * cross-check for the Euler-form sieve — it should find exactly the even
 * perfect numbers (6, 28, 496, 8128, 33550336, ...) and no odd ones.
 *
 * Usage: node opn/brute.ts [--max N]
 */

export function bruteForcePerfect(limit: number): number[] {
  // sigma[n] accumulated by adding every d to all of its multiples.
  // Values stay far below 2^53, so a Float64Array is exact.
  const sigma = new Float64Array(limit + 1);
  for (let d = 1; d <= limit; d++) {
    for (let j = d; j <= limit; j += d) {
      sigma[j] += d;
    }
  }
  const perfect: number[] = [];
  for (let n = 2; n <= limit; n++) {
    if (sigma[n] === 2 * n) perfect.push(n);
  }
  return perfect;
}

const isMain = process.argv[1] && process.argv[1].endsWith("brute.ts");
if (isMain) {
  const args = process.argv.slice(2);
  const maxIdx = args.indexOf("--max");
  const limit = maxIdx >= 0 ? Number(args[maxIdx + 1]) : 10_000_000;

  console.log(`Brute-force sigma sieve up to ${limit}...`);
  const started = Date.now();
  const perfect = bruteForcePerfect(limit);
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`done in ${secs}s. Perfect numbers found: ${perfect.join(", ")}`);
  const odd = perfect.filter((n) => n % 2 === 1);
  console.log(
    odd.length === 0
      ? `RESULT: no odd perfect number exists below ${limit} (direct verification).`
      : `!!! ODD PERFECT NUMBER(S) FOUND: ${odd.join(", ")}`
  );
}
