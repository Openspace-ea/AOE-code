// AOE Code: Sharp stub - provides mock implementation
// Real image processing is not available, but this prevents runtime errors

const sharp = function (input) {
  const instance = {
    resize(...args) { return instance; },
    jpeg() { return instance; },
    png() { return instance; },
    webp() { return instance; },
    gif() { return instance; },
    toBuffer() { return Promise.resolve(Buffer.alloc(0)); },
    toFile(path) { return Promise.resolve({ size: 0 }); },
    metadata() {
      return Promise.resolve({
        format: 'unknown',
        width: 0,
        height: 0,
        channels: 3,
        size: 0,
      });
    },
    rotate() { return instance; },
    flip() { return instance; },
    flop() { return instance; },
    sharpen() { return instance; },
    blur() { return instance; },
    flatten() { return instance; },
    trim() { return instance; },
    extend() { return instance; },
    extract() { return instance; },
    composite() { return instance; },
    modulate() { return instance; }
  };
  return instance;
};

sharp.cache = function() {};
sharp.concurrency = function() {};
sharp.counters = function() { return { queue: 0, process: 0 }; };

export default sharp;
