# The Odd Perfect Number Problem

> **Does there exist an odd number N with sigma(N) = 2N?**
> (sigma = sum of all divisors, so a perfect number equals the sum of its
> proper divisors: 6 = 1 + 2 + 3, 28 = 1 + 2 + 4 + 7 + 14, ...)

Open for ~2300 years — it goes back to Euclid, and Sylvester called it a
problem that "must have been present to the minds of mathematicians from the
earliest times." Nobody has found an odd perfect number, and nobody has proved
one cannot exist. This folder is a working toolkit that (a) re-derives the
strongest *computational* style of evidence from scratch, (b) demonstrates the
central obstruction to a proof, and (c) lays out concrete next steps.

## What is in this folder

| File | What it does |
|---|---|
| `sigma.ts` | Exact BigInt number theory: sigma, SPF sieve, Miller–Rabin, Pollard rho, integer roots |
| `euler-sieve.ts` | **The main engine.** A complete search for OPNs indexed by their square part (see below) |
| `brute.ts` | Assumption-free cross-check: sieves sigma(n) for every n up to a bound |
| `constraints.ts` | Tests any candidate against the strongest published necessary conditions |
| `omega-bounds.ts` | Machine-proves (exact rationals) lower bounds on omega(N) by smallest prime factor |
| `test.ts` | Test suite (`npm test`) |

## The engine: searching by square part

Euler proved every odd perfect number must factor as

```
N = q^k * m^2      q prime,  q ≡ 1 (mod 4),  k ≡ 1 (mod 4),  q ∤ m
```

(q^k is called the *Euler factor*.) Since sigma is multiplicative,
sigma(N) = 2N forces

```
sigma(q^k) / q^k  =  2 m^2 / sigma(m^2)
```

The key observation making a complete search possible: the left-hand fraction
is **already in lowest terms** (q cannot divide sigma(q^k) = 1 + q + ... + q^k,
which is ≡ 1 mod q). So once m is fixed, reduce 2m^2/sigma(m^2) to lowest
terms A/B — then the *only* candidate Euler factor is q^k = B with
sigma(q^k) = A. One odd m, one O(1) verdict, no search over q or k at all.

Consequences of a clean scan of all odd m ≤ M:

1. No odd perfect number has square part m^2 with m ≤ M — for *any* Euler
   factor, of any size.
2. Since N = q^k m^2 > m^2, every odd perfect number exceeds M^2.

Results obtained by this code (reproduce with the commands shown; timings
from the run on 2026-08-19 that produced these claims):

- `npm test` — sanity: sigma is exact, the brute sieve finds exactly
  6, 28, 496, 8128 below 10^6, and the engine rediscovers Descartes' spoof.
- `node opn/brute.ts --max 10000000` (2.8s) — **no odd perfect number below
  10^7**, verified directly from the definition with no theory assumed.
- `node opn/euler-sieve.ts --spoof --max 10000000` (187s, 5 * 10^6 square
  parts scanned, every possible Euler factor decided for each) —
  **no odd perfect number has square part m^2 with m ≤ 10^7**, hence any OPN
  exceeds 10^14. (The published record is far stronger — see below — but
  this is independently re-verified here, from scratch, in minutes.)
  Striking side result: across the whole scan there was **exactly one hit of
  any kind — Descartes' 1638 spoof** at m = 3003. No other number even
  *pretends* to be an odd perfect number in this range: Descartes-style
  spoofs with a single fake prime are that rare.
- `node opn/omega-bounds.ts` — a table of machine-proved theorems via exact
  rational arithmetic, e.g. **an OPN not divisible by 3 has at least 7
  distinct prime factors**; one with smallest prime factor ≥ 13 has at
  least 41; smallest prime ≥ 59 forces at least 509 distinct primes. (Row 1
  reproduces the classical omega ≥ 3.)

## The obstruction: Descartes spoofs

In 1638 Descartes noticed that

```
D = 3^2 * 7^2 * 11^2 * 13^2 * 22021 = 198585576189
```

