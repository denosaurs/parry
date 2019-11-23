type AsyncFunction<S extends any[], T> = (...args: S) => Promise<T>;
type MaybeAsyncFunction<S extends any[], T> = (...args: S) => T | Promise<T>;

export default function parry<S extends any[], T>(
    original: MaybeAsyncFunction<S, T>
): AsyncFunction<S, T> {
    let id = 0;
    let promises: { [id: number]: [(value?: T | PromiseLike<T>) => void, (reason?: any) => void] } = {};

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

    worker.onmessage = e => {
        const { type, id, data } = e.data;
        
        switch(type) {
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
    const close = () => worker.postMessage({ type: "close" });

    return (...args: S): Promise<T> => {
        return new Promise((resolve, reject) => {
            promises[id] = [resolve, reject];
            call(id, ...args);

            id++;
        });
    };
}
