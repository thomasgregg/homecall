import { registerHomeAssistantFixtures } from "../tests/browser/ha-fixture.js";
registerHomeAssistantFixtures();
await import("../../custom_components/homecall/frontend/homecall-card.js");
let allStates = false;
let sizing = false;
const phases = {
  loading: [
    "Loading speakers",
    "Geräte werden geladen …",
    "microphone",
    "Geräte werden geladen …",
  ],
  ready: ["Start", "Mikrofon starten", "microphone", "Tippe auf das Mikrofon"],
  starting: [
    "Preparing",
    "Vorbereitung …",
    "microphone",
    "Mikrofon wird vorbereitet …",
  ],
  recording: ["Speak now", "Sprich jetzt", "microphone", "Sprich jetzt"],
  stopping: [
    "Finishing",
    "Aufnahme wird abgeschlossen …",
    "stop",
    "Aufnahme wird abgeschlossen …",
  ],
  recorded: [
    "Ready to send",
    "Senden",
    "send-outline",
    "Zeitlimit erreicht - bereit zum Senden.",
  ],
  sending: [
    "Sending",
    "Wird gesendet",
    "volume-high",
    "Deine Nachricht wird vorbereitet …",
  ],
  sent: ["Sent", "Neue Durchsage", "check", "An 1 Lautsprecher gesendet."],
  partial: [
    "Partial delivery",
    "Mikrofon starten",
    "microphone",
    "Einige Geräte konnten nicht erreicht werden.",
  ],
  error: [
    "Retry",
    "Erneut versuchen",
    "refresh",
    "Mikrofon konnte nicht gestartet werden.",
  ],
};
function render() {
  const gallery = document.querySelector("#gallery");
  gallery.replaceChildren();
  const picker = document.querySelector("#picker").checked;
  const lang = document.querySelector("#language").value;
  const rows = sizing
    ? [
        ["Narrow dashboard · 172 × 120px", 172, 120],
        ["Edit-mode width · 193.5 × 120px", 193.5, 120],
        ["Dashboard width · 203.5 × 120px", 203.5, 120],
      ]
    : allStates
      ? [["Every state", 376, 312]]
      : [
          ["One row", 246, 56],
          ["Compact", 177.5, 184],
          ["Large", 376, 312],
        ];
  for (const [name, width, height] of rows) {
    const heading = document.createElement("h2");
    heading.className = "row-title";
    heading.textContent = name;
    const grid = document.createElement("div");
    grid.className = allStates ? "grid all" : "grid";
    gallery.append(heading, grid);
    for (const phase of allStates
      ? Object.keys(phases)
      : ["ready", "starting", "recording"]) {
      const item = document.createElement("section");
      item.className = "case";
      const title = document.createElement("div");
      title.className = "phase";
      title.textContent = phases[phase][0];
      const card = document.createElement("homecall-card");
      card.style.cssText = `width:${width}px;height:${height}px;max-width:100%`;
      card._load = function () {
        this._lang = lang;
        this._targets = [
          {
            entity_id: "media_player.kitchen",
            name: "Kitchen",
            available: true,
          },
        ];
        this._selection = ["media_player.kitchen"];
        this._phase = phase === "partial" ? "sent" : phase;
        this._partialSend = phase === "partial";
        this._loadingIndicator = phase === "loading";
        this._sampleRate = 48000;
        this._samples = phase === "recorded" ? 48000 * 60 : 48000 * 12;
        this._recordedAtLimit = phase === "recorded";
        this._levels = Array.from(
          { length: 64 },
          (_, i) =>
            0.04 + 0.35 * Math.sin(i * 0.83) ** 2 * Math.sin(i * 0.23) ** 2,
        );
        const summary = this._view.querySelector("summary");
        summary.querySelector("span").textContent = this._t("1 Lautsprecher");
        summary.setAttribute("aria-label", this._t("1 Lautsprecher"));
        this._button(phases[phase][1], phases[phase][2]);
        this._setStatus(
          phase === "sent"
            ? this._t("An {count} Lautsprecher gesendet.", { count: 1 })
            : phases[phase][3],
        );
        this._applyLayout();
        this._draw();
        cancelAnimationFrame(this._raf);
        // A static preview cannot start a real recording or send anything.
        this._view.querySelector(".main").onclick = null;
        this._view.querySelector(".discard").onclick = null;
        summary.onclick = (event) => event.preventDefault();
      };
      card.config = { show_speaker_selection: picker };
      card._hass = { locale: { language: lang } };
      card._lang = lang;
      item.append(title, card);
      grid.append(item);
    }
  }
}
document.querySelector("#readiness").onclick = () => {
  allStates = false;
  sizing = false;
  updateMode();
};
document.querySelector("#states").onclick = () => {
  allStates = true;
  sizing = false;
  updateMode();
};
document.querySelector("#sizing").onclick = () => {
  allStates = false;
  sizing = true;
  updateMode();
};
function updateMode() {
  document
    .querySelector("#readiness")
    .setAttribute("aria-pressed", String(!allStates && !sizing));
  document
    .querySelector("#states")
    .setAttribute("aria-pressed", String(allStates));
  document
    .querySelector("#sizing")
    .setAttribute("aria-pressed", String(sizing));
  render();
}
document.querySelector("#picker").onchange = render;
document.querySelector("#language").onchange = render;
document.querySelector("#theme").onclick = (event) => {
  const dark = document.documentElement.classList.toggle("dark");
  event.currentTarget.setAttribute("aria-pressed", String(dark));
  event.currentTarget.textContent = dark ? "Light theme" : "Dark theme";
  for (const card of document.querySelectorAll("homecall-card")) {
    card._draw();
    cancelAnimationFrame(card._raf);
  }
};
await document.fonts.ready;
render();
