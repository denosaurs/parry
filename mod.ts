export default function parry<T extends any[], U>(original: (...params: T) => U): (...params: T) => Promise<U> {
    return function (...args: T): Promise<U> {
        return new Promise((resolve, reject) => {
            const script = `onmessage = function (e) { postMessage((${original.toString()})(...e.data)); }`;

            const blob = new Blob([script], { type: "text/javascript" });
            const url = URL.createObjectURL(blob);
    
            let worker = new Worker(url);
            URL.revokeObjectURL(url);
    
            worker.onmessage = msg => resolve(msg.data);
            worker.onerror = () => reject();

            worker.postMessage(args);
        });
    }
}
