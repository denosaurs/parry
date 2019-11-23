export default function parry<T extends any[], U>(
    original: (...params: T) => U
): (...params: T) => Promise<U> {
    const script = `onmessage = function (e) { if (e.data === "close") self.close(); postMessage((${original.toString()})(...e.data)); }`;
    const blob = new Blob([script], { type: "text/javascript" });

    return function(...args: T): Promise<U> {
        const url = URL.createObjectURL(blob);
        let worker = new Worker(url);
        URL.revokeObjectURL(url);

        const call = (...args) => worker.postMessage(args);
        const close = () => worker.postMessage("close");

        call(args);

        return new Promise((resolve, reject) => {
            worker.onmessage = msg => {
                close();
                resolve(msg.data);
            };

            worker.onerror = () => {
                close();
                reject();
            };
        });
    };
}