would be an odd perfect number **if 22021 were prime** (it is 19^2 * 61).
Treating 22021 as a formal prime, the sigma product comes out to exactly 2D.
Run `node opn/euler-sieve.ts --spoof --max 5000` and the engine rediscovers
this at m = 3003: the forced Euler factor B = 22021 arrives with
A = B + 1 = 22022, i.e. "perfect if prime."

Why this matters strategically: the spoof satisfies the multiplicative
structure of the problem perfectly. **Any disproof of odd perfect numbers must
somewhere use the actual primality of the Euler factor** — no argument built
purely from the sigma-product bookkeeping can succeed, because Descartes'
example satisfies all that bookkeeping. (Voight found a spoof with a negative
"prime," 2^2 * 3^2 * 7^2 * 5 * (-19)... family; a 2022 BYU group computation
enumerated all spoofs with bounded shape — they are rare, which is itself
weak evidence that genuine OPNs do not exist.)

## Known necessary conditions (all checked by `constraints.ts`)

Any odd perfect number N must satisfy at least:

- **Euler form**: N = q^k m^2, q ≡ k ≡ 1 (mod 4), q ∤ m.
- **Touchard 1953**: N ≡ 1 (mod 12) or N ≡ 9 (mod 36).
- **Classical**: 105 ∤ N.
- **Ochem & Rao 2012**: N > 10^1500, and Omega(N) ≥ 101 (prime factors with
  multiplicity).
- **Nielsen 2015**: omega(N) ≥ 10 (distinct prime factors); also
  N < 2^(4^omega(N)) (Nielsen 2003), so bounding omega bounds N.
- **Goto & Ohno 2008**: largest prime factor > 10^8.
- **Iannucci 1999/2000**: second largest > 10^4, third largest > 10^2.

The tension between these is the modern attack: lower bounds on N and on
omega(N) rise (computation), while N < 2^(4^omega) caps how much room is left
for each omega. If a proof ever shows omega(N) ≤ C for some absolute C, a
finite computation finishes the problem.

## Roadmap — concrete next steps, in increasing ambition

1. **Push the sieve.** The Euler-form sieve here is O(M log M)-ish and
   embarrassingly parallel in m. Segmenting the SPF sieve and sharding m
   across workers would reach m ≤ 10^9 on one machine — an
   independently-verified N > 10^18 with this exact code. (Not competitive
   with Ochem–Rao's 10^1500, but the *method* here, factor-chain elimination,
   is a small version of theirs.)
2. **Implement factor chains (the Ochem–Rao method).** Assume a smallest
   prime; the abundancy requirement sigma(N)/N = 2 forces new primes into N
   via sigma(p^e) | 2N; branch on those, with interval arithmetic pruning
   branches whose abundancy cannot reach 2. This is a tree search that this
   toolkit's primitives (exact sigma, primality, factoring) already support.
   It is how every modern bound (10^300 → 10^1500) was actually proven.
3. **Abundancy outlaws.** N is perfect iff sigma(N)/N = 2. Study which
   rationals are "abundancy outlaws" (values sigma(n)/n never takes). If 2
   restricted to odds were shown to be an outlaw, done. Partial results
   exist for families like (2k+1)/k; the machinery in `sigma.ts` can
   computationally map outlaw families.
4. **Spoof classification.** Extend the BYU-style spoof enumeration: every
   new spoof constrains what a disproof can look like, and a proof that
   spoofs with > C factors cannot exist would combine with omega bounds.
5. **The Dris direction.** Dris conjectured q^k < m for the Euler factor;
   results relating q^k and m sharpen the sieve in (1) — e.g. any proven
   bound q^k < f(m) would let the sieve certify larger N-free regions per m.

## Honest status

No odd perfect number was found (expected — the smallest is provably beyond
10^1500 digits-wise... more precisely it exceeds 10^1500). No disproof either:
that remains one of the oldest open problems in mathematics. What exists here
is a correct, tested, reproducible framework that re-derives the classical
computational results, exhibits the spoof obstruction concretely, and points
at the factor-chain method as the next real step.
