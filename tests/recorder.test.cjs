const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("custom_components/homecall/frontend/homecall-recorder-worklet.js", "utf8");

function recorder(rate = 48000) {
  const messages = [];
  let Processor;
  vm.runInNewContext(source, {
    sampleRate: rate, Float32Array,
    AudioWorkletProcessor: class {
      constructor() { this.port = {postMessage: message => messages.push(message)}; }
    },
    registerProcessor(name, implementation) {
      assert.equal(name, "homecall-recorder-v1");
      Processor = implementation;
    },
  });
  return {processor: new Processor(), messages};
}

test("readiness accepts silence but waits for input, without dropping its first samples", () => {
  const {processor, messages} = recorder();
  assert.equal(processor.process([[]]), true);
  assert.equal(messages.length, 0);
  processor.process([[new Float32Array(128)]]);
  assert.equal(messages[0].type, "ready");
  processor.port.onmessage({data: {type: "stop"}});
  assert.equal(messages[1].samples.length, 128);
  assert.equal(messages[2].total, 128);
});

test("stop flushes every sample in order, including a partial ending, exactly once", () => {
  const {processor, messages} = recorder();
  const input = Float32Array.from({length: 5504}, (_, i) => i / 5504);
  for (let i = 0; i < input.length; i += 128)
    processor.process([[input.subarray(i, i + 128)]]);
  processor.port.onmessage({data: {type: "stop"}});
  processor.port.onmessage({data: {type: "stop"}});
  assert.equal(processor.process([[new Float32Array(128)]]), false);
  const chunks = messages.filter(message => message.type === "chunk");
  assert.deepEqual(chunks.map(message => message.sequence), [0, 1, 2]);
  assert.deepEqual(chunks.map(message => message.samples.length), [2048, 2048, 1408]);
  assert.deepEqual(chunks.flatMap(message => [...message.samples]), [...input]);
  assert.equal(messages.at(-1).type, "stopped");
  assert.equal(messages.at(-1).total, input.length);
  assert.equal(messages.filter(message => message.type === "stopped").length, 1);
});

for (const rate of [44100, 48000]) test(`60-second limit preserves exactly ${rate * 60} samples and acknowledges after flushing`, () => {
  const {processor, messages} = recorder(rate);
  const input = new Float32Array(128).fill(0.25);
  while (processor.process([[input]])) {}
  const chunks = messages.filter(message => message.type === "chunk");
  assert.equal(chunks.reduce((total, message) => total + message.samples.length, 0), rate * 60);
  assert.equal(messages.at(-1).reason, "limit");
  assert.equal(messages.at(-1).total, rate * 60);
  assert.equal(messages.at(-2).type, "chunk");
});
