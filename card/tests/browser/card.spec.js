import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { registerHomeAssistantFixtures } from "./ha-fixture.js";
const script = await readFile(
  new URL(
    "../../../custom_components/homecall/frontend/homecall-card.js",
    import.meta.url,
  ),
  "utf8",
);
async function fixture(
  page,
  width = 215,
  height = 184,
  liveStatus = false,
  recipient = "notify.kitchen_speak",
) {
  // Match the card's HA font variable to the controls' fixture font. Without
  // this, Linux WebKit falls back from missing Roboto to wider system text.
  await page.setContent(
    `<style>body{--primary-color:#009ac0;--error-color:#db4437;--warning-color:#ffa600;--primary-text-color:#222;--secondary-text-color:#666;--ha-font-size-m:14px;--ha-border-radius-md:8px;--ha-border-radius-lg:12px;--primary-font-family:Arial,sans-serif;font-family:Arial,sans-serif}homecall-card{display:block;width:${width}px;height:${height}px}</style><button id="toggle">Toggle picker and save</button><main></main>`,
  );
  await page.evaluate(registerHomeAssistantFixtures);
  await page.addScriptTag({ content: script });
  await page.evaluate(
    ({ liveStatus, recipient }) => {
      const c = document.createElement("homecall-card");
      if (!liveStatus)
        c._load = function () {
          this._phase = "ready";
          this._selection = [recipient];
          this._view.querySelector("summary span").textContent =
            this._t("1 Lautsprecher");
          this._button("Mikrofon starten");
        };
      c._hass = { locale: { language: "en" } };
      if (liveStatus) {
        window.statusRequests = 0;
        window.echoOnline = false;
        c._hass.states = { [recipient]: { state: "unavailable" } };
        c._hass.fetchWithAuth = async () => {
          window.statusRequests++;
          return {
            ok: true,
            json: async () => ({
              default_targets: [],
              targets: [
                {
                  entity_id: recipient,
                  name: "Kitchen",
                  available: window.echoOnline,
                },
              ],
            }),
          };
        };
      }
      c._lang = "en";
      c.config = { show_speaker_selection: false };
      document.querySelector("main").append(c);
      document.querySelector("#toggle").onclick = () =>
        c.setConfig({
          show_speaker_selection: c.config.show_speaker_selection === false,
        });
    },
    { liveStatus, recipient },
  );
  await expect(page.locator("homecall-card .main")).toBeVisible();
}
test("an offline Echo recovers from HA updates without a dashboard reload", async ({
  page,
}) => {
  await fixture(page, 246, 184, true);
  await expect(page.locator("homecall-card .main")).toHaveAttribute(
    "aria-label",
    "Retry",
  );
  const original = await geometry(page);
  await page.locator("homecall-card").evaluate((c) => {
    c.hass = {
      ...c._hass,
      states: { ...c._hass.states, "sensor.other": { state: "on" } },
    };
  });
  expect(await page.evaluate(() => window.statusRequests)).toBe(1);
  await page.locator("homecall-card").evaluate((c) => {
    window.echoOnline = true;
    c.hass = {
      ...c._hass,
      states: {
        ...c._hass.states,
        "notify.kitchen_speak": { state: "unknown" },
      },
    };
  });
  await expect(page.locator("homecall-card .main")).toHaveAttribute(
    "aria-label",
    "Start microphone",
  );
  expect(await page.evaluate(() => window.statusRequests)).toBe(2);
  expect((await geometry(page)).size).toBe(original.size);
});
test("Retry fetches current availability and keeps recovered recipients selected", async ({
  page,
}) => {
  await fixture(page, 246, 184, true);
  await expect(page.locator("homecall-card .main")).toHaveAttribute(
    "aria-label",
    "Retry",
  );
  await page.evaluate(() => {
    window.echoOnline = true;
  });
  await page.locator("homecall-card .main").click();
  await expect(page.locator("homecall-card .main")).toHaveAttribute(
    "aria-label",
    "Start microphone",
  );
  expect(await page.evaluate(() => window.statusRequests)).toBe(2);
  expect(
    await page.locator("homecall-card").evaluate((c) => c._selection),
  ).toEqual(["notify.kitchen_speak"]);
  await page.locator("homecall-card").evaluate((c) => {
    c._phase = "recording";
    c.hass = {
      ...c._hass,
      states: { "notify.kitchen_speak": { state: "unavailable" } },
    };
  });
  expect(await page.locator("homecall-card").evaluate((c) => c._phase)).toBe(
    "recording",
  );
  expect(await page.evaluate(() => window.statusRequests)).toBe(2);
});
async function geometry(page) {
  return page.locator("homecall-card").evaluate((e) => {
    const q = (s) => e.shadowRoot.querySelector(s).getBoundingClientRect(),
      c = q("ha-card"),
      h = q(".halo"),
      b = q(".main"),
      cx = h.x + h.width / 2,
      cy = h.y + h.height / 2;
    const gap = (s) => {
      const r = q(s);
      return r.width
        ? Math.hypot(
            Math.max(r.left - cx, 0, cx - r.right),
            Math.max(r.top - cy, 0, cy - r.bottom),
          ) -
            h.width / 2
        : null;
    };
    const footer = q(".info");
    return {
      cardWidth: c.width,
      cardHeight: c.height,
      size: b.width,
      top: b.top - c.top,
      bottom: c.bottom - b.bottom,
      discardGap: gap(".discard"),
      timerGap: gap(".time"),
      leftInset: footer.left - c.left,
      rightInset: c.right - footer.right,
      bottomInset: c.bottom - footer.bottom,
      captionVisible: !e.shadowRoot.querySelector(".action-label").hidden,
      selectorHidden: e.shadowRoot.querySelector(".targets").hidden,
    };
  });
}

