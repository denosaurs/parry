import { test } from "https://deno.land/x/std/testing/mod.ts";
import { assert, assertEquals } from "https://deno.land/std/testing/asserts.ts";

import parry from "./mod.ts";

test(function returnsAsyncFunctionFromSyncFunction() {
    const f = parry(() => { return; });

    assertEquals(typeof f, "function");
    assert(f() instanceof Promise);
});

test(function returnsAsyncFunctionFromAsyncFunction() {
    const f = parry(async () => { return; });

    assertEquals(typeof f, "function");
    assert(f() instanceof Promise);
});

test(async function returnsPromise() {
    const f = parry((a) => { return a; });
    const r = f(1);

    assert(r instanceof Promise);
    assertEquals(await r, 1);
});


test(async function invokesSyncFunction() {
    const f = parry((a) => { return a; });
    const r = await f(1);

    assertEquals(r, 1);
});

test(async function invokesAsyncFunction() {
    const f = parry(async (a) => { return a; });
    const r = await f(1);

    assertEquals(r, 1);
});

test(async function forwardsArguments() {
    const f = parry((a, b, c, d, e, f) => { return [a, b, c, d, e, f]; });
    const r = await f(1, 2, 3, 4, 5, 6);

    assertEquals(r, [1, 2, 3, 4, 5, 6]);
});

test(async function multipleWorksInParallel() {
    const f1 = parry((a, b, c, d, e, f) => { return [a, b, c, d, e, f]; });
    const f2 = parry((a, b, c, d, e, f) => { return [f, a, b, c, d, e]; });
    const f3 = parry((a, b, c, d, e, f) => { return [e, f, a, b, c, d]; });

    const a1 = f1(1, 2, 3, 4, 5, 6);
    const a2 = f2(1, 2, 3, 4, 5, 6);
    const a3 = f3(1, 2, 3, 4, 5, 6);

    const [r1, r2, r3] = await Promise.all([a1, a2, a3]);

    assertEquals(r1, [1, 2, 3, 4, 5, 6]);
    assertEquals(r2, [6, 1, 2, 3, 4, 5]);
    assertEquals(r3, [5, 6, 1, 2, 3, 4]);
});

test(async function invokesMultipleTimes() {
    const f = parry((a, b, c, d, e, f) => { return [a, b, c, d, e, f]; });

    const r1 = await f(1, 2, 3, 4, 5, 6);
    const r2 = await f(6, 1, 2, 3, 4, 5);
    const r3 = await f(5, 6, 1, 2, 3, 4);

    assertEquals(r1, [1, 2, 3, 4, 5, 6]);
    assertEquals(r2, [6, 1, 2, 3, 4, 5]);
    assertEquals(r3, [5, 6, 1, 2, 3, 4]);
});
