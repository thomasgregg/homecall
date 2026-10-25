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
  window: {},
  document: {},
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
  for (const [key, t] of [...timers])
    if (t.due <= now) {
      timers.delete(key);
      t.fn();
    }
}
function node() {
  const classes = new Set();
  return {
    dataset: {},
    classes,
    classList: {
      toggle(n, on) {
        if (on) classes.add(n);
        else classes.delete(n);
      },
    },
    attrs: {},
    setAttribute(n, v) {
      this.attrs[n] = v;
    },
  };
}
function fixture() {
  const c = new context.Card();
  const nodes = new Map();
  c._phase = "starting";
  c._session = Symbol();
  c._lang = "en";
  c._view = {
    dataset: {},
    querySelector(s) {
      if (!nodes.has(s)) nodes.set(s, node());
      return nodes.get(s);
    },
  };
  c._button("Vorbereitung …");
  c._syncPhase();
  return { c, nodes };
}
const fast = fixture();
assert.equal(fast.nodes.get(".main").loading, true);
assert.equal(fast.nodes.get(".main").attrs["aria-busy"], "true");
assert.equal(fast.nodes.get(".main").attrs["aria-label"], "Preparing …");
assert.equal(fast.nodes.get(".action-label").textContent, "Preparing");
assert.equal(timers.size, 0);
assert.ok(fast.nodes.get(".message-control").classes.has("sr-only"));
assert.equal(fast.nodes.get(".status-more").hidden, true);
assert.equal(fast.nodes.get(".time").hidden, true);
assert.equal(fast.c._view.dataset.tone, "blue");
advance(300);
fast.c._phase = "recording";
fast.c._button("Sprich jetzt");
assert.equal(fast.nodes.get(".main").loading, false);
assert.equal(fast.nodes.get(".action-label").textContent, "Speak now");
assert.equal(fast.c._view.dataset.tone, "red");
assert.equal(fast.nodes.get(".main").variant, "danger");
assert.equal(fast.nodes.get(".time").hidden, false);
for (const phase of [
  "loading",
  "ready",
  "starting",
  "recorded",
  "recorded",
  "sending",
  "sent",
  "error",
]) {
  fast.c._phase = phase;
  fast.c._syncPhase();
  assert.equal(
    fast.c._view.dataset.tone,
    "blue",
    phase + " must not suggest an active microphone",
  );
  assert.equal(fast.nodes.get(".main").variant, "brand");
}
console.log(
  "Passed: startup feedback is immediate, capture stays blue until ready, and recording replaces preparation without a timer.",
);
