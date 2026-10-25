const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const source = fs
  .readFileSync("src/homecall-card.js", "utf8")
  .replace(/^import.*\n/, "");
let id = 0;
const timers = new Map();
const context = {
  HTMLElement: class {
    attachShadow() {
      return {};
    }
  },
  window: { isSecureContext: true, AudioWorkletNode: class {} },
  document: {},
  performance: { now: () => 0 },
  navigator: { mediaDevices: {} },
  setTimeout(fn, delay) {
    const key = ++id;
    timers.set(key, { fn, delay });
    return key;
  },
  clearTimeout(key) {
    timers.delete(key);
  },
  cancelAnimationFrame() {},
};
vm.createContext(context);
vm.runInContext(
  source.slice(
    0,
    source.search(/if\s*\(!customElements\.get\(["']homecall-card["']\)\)/),
  ) + "\nglobalThis.Card=HomeCallCard;",
  context,
);
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
function fixture(phase = "recording") {
  const c = new context.Card(),
    nodes = {};
  for (const name of [
    ".targets",
    ".status-popover",
    ".time",
    ".speaker-list",
    ".main",
  ])
    nodes[name] = {
      open: false,
      textContent: name === ".time" ? "00:12" : "",
      matches: () => false,
    };
  const summary = { textContent: "1 Echo" };
  nodes.summary = summary;
  c._view = {
    querySelector: (s) => nodes[s],
    classList: { remove() {} },
    remove() {
      assert.fail("Card was removed");
    },
  };
  c.config = {};
  c._phase = phase;
  c._session = Symbol();
  c._targets = [{ entity_id: "one", available: true }];
  c._selection = ["one"];
  c._chunks = [new Float32Array(100)];
  c._levels = Array(64).fill(0.6);
  c._samples = 100;
  c._started = 12;
  c._button = (label) => (c.label = label);
  c._setStatus = (message) => (c.status = message);
  c._draw = () => (c.drawn = true);
  c._render = () => assert.fail("Card rebuilt");
  c._fillTargets = () => assert.fail("Recipients rebuilt");
  c._hass = { fetchWithAuth: () => assert.fail("Discard fetched devices") };
  return { c, nodes, summary };
}
(async () => {
  for (const phase of [
    "starting",
    "recording",
    "recorded",
    "recorded",
    "sent",
    "error",
  ]) {
    const { c, nodes, summary } = fixture(phase),
      view = c._view,
      selection = c._selection,
      oldSession = c._session;
    let stops = 0,
      closes = 0,
      disconnects = 0;
    c._stream = { getTracks: () => [{ stop: () => stops++ }] };
    c._context = {
      close: () => {
        closes++;
        return Promise.resolve();
      },
    };
    c._processor = { disconnect: () => disconnects++ };
    c._source = { disconnect: () => disconnects++ };
    for (const key of ["_timer", "_readyTimer", "_receiptTimer"])
      c[key] = context.setTimeout(() => assert.fail("Stale timer fired"), 100);
    c._reset();
    assert.equal(c._phase, "ready");
    assert.equal(c._view, view);
    assert.equal(c._selection, selection);
    assert.equal(nodes.summary, summary);
    assert.equal(summary.textContent, "1 Echo");
    assert.notEqual(c._session, oldSession);
    assert.equal(c._chunks.length, 0);
    assert.equal(c._samples, 0);
    assert.ok(c._levels.every((v) => v === 0));
    assert.equal(nodes[".time"].textContent, "1:00");
    assert.equal(nodes[".main"].disabled, false);
    assert.equal(stops, 1);
    assert.equal(closes, 1);
    assert.equal(disconnects, 2);
    assert.equal(timers.size, 0);
  }
  // Retry still loads devices after a failed initial load.
  const { c: retry, nodes: retryNodes } = fixture("error");
  retryNodes[".speaker-list"] = null;
  let retries = 0;
  retry._load = () => retries++;
  retry._reset();
  assert.equal(retries, 1);
  // A microphone permission request can resolve after Discard.
  const pendingMic = deferred(),
    micRequested = deferred();
  let lateStops = 0;
  context.window.AudioContext = class {
    constructor() {
      this.audioWorklet = { addModule: () => Promise.resolve() };
    }
    suspend() {
      return Promise.resolve();
    }
    resume() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
  };
  context.navigator.mediaDevices.getUserMedia = () => {
    micRequested.resolve();
    return pendingMic.promise;
  };
  const { c: starting } = fixture("ready");
  starting._hass.fetchWithAuth = async () => ({
    ok: true,
    json: async () => ({ targets: starting._targets }),
  });
  const start = starting._start();
  await micRequested.promise;
  starting._reset();
  pendingMic.resolve({ getTracks: () => [{ stop: () => lateStops++ }] });
  await start;
  assert.ok(lateStops > 0);
  assert.equal(starting._phase, "ready");
  // A worklet module can finish loading after Discard, without starting capture.
  const module = deferred(),
    moduleRequested = deferred();
  context.window.AudioContext = class {
    constructor() {
      this.audioWorklet = {
        addModule: () => {
          moduleRequested.resolve();
          return module.promise;
        },
      };
    }
    suspend() {
      return Promise.resolve();
    }
    resume() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
  };
  context.navigator.mediaDevices.getUserMedia = async () => ({
    getTracks: () => [{ stop() {} }],
  });
  const { c: modulePending } = fixture("ready");
  const moduleStart = modulePending._start();
  await moduleRequested.promise;
  modulePending._reset();
  module.resolve();
  await moduleStart;
  assert.equal(modulePending._phase, "ready");
  assert.equal(modulePending.status, "Tippe auf das Mikrofon");
  // A receipt completing after reset must not overwrite Ready.
  const receipt = deferred(),
    { c: sent } = fixture("sent");
  sent._hass.fetchWithAuth = async () => ({ json: () => receipt.promise });
  const receiptCheck = sent._checkReceipt("test", 0);
  sent._reset();
  receipt.resolve({ audio_fetches: 1 });
  await receiptCheck;
  assert.equal(sent.status, "Tippe auf das Mikrofon");
  assert.equal(timers.size, 0);
  console.log(
    "Passed: Discard retains recipient DOM/selection without fetching, releases audio, cancels timers and stale async work, and keeps initial-load retry.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
