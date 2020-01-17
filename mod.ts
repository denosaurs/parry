const _createWorkerScript = <S extends any[], T>(script: MaybeAsyncFunction<S, T>) => `
const _f=${script.toString()};
onmessage = function(e) {
    const { type, id, data } = e.data;
    switch (type) {
        case "close":
            close();
            break;
        case "call":
            Promise.resolve(data)
                .then(v => _f.apply(null, v))
                .then(
                    r => postMessage({ type: "resolve", id: id, data: r }),
                    e => postMessage({ type: "reject", id: id, data: e })
                );
            break;
        default:
            throw "Unknown message type";
    }
};`;

type AsyncFunction<S extends any[], T> = (...args: S) => Promise<T>;
type MaybeAsyncFunction<S extends any[], T> = (...args: S) => T | Promise<T>;

interface ParryFunction<S extends any[], T> extends AsyncFunction<S, T> {
    close: () => void;
}

export default function parry<S extends any[], T>(
    original: MaybeAsyncFunction<S, T>
): ParryFunction<S, T> {
    let id = 0;
    let promises: {
        [id: number]: [(value?: T | PromiseLike<T>) => void, (reason?: any) => void];
    } = {};

    const script = _createWorkerScript(original);
    const worker = new Worker(URL.createObjectURL(new Blob([script], { type: "text/javascript" })));

    worker.onmessage = e => {
        const { type, id, data } = e.data;

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
                id: id,
                data: args
            });

            id++;
        });
    };

    call.close = (): void => {        
        worker.postMessage({ type: "close" });
    }

    return call;
}