for (const language of ["en", "de"]) {
  for (const picker of [false, true]) {
    test(`window resizing updates the mounted two-row card in ${language}, picker ${picker}`, async ({
      page,
    }) => {
      await fixture(page, 172, 120);
      if (picker) await page.locator("#toggle").click();
      await page.locator("homecall-card").evaluate((c, language) => {
        c._lang = language;
        c.style.width = "calc(50vw - 64px)";
      }, language);
      // Wait for browser rendering and the observer's scheduled frame, without
      // calling the card's layout method or using an arbitrary sleep.
      const render = () =>
        page.evaluate(
          () =>
            new Promise((resolve) => {
              requestAnimationFrame(() => requestAnimationFrame(resolve));
            }),
        );
      const resize = async (width) => {
        await page.setViewportSize({ width, height: 600 });
        await render();
        const current = await geometry(page);
        expect(current.cardWidth).toBeCloseTo(width / 2 - 64, 2);
        expect(current.cardHeight).toBe(120);
        expect(current.top).toBeCloseTo(current.bottom, 1);
        expect(current.leftInset).toBe(9);
        expect(current.rightInset).toBe(9);
        expect(current.bottomInset).toBe(9);
        return current;
      };
      const widths = [428, 448, 472, 483, 515, 526, 527, 528, 529, 535, 548];
      const reference = new Map();
      for (const phase of ["ready", "starting", "recording"]) {
        await page.locator("homecall-card").evaluate((c, phase) => {
          c._phase = phase;
          c._sampleRate = 48000;
          c._samples = 55 * c._sampleRate;
          c._button("Mikrofon starten");
          c._draw();
        }, phase);
        let previous = 0;
        for (const width of widths) {
          const current = await resize(width);
          expect(current.size).toBeGreaterThanOrEqual(previous);
          if (width >= 527 && width <= 529)
            expect(current.size - previous).toBeLessThanOrEqual(1);
          if (!picker && current.cardWidth >= 172)
            expect(current.size).toBeGreaterThanOrEqual(56);
          if (reference.has(width))
            expect(current.size).toBe(reference.get(width));
          else reference.set(width, current.size);
          if (phase === "recording") {
            expect(
              current.discardGap,
              `${width}: discard clearance`,
            ).toBeGreaterThanOrEqual(7.9);
            expect(
              current.timerGap,
              `${width}: timer clearance`,
            ).toBeGreaterThanOrEqual(7.9);
          }
          previous = current.size;
        }
        for (const width of [...widths].reverse()) {
          const current = await resize(width);
          expect(current.size).toBe(reference.get(width));
        }
        // Several changes before observing the result must settle at the final
        // window size, rather than leaving a stale diameter from an earlier one.
        for (const width of [535, 428, 548, 527, 472])
          await page.setViewportSize({ width, height: 600 });
        await render();
        expect((await geometry(page)).size).toBe(reference.get(472));
      }
    });
  }
}
for (const language of ["en", "de"]) {
  for (const picker of [false, true]) {
    test(`caption footer stays balanced through window resizing in ${language}, picker ${picker}`, async ({
      page,
    }) => {
      await fixture(page, 500, 312);
      if (picker) await page.locator("#toggle").click();
      await page.locator("homecall-card").evaluate((c, language) => {
        c._lang = language;
        c.style.width = "calc(100vw - 64px)";
        c.style.height = "calc(100vh - 64px)";
      }, language);
      // Exercise the observer in both directions, including a return from
      // compact/icon-only layouts to the full-size caption footer.
      for (const [width, height] of [
        [500, 312],
        [376, 312],
        [470, 376],
        [246, 184],
        [172, 120],
        [376, 312],
      ]) {
        await page.setViewportSize({ width: width + 64, height: height + 64 });
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        const idle = await geometry(page);
        expect(idle.cardWidth).toBe(width);
        expect(idle.cardHeight).toBe(height);
        for (const phase of [
          "ready",
          "starting",
          "recording",
          "recorded",
          "stopping",
          "sending",
        ]) {
          const result = await page
            .locator("homecall-card")
            .evaluate((c, phase) => {
              c._phase = phase;
              c._button(phase === "ready" ? "Mikrofon starten" : "Senden");
              c._syncPhase();
              const q = (selector) => c.shadowRoot.querySelector(selector);
              const rect = (selector) => q(selector).getBoundingClientRect();
              const card = rect("ha-card"),
                halo = rect(".halo"),
                caption = rect(".action-label"),
                footer = rect(".info");
              return {
                size: rect(".main").width,
                top: halo.top - card.top,
                bottom: card.bottom - caption.bottom,
                captionGap: caption.top - halo.bottom,
                captionVisible: !q(".action-label").hidden,
                captionLines: caption.height / 16,
                footerBottom: card.bottom - footer.bottom,
                footerLeft: footer.left - card.left,
                footerHeight: footer.height,
                discardHeight: rect(".discard").height,
              };
            }, phase);
          expect(result.size).toBe(idle.size);
          if (width >= 376) {
            expect(result.captionVisible).toBe(true);
            expect(result.captionGap).toBeGreaterThanOrEqual(12);
            expect(result.top).toBeGreaterThanOrEqual(20);
            expect(result.footerBottom).toBe(9);
            expect(result.footerLeft).toBe(21);
            expect(result.footerHeight).toBe(44);
            if (phase === "recording") expect(result.discardHeight).toBe(44);
            if (!picker && height === 312 && result.captionLines === 1)
              expect(Math.abs(result.top - result.bottom)).toBeLessThanOrEqual(
                3,
              );
          } else {
            expect(result.captionVisible).toBe(false);
            expect(result.footerBottom).toBe(9);
          }
          const current = await geometry(page);
          if (current.discardGap !== null)
            expect(current.discardGap).toBeGreaterThanOrEqual(8);
          if (current.timerGap !== null)
            expect(current.timerGap).toBeGreaterThanOrEqual(8);
        }
      }
    });
  }
}
for (const width of [174, 177.5, 215, 231]) {
  test(`saved selector cycles restore mounted size at ${width}×184`, async ({
    page,
  }) => {
    await fixture(page, width, 184);
    const off = await geometry(page);
    for (let cycle = 0; cycle < 3; cycle++) {
      await page.locator("#toggle").click();
      await expect(page.locator("homecall-card .targets")).toBeVisible();
      const on = await geometry(page);
      await page.locator("#toggle").click();
      await expect(page.locator("homecall-card .targets")).toBeHidden();
      await expect.poll(async () => (await geometry(page)).size).toBe(off.size);
      // On narrow cards the footer, rather than the picker, limits the circle.
      expect(on.size).toBeLessThanOrEqual(off.size);
      if (width >= 215) expect(on.size).toBeLessThan(off.size);
    }
    await page.locator("homecall-card").evaluate((c) => {
      c.hass = { ...c._hass, locale: { language: "de" } };
      c.hass = { ...c._hass, locale: { language: "en" } };
    });
    await expect.poll(async () => (await geometry(page)).size).toBe(off.size);
  });
}
for (const [width, height] of [
  [177.5, 184],
  [174, 184],
  [184, 184],
  [215, 184],
  [246, 184],
  [231, 184],
  [376, 312],
]) {
  test(`center and full halo clearance across phases at ${width}×${height}`, async ({
    page,
  }) => {
    await fixture(page, width, height);
    const idle = await geometry(page);
    if (width === 177.5) expect(idle.size).toBe(97);
    for (const phase of [
      "starting",
      "recording",
      "recorded",
      "sending",
      "sent",
      "error",
      "ready",
    ]) {
      await page.locator("homecall-card").evaluate((c, p) => {
        c._phase = p;
        c._view.querySelector(".time").textContent = "00:05";
        c._syncPhase();
        c._applyLayout();
      }, phase);
      const x = await geometry(page);
      expect(x.size).toBe(idle.size);
      expect(x.top).toBeCloseTo(idle.top, 1);
      expect(x.bottom).toBeCloseTo(idle.bottom, 1);
      if (!x.captionVisible) expect(x.top).toBeCloseTo(x.bottom, 1);
      expect(x.leftInset).toBeGreaterThanOrEqual(8);
      expect(x.rightInset).toBeGreaterThanOrEqual(8);
      expect(x.bottomInset).toBeGreaterThanOrEqual(8);
      if (x.discardGap !== null) expect(x.discardGap).toBeGreaterThanOrEqual(8);
      if (x.timerGap !== null) expect(x.timerGap).toBeGreaterThanOrEqual(8);
    }
  });
}

test("an offline DLNA speaker recovers when HA reports idle", async ({
  page,
}) => {
  await fixture(page, 246, 184, true, "media_player.jbl");
  await expect(page.locator("homecall-card .main")).toHaveAttribute(
    "aria-label",
    "Retry",
  );
  await page.locator("homecall-card").evaluate((c) => {
    window.echoOnline = true;
    c.hass = { ...c._hass, states: { "media_player.jbl": { state: "idle" } } };
  });
  await expect(page.locator("homecall-card .main")).toHaveAttribute(
    "aria-label",
    "Start microphone",
  );
  expect(
    await page.locator("homecall-card").evaluate((c) => c._selection),
  ).toEqual(["media_player.jbl"]);
});

for (const width of [177.5, 246]) {
  test(`icon control boundaries match at ${width}px`, async ({ page }) => {
    await fixture(page, width, 184);
    await page.locator("#toggle").click();
    const sizes = await page.locator("homecall-card").evaluate((c) => {
      const measure = (selector) => {
        const el = c.shadowRoot.querySelector(selector);
        const base = el.shadowRoot?.querySelector("button") || el;
        const r = base.getBoundingClientRect();
        return {
          width: r.width,
          height: r.height,
          radius: getComputedStyle(base).borderRadius,
        };
      };
      const picker = measure("summary");
      c._phase = "recorded";
      c._syncPhase();
      const discard = measure(".discard");
      c._phase = "error";
      c._syncPhase();
      const status = measure(".status-more");
      return { picker, discard, status };
    });
    const expected = width < 200 ? 32 : 44;
    for (const control of Object.values(sizes)) {
      expect(control.width).toBe(expected);
      expect(control.height).toBe(expected);
      expect(control.radius).toBe(sizes.picker.radius);
    }
  });
}

