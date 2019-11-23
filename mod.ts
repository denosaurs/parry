export default function parry<T extends any[], U>(
    original: (...params: T) => U
): (...params: T) => Promise<U> {
    return function(...args: T): Promise<U> {
        return new Promise((resolve, reject) => {
            const script = `onmessage = function (e) { if (e.data === "close") self.close(); postMessage((${original.toString()})(...e.data)); }`;

            const blob = new Blob([script], { type: "text/javascript" });
            const url = URL.createObjectURL(blob);

            let worker = new Worker(url);
            URL.revokeObjectURL(url);

            worker.onmessage = msg => {
                worker.postMessage("close")
                resolve(msg.data);
            };
            
            worker.onerror = () => {
                worker.postMessage("close")
                reject();
            };

            worker.postMessage(args);
        });
    };
}
