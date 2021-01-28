let __func = () => {};

onmessage = function (event) {
  const { type, id, data } = event.data;
  switch (type) {
    case "set":
      __func = new Function(`return ${data};`)();
      break;
    case "call":
      Promise.resolve(data)
        .then((v) => __func.apply(null, v))
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
    case "define":
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