test("moving a mounted dashboard card does not fetch or rebuild it twice", async ({
  page,
}) => {
  await fixture(page, 177.5, 184, true);
  const original = await page.locator("homecall-card").evaluate((c) => {
    window.originalCardView = c.shadowRoot.querySelector("ha-card");
    const container = document.createElement("section");
    document.body.append(container);
    container.append(c);
    return window.statusRequests;
  });
  await expect
    .poll(() => page.evaluate(() => window.statusRequests))
    .toBe(original);
  expect(
    await page
      .locator("homecall-card")
      .evaluate(
        (c) =>
          c.shadowRoot.querySelector("ha-card") === window.originalCardView,
      ),
  ).toBe(true);
});

test("actual removal releases resources and unchanged action keeps its icon", async ({
  page,
}) => {
  await fixture(page);
  expect(
    await page.locator("homecall-card").evaluate((c) => {
      const icon = c.shadowRoot.querySelector(".main ha-icon");
      c._button("Geräte werden geladen …");
      c._button("Mikrofon starten");
      return icon === c.shadowRoot.querySelector(".main ha-icon");
    }),
  ).toBe(true);
  await page.locator("homecall-card").evaluate((c) => {
    window.removedCard = c;
    window.releases = 0;
    c._release = () => window.releases++;
    c.remove();
  });
  await expect.poll(() => page.evaluate(() => window.releases)).toBe(1);
  expect(
    await page.evaluate(() =>
      window.removedCard.shadowRoot.querySelector("ha-card"),
    ),
  ).toBeNull();
});

test("fast loading preserves the microphone; slow loading shows progress without allowing recording", async ({
  page,
}) => {
  await fixture(page, 215, 184, true);
  await page.locator("homecall-card").evaluate((c) => {
    window.echoOnline = true;
    window.resolveStatus = null;
    const fetchStatus = c._hass.fetchWithAuth;
    c._hass.fetchWithAuth = () =>
      new Promise((resolve) => {
        window.resolveStatus = async () => resolve(await fetchStatus());
      });
    window.loadPromise = c._load();
    window.loadingIcon = c.shadowRoot.querySelector(".main ha-icon");
  });
  const button = page.locator("homecall-card .main");
  expect(await button.evaluate((b) => !!b.loading)).toBe(false);
  expect(await button.evaluate((b) => !!b.disabled)).toBe(false);
  await expect(button).toHaveAttribute("aria-busy", "true");
  await button.click();
  expect(await page.locator("homecall-card").evaluate((c) => c._phase)).toBe(
    "loading",
  );
  await page.evaluate(async () => {
    await window.resolveStatus();
    await window.loadPromise;
  });
  expect(await button.evaluate((b) => !!b.loading)).toBe(false);
  expect(
    await button.evaluate(
      (b) => b.querySelector("ha-icon") === window.loadingIcon,
    ),
  ).toBe(true);
  await expect(button).toHaveAttribute("aria-disabled", "false");
  await page.locator("homecall-card").evaluate((c) => {
    window.loadPromise = c._load();
  });
  await expect.poll(() => button.evaluate((b) => !!b.loading)).toBe(true);
  await page.evaluate(async () => {
    await window.resolveStatus();
    await window.loadPromise;
  });
  expect(await button.evaluate((b) => !!b.loading)).toBe(false);
});

test("countdown and ring reach the limit without sending, and expose Send on a tiny card", async ({
  page,
}) => {
  await fixture(page, 177.5, 184);
  await page.locator("homecall-card").evaluate((c) => {
    c._phase = "recording";
    c._sampleRate = 48000;
    c._samples = 48000 * 30;
    c._button("Senden", "microphone");
    c._draw();
    cancelAnimationFrame(c._raf);
  });
  await expect(page.locator("homecall-card .time")).toHaveText("0:30");
  const progress = await page
    .locator("homecall-card ha-card")
    .evaluate((el) =>
      parseFloat(el.style.getPropertyValue("--homecall-recording-progress")),
    );
  expect(progress).toBeGreaterThanOrEqual(180);
  expect(progress).toBeLessThan(186);
  await page.locator("homecall-card").evaluate((c) => {
    window.sendsAtLimit = 0;
    c._finish = () => window.sendsAtLimit++;
    c._stopAtLimit();
  });
  await expect(page.locator("homecall-card .time")).toHaveText("0:00");
  await expect(page.locator("homecall-card .main ha-icon")).toHaveAttribute(
    "icon",
    "mdi:send-outline",
  );
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-tone",
    "blue",
  );
  await expect(page.locator("homecall-card .discard")).toBeVisible();
  await expect(page.locator("homecall-card .status-more")).toBeHidden();
  expect(await page.evaluate(() => window.sendsAtLimit)).toBe(0);
  await page.locator("homecall-card .main").click();
  expect(await page.evaluate(() => window.sendsAtLimit)).toBe(1);
});

test("microphone startup immediately shows preparation and ignores repeat clicks", async ({
  page,
}) => {
  await fixture(page);
  await page.locator("homecall-card").evaluate((c) => {
    window.AudioContext = class {
      constructor() {
        this.audioWorklet = { addModule: () => new Promise(() => {}) };
      }
      resume() {
        return new Promise(() => {});
      }
    };
    window.AudioWorkletNode ||= class {};
    window.isSecureContext ||
      Object.defineProperty(window, "isSecureContext", { value: true });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: () => new Promise(() => {}) },
    });
    window.startIcon = c.shadowRoot.querySelector(".main ha-icon");
  });
  await page.locator("homecall-card .main").click({ force: true });
  await expect(page.locator("homecall-card .main")).toHaveAttribute(
    "aria-label",
    "Preparing …",
  );
  expect(
    await page.locator("homecall-card .main").evaluate((b) => b.loading),
  ).toBe(true);
  await expect(page.locator("homecall-card .main")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  expect(
    await page.locator("homecall-card .main").evaluate((b) => !!b.disabled),
  ).toBe(false);
  await page.locator("homecall-card .main").click({ force: true });
  expect(
    await page.locator("homecall-card ha-card").getAttribute("data-phase"),
  ).toBe("starting");
  expect(
    await page
      .locator("homecall-card .main")
      .evaluate((b) => b.querySelector("ha-icon") === window.startIcon),
  ).toBe(true);
});

async function controlledRecorder(
  page,
  constructionFails = false,
  prepared = false,
  {
    width = 376,
    height = 350,
    deferReadiness = false,
    targets,
    defaults,
    language = "en",
  } = {},
) {
  await fixture(page, width, height);
  await page.locator("homecall-card").evaluate(
    async (c, { constructionFails, prepared, targets, defaults, language }) => {
      c._lang = language;
      if (targets) {
        c._defaultsAll = defaults === undefined;
        c._defaults = defaults || [];
        c._fillTargets(targets);
      }
      window.audioContexts = 0;
      window.recorderModules = 0;
      window.microphoneRequests = 0;
      window.isSecureContext ||
        Object.defineProperty(window, "isSecureContext", { value: true });
      window.AudioContext = class {
        constructor(options) {
          window.audioContexts++;
          this.sampleRate = options?.sampleRate || 96000;
          this.state = "running";
          this.audioWorklet = {
            addModule: async () => {
              window.recorderModules++;
            },
          };
        }
        resume() {
          this.state = "running";
          return Promise.resolve();
        }
        suspend() {
          this.state = "suspended";
          return Promise.resolve();
        }
        close() {
          this.state = "closed";
          return Promise.resolve();
        }
        createMediaStreamSource() {
          return { connect() {}, disconnect() {} };
        }
      };
      window.AudioWorkletNode = class {
        constructor() {
          if (constructionFails)
            throw new Error("Recorder construction failed");
          this.port = window.recorderPort = {
            postMessage(message) {
              window.stopRequested = message.type === "stop";
            },
            close() {},
          };
        }
        connect() {}
        disconnect() {}
      };
      window.microphoneTrack = Object.assign(new EventTarget(), {
        stop() {
          window.trackStopped = true;
        },
      });
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => {
            window.microphoneRequests++;
            return { getTracks: () => [window.microphoneTrack] };
          },
        },
      });
      window.uploads = [];
      c._hass.fetchWithAuth = async (url, options) => {
        if (options?.method === "POST") {
          const wav = new DataView(await options.body.arrayBuffer());
          window.uploads.push({
            url,
            samples: wav.getUint32(40, true) / 2,
            sampleRate: wav.getUint32(24, true),
            first: wav.getInt16(44, true),
            last: wav.getInt16(wav.byteLength - 2, true),
          });
          return {
            ok: true,
            json: async () => ({
              results: [{ accepted: true }],
              receipt: "private-audio-token",
              diagnostics: {
                diagnostic_id: "diagnostic-only-id",
                audio_fetches: 0,
                timings_ms: { conversion: 12 },
              },
            }),
          };
        }
        if (url.includes("diagnostic_id="))
          return {
            ok: true,
            json: async () => ({
              diagnostics: {
                diagnostic_id: "diagnostic-only-id",
                audio_fetches: 1,
                timings_ms: { conversion: 12, clip_to_first_fetch: 30 },
              },
            }),
          };
        throw new Error("Recording must not fetch status before capturing");
      };
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text) => {
            window.copiedDiagnostics = text;
          },
        },
      });
      if (prepared) {
        c._warmRecorder();
        await c._recorderPreparation.loaded;
        window.idleMicrophoneRequests = window.microphoneRequests;
        window.preparedContextState = c._recorderPreparation.context.state;
      }
    },
    { constructionFails, prepared, targets, defaults, language },
  );
  await page.locator("homecall-card .main").click();
  if (constructionFails) {
    await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
      "data-phase",
      "error",
    );
    return;
  }
  await expect
    .poll(() => page.evaluate(() => !!window.recorderPort))
    .toBe(true);
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "starting",
  );
  if (deferReadiness) return;
  await page.evaluate(() => {
    window.recorderPort.onmessage({ data: { type: "ready" } });
    window.recorderPort.onmessage({
      data: {
        type: "chunk",
        sequence: 0,
        samples: new Float32Array(12000).fill(0.25),
      },
    });
  });
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "recording",
  );
}

