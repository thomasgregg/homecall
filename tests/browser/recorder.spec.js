import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

const worklet = await readFile(new URL("../../custom_components/homecall/frontend/homecall-recorder-worklet.js", import.meta.url), "utf8");
let server, address;

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const module = request.url === "/recorder.js";
    response.setHeader("Content-Type", module ? "application/javascript" : "text/html");
    response.end(module ? worklet : '<button id="start">Start synthetic capture</button>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  address = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});

test("real audio worklet preserves opening and ending samples through a partial flush", async ({page}) => {
  // Worklet module fetching bypasses page.route in Chromium; use real same-origin HTTP.
  await page.goto(address);
  await page.evaluate(() => {
    document.querySelector("#start").onclick = async () => {
      try {
        const context = new AudioContext({sampleRate: 48000});
        await context.resume();
        await context.audioWorklet.addModule("/recorder.js");
        const recorder = new AudioWorkletNode(context, "homecall-recorder-v1", {
          numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1,
        });
        const chunks = [];
        let readyCount = 0;
        recorder.port.onmessage = async ({data}) => {
          if (data.type === "ready") readyCount++;
          if (data.type === "chunk") chunks.push({sequence: data.sequence, samples: [...data.samples]});
          if (data.type === "stopped") {
            window.result = {readyCount, total: data.total, chunks};
            await context.close();
          }
        };
        recorder.connect(context.destination); // Output is silent.
        const source = context.createBufferSource();
        source.buffer = context.createBuffer(1, 5504, 48000);
        const signal = source.buffer.getChannelData(0);
        signal.fill(.125);
        signal.fill(.25, 0, 128);
        signal.fill(.5, 5376);
        source.connect(recorder);
        source.onended = () => recorder.port.postMessage({type: "stop"});
        source.start();
      } catch (error) { window.captureError = error.message; }
    };
  });
  await page.locator("#start").click();
  await expect.poll(() => page.evaluate(() => window.result || window.captureError)).toBeTruthy();
  const {result, error} = await page.evaluate(() => ({result: window.result, error: window.captureError}));
  expect(error).toBeUndefined();
  expect(result.readyCount).toBe(1);
  expect(result.chunks.map(chunk => chunk.sequence)).toEqual(result.chunks.map((_, i) => i));
  const samples = result.chunks.flatMap(chunk => chunk.samples);
  expect(samples.length).toBe(result.total);
  expect(samples.filter(sample => sample === .25)).toHaveLength(128);
  expect(samples.filter(sample => sample === .5)).toHaveLength(128);
  expect(samples.filter(sample => sample === .125)).toHaveLength(5248);
});
