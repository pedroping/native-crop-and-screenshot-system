self.addEventListener("message", async (event) => {
  console.log(event);

  const logProgress = (proportion) => {
    console.log(proportion * 100.0);
    self.postMessage({
      action: "progress",
      result: (proportion * 100.0).toFixed(0),
    });
  };

  const decodeString = (ptr) => {
    var bytes = new Uint8Array(memory.buffer, ptr);
    var strlen = 0;
    while (bytes[strlen] != 0) strlen++;

    return new TextDecoder("utf8").decode(bytes.slice(0, strlen));
  };

  var memory = new WebAssembly.Memory({
    initial: 256,
    maximum: 512,
  });

  var exports;
  WebAssembly.instantiateStreaming(fetch("dist/exported.wasm"), {
    js: {
      mem: memory,
    },
    env: {
      curTime: () => Date.now(),
      logProgress: logProgress,
      emscripten_resize_heap: memory.grow,
    },
  }).then((results) => {
    exports = results.instance.exports;
    memory = results.instance.exports.memory;

    var str = decodeString(exports.randString(40));

    self.postMessage({ action: "finish", result: str });
  });
});
