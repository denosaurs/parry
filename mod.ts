import { dirname, join } from "https://deno.land/std@v0.42.0/path/mod.ts";

type AsyncFunction<S extends any[], T> = (...params: S) => Promise<T>;
type MaybeAsyncFunction<S extends any[], T> = (...params: S) => T | Promise<T>;

// Objects that can be transfered without problem between
export type Transferable =
  | number
  | string
  | boolean
  | null
  | undefined
  | Date
  | Number
  | Boolean
  | String
  | Date
  | RegExp
  | Blob
  | File
  | ArrayBuffer
  | ArrayBufferView
  | Map<unknown, unknown>
  | Set<unknown>
  | void // Not technically transferable but important for void functions
  | Transferable[];

/** An error thrown by a parry function or Worker */
export class ParryError extends Error {
  constructor(message: string = "") {
    super(message);
    this.name = this.constructor.name;
    this.stack;
  }
}

/** The global parry instance and ParryFunction spawner */
export interface Parry {
  <S extends Transferable[], T extends Transferable>(
    /** Creates a new ParryFunction function */
    original?: (...params: S) => T | Promise<T>,
    deno?: boolean,
  ): ParryFunction<S, T>;

  /** Closes all parry Workers */
  close(): void;
}

/** A callable function in it's own Worker */
export interface ParryFunction<S extends Transferable[], T extends Transferable>
  extends AsyncFunction<S, T> {
  /** The id of the functions Worker */
  id: number;
  /** Is the Worker closed? */
  closed: boolean;
  /** Closes the current Worker */
  close: () => void;
  /** Sets the current Workers function */
  set: (f: MaybeAsyncFunction<S, T>) => void;
  /** Runs a single function inside the Worker */
  run: <U extends Transferable[], V extends Transferable>(
    f: MaybeAsyncFunction<U, V>,
    ...params: U
  ) => Promise<V>;
  /** Declares a global variable to specified value */
  declare: (ident: string, value: Transferable) => void;
  /** Adds a global function with the specified identifier */
  use: (ident: string, func: Function) => void;
}

// All of the current parry functions
const funcs: Map<number, ParryFunction<any, any>> = new Map();
let funcsIndex: number = 0;

/** Move a function into it's own Worker */
export const parry: Parry = <S extends Transferable[], T extends Transferable>(
  original?: (...params: S) => T | Promise<T>,
  deno?: boolean,
): ParryFunction<S, T> => {
  let id = 0;
  const promises: {
    [id: number]: [
      (value?: T | PromiseLike<T> | any | PromiseLike<any>) => void,
      (reason?: any) => void,
    ];
  } = {};

  const worker = new Worker(
    join(dirname(import.meta.url), "worker.js"), // Allows the Worker to be run both locally and imported from an URL
    { type: "module", deno },
  );

  worker.onmessage = (event) => {
    const { type, id, data } = event.data; // All parry Worker messages use this object structure

    switch (type) {
      case "resolve":
        promises[id][0](data);
        delete promises[id];
        break;
      case "reject":
        promises[id][1](data);
        delete promises[id];
        break;
      case "error":
        throw new ParryError(data);
        break;
      default:
        throw new ParryError(`Unknown message type "${type}"`);
    }
  };

  // Throw errors when they are encountered in the worker (only works for certain error though)
  worker.onerror = () => {
    throw new ParryError("Worker error");
  };

  worker.onmessageerror = () => {
    throw new ParryError("Worker message error");
  };

  // Create the ParryFunction that is returned
  const func: ParryFunction<S, T> = (...params: S): Promise<T> => {
    if (func.closed) {
      throw new ParryError("Cannot call closed Worker");
    }

    return new Promise((resolve, reject) => {
      promises[id] = [resolve, reject];
      worker.postMessage({
        type: "call",
        data: params,
        id,
      });

      id++;
    });
  };

  func.id = funcsIndex++; // This id is the global id of the worker
  func.closed = false;

  // A method for closing the parry Worker
  func.close = (): void => {
    if (func.closed) {
      throw new ParryError("Cannot close already closed Worker");
    }

    worker.terminate();
    func.closed = true;
    funcs.delete(func.id);
  };

  // A method for setting the parry Workers function
  func.set = (f: MaybeAsyncFunction<S, T>): void => {
    if (func.closed) {
      throw new ParryError("Cannot set closed Worker");
    }

    worker.postMessage({
      type: "set",
      data: f.toString(),
    });
  };

  // A method for running a function in the parry Worker
  func.run = <U extends Transferable[], V extends Transferable>(
    f: MaybeAsyncFunction<U, V>,
    ...params: U
  ): Promise<V> => {
    if (func.closed) {
      throw new ParryError("Cannot run closed Worker");
    }

    return new Promise((resolve, reject) => {
      promises[id] = [resolve, reject];
      worker.postMessage({
        type: "run",
        data: {
          func: f.toString(),
          params,
        },
        id,
      });

      id++;
    });
  };

  // Declares a global variable
  func.declare = (ident: string, value: Transferable) => {
    worker.postMessage({
      type: "declare",
      data: {
        ident,
        value,
      },
    });
  };

  // Declares a global function
  func.use = (ident: string, func: Function) => {
    worker.postMessage({
      type: "use",
      data: {
        ident,
        func: func.toString(),
      },
    });
  };

  // Sets the Workers main function if specified
  if (original) {
    func.set(original);
  }

  // Adds the parry function to the global list of parry functions (for global parry stuff like closing all)
  funcs.set(func.id, func);

  return func;
};

/** Closes all Workers */
parry.close = (): void => {
  for (const [id, func] of funcs) {
    func.close();
  }
};

export default parry;
