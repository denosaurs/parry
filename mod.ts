const _workers: { [hash: number]: Worker } = {};

type AsyncFunction<S extends any[], T> = (...args: S) => Promise<T>;
type MaybeAsyncFunction<S extends any[], T> = (...args: S) => T | Promise<T>;

function djb2(chars: string): number {
    let hash = 5381;
    for (let i = 0; i < chars.length; i++)
        hash = ((hash << 5) + hash) + chars.charCodeAt(i);

    return hash;
}

export default function parry<S extends any[], T>(
    original: MaybeAsyncFunction<S, T>
): AsyncFunction<S, T> {
    let id = 0;
    let promises: {
        [id: number]: [(value?: T | PromiseLike<T>) => void, (reason?: any) => void];
    } = {};

    /* WebWorker function wrapper
    const _f = ${original.toString()};
    onmessage = function (e) {
        const { type, id, data } = e.data;
        switch(type) {
            case "close":
                self.close();
                break;
            case "call":
                Promise.resolve(data).then(v => _f.apply(_f, v)).then(
                    r => postMessage({ type: "resolve", id: id, data: r }),
                    e => postMessage({ type: "reject", id: id, data: e })
                );
                break;
            default:
                throw "Unknown message type";
        }
    };
     */
    const script = `const _f=${original.toString()};onmessage=function(e){const{type,id,data}=e.data;switch(type){case "close":self.close();break;case "call":Promise.resolve(data).then(v=>_f.apply(_f,v)).then(r=>postMessage({type:"resolve",id:id,data:r}),e=>postMessage({type:"reject",id:id,data:e}));break;default:throw "Unknown message type"}};`;

    let worker = new Worker(URL.createObjectURL(new Blob([script], { type: "text/javascript" })));
    if (!_workers[djb2(original.toString())]) _workers[djb2(original.toString())] = worker;
    else throw "Cannot create duplicates without closing the previous first";

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
                throw "Unknown message type";
        }

        delete promises[id];
    };

    const call = (id: number, ...args: S) => {
        worker.postMessage({
            type: "call",
            id: id,
            data: args
        });
    };

    return (...args: S): Promise<T> => {
        return new Promise((resolve, reject) => {
            promises[id] = [resolve, reject];
            call(id, ...args);

            id++;
        });
    };
}

export function close<S extends any[], T>(
    target?: MaybeAsyncFunction<S, T> | MaybeAsyncFunction<S, T>[]
): void {
    if (target && target instanceof Array) {
        for (const t of target) {
            close(t);
        }
    } else if (target && _workers[djb2(target.toString())]) {
        _workers[djb2(target.toString())].postMessage({ type: "close" });
        delete _workers[djb2(target.toString())];
    } else {
        for (const hash in _workers) {
            const worker = _workers[hash];
            worker.postMessage({ type: "close" });
            delete _workers[hash];
        }
    }
}
