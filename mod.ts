type AsyncFunction<S extends any[], T> = (...args: S) => Promise<T>;
type MaybeAsyncFunction<S extends any[], T> = (...args: S) => T | Promise<T>;

interface ParryFunction<S extends any[], T> extends AsyncFunction<S, T> {
  close: () => void;
  set: (f: MaybeAsyncFunction<S, T>) => void;
}

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

  const worker = new Worker("./worker.js", { type: "module" });

  worker.postMessage({
    type: "set",
    data: original.toString(),
  });

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
        throw `Unknown message type ${type}`;
    }

    delete promises[id];
  };

  const call: ParryFunction<S, T> = (...args: S[]): Promise<T> => {
    return new Promise((resolve, reject) => {
      promises[id] = [resolve, reject];
      worker.postMessage({
        type: "call",
        id,
        data: args,
      });

      id++;
    });
  };

  call.close = (): void => {
    worker.postMessage({ type: "close" });
  };

  call.set = (f: MaybeAsyncFunction<S, T>): void => {
    worker.postMessage({
      type: "set",
      data: f.toString(),
    });
  };

  return call;
}

export default parry;
