const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const source = fs
  .readFileSync("src/homecall-card.js", "utf8")
  .replace(/^import.*\n/, "");
let created = 0,
  modules = 0,
  microphoneRequests = 0,
  failModule = false;
const contexts = [];
const environment = {
  HTMLElement: class {
    attachShadow() {}
  },
  document: { hidden: false },
  window: {
    isSecureContext: true,
    AudioWorkletNode: class {},
    AudioContext: class {
      constructor() {
        created++;
        contexts.push(this);
        this.state = "running";
        this.audioWorklet = {
          addModule: async () => {
            modules++;
            if (failModule) throw Error("Module unavailable");
          },
        };
      }
      suspend() {
        this.state = "suspended";
        return Promise.resolve();
      }
      close() {
        this.state = "closed";
        return Promise.resolve();
      }
    },
  },
  navigator: {
    mediaDevices: {
      getUserMedia() {
        microphoneRequests++;
      },
    },
  },
  clearTimeout() {},
  cancelAnimationFrame() {},
};
vm.createContext(environment);
vm.runInContext(
  source.slice(
    0,
    source.search(/if\s*\(!customElements\.get\(["']homecall-card["']\)/),
  ) + "\nglobalThis.Card=HomeCallCard;",
  environment,
);
(async () => {
  const card = new environment.Card();
  card._warmRecorder();
  const first = card._recorderPreparation;
  await first.loaded;
  assert.equal(first.context.state, "suspended");
  assert.equal(first.ready, true);
  assert.equal(microphoneRequests, 0);
  assert.equal(card._prepareRecorder(), first);
  assert.equal(created, 1);
  assert.equal(modules, 1);
  let stopped = 0;
  card._context = first.context;
  card._stream = {
    getTracks: () => [
      {
        stop() {
          stopped++;
        },
      },
    ],
  };
  card._release(true);
  await first.idle;
  assert.equal(stopped, 1);
  assert.equal(card._prepareRecorder(), first);
  assert.equal(first.context.state, "suspended");
  assert.equal(modules, 1);
  card._release();
  assert.equal(first.context.state, "closed");
  assert.equal(card._recorderPreparation, null);
  environment.document.hidden = true;
  card._warmRecorder();
  assert.equal(created, 1);
  environment.document.hidden = false;
  failModule = true;
  card._warmRecorder();
  await assert.rejects(
    card._recorderPreparation.loaded,
    /Could not|Aufnahmemodul/,
  );
  assert.equal(contexts[1].state, "closed");
  assert.equal(card._recorderPreparation, null);
  failModule = false;
  card._warmRecorder();
  await card._recorderPreparation.loaded;
  assert.equal(created, 3);
  assert.equal(microphoneRequests, 0);
  card._release();
  console.log(
    "Passed: idle preparation never opens the microphone; repeats reuse suspended code; teardown and preload failure close contexts; failed preload can retry.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