const skippedSpeakers = [
  {
    entity_id: "media_player.offline",
    name: "Living room speaker",
    transport: "sonos",
    available: false,
  },
  { entity_id: "notify.kitchen_speak", name: "Kitchen", available: true },
];
for (const explicit of [false, true]) {
  test(`skipped ${explicit ? "custom defaults" : "all-speaker defaults"} stay visible after a successful fetch with diagnostics off`, async ({
    page,
  }) => {
    await controlledRecorder(page, false, false, {
      targets: skippedSpeakers,
      defaults: explicit
        ? skippedSpeakers.map((target) => target.entity_id)
        : undefined,
    });
    await page.clock.install();
    await page.locator("homecall-card .main").click();
    await page.evaluate(() =>
      window.recorderPort.onmessage({
        data: { type: "stopped", total: 12000, reason: "requested" },
      }),
    );
    await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
      "data-partial-send",
      "true",
    );
    await expect(page.locator("homecall-card .status-more")).toBeVisible();
    await expect(page.locator("homecall-card .status")).toContainText(
      "Skipped: Living room speaker (Sonos).",
    );
    await expect(page.locator("homecall-card .status")).toContainText(
      "Living room speaker (Sonos)",
    );
    const result = await page
      .locator("homecall-card")
      .evaluate(async (card) => {
        await card._checkReceipt("unused", 0);
        return { timer: !!card._readyTimer, upload: window.uploads[0].url };
      });
    expect(result.timer).toBe(false);
    expect(result.upload).toContain("target=notify.kitchen_speak");
    expect(result.upload).not.toContain("media_player.offline");
    await page.clock.fastForward(6000);
    await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
      "data-phase",
      "sent",
    );
    await expect(page.locator("homecall-card .main ha-icon")).toHaveAttribute(
      "icon",
      "mdi:microphone",
    );
    await page.locator("homecall-card .status-more").click();
    await expect(page.locator("homecall-card .status-popover")).toContainText(
      "Skipped: Living room speaker (Sonos).",
    );
    await expect(
      page.locator("homecall-card .status-popover details"),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.locator("homecall-card .main").click();
    await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
      "data-phase",
      "starting",
    );
    await expect(page.locator("homecall-card .main")).toHaveAttribute(
      "aria-label",
      "Preparing …",
    );
    expect(await page.evaluate(() => window.uploads.length)).toBe(1);
    await expect(page.locator("homecall-card .status-more")).toBeHidden();
    await expect(page.locator("homecall-card .status-popover")).toBeHidden();
  });
}
test("unselected offline speakers cannot turn a complete send into a warning", async ({
  page,
}) => {
  await controlledRecorder(page, false, false, {
    targets: skippedSpeakers,
    defaults: ["notify.kitchen_speak"],
  });
  await page.clock.install({ time: new Date("2026-10-06T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-06T12:00:01Z"));
  await page.locator("homecall-card .main").click();
  await page.evaluate(() =>
    window.recorderPort.onmessage({
      data: { type: "stopped", total: 12000, reason: "requested" },
    }),
  );
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "sent",
  );
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-partial-send",
    "false",
  );
  await expect(page.locator("homecall-card .status-more")).toBeHidden();
  expect(
    await page.locator("homecall-card").evaluate((card) => !!card._readyTimer),
  ).toBe(true);
  await page.clock.fastForward(4999);
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "sent",
  );
  await page.clock.fastForward(1);
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "ready",
  );
  await expect(page.locator("homecall-card .status-more")).toBeHidden();
});

test("a rejected send retains Retry instead of the new-recording action", async ({
  page,
}) => {
  await controlledRecorder(page);
  await page.locator("homecall-card").evaluate((card) => {
    card._hass.fetchWithAuth = async () => ({
      ok: true,
      json: async () => ({ results: [{ accepted: false }] }),
    });
  });
  await page.locator("homecall-card .main").click();
  await page.evaluate(() =>
    window.recorderPort.onmessage({
      data: { type: "stopped", total: 12000, reason: "requested" },
    }),
  );
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "error",
  );
  await expect(page.locator("homecall-card .main")).toHaveAttribute(
    "aria-label",
    "Retry",
  );
  await expect(page.locator("homecall-card .main ha-icon")).toHaveAttribute(
    "icon",
    "mdi:refresh",
  );
  await page.clock.install();
  await page.clock.fastForward(6000);
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "error",
  );
  await page.locator("homecall-card .main").click();
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "ready",
  );
  await expect(page.locator("homecall-card .status-more")).toBeHidden();
});

for (const [width, height] of [
  [160, 56],
  [177.5, 184],
  [376, 312],
]) {
  test(`capture cues wait for actual input at ${width}×${height}`, async ({
    page,
  }) => {
    await controlledRecorder(page, false, true, {
      width,
      height,
      deferReadiness: true,
    });
    const card = page.locator("homecall-card ha-card");
    const button = page.locator("homecall-card .main");
    const before = await button.boundingBox();
    await expect(button).toHaveAttribute("aria-label", "Preparing …");
    await expect(card).toHaveAttribute("data-tone", "blue");
    await expect(page.locator("homecall-card .time")).toBeHidden();
    await expect(page.locator("homecall-card .wave")).toHaveCSS("opacity", "0");
    await expect(page.locator("homecall-card .status-more")).toBeHidden();
    expect(await button.evaluate((b) => b.loading)).toBe(true);
    await page.evaluate(() => {
      window.recorderPort.onmessage({ data: { type: "ready" } });
      window.recorderPort.onmessage({
        data: { type: "chunk", sequence: 0, samples: new Float32Array(12000) },
      });
    });
    await expect(card).toHaveAttribute("data-phase", "recording");
    await expect(card).toHaveAttribute("data-tone", "red");
    await expect(page.locator("homecall-card .time")).toBeVisible();
    await expect(page.locator("homecall-card .status")).toHaveText("Speak now");
    expect(await button.evaluate((b) => b.loading)).toBe(false);
    expect(await button.boundingBox()).toEqual(before);
    // A complete track is visible even at the first, silent input quantum.
    expect(
      await page
        .locator("homecall-card .halo")
        .evaluate((h) => getComputedStyle(h, "::before").content),
    ).toBe('""');
    await button.click();
    await expect(card).toHaveAttribute("data-phase", "stopping");
    await expect(page.locator("homecall-card .time")).toBeHidden();
    await expect(page.locator("homecall-card .wave")).toHaveCSS("opacity", "0");
    expect(await page.evaluate(() => window.uploads.length)).toBe(0);
  });
}

