type AsyncFunction<S extends any[], T> = (...args: S) => Promise<T>;
type MaybeAsyncFunction<S extends any[], T> = (...args: S) => T | Promise<T>;

export default function parry<S extends any[], T>(
    original: MaybeAsyncFunction<S, T>
): AsyncFunction<S, T> {
    let id = 0;
    let promises: { [id: number]: [(value?: T | PromiseLike<T>) => void, (reason?: any) => void] } = {};

    const script =
        `const _f = ${original.toString()};` +
        `\nonmessage = function (e) {` +
        `\n    const { type, id, data } = e.data;` +
        `\n    switch(type) {` +
        `\n        case "close":` +
        `\n            self.close();` +
        `\n            break;` +
        `\n        case "call":` +
        `\n            Promise.resolve(data).then(v => _f.apply(_f, v)).then(` +
        `\n                r => postMessage({ type: "resolve", id: id, data: r }),` +
        `\n                e => postMessage({ type: "reject", id: id, data: e })` +
        `\n            );` +
        `\n            break;` +
        `\n        default:` +
        `\n            throw "Unknown message type";` +
        `\n    }` +
        `\n};`;

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
