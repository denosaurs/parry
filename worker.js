let f = () => {};

onmessage = function (event) {
  const { type, id, data } = event.data;
  switch (type) {
    case "set":
      f = new Function(`return ${data};`)();
      break;
    case "call":
      Promise.resolve(data)
        .then((v) => f.apply(null, v))
        .then(
          (resolved) =>
            self.postMessage({
              type: "resolve",
              id,
              data: resolved,
            }),
          (rejected) =>
            self.postMessage({
              type: "reject",
              id,
              data: rejected,
            }),
        );
      break;
    case "run":
      const r = new Function(`return ${data.func};`)();

      Promise.resolve(data.params)
        .then((v) => r.apply(null, v))
        .then(
          (resolved) => {
            self.postMessage({
              type: "resolve",
              id,
              data: resolved,
            });
          },
          (rejected) =>
            self.postMessage({
              type: "reject",
              id,
              data: rejected,
            }),
        );
      break;
    case "declare":
      self[data.ident] = data.value;
      break;
    case "use":
      self[data.ident] = new Function(`return ${data.func};`)();
      break;
    default:
      self.postMessage({
        type: "error",
        data: "Unknown message type",
      });
      break;
  }
};