for (const [width, height] of [
  [160, 56],
  [177.5, 184],
  [246, 184],
  [376, 312],
]) {
  for (const selector of [false, true]) {
    test(`all state controls fit ${width}×${height} with picker ${selector}`, async ({
      page,
    }) => {
      await fixture(page, width, height);
      if (selector) await page.locator("#toggle").click();
      for (const lang of ["en", "de"]) {
        for (const phase of [
          "loading",
          "ready",
          "starting",
          "recording",
          "stopping",
          "recorded",
          "sending",
          "sent",
          "error",
        ]) {
          const controls = await page.locator("homecall-card").evaluate(
            (c, { phase, lang }) => {
              c._lang = lang;
              c._view.querySelector(".discard-label").textContent =
                c._t("Verwerfen");
              c._view.querySelector("summary span").textContent =
                c._t("1 Lautsprecher");
              c._phase = phase;
              c._loadingIndicator = phase === "loading";
              c._button(
                {
                  loading: "Geräte werden geladen …",
                  ready: "Mikrofon starten",
                  starting: "Vorbereitung …",
                  recording: "Sprich jetzt",
                  stopping: "Aufnahme wird abgeschlossen …",
                  recorded: "Senden",
                  sending: "Wird gesendet",
                  sent: "Neue Durchsage",
                  error: "Erneut versuchen",
                }[phase],
              );
              c._applyLayout();
              const root = c.shadowRoot;
              const card = root
                .querySelector("ha-card")
                .getBoundingClientRect();
              const visible = [
                ".main",
                ".discard",
                ".time",
                "summary",
                ".action-label",
                ".status-more",
              ]
                .map((selector) => ({
                  selector,
                  box: root.querySelector(selector).getBoundingClientRect(),
                }))
                .filter(({ box }) => box.width && box.height);
              // The short picker keeps a 32px touch target. Its painted 22px
              // speaker icon sits above the non-interactive countdown.
              const painted = visible.map((control) => {
                if (control.selector !== "summary" || !c._layout.short)
                  return control;
                return {
                  ...control,
                  box: root
                    .querySelector(".speaker-icon")
                    .getBoundingClientRect(),
                };
              });
              return {
                fits: visible.every(
                  ({ box: b }) =>
                    b.left >= card.left &&
                    b.right <= card.right &&
                    b.top >= card.top &&
                    b.bottom <= card.bottom,
                ),
                overlaps: painted.flatMap((a, i) =>
                  painted
                    .slice(i + 1)
                    .filter(
                      (b) =>
                        Math.min(a.box.right, b.box.right) -
                          Math.max(a.box.left, b.box.left) >
                          0.5 &&
                        Math.min(a.box.bottom, b.box.bottom) -
                          Math.max(a.box.top, b.box.top) >
                          0.5,
                    )
                    .map((b) => [a.selector, b.selector]),
                ),
                captionClipped:
                  !root.querySelector(".action-label").hidden &&
                  root.querySelector(".action-label").scrollWidth >
                    root.querySelector(".action-label").clientWidth + 1,
                timerHidden: root.querySelector(".time").hidden,
                waveformOpacity: getComputedStyle(root.querySelector(".wave"))
                  .opacity,
              };
            },
            { phase, lang },
          );
          expect(controls.fits, `${lang} ${phase}`).toBe(true);
          expect(controls.overlaps, `${lang} ${phase}`).toEqual([]);
          expect(controls.captionClipped, `${lang} ${phase}`).toBe(false);
          expect(controls.timerHidden, phase).toBe(
            !["recording", "recorded"].includes(phase),
          );
          expect(controls.waveformOpacity, phase).toBe(
            ["recording", "recorded"].includes(phase) ? "0.24" : "0",
          );
        }
      }
    });
  }
}

test("partial delivery keeps its warning after an audio fetch and offers details", async ({
  page,
}) => {
  await controlledRecorder(page);
  await page.locator("homecall-card").evaluate((c) => {
    c._recordingTargets = ["media_player.kitchen", "media_player.living_room"];
  });
  await page.locator("homecall-card .main").click();
  await page.evaluate(() =>
    window.recorderPort.onmessage({
      data: { type: "stopped", total: 12000, reason: "requested" },
    }),
  );
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "sent",
  );
  await expect(page.locator("homecall-card .status")).toContainText(
    "Some devices could not be reached.",
  );
  await expect(page.locator("homecall-card .main ha-icon")).toHaveAttribute(
    "icon",
    "mdi:microphone",
  );
  await expect(page.locator("homecall-card .status-more")).toBeVisible();
  await expect(
    page.locator("homecall-card .status-more ha-icon"),
  ).toHaveAttribute("icon", "mdi:alert-circle-outline");
  await expect(page.locator("homecall-card .status-more ha-icon")).toHaveCSS(
    "color",
    "rgb(255, 166, 0)",
  );
  expect(
    await page.locator("homecall-card").evaluate((c) => c._readyTimer),
  ).toBeUndefined();
  await page.locator("homecall-card .status-more").click();
  await expect(page.locator("homecall-card .status-popover")).toContainText(
    "Some devices could not be reached.",
  );
  await page.keyboard.press("Escape");
  await page.locator("homecall-card .main").click();
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-partial-send",
    "false",
  );
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "starting",
  );
  expect(await page.evaluate(() => window.uploads.length)).toBe(1);
});

test("prepared recording reuses code across announcements while releasing the microphone", async ({
  page,
}) => {
  await controlledRecorder(page, false, true);
  expect(await page.evaluate(() => window.idleMicrophoneRequests)).toBe(0);
  expect(await page.evaluate(() => window.preparedContextState)).toBe(
    "suspended",
  );
  expect(
    await page
      .locator("homecall-card")
      .evaluate((c) => c._diagnostics.recorder_prepared_before_tap),
  ).toBe(true);
  await page.locator("homecall-card .main").click();
  await page.evaluate(() => {
    window.recorderPort.onmessage({
      data: { type: "stopped", total: 12000, reason: "requested" },
    });
  });
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "sent",
  );
  expect(await page.evaluate(() => window.trackStopped)).toBe(true);
  expect(
    await page
      .locator("homecall-card")
      .evaluate((c) => c._recorderPreparation.context.state),
  ).toBe("suspended");
  await page.locator("homecall-card .main").click();
  await page.locator("homecall-card").evaluate((c) => {
    window.previousPort = window.recorderPort;
    c._start();
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.recorderPort !== window.previousPort),
    )
    .toBe(true);
  await page.evaluate(() => {
    window.recorderPort.onmessage({ data: { type: "ready" } });
    window.recorderPort.onmessage({
      data: {
        type: "chunk",
        sequence: 0,
        samples: new Float32Array(128).fill(0.5),
      },
    });
  });
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "recording",
  );
  expect(
    await page.evaluate(() => [
      window.audioContexts,
      window.recorderModules,
      window.microphoneRequests,
    ]),
  ).toEqual([1, 1, 2]);
  expect(
    await page
      .locator("homecall-card")
      .evaluate((c) => [c._samples, c._chunks[0][0]]),
  ).toEqual([128, 0.5]);
  await page.locator("homecall-card").evaluate((c) => {
    window.preparedContext = c._recorderPreparation.context;
    c.remove();
  });
  await expect
    .poll(() => page.evaluate(() => window.preparedContext.state))
    .toBe("closed");
});

test("hiding the page during final flush preserves samples and closes the prepared context", async ({
  page,
}) => {
  await controlledRecorder(page, false, true);
  await page.locator("homecall-card .main").click();
  await page.evaluate(() => {
    window.backgroundContext =
      document.querySelector("homecall-card")._recorderPreparation.context;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "stopping",
  );
  expect(await page.evaluate(() => !!window.trackStopped)).toBe(false);
  await page.evaluate(() => {
    window.recorderPort.onmessage({
      data: { type: "stopped", total: 12000, reason: "requested" },
    });
  });
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "sent",
  );
  expect(await page.evaluate(() => window.trackStopped)).toBe(true);
  expect(await page.evaluate(() => window.backgroundContext.state)).toBe(
    "closed",
  );
  expect(await page.evaluate(() => window.uploads[0].samples)).toBe(12000);
});

