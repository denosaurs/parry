# parry

[![Tags](https://img.shields.io/github/release/denosaurs/parry)](https://github.com/denosaurs/parry/releases)
[![CI Status](https://img.shields.io/github/workflow/status/denosaurs/parry/check)](https://github.com/denosaurs/parry/actions)
[![Dependencies](https://img.shields.io/github/workflow/status/denosaurs/parry/depsbot?label=dependencies)](https://github.com/denosaurs/depsbot)
[![License](https://img.shields.io/github/license/denosaurs/parry)](https://github.com/denosaurs/parry/blob/master/LICENSE)

---

> ⚠️ This project is a working project. Expect breaking changes.

---

A simple way of running functions in their own Worker that works with
[deno](https://deno.land/).

## Usage

The following function will run in it's own Worker, enabling threading and
therefor not blocking the main event loop. This becomes very useful for
parallelization of certain computations or just a way of running a function and
not blocking the main event loop while it runs. It is required to use the
`--allow-read` flag for it to work due to an external js file being loaded in as
the worker. If you want the `Deno` object to be avalible in the worker the
`--unstable` flag is required. Permissions inside the workers are inherited and
imports need to be dynamic.

```ts
import { parry } from "https://deno.land/x/parry/mod.ts";

async function countSerial(limit: number): Promise<void> {
  for (let i = 0; i < limit; i++) {}
}

console.time("4x CountSerial");
await Promise.all([
  countSerial(1e9),
  countSerial(1e9),
  countSerial(1e9),
  countSerial(1e9),
]);
console.timeEnd("4x CountSerial");

const threads = [
  parry(countSerial),
  parry(countSerial),
  parry(countSerial),
  parry(countSerial),
];

console.time("4x CountParallel");
await Promise.all([
  threads[0](1e9),
  threads[1](1e9),
  threads[2](1e9),
  threads[3](1e9),
]);
console.timeEnd("4x CountParallel");

parry.close();
```

The parallelized version is as expected 4x faster than the serial version of the
count function:

```
4x CountSerial: 1885ms
4x CountParallel: 509ms
```
