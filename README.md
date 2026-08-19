# Reyes Triangles

## Run Locally

- Choose a desired degree `power`
- Choose the number of initial terms for `n`

```bash
npm install

npm run dev

```

*note that if you don't include enough `n` for the `power` to reach zero the program will not terminate

## Examples

 ```
0   1   8  27  64  125  216  343  512  
  7  19  37  61  91  127   169  217
   12  18  24  30  36   42   48
     6   6   6   6   6    6
       0   0   0   0   0  
```

## Odd Perfect Numbers (`opn/`)

A toolkit attacking the odd perfect number problem — the oldest open problem
in mathematics. See [`opn/RESEARCH.md`](opn/RESEARCH.md) for the write-up.
Requires Node ≥ 22.18 (runs TypeScript natively).

```bash
npm test              # test suite
npm run opn:brute     # brute-force perfect number search (default 10^7)
npm run opn:euler     # complete Euler-form sieve by square part (default 10^7)
npm run opn:spoof     # same sieve, also reporting Descartes spoofs
npm run opn:check     # constraint report for a candidate (default: Descartes' spoof)
npm run opn:omega     # machine-proved omega(N) lower bounds by smallest prime factor
```