test("recorder construction failure releases the microphone without unhandled rejections", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await controlledRecorder(page, true);
  expect(await page.evaluate(() => window.trackStopped)).toBe(true);
  expect(await page.evaluate(() => window.uploads.length)).toBe(0);
  expect(errors).toEqual([]);
});

test("capture readiness, final flush, frozen recipients and private diagnostics", async ({
  page,
}) => {
  await controlledRecorder(page);
  await page.locator("homecall-card").evaluate((c) => {
    c.config.show_diagnostics = true;
  });
  await page.locator("homecall-card").evaluate((c) => {
    c._selection = ["notify.changed_speak"];
  });
  await page.locator("homecall-card .main").click();
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "stopping",
  );
  expect(await page.evaluate(() => window.stopRequested)).toBe(true);
  expect(await page.evaluate(() => window.uploads.length)).toBe(0);
  await page.evaluate(() => {
    window.recorderPort.onmessage({
      data: {
        type: "chunk",
        sequence: 1,
        samples: new Float32Array(128).fill(0.5),
      },
    });
    window.recorderPort.onmessage({
      data: { type: "stopped", total: 12128, reason: "requested" },
    });
  });
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "sent",
  );
  const uploads = await page.evaluate(() => window.uploads);
  expect(uploads).toHaveLength(1);
  expect(uploads[0]).toMatchObject({
    samples: 12128,
    sampleRate: 48000,
    first: 8191,
    last: 16383,
  });
  expect(uploads[0].url).toContain("notify.kitchen_speak");
  expect(uploads[0].url).not.toContain("changed_speak");
  expect(await page.evaluate(() => window.trackStopped)).toBe(true);
  await page.locator("homecall-card .status-more").click();
  await page.locator("homecall-card .status-popover summary").click();
  await page.getByText("Copy diagnostics", { exact: true }).click();
  const copied = await page.evaluate(() => window.copiedDiagnostics);
  expect(JSON.parse(copied).server.timings_ms.clip_to_first_fetch).toBe(30);
  expect(copied).not.toContain("private-audio-token");
  expect(copied).not.toContain("http");
});

test("legacy review config cannot interrupt the flushed Send flow", async ({
  page,
}) => {
  await controlledRecorder(page);
  await page.locator("homecall-card").evaluate((card) => {
    card.config.preview_before_send = true; // Older saved YAML is harmless.
  });
  await page.locator("homecall-card .main").click();
  await page.evaluate(() => {
    window.recorderPort.onmessage({
      data: { type: "stopped", total: 12000, reason: "requested" },
    });
  });
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "sent",
  );
  await expect(page.locator("homecall-card .status-popover audio")).toHaveCount(
    0,
  );
  expect(await page.evaluate(() => window.uploads.length)).toBe(1);
  expect(await page.evaluate(() => window.trackStopped)).toBe(true);
  await expect(
    page.locator("homecall-card .status-popover details"),
  ).toHaveCount(0);
});

test("diagnostic copy starts the clipboard write before refresh and retains the clicked trace", async ({
  page,
}) => {
  await controlledRecorder(page);
  await page.locator("homecall-card").evaluate((c) => {
    c.config.show_diagnostics = true;
  });
  await page.locator("homecall-card .main").click();
  await page.evaluate(() =>
    window.recorderPort.onmessage({
      data: { type: "stopped", total: 12000, reason: "requested" },
    }),
  );
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "sent",
  );
  await page.locator("homecall-card").evaluate((c) => {
    c._hass.fetchWithAuth = () =>
      new Promise((resolve) => {
        window.finishDiagnosticFetch = resolve;
      });
    window.ClipboardItem = class {
      constructor(data) {
        this.data = data;
      }
      getType(type) {
        return this.data[type];
      }
    };
    navigator.clipboard.write = async (items) => {
      window.clipboardWriteStarted = true;
      window.copiedDiagnostics = await (
        await items[0].getType("text/plain")
      ).text();
    };
  });
  await page.locator("homecall-card .status-more").click();
  await page.locator("homecall-card .status-popover summary").click();
  await page.getByText("Copy diagnostics", { exact: true }).click();
  expect(await page.evaluate(() => window.clipboardWriteStarted)).toBe(true);
  expect(await page.evaluate(() => window.copiedDiagnostics)).toBeUndefined();
  await page.locator("homecall-card").evaluate((c) => {
    c._diagnostics = { server: { diagnostic_id: "new-recording" } };
    window.finishDiagnosticFetch({
      ok: true,
      json: async () => ({
        diagnostics: {
          diagnostic_id: "diagnostic-only-id",
          timings_ms: { clip_to_first_fetch: 42 },
        },
      }),
    });
  });
  await expect
    .poll(() => page.evaluate(() => window.copiedDiagnostics))
    .toBeTruthy();
  const copied = JSON.parse(
    await page.evaluate(() => window.copiedDiagnostics),
  );
  expect(copied.server.diagnostic_id).toBe("diagnostic-only-id");
  expect(copied.server.timings_ms.clip_to_first_fetch).toBe(42);
  expect(
    await page
      .locator("homecall-card")
      .evaluate((c) => c._diagnostics.server.diagnostic_id),
  ).toBe("new-recording");
});

test("missing flush acknowledgement fails without uploading partial audio", async ({
  page,
}) => {
  await page.clock.install();
  await controlledRecorder(page);
  await page.locator("homecall-card .main").click();
  await page.clock.fastForward(2000);
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "error",
  );
  expect(await page.evaluate(() => window.uploads.length)).toBe(0);
  expect(await page.evaluate(() => window.trackStopped)).toBe(true);
});

for (const interruptedBy of ["microphone", "context"]) {
  test(`unexpected ${interruptedBy} interruption stops recording without uploading`, async ({
    page,
  }) => {
    await controlledRecorder(page);
    await page.locator("homecall-card").evaluate((c, interruptedBy) => {
      if (interruptedBy === "microphone")
        window.microphoneTrack.dispatchEvent(new Event("ended"));
      else {
        c._context.state = "interrupted";
        c._context.onstatechange();
      }
    }, interruptedBy);
    await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
      "data-phase",
      "error",
    );
    expect(await page.evaluate(() => window.uploads.length)).toBe(0);
    expect(await page.evaluate(() => window.trackStopped)).toBe(true);
    expect(
      await page.locator("homecall-card").evaluate((c) => c._chunks.length),
    ).toBe(0);
    expect(
      await page
        .locator("homecall-card")
        .evaluate((c) => c._diagnostics.recorder_error),
    ).toBe(
      interruptedBy === "microphone"
        ? "microphone_ended"
        : "context_interrupted",
    );
  });
}

for (const width of [160, 177.5, 246, 376]) {
  test(`one-row controls stay centered and speaker/timer share the center at ${width}px`, async ({
    page,
  }) => {
    await fixture(page, width, 56);
    await page.locator("#toggle").click();
    for (const phase of [
      "ready",
      "loading",
      "starting",
      "recording",
      "recorded",
      "sending",
      "sent",
      "error",
    ]) {
      await page.locator("homecall-card").evaluate((c, phase) => {
        c._phase = phase;
        c._syncPhase();
        c._applyLayout();
      }, phase);
      const g = await page.locator("homecall-card").evaluate((c) => {
        const q = (s) => c.shadowRoot.querySelector(s).getBoundingClientRect();
        const card = q("ha-card"),
          main = q(".main"),
          picker = q("summary"),
          trash = q(".discard"),
          time = q(".time"),
          wave = q(".wave");
        const cy = (r) => r.top + r.height / 2;
        return {
          height: card.height,
          center: cy(card),
          main: cy(main),
          picker: cy(picker),
          trash: trash.height ? cy(trash) : null,
          time: time.height
            ? {
                top: time.top,
                bottom: time.bottom,
                cx: time.left + time.width / 2,
              }
            : null,
          pickerBottom: picker.bottom,
          pickerTop: picker.top,
          pickerCenterX: picker.left + picker.width / 2,
          bottom: card.bottom,
          waveLeft: wave.left,
          waveRight: wave.right,
          pickerLeft: picker.left,
          trashRight: trash.right,
          mainWidth: main.width,
        };
      });
      expect(g.height).toBe(56);
      expect(g.main).toBeCloseTo(g.center, 1);
      if (!g.time) expect(g.picker).toBeCloseTo(g.center, 1);
      if (g.trash !== null) expect(g.trash).toBeCloseTo(g.center, 1);
      if (g.time) {
        expect((g.pickerTop + g.time.bottom) / 2).toBeCloseTo(g.center - 3, 1);
        expect(g.time.top).toBeGreaterThanOrEqual(g.pickerBottom);
        expect(g.time.bottom).toBeLessThanOrEqual(g.bottom);
        expect(g.time.cx).toBeCloseTo(g.pickerCenterX, 1);
      }
      expect(g.waveRight).toBeLessThan(g.pickerLeft);
      if (g.trash !== null) expect(g.waveLeft).toBeGreaterThan(g.trashRight);
      expect(g.mainWidth).toBe(36);
    }
    await page.locator("homecall-card").evaluate((c) => {
      c._phase = "ready";
      c._syncPhase();
      c._view.querySelector(".list").textContent = "Kitchen";
    });
    await page.locator("homecall-card summary").click();
    await expect(page.locator("homecall-card .list")).toBeVisible();
    const list = await page.locator("homecall-card .list").boundingBox();
    expect(list.width).toBeGreaterThanOrEqual(240);
    await page.keyboard.press("Escape");
    await expect(page.locator("homecall-card .list")).toBeHidden();
  });
}

