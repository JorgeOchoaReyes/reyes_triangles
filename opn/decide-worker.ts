/**
 * Worker for omega-n-prover: receives batches of candidate supports (arrays
 * of odd primes) and decides each with the factor-chain prover. Posts back
 * {nodes, bad} where bad lists any support that admitted a perfect number
 * (never happens unless mathematics is in trouble — but it is checked).
 */
import { parentPort } from "node:worker_threads";
import { proveSmoothForPrimes } from "./smooth-prover.ts";

parentPort!.on("message", (batch: number[][]) => {
  let nodes = 0;
  const bad: string[] = [];
  for (const sup of batch) {
    const r = proveSmoothForPrimes(sup, "odd", undefined, true);
    nodes += r.nodes;
    if (r.solutions.length > 0) bad.push(`{${sup.join(",")}}: ${r.solutions.join(", ")}`);
  }
  parentPort!.postMessage({ nodes, bad, count: batch.length });
});
