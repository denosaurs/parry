import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.79.0/testing/asserts.ts";

import { parry } from "./mod.ts";

const { test } = Deno;

test({
  name: "returns async function from sync function",
  async fn(): Promise<void> {
    const f = parry(() => {
      return;
    });
    const r = f();

    assertEquals(typeof f, "function");
    assert(r instanceof Promise);

    await r;
    f.close();
  },
});

test(
  {
    name: "returns async function from async function",
    async fn(): Promise<void> {
      const f = parry(async () => {
        return;
      });
      const r = f();

      assertEquals(typeof f, "function");
      assert(r instanceof Promise);

      await r;
      f.close();
    },
  },
);

test({
  name: "returns promise",
  async fn(): Promise<void> {
    const f = parry((a) => {
      return a;
    });
    const r = f(1);

    assert(r instanceof Promise);
    assertEquals(await r, 1);

    f.close();
  },
});

test({
  name: "calls sync function",
  async fn(): Promise<void> {
    const f = parry((a) => {
      return a;
    });
    const r = await f(1);

    assertEquals(r, 1);

    f.close();
  },
});

test({
  name: "calls async function",
  async fn(): Promise<void> {
    const f = parry(async (a) => {
      return a;
    });
    const r = await f(1);

    assertEquals(r, 1);

    f.close();
  },
});

test({
  name: "forwards arguments",
  async fn(): Promise<void> {
    const f = parry((a, b, c, d, e, f) => {
      return [a, b, c, d, e, f];
    });
    const r = await f(1, 2, 3, 4, 5, 6);

    assertEquals(r, [1, 2, 3, 4, 5, 6]);

    f.close();
  },
});

test({
  name: "multiple works in parallel",
  async fn(): Promise<void> {
    const f1 = parry((a, b, c, d, e, f) => {
      return [a, b, c, d, e, f];
    });
    const f2 = parry((a, b, c, d, e, f) => {
      return [f, a, b, c, d, e];
    });
    const f3 = parry((a, b, c, d, e, f) => {
      return [e, f, a, b, c, d];
    });

    const a1 = f1(1, 2, 3, 4, 5, 6);
    const a2 = f2(1, 2, 3, 4, 5, 6);
    const a3 = f3(1, 2, 3, 4, 5, 6);

    const [r1, r2, r3] = await Promise.all([a1, a2, a3]);

    assertEquals(r1, [1, 2, 3, 4, 5, 6]);
    assertEquals(r2, [6, 1, 2, 3, 4, 5]);
    assertEquals(r3, [5, 6, 1, 2, 3, 4]);

    f1.close();
    f2.close();
    f3.close();
  },
});

test({
  name: "call multiple times",
  async fn(): Promise<void> {
    const f = parry((a, b, c, d, e, f) => {
      return [a, b, c, d, e, f];
    });

    const r1 = await f(1, 2, 3, 4, 5, 6);
    const r2 = await f(6, 1, 2, 3, 4, 5);
    const r3 = await f(5, 6, 1, 2, 3, 4);

    assertEquals(r1, [1, 2, 3, 4, 5, 6]);
    assertEquals(r2, [6, 1, 2, 3, 4, 5]);
    assertEquals(r3, [5, 6, 1, 2, 3, 4]);

    f.close();
  },
});

test({
  name: "run sync function",
  async fn(): Promise<void> {
    const p = parry((x) => x);

    const r = await p.run(((x: number): number => x + 1), 1);

    assertEquals(r, 2);

    p.close();
  },
});

test({
  name: "run async function",
  async fn(): Promise<void> {
    const p = parry((x) => x);

    const r = await p.run(
      (async (x: number) => {
        return x + 1;
      }),
      1,
    );

    assertEquals(r, 2);

    p.close();
  },
});

test({
  name: "declare value",
  async fn(): Promise<void> {
    const p = parry((x) => x);

    p.declare("value", 1);

    const r = await p.run(
      (async () => {
        // deno-lint-ignore ban-ts-comment
        // @ts-ignore
        return value;
      }),
    );

    assertEquals(r, 1);

    p.close();
  },
});

test({
  name: "define function",
  async fn(): Promise<void> {
    const p = parry((x) => x);

    p.define("add", (a: number, b: number): number => a + b);

    const r = await p.run(
      (async () => {
        // deno-lint-ignore ban-ts-comment
        // @ts-ignore
        return add(1, 1);
      }),
    );

    assertEquals(r, 2);

    p.close();
  },
});