for (const width of [160, 177.5, 246, 376]) {
  for (const selector of [true, false]) {
    test(`one-row speaker/timer group centers at ${width}px with selector ${selector}`, async ({
      page,
    }) => {
      await fixture(page, width, 56);
      if (selector) await page.locator("#toggle").click();
      await page.locator("homecall-card").evaluate((c) => {
        c._phase = "starting";
        c._syncPhase();
      });
      await expect(page.locator("homecall-card .time")).toBeHidden();
      for (const phase of ["recording", "recorded"]) {
        const geometry = await page
          .locator("homecall-card")
          .evaluate((c, phase) => {
            c._phase = phase;
            c._view.querySelector(".time").textContent = "0:43";
            c._syncPhase();
            const time = c._view.querySelector(".time");
            const range = document.createRange();
            range.selectNodeContents(time);
            const digits = range.getBoundingClientRect();
            const card = c._view.getBoundingClientRect();
            const timer = time.getBoundingClientRect();
            const speaker = c._view
              .querySelector("summary")
              .getBoundingClientRect();
            const speakerIcon = c._view
              .querySelector(".speaker-icon")
              .getBoundingClientRect();
            const mic = c._view.querySelector(".main").getBoundingClientRect();
            const discard = c._view
              .querySelector(".discard")
              .getBoundingClientRect();
            const dot = getComputedStyle(time, "::before");
            return {
              digitX: digits.x + digits.width / 2,
              digitY: digits.y + digits.height / 2,
              timerX: timer.x + timer.width / 2,
              timerY: timer.y + timer.height / 2,
              speakerX: speaker.x + speaker.width / 2,
              groupY: (speaker.top + timer.bottom) / 2,
              visibleGroupY: (speakerIcon.top + timer.bottom) / 2,
              controlGap: timer.top - speaker.bottom,
              iconGap: timer.top - speakerIcon.bottom,
              topInset: speakerIcon.top - card.top,
              hitAreaTopInset: speaker.top - card.top,
              bottomInset: card.bottom - timer.bottom,
              micY: mic.y + mic.height / 2,
              discardY: discard.height ? discard.y + discard.height / 2 : null,
              cardY: card.y + card.height / 2,
              dotPosition: dot.position,
              dotTop: parseFloat(dot.top),
              timerHeight: timer.height,
              waveformRight: c._view
                .querySelector(".wave")
                .getBoundingClientRect().right,
              timerLeft: timer.left,
            };
          }, phase);
        expect(geometry.digitX).toBeCloseTo(geometry.timerX, 1);
        if (selector) {
          expect(geometry.digitX).toBeCloseTo(geometry.speakerX, 1);
          expect(geometry.groupY).toBeCloseTo(geometry.cardY - 3, 1);
          expect(
            Math.abs(geometry.visibleGroupY - geometry.cardY),
          ).toBeLessThanOrEqual(0.5);
          expect(geometry.controlGap).toBeGreaterThanOrEqual(0);
          expect(geometry.iconGap).toBeGreaterThanOrEqual(5);
          expect(
            Math.abs(geometry.topInset - geometry.bottomInset),
          ).toBeLessThanOrEqual(1);
          expect(geometry.hitAreaTopInset).toBeGreaterThanOrEqual(2);
          expect(geometry.bottomInset).toBeGreaterThanOrEqual(8);
        } else expect(geometry.timerY).toBeCloseTo(geometry.cardY, 1);
        expect(geometry.micY).toBeCloseTo(geometry.cardY, 1);
        expect(geometry.discardY).toBeCloseTo(geometry.cardY, 1);
        if (phase === "recording") {
          expect(
            geometry.timerLeft - geometry.waveformRight,
          ).toBeGreaterThanOrEqual(12);
          expect(geometry.dotPosition).toBe("absolute");
          expect(geometry.dotTop).toBeCloseTo(geometry.timerHeight / 2, 1);
        }
      }
      for (const phase of [
        "stopping",
        "sending",
        "sent",
        "error",
        "ready",
        "starting",
      ]) {
        await page.locator("homecall-card").evaluate((c, phase) => {
          c._phase = phase;
          c._syncPhase();
        }, phase);
        await expect(page.locator("homecall-card .time")).toBeHidden();
        if (selector) {
          const center = await page.locator("homecall-card").evaluate((c) => {
            const box = (selector) =>
              c.shadowRoot.querySelector(selector).getBoundingClientRect();
            const speaker = box("summary"),
              mic = box(".main");
            return {
              speakerY: speaker.y + speaker.height / 2,
              micY: mic.y + mic.height / 2,
            };
          });
          expect(center.speakerY).toBeCloseTo(center.micY, 1);
        }
      }
    });
  }
}

for (const language of ["en", "de"]) {
  test(`recording limit caption clears the footer controls in ${language}`, async ({
    page,
  }) => {
    await fixture(page, 470, 312);
    await page.locator("homecall-card").evaluate((c, language) => {
      c._lang = language;
      c._phase = "recording";
      c._started = performance.now() - 60000;
      c._stopAtLimit();
    }, language);
    await expect(page.locator("homecall-card .action-label")).toBeVisible();
    await expect(page.locator("homecall-card .status-more")).toBeHidden();
    const positions = await page.locator("homecall-card").evaluate((c) => {
      const rect = (selector) =>
        c.shadowRoot.querySelector(selector).getBoundingClientRect().toJSON();
      return {
        caption: rect(".action-label"),
        discard: rect(".discard"),
        time: rect(".time"),
      };
    });
    expect(positions.caption.left).toBeGreaterThan(positions.discard.right);
    expect(positions.caption.right).toBeLessThan(positions.time.left);
    await expect(page.locator("homecall-card .status")).toHaveText(
      language === "de"
        ? "Zeitlimit erreicht - bereit zum Senden."
        : "Limit reached - ready to send.",
    );
  });
}

