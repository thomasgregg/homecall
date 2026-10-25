const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const source = fs
  .readFileSync("src/homecall-card.js", "utf8")
  .replace(/^import.*\n/, "");
let now = 0,
  id = 0;
const timers = new Map();
const context = {
  HTMLElement: class {
    attachShadow() {
      return {};
    }
  },
  window: { removeEventListener() {} },
  document: { removeEventListener() {} },
  Blob,
  performance: { now: () => now },
  URLSearchParams,
  setTimeout(fn, delay) {
    const key = ++id;
    timers.set(key, { fn, due: now + delay });
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
function advance(ms) {
  now += ms;
  for (const [key, t] of timers)
    if (t.due <= now) {
      timers.delete(key);
      t.fn();
    }
}
function fixture(accepted) {
  const c = new context.Card();
  c._phase = "recording";
  c.config = {};
  c._diagnostics = { browser_timings_ms: {} };
  c._recorderStopped = true;
  c._session = Symbol();
  c._selection = ["one", "two"];
  c._samples = 24000;
  c._sampleRate = 24000;
  c._targets = [{ available: true }];
  c._draw = () => {};
  c._view = {
    querySelector: () => ({
      open: false,
      disabled: false,
      matches: () => false,
    }),
    classList: { remove() {} },
    remove() {},
  };
  c._release = () => {};
  c._button = () => {};
  c._setStatus = (t) => (c.status = t);
  c._doneButton = () => {};
  c._checkReceipt = () => {};
  c._wav = () => new Blob(["audio"]);
  c._hass = {
    fetchWithAuth: async () => ({
      ok: true,
      json: async () => ({
        results: accepted.map((accepted) => ({ accepted })),
        receipt: "recorded",
      }),
    }),
  };
  c._render = () => {
    c._phase = "ready";
    c._session = Symbol();
    c.rendered = true;
  };
  return c;
}
(async () => {
  const success = fixture([true, true]);
  await success._finish();
  assert.equal(success._phase, "sent");
  advance(4999);
  assert.equal(success._phase, "sent");
  advance(1);
  assert.equal(success._phase, "ready");
  assert.deepEqual(Array.from(success._selection), ["one", "two"]);
  assert.equal(success.rendered, undefined);
  const manual = fixture([true, true]);
  await manual._finish();
  manual._reset();
  assert.equal(timers.size, 0);
  const session = manual._session;
  advance(5000);
  assert.equal(manual._session, session);
  const stale = fixture([true, true]);
  await stale._finish();
  stale._session = Symbol();
  advance(5000);
  assert.equal(stale.rendered, undefined);
  const partial = fixture([true, false]);
  await partial._finish();
  advance(5000);
  assert.equal(partial._phase, "sent");
  assert.equal(partial.rendered, undefined);
  const failure = fixture([false, false]);
  await failure._finish();
  advance(5000);
  assert.equal(failure._phase, "error");
  assert.equal(failure.rendered, undefined);
  const skipped = fixture([true, true]);
  skipped._recordingSkippedTargets = ["offline"];
  await skipped._finish();
  assert.equal(skipped._partialSend, true);
  assert.match(skipped.status, /Skipped: offline/);
  advance(5000);
  assert.equal(skipped._phase, "sent");
  console.log(
    "Passed: 5-second success reset, selection retained, manual reset cancels timer, stale sessions guarded, partial/failure feedback retained.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
