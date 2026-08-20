# The Odd Perfect Ledger

*Research report, 2026-08-19 — what a session of machine proof accomplished
against the oldest open problem in mathematics, and exactly where the wall
is. Styled version: <https://claude.ai/code/artifact/4c3a2362-e20b-43af-a13a-465cb8911ff6>.*

A number is **perfect** when it equals the sum of its proper divisors:
6 = 1+2+3, 28 = 1+2+4+7+14. Every even perfect number was characterized by
Euclid and Euler. Whether an **odd** one exists has been open for roughly
2,300 years. Nobody found one tonight — the smallest, if it exists, is known
to exceed 10^1500 — but this repository now contains a toolkit that
re-derives the classical impossibility results from scratch, with proofs a
machine checks end to end, plus verified searches of its own. Everything
below reruns from `npm run` scripts.

## Theorems proved by the code

| # | Statement | Engine | Evidence |
|---|---|---|---|
| T1 | Every odd perfect number has **at least 5 distinct prime factors** (Sylvester 1888 tier) | `omega-n-prover.ts` | 0.2 s; sole surviving support {3,5,11,137}, killed by factor chains |
| T2 | Every odd perfect number has a **prime factor > 5000** | `smooth-prover.ts` | 11,609,331,208 nodes, 329 viable Euler primes, 52 min |
| T3 | Any odd perfect number **exceeds 1.25 × 10^16** | `euler-sieve.ts` | all 2.5 × 10^7 square parts m ≤ 5×10^7 decided, 1078 s |
| T4 | Every odd perfect number is **≡ 1 (mod 12) or ≡ 9 (mod 36)** (Touchard 1953) | `touchard.ts` | three finite residue lemmas verified exhaustively |
| L1 | **No odd perfect number is divisible by 3·5·7** | `omega5-prover.ts` | exact rational casework, no search needed |

## The identity that powers the searches

Sigma is multiplicative and sigma(q^k) is always coprime to q^k, so for a
fixed square part the perfect-number equation admits no freedom at all:

```
sigma(q^k) / q^k  =  2m^2 / sigma(m^2)      (already in lowest terms)
```

Reduce the right side to A/B and the only possible Euler factor is q^k = B
with sigma(q^k) = A. One odd m, one O(1) verdict, every q and k decided
simultaneously.

The second engine inverts the direction: fix a finite set of allowed primes
and every sigma(p^e) must factor over that set, while the
lifting-the-exponent lemma bounds sigma(p^e) ≤ C_p·(e+1) — against its
exponential growth, an explicit cap on e. Finite lists, exact BigInt
products, complete search. The third engine wraps both in exact interval
arithmetic so even *unknown* primes get cornered: at every leaf the unknown
prime's envelope must meet a window the known primes have already squeezed,
which bounds it explicitly. The prover throws rather than truncates if a
leaf ever fails to bound a prime — a completed run is a complete proof.

## The one impostor in 25 million

The full sieve of every square part up to 5×10^7 produced exactly one hit of
any kind: Descartes' 1638 example

```
198585576189 = 3^2 · 7^2 · 11^2 · 13^2 · 22021
```

which would be perfect *if 22021 were prime* (it is 19^2 · 61). Nothing else
in the space even pretends. Strategically this is the heart of the problem:
the spoof satisfies every multiplicative constraint, so any proof that odd
perfect numbers don't exist must genuinely use the *primality* of the Euler
factor. Pure sigma-bookkeeping can never close the question.

## Where tonight sits in 200 years of omega-bounds

| Bound | First proved | Tonight, by machine |
|---|---|---|
| omega ≥ 3 | classical | 2 search nodes |
| **omega ≥ 4** | Peirce, 1832 | **proved, 0.1 s** |
| **omega ≥ 5** | Sylvester, 1888 | **proved, 0.2 s** |
| **omega ≥ 6** | Gradstein, 1925 | **proved, 86 min** — 15,328 supports decided, largest prime 80,407 |
| omega ≥ 8 | Chein / Hagis, 1979–80 | — |
| omega ≥ 10 | Nielsen, 2015 | — |

For honest scale: the published lower bound on the number itself is 10^1500
(Ochem–Rao 2012) against tonight's independently verified 1.25×10^16; the
published largest-prime-factor bound is 10^8 (Goto–Ohno 2008) against
tonight's 5000. Those records rest on decades of specialized machinery — the
point here is that a few hundred lines of readable TypeScript, written and
verified in one session, now climb the same ladder with proofs you can rerun.

## The wall, precisely located

Pushing to omega ≥ 6 and beyond, the window method keeps working until
certain branches bottom out in *exponential Diophantine* conditions — for
example, a branch survives only if sigma(3^a) = (3^{a+1}−1)/2 is a pure
prime power for unboundedly many a. These are exactly the sub-problems where
the classical proofs turned hard, now isolated as concrete, attackable
statements. Next moves, in order of ambition: push omega ≥ 7 (running);
parallelize the smooth prover toward a 10^4 prime-factor bound; attack the
Diophantine walls with covering congruences.

---

All results verified by the test suite (`npm test`), including adversarial
validations — engines are required to find the genuine perfect numbers
before being trusted to rule out odd ones. Full derivations, references, and
reproduction commands: [`RESEARCH.md`](RESEARCH.md). The problem itself
remains open — this ledger records steps, honestly labeled.