test("normal recording keeps the status icon hidden through flush, upload, success and reset", async ({
  page,
}) => {
  await page.clock.install();
  await controlledRecorder(page);
  await page.locator("homecall-card").evaluate((c) => {
    const fetch = c._hass.fetchWithAuth;
    c._hass.fetchWithAuth = async (url, options) => {
      if (options?.method === "POST")
        await new Promise((resolve) => {
          window.finishUpload = resolve;
        });
      return fetch(url, options);
    };
  });
  await page.locator("homecall-card .main").click();
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "stopping",
  );
  await expect(page.locator("homecall-card .status-more")).toBeHidden();
  await page.evaluate(() =>
    window.recorderPort.onmessage({
      data: { type: "stopped", total: 12000, reason: "requested" },
    }),
  );
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "sending",
  );
  await expect(page.locator("homecall-card .status-more")).toBeHidden();
  await page.evaluate(() => window.finishUpload());
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "sent",
  );
  await expect(page.locator("homecall-card .status-more")).toBeHidden();
  await page.clock.fastForward(5000);
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "ready",
  );
  await expect(page.locator("homecall-card .status-more")).toBeHidden();
  await page.locator("homecall-card .main").click();
  await expect
    .poll(() => page.evaluate(() => !!window.recorderPort.onmessage))
    .toBe(true);
  await page.evaluate(() =>
    window.microphoneTrack.dispatchEvent(new Event("ended")),
  );
  await expect(page.locator("homecall-card ha-card")).toHaveAttribute(
    "data-phase",
    "error",
  );
  await page.locator("homecall-card .status-more").click();
  await expect(page.locator("homecall-card .status-popover")).toBeVisible();
  await expect(
    page.locator("homecall-card .status-popover details"),
  ).toHaveCount(0);
  await expect(page.locator("homecall-card .status-popover pre")).toHaveCount(
    0,
  );
});

test("the native editor enables diagnostics explicitly and removes the option when disabled", async ({
  page,
}) => {
  await fixture(page);
  const config = await page.evaluate(() => {
    const editor = document.createElement("homecall-card-editor");
    editor.setConfig({
      type: "custom:homecall-card",
      show_speaker_selection: false,
    });
    document.querySelector("main").append(editor);
    const form = editor.shadowRoot.querySelector(".troubleshooting ha-form");
    const initial = form.data.show_diagnostics;
    const fields = form.schema;
    const emitted = [];
    editor.addEventListener("config-changed", (event) =>
      emitted.push(event.detail.config),
    );
    form.dispatchEvent(
      new CustomEvent("value-changed", {
        detail: { value: { ...form.data, show_diagnostics: true } },
      }),
    );
    const savedEditor = document.createElement("homecall-card-editor");
    savedEditor.setConfig(emitted[0]);
    document.querySelector("main").append(savedEditor);
    savedEditor.addEventListener("config-changed", (event) =>
      emitted.push(event.detail.config),
    );
    const savedForm = savedEditor.shadowRoot.querySelector(
      ".troubleshooting ha-form",
    );
    const enabled = savedForm.data.show_diagnostics;
    savedForm.dispatchEvent(
      new CustomEvent("value-changed", {
        detail: { value: { ...savedForm.data, show_diagnostics: false } },
      }),
    );
    return { initial, fields, enabled, emitted };
  });
  expect(config.initial).toBe(false);
  expect(config.fields).toEqual([
    { name: "show_diagnostics", selector: { boolean: {} } },
  ]);
  expect(config.enabled).toBe(true);
  expect(config.emitted[0]).toMatchObject({
    show_diagnostics: true,
    show_speaker_selection: false,
  });
  expect(config.emitted[1]).not.toHaveProperty("show_diagnostics");
  expect(config.emitted[1].show_speaker_selection).toBe(false);
});

for (const width of [354, 376, 470]) {
  test(`large-card captions remain complete and useful at ${width}px`, async ({
    page,
  }) => {
    await fixture(page, width, 312);
    for (const language of ["en", "de"]) {
      for (const phase of [
        "loading",
        "ready",
        "starting",
        "recording",
        "stopping",
        "recorded",
        "sending",
        "sent",
        "error",
      ]) {
        const result = await page.locator("homecall-card").evaluate(
          (c, { language, phase }) => {
            c._lang = language;
            c._phase = phase;
            c._button(
              {
                loading: "Geräte werden geladen …",
                ready: "Mikrofon starten",
                starting: "Vorbereitung …",
                recording: "Senden",
                stopping: "Aufnahme wird abgeschlossen …",
                recorded: "Senden",
                sending: "Wird gesendet",
                sent: "Neue Durchsage",
                error: "Erneut versuchen",
              }[phase],
            );
            c._applyLayout();
            const label = c.shadowRoot.querySelector(".action-label");
            return {
              visible: !label.hidden,
              text: label.textContent,
              height: label.getBoundingClientRect().height,
              fontSize: getComputedStyle(label).fontSize,
              clipped: label.scrollWidth > label.clientWidth + 1,
            };
          },
          { language, phase },
        );
        expect(result.visible, language + " " + phase).toBe(true);
        expect(result.text).not.toContain("...");
        expect(result.text).not.toContain("…");
        if (["loading", "starting", "stopping"].includes(phase))
          expect(result.height).toBe(16);
        expect(result.height).toBeLessThanOrEqual(32);
        expect(result.clipped).toBe(false);
        expect(result.fontSize).toBe("14px");
        if (phase === "sent")
          expect(result.text).toBe(
            language === "de" ? "Neue Durchsage" : "New announcement",
          );
        if (phase === "recording")
          expect(result.text).toBe(
            language === "de" ? "Sprich jetzt" : "Speak now",
          );
      }
    }
  });
}

test("empty footer space keeps complete English actions visible at 323px", async ({
  page,
}) => {
  await fixture(page, 323, 312);
  for (const [phase, action, caption] of [
    ["ready", "Mikrofon starten", "Start microphone"],
    ["sent", "Neue Durchsage", "New announcement"],
  ]) {
    await page.locator("homecall-card").evaluate(
      (c, { phase, action }) => {
        c._phase = phase;
        c._button(action);
        c._applyLayout();
      },
      { phase, action },
    );
    const label = page.locator("homecall-card .action-label");
    await expect(label).toBeVisible();
    await expect(label).toHaveText(caption);
    expect(
      await label.evaluate(
        (l) => l.scrollWidth <= l.clientWidth + 1 && l.scrollHeight <= 32,
      ),
    ).toBe(true);
  }
});

for (const picker of [false, true]) {
  test(`two-row circle grows through 200px and stays stable across phases, picker ${picker}`, async ({
    page,
  }) => {
    await fixture(page, 190, 120);
    if (picker) await page.locator("#toggle").click();
    let previousSize = 0;
    const sizes = new Map();
    for (const width of [
      150, 160, 172, 177.5, 190, 193.5, 195, 199, 199.5, 200, 200.5, 203.5, 205,
      210,
    ]) {
      await page.locator("homecall-card").evaluate((c, width) => {
        c.style.width = width + "px";
        c._applyLayout();
      }, width);
      let first;
      for (const phase of [
        "ready",
        "starting",
        "recording",
        "stopping",
        "recorded",
        "sending",
        "sent",
        "error",
      ]) {
        await page.locator("homecall-card").evaluate((c, phase) => {
          c._phase = phase;
          c._button("Mikrofon starten");
          c._applyLayout();
        }, phase);
        const current = await geometry(page);
        if (!first) first = current;
        expect(current.size, `${width} ${phase}`).toBe(first.size);
        expect(current.top, `${width} ${phase}`).toBe(first.top);
        expect(current.leftInset).toBe(first.leftInset);
        expect(current.rightInset).toBe(first.rightInset);
        expect(current.bottomInset).toBe(first.bottomInset);
        if (phase === "recording") {
          expect(current.discardGap, `${width} discard`).toBeGreaterThanOrEqual(
            7.9,
          );
          expect(current.timerGap, `${width} timer`).toBeGreaterThanOrEqual(
            7.9,
          );
        }
      }
      expect(first.size, `${width}: must not shrink`).toBeGreaterThanOrEqual(
        previousSize,
      );
      if (!picker && width >= 172)
        expect(
          first.size,
          `${width}: usable microphone size`,
        ).toBeGreaterThanOrEqual(56);
      if (width >= 199.5 && width <= 200.5)
        expect(first.size - previousSize).toBeLessThanOrEqual(1);
      previousSize = first.size;
      sizes.set(width, first.size);
    }
    // Resize the mounted card back down as a user drags the window narrower.
    for (const width of [203.5, 200, 199.5, 193.5, 177.5, 172]) {
      await page.locator("homecall-card").evaluate((c, width) => {
        c.style.width = width + "px";
      }, width);
      await expect
        .poll(async () => (await geometry(page)).size)
        .toBe(sizes.get(width));
      const resized = await geometry(page);
      expect(resized.size).toBeLessThanOrEqual(previousSize);
      previousSize = resized.size;
    }
  });
}
