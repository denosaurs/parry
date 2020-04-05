let f = () => {};

onmessage = function (event) {
  const { type, id, data } = event.data;
  switch (type) {
    case "set":
      f = new Function(`return ${data};`)();
      break;
    case "close":
      self.close();
      break;
    case "call":
      Promise.resolve(data)
        .then((v) => f.apply(null, v))
        .then(
          (resolved) =>
            self.postMessage({
              type: "resolve",
              id: id,
              data: resolved,
            }),
          (rejected) =>
            self.postMessage({
              type: "reject",
              id: id,
              data: rejected,
            }),
        );
      break;
    default:
      throw "Unknown message type";
  }
};
