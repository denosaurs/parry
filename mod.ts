import { dirname, join } from "https://deno.land/std/path/mod.ts";

class ParryError extends Error {
  constructor(message: string = "") {
    super(message);
    this.name = this.constructor.name;
    this.stack;
  }
}

type AsyncFunction<S extends any[], T> = (...args: S) => Promise<T>;
type MaybeAsyncFunction<S extends any[], T> = (...args: S) => T | Promise<T>;

/** A callable function in it's own Worker */
export interface ParryFunction<S extends any[], T> extends AsyncFunction<S, T> {
  /** The id of the functions Worker */
  id: number;
  /** Is the Worker closed? */
  closed: boolean;
  /** Closes the current worker */
  close: () => void;
  /** Sets the current Workers function */
  set: (f: MaybeAsyncFunction<S, T>) => void;
}

// All of the current parry functions
const funcs: Map<number, ParryFunction<any, any>> = new Map();
let funcsIndex: number = 0;

/** Move a function into it's own Worker */
export function parry<S extends any[], T>(
  original: (...args: S) => T | Promise<T>,
): ParryFunction<S, T> {
  let id = 0;
  const promises: {
    [id: number]: [
      (value?: T | PromiseLike<T>) => void,
      (reason?: any) => void,
    ];
  } = {};

  const worker = new Worker(
    join(dirname(import.meta.url), "worker.js"),
    { type: "module" },
  );

  worker.onmessage = (event) => {
    const { type, id, data } = event.data;

    switch (type) {
      case "resolve":
        promises[id][0](data);
        break;
      case "reject":
        promises[id][1](data);
        break;
      default:
        throw new ParryError(`Unknown message type "${type}"`);
    }

    delete promises[id];
  };

  worker.onerror = () => {
    throw new ParryError("Worker error");
  };

  worker.onmessageerror = () => {
    throw new ParryError("Worker message error");
  };

  const func: ParryFunction<S, T> = (...args: S[]): Promise<T> => {
    if (func.closed) {
      throw new ParryError("Cannot run closed Worker");
    }

    return new Promise((resolve, reject) => {
      promises[id] = [resolve, reject];
      worker.postMessage({
        type: "call",
        data: args,
        id,
      });

      id++;
    });
  };

  func.id = funcsIndex++;
  func.closed = false;

  func.close = (): void => {
    if (func.closed) {
      throw new ParryError("Cannot close already closed Worker");
    }

    worker.postMessage({ type: "close" });
    func.closed = true;
    funcs.delete(func.id);
  };

  func.set = (f: MaybeAsyncFunction<S, T>): void => {
    if (func.closed) {
      throw new ParryError("Cannot set closed Worker");
    }

    worker.postMessage({
      type: "set",
      data: f.toString(),
    });
  };

  func.set(original);

  funcs.set(func.id, func);

  return func;
}

parry.close = (): void => {
  for (const [id, func] of funcs) {
    func.close();
  }
};

export default parry;
