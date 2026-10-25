import { homeCallLayout, homeCallRecipientBounds } from "./layout.js";
async function homeCallNativeForms() {
  if (customElements.get("ha-form")) return;
  if (!window.loadCardHelpers)
    throw new Error("Home Assistant form components are unavailable.");
  const helpers = await window.loadCardHelpers();
  const card = helpers.createCardElement({ type: "entities", entities: [] });
  await card.constructor.getConfigElement();
}

async function homeCallNativeSpeakerControls(element, hass) {
  await homeCallNativeForms();
  const names = ["ha-list", "ha-check-list-item", "ha-expansion-panel"];
  if (names.every((name) => customElements.get(name))) return;
  // HA’s native To-do card imports its checklist; the form imports expansion panels.
  // Ask HA to load its own modules, without copied controls or chunk URLs.
  const helpers = await window.loadCardHelpers();
  helpers.createCardElement({
    type: "todo-list",
    entity: "todo.homecall_component_loader",
  });
  const form = document.createElement("ha-form");
  form.hidden = true;
  form.hass = hass;
  form.data = {};
  form.schema = [{ name: "settings", type: "expandable", schema: [] }];
  element.shadowRoot.append(form);
  let timeout;
  try {
    await Promise.race([
      Promise.all(names.map((name) => customElements.whenDefined(name))),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error("Home Assistant speaker controls are unavailable."),
            ),
          10000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
    form.remove();
  }
}
function homeCallSpeakerAvailable(target, hass) {
  const state = hass?.states?.[target.entity_id]?.state;
  return state === undefined
    ? target.available
    : state !== "unavailable" &&
        (!target.entity_id.startsWith("media_player.") || state !== "unknown");
}
function homeCallSpeakerIntegration(target) {
  return (
    {
      dlna: "DLNA",
      sonos: "Sonos",
      music_assistant: "Music Assistant",
      cast: "Google Cast",
      echomuse: "EchoMuse",
    }[target.transport] ||
    (target.entity_id.startsWith("notify.") &&
    target.entity_id.endsWith("_speak")
      ? "Alexa"
      : "")
  );
}
function homeCallSpeakerDescription(target, language) {
  const integration = homeCallSpeakerIntegration(target);
  const status =
    language === "de"
      ? target.available
        ? "Verfügbar"
        : "Nicht verfügbar"
      : target.available
        ? "Available"
        : "Unavailable";
  return [integration, status].filter(Boolean).join(" · ");
}
function homeCallSpeakerList(
  targets,
  selected,
  language,
  allowUnavailable,
  onChange,
) {
  const list = document.createElement("ha-list");
  list.className = "speaker-list";
  list.multi = true;
  list.wrapFocus = true;
  list.setAttribute(
    "aria-label",
    language === "de" ? "Lautsprecher" : "Speakers",
  );
  for (const target of targets) {
    const row = document.createElement("ha-check-list-item");
    row.value = target.entity_id;
    row.left = true;
    row.twoline = true;
    const name = document.createElement("span");
    name.textContent = target.name;
    const description = document.createElement("span");
    description.slot = "secondary";
    description.textContent = homeCallSpeakerDescription(target, language);
    row.append(name, description);
    row.title = target.name + " · " + description.textContent;
    row.selected = selected.includes(target.entity_id);
    row.disabled = !allowUnavailable && !target.available;
    row.addEventListener("request-selected", (event) => {
      if (
        event.target === row &&
        !row.disabled &&
        typeof event.detail?.selected === "boolean"
      )
        onChange(row.value, event.detail.selected);
    });
    list.append(row);
  }
  return list;
}
function homeCallSyncSpeakerList(
  list,
  targets,
  selected,
  language,
  allowUnavailable,
) {
  if (!list) return;
  for (const row of list.children) {
    const target = targets.find((target) => target.entity_id === row.value);
    if (!target) continue;
    row.selected = selected.includes(row.value);
    row.disabled = !allowUnavailable && !target.available;
    const description = homeCallSpeakerDescription(target, language);
    row.querySelector('[slot="secondary"]').textContent = description;
    row.title = target.name + " · " + description;
  }
}

/* HomeCall: microphone waveform and original-voice announcements. */
const HOMECALL_EN = {
  Verwerfen: "Discard",
  "Alle Lautsprecher": "All speakers",
  "1 Lautsprecher": "1 speaker",
  "{count} Lautsprecher": "{count} speakers",
  "Neue Durchsage": "New announcement",
  "Erneut versuchen": "Retry",
  "Tippe auf das Mikrofon": "Tap the microphone",
  "Geräte werden geladen …": "Loading devices …",
  "Geräte konnten nicht geladen werden.": "Could not load devices.",
  "HomeCall öffnen": "Open HomeCall",
  "Deine Stimme zu Hause": "Your voice at home",
  Durchsage: "Announcement",
  "An alle Lautsprecher": "To all speakers",
  "An {count} Lautsprecher": "To {count} speakers",
  "An 1 Lautsprecher": "To 1 speaker",
  "Kein Lautsprecher ausgewählt": "No speaker selected",
  "Alle auswählen": "Select all",
  Bereit: "Ready",
  "Mikrofon starten": "Start microphone",
  "Vorbereitung …": "Preparing …",
  Laden: "Loading",
  Startet: "Preparing",
  Beenden: "Finishing",
  "Bereit zum Senden": "Ready to send",
  Senden: "Send",
  Schließen: "Close",
  Mikrofonpegel: "Microphone level",
  "Aufnahme verwerfen": "Discard recording",
  "Mikrofon wird vorbereitet …": "Preparing microphone …",
  "Sprich jetzt": "Speak now",
  "Aufnahme wird abgeschlossen …": "Finishing recording …",
  "Aufnahme konnte nicht vollständig abgeschlossen werden.":
    "Could not finish the complete recording.",
  "AudioWorklet ist nicht verfügbar. Bitte Browser aktualisieren.":
    "AudioWorklet is unavailable. Please update your browser.",
  "Aufnahmemodul konnte nicht geladen werden. Bitte HomeCall-Integration aktualisieren.":
    "Could not load the recorder. Please update the HomeCall integration.",
  "Keine Audiodaten vom Mikrofon empfangen.":
    "No audio samples received from the microphone.",
  Diagnose: "Diagnostics",
  "Diagnose kopieren": "Copy diagnostics",
  Kopiert: "Copied",
  "Kopieren nicht möglich. Bitte Text auswählen.":
    "Could not copy. Please select the text.",
  "Wird gesendet": "Sending",
  "Deine Nachricht wird vorbereitet …": "Preparing your message …",
  "HomeCall ist noch nicht bereit.": "HomeCall is not ready yet.",
  "HomeCall ist noch nicht eingerichtet.": "HomeCall is not configured yet.",
  "Das Mikrofon benötigt HTTPS. Bitte eine sichere HA-Adresse verwenden.":
    "The microphone requires HTTPS. Open HA using a secure address.",
  "Bitte den Mikrofonzugriff für Home Assistant erlauben.":
    "Please allow microphone access for Home Assistant.",
  "Mikrofon konnte nicht gestartet werden.": "Could not start the microphone.",
  "Kein Lautsprecher ist gerade erreichbar.":
    "No speaker is available right now.",
  "Die Aufnahme war zu kurz. Bitte erneut aufnehmen.":
    "The recording was too short. Please record again.",
  "Bitte mindestens einen Lautsprecher auswählen.":
    "Please select at least one speaker.",
  "Die Durchsage konnte nicht gesendet werden.":
    "Could not send the announcement.",
  "Die Lautsprecher haben die Durchsage nicht angenommen.":
    "The speakers did not accept the announcement.",
  "Die Durchsage ist fehlgeschlagen.": "The announcement failed.",
  "Deine Sprachnachricht wurde abgerufen.": "Your voice message was retrieved.",
  "An die Lautsprecher gesendet. Der Audioabruf ist noch nicht bestätigt.":
    "Sent to the speakers. Audio retrieval has not been confirmed yet.",
  "An {count} Lautsprecher gesendet.": "Sent to {count} speakers.",
  "Einige Geräte konnten nicht erreicht werden.":
    "Some devices could not be reached.",
  "Diese Lautsprecher werden übersprungen: {speakers}.":
    "These speakers will be skipped: {speakers}.",
  "Übersprungen: {speakers}.": "Skipped: {speakers}.",
  "Eine Durchsage wird gerade gesendet.":
    "An announcement is already being sent.",
  "Bitte erreichbare Lautsprecher auswählen.":
    "Please select available speakers.",
  "Aufnahme ist zu groß.": "The recording is too large.",
  "Ungültige Aufnahme. Bitte 1 bis 60 Sekunden sprechen.":
    "Invalid recording. Please speak for 1 to 60 seconds.",
  "Audio konnte nicht umgewandelt werden.": "Could not convert the audio.",
  "Zu viele Durchsagen. Bitte kurz warten.":
    "Too many announcements. Please wait a moment.",
  "Zeitlimit erreicht - bereit zum Senden.": "Limit reached - ready to send.",
};

class HomeCallCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._phase = "idle";
    this._levels = Array(64).fill(0);
  }
  setConfig(config) {
    if (JSON.stringify(config) === JSON.stringify(this.config)) return;
    this._close();
    this.config = config;
    this._render();
  }
  set hass(hass) {
    const lang = (
      hass.locale?.language ||
      hass.language ||
      navigator.language ||
      "en"
    )
      .toLowerCase()
      .split("-")[0];
    const changed = this._lang !== lang;
    this._hass = hass;
    this._lang = lang;
    if (changed) this._close();
    if (changed || !this._view) this._render();
    else if (
      this._phase === "error" &&
      this._availabilityError &&
      this._availabilitySnapshot !== this._availabilityState()
    )
      this._retryAvailability();
    else if (
      this._phase === "ready" &&
      this._targets &&
      this._view?.querySelector(".speaker-list")
    ) {
      const targets = this._targets.map((target) => ({
        ...target,
        available: homeCallSpeakerAvailable(target, hass),
      }));
      if (
        targets.some(
          (target, index) =>
            target.available !== this._targets[index].available,
        )
      ) {
        this._targets = targets;
        // Remember automatically excluded recipients until an explicit selection change.
        this._skippedTargets = [
          ...new Set([
            ...(this._skippedTargets || []),
            ...this._selection.filter(
              (id) =>
                !targets.some(
                  (target) => target.entity_id === id && target.available,
                ),
            ),
          ]),
        ];
        this._selection = this._selection.filter((id) =>
          targets.some((target) => target.entity_id === id && target.available),
        );
        this._updateSelection();
      }
    }
  }
  _availabilityState() {
    // Notify states can be timestamps or "unknown"; neither means offline.
    return JSON.stringify(
      Object.entries(this._hass?.states || {})
        .filter(
          ([id]) =>
            (id.startsWith("notify.") && id.endsWith("_speak")) ||
            id.startsWith("media_player."),
        )
        .map(([id, state]) => [
          id,
          state.state !== "unavailable" &&
            (!id.startsWith("media_player.") || state.state !== "unknown"),
        ])
        .sort(([a], [b]) => a.localeCompare(b)),
    );
  }
  _retryAvailability() {
    this._nextSelection = this._selection?.length ? [...this._selection] : null;
    this._load();
  }
  _t(text, values = {}) {
    let result = this._lang === "de" ? text : HOMECALL_EN[text] || text;
    for (const [k, v] of Object.entries(values))
      result = result.replaceAll("{" + k + "}", v);
    return result;
  }
  _button(text, kind = "microphone") {
    const b = this._view.querySelector(".main");
    b.disabled = false;
    b.setAttribute("aria-label", this._t(text));
    b.title = this._t(text);
    if (b.dataset.kind !== kind) {
      b.dataset.kind = kind;
      b.innerHTML = '<ha-icon icon="mdi:' + kind + '"></ha-icon>';
    }
    this._view.querySelector(".action-label").textContent = this._t(text);
    this._syncPhase();
  }
  _syncCaption() {
    const label = this._view.querySelector(".action-label");
    const caption = {
      loading: "Laden",
      starting: "Startet",
      recording: "Sprich jetzt",
      stopping: "Beenden",
      recorded: "Bereit zum Senden",
    }[this._phase];
    if (caption) label.textContent = this._t(caption);
    label.hidden = !this._layout?.showLabel;
    if (label.hidden) return;
    const discard = this._view.querySelector(".discard"),
      time = this._view.querySelector(".time"),
      status = this._view.querySelector(".status-more");
    // Empty footer space can hold the complete caption without moving controls.
    label.style.maxWidth =
      discard.hidden && time.hidden
        ? Math.max(
            0,
            this._view.querySelector(".info").clientWidth -
              (status.hidden
                ? 0
                : 2 * (status.getBoundingClientRect().width + 8)),
          ) + "px"
        : "";
    // Use the existing 32px footer slot, without moving either side control.
    // Keep the same HA caption size in every phase. Shorten the action rather
    // than shrinking the type when its complete description needs more room.
    const fits = () =>
      label.scrollHeight <= 32 && label.scrollWidth <= label.clientWidth + 1;
    if (!fits() && this._phase === "recorded")
      label.textContent = this._t("Senden");
    label.hidden = !fits();
  }
  static async getConfigElement() {
    await homeCallNativeForms();
    return document.createElement("homecall-card-editor");
  }
  static getStubConfig() {
    return {};
  }
  getCardSize() {
    return 1;
  }
  getGridOptions() {
    return { columns: 6, rows: 1, min_columns: 6, min_rows: 1 };
  }
  connectedCallback() {
    if (!this._view) this._render();
  }
  _render() {
    if (!this.config || !this._hass || !this.isConnected) return;
    this.shadowRoot.innerHTML = `<style>
:host{display:block;height:100%;min-width:0;font-family:var(--primary-font-family,Roboto,sans-serif);--homecall-button-size:112px;--homecall-icon-size:63px;--homecall-padding:20px;--homecall-selector-top:10px;--homecall-content-inset:13px;--homecall-control-size:44px;--homecall-control-radius:var(--ha-border-radius-md)}
ha-card{display:flex;position:relative;flex-direction:column;box-sizing:border-box;height:100%;min-height:56px;min-width:0;padding:var(--homecall-padding);color:var(--primary-text-color);--homecall-tone:var(--ha-color-fill-primary-loud-resting,var(--primary-color))}
ha-card[data-tone="red"]{--homecall-tone:var(--ha-color-fill-danger-loud-resting,var(--error-color))}[hidden]{display:none!important}.header{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:32px;position:absolute;top:var(--homecall-selector-top);inset-inline:var(--homecall-padding);z-index:2;pointer-events:none}
.targets{margin:0 0 0 auto;max-width:100%;flex:none;pointer-events:auto;color:var(--secondary-text-color);font-size:var(--ha-font-size-m)}.targets summary{display:flex;align-items:center;justify-content:flex-end;gap:4px;cursor:pointer;list-style:none;min-height:32px;min-width:44px;max-width:100%;border-radius:var(--homecall-control-radius);padding-inline:6px;margin-inline-end:calc(var(--homecall-content-inset) - 6px);-webkit-tap-highlight-color:transparent}.targets summary span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.targets summary::-webkit-details-marker{display:none}.targets summary:focus-visible{outline:2px solid var(--ha-color-focus);outline-offset:2px}.targets summary ha-icon{--mdc-icon-size:18px;flex:none}.targets .speaker-icon{display:none}.targets[open] .chevron{transform:rotate(180deg)}.targets summary[aria-disabled="true"]{color:var(--disabled-text-color);cursor:default}
.list,.status-popover{position:fixed;inset:auto;margin:0;box-sizing:border-box;color:var(--primary-text-color);font:var(--ha-font-size-m)/var(--ha-line-height-normal) var(--primary-font-family,Roboto,sans-serif);padding:8px 12px;overflow:auto;overscroll-behavior:contain;background:var(--ha-card-background,var(--card-background-color));border:1px solid var(--divider-color);border-radius:var(--ha-border-radius-lg);box-shadow:var(--ha-box-shadow-l)}.list{overflow-x:hidden}.status-popover{padding:16px;overflow-wrap:anywhere}.list ha-checkbox.all{display:flex;min-height:44px;border-bottom:1px solid var(--divider-color);margin-bottom:4px;padding-bottom:4px}
.action{display:flex;position:absolute;inset:0;pointer-events:none;flex-direction:column;align-items:center;justify-content:center}.visual{transform:translateY(var(--homecall-action-offset,0px));position:relative;display:flex;align-items:center;justify-content:center;width:calc(100% - 2*var(--homecall-padding));height:var(--homecall-visual-height,calc(var(--homecall-button-size)*1.44));max-height:calc(100% - 2*var(--homecall-padding));flex:none;isolation:isolate}.halo{position:absolute;width:calc(var(--homecall-button-size)*1.18);height:calc(var(--homecall-button-size)*1.18);border-radius:50%;background:var(--homecall-tone);opacity:.18;pointer-events:none;z-index:-1}.wave{position:absolute;inset:0;width:100%;height:100%;opacity:0;pointer-events:none;z-index:-2}ha-card[data-phase="recording"] .wave,ha-card[data-phase="recorded"] .wave{opacity:.24}
ha-card[data-phase="starting"] .halo{opacity:.08}ha-card[data-phase="recording"] .halo{opacity:1;background:none;mask:radial-gradient(circle,transparent 60%,black 61%)}ha-card[data-phase="recording"] .halo::before,ha-card[data-phase="recording"] .halo::after{content:"";position:absolute;inset:0;border-radius:inherit}ha-card[data-phase="recording"] .halo::before{background:var(--homecall-tone);opacity:.16}ha-card[data-phase="recording"] .halo::after{background:conic-gradient(var(--homecall-tone) var(--homecall-recording-progress,0deg),transparent 0);opacity:.46}
.main{pointer-events:auto;--ha-button-height:var(--homecall-button-size);--ha-button-border-radius:50%;--ha-button-box-shadow:none;flex:none}.main::part(base){width:var(--homecall-button-size);padding:0}.main::part(label){display:flex;align-items:center;justify-content:center}.main::part(spinner){font-size:var(--homecall-icon-size)}.main ha-icon{--mdc-icon-size:var(--homecall-icon-size)}.main[data-kind="send-outline"] ha-icon{--mdc-icon-size:calc(var(--homecall-icon-size)*.75)}.action-label{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:var(--ha-font-size-m);font-weight:var(--ha-font-weight-medium,500);line-height:16px;max-width:var(--homecall-label-space);text-align:center;color:var(--primary-text-color);white-space:normal;flex:none}
ha-card[data-edge-footer="true"] .info{bottom:8px;inset-inline:8px}ha-card[data-edge-footer="true"] .time{padding-inline-end:0}
ha-card[data-narrow="true"] .info{height:32px;min-height:32px;align-items:flex-end}ha-card[data-narrow="true"] .discard{--ha-button-height:32px}ha-card[data-narrow="true"] .discard::part(base){min-width:32px;padding:0 5px}ha-card[data-narrow="true"] .time{font-size:12px;line-height:24px;gap:6px}
.info{display:flex;position:absolute;bottom:var(--homecall-footer-bottom,var(--homecall-padding));inset-inline:var(--homecall-padding);pointer-events:none;align-items:center;justify-content:space-between;gap:8px;height:44px;min-height:44px;flex:none;color:var(--secondary-text-color);font-size:var(--ha-font-size-m);line-height:20px}.discard{pointer-events:auto;--ha-button-height:44px;--ha-button-border-radius:var(--homecall-control-radius);--ha-button-box-shadow:none;flex:none}.discard::part(base){padding:0 12px;min-width:44px}.discard::part(label){display:flex;align-items:center;gap:8px;font-size:var(--ha-font-size-m);font-weight:400;line-height:20px}.discard ha-icon{--mdc-icon-size:20px}.message-control{display:flex;align-items:center;justify-content:center;min-width:0;gap:4px}.status{line-height:20px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}.status-more{pointer-events:auto;flex:none;color:var(--secondary-text-color)}ha-card[data-phase="error"] .status-more ha-icon{color:var(--error-color)}ha-card[data-phase="sent"] .status-more ha-icon{color:var(--success-color)}ha-card[data-phase="ready"][data-skipped-targets="true"] .status-more ha-icon,ha-card[data-phase="sent"][data-partial-send="true"] .status-more ha-icon{color:var(--warning-color,var(--error-color))}.time{display:flex;align-items:center;gap:8px;margin-inline-start:auto;padding-inline-end:var(--homecall-content-inset);white-space:nowrap;font-variant-numeric:tabular-nums}ha-card[data-phase="recording"] .time:before{content:'';display:block;width:8px;height:8px;flex:none;border-radius:50%;background:var(--ha-color-fill-danger-loud-resting,var(--error-color))}
.sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
ha-card[data-compact="true"] .header{min-height:44px}
ha-card[data-compact="true"] .targets summary{justify-content:center;margin-inline-end:calc(var(--homecall-content-inset) - 11px);padding-inline:0}ha-card[data-compact="true"] .targets summary span,ha-card[data-compact="true"] .targets .chevron{display:none}ha-card[data-compact="true"] .targets .speaker-icon{display:block;--mdc-icon-size:22px}ha-card[data-compact="true"] .discard .discard-label{display:none}ha-card[data-compact="true"] .message-control{gap:0}
ha-card[data-narrow="true"]{--homecall-control-size:32px}
ha-card[data-compact="true"] .targets summary{box-sizing:border-box;width:var(--homecall-control-size);height:var(--homecall-control-size);min-width:var(--homecall-control-size);min-height:var(--homecall-control-size)}
ha-card[data-compact="true"] .discard::part(base),.status-more::part(base){box-sizing:border-box;width:var(--homecall-control-size);min-width:var(--homecall-control-size);padding:0}
.status-more{--ha-button-height:var(--homecall-control-size);--ha-button-border-radius:var(--homecall-control-radius);--ha-button-box-shadow:none}.status-more ha-icon{--mdc-icon-size:20px}
/* In a one-row card, side icons share the action's vertical centerline. */
ha-card[data-short="true"]{--homecall-control-size:32px}
ha-card[data-short="true"] .header{top:calc(50% - 16px);min-height:32px;height:32px}
/* Lift the speaker/timer pair 3px to balance the visible artwork and text,
   rather than the speaker's padded 32px hit area. Their hit areas stay separate. */
ha-card[data-short="true"]:has(.time:not([hidden])) .header{top:calc(50% - 26px)}
ha-card[data-short="true"] .targets summary{margin-inline-end:6px}
ha-card[data-short="true"] .visual{width:calc(100% - 100px)}
ha-card[data-short="true"] .wave{width:calc(100% - 12px);inset-inline-start:0;inset-inline-end:12px}
ha-card[data-short="true"] .info{inset:0 var(--homecall-padding);height:100%;min-height:0}
ha-card[data-short="true"] .discard,ha-card[data-short="true"] .message-control{position:absolute;inset-inline-start:6px;top:calc(50% - 16px);height:32px}
ha-card[data-short="true"] .discard{--ha-button-height:32px}
ha-card[data-short="true"] .time{position:absolute;inset-inline-end:0;top:calc(50% + 6px);width:44px;height:14px;justify-content:center;margin:0;padding:0;font-size:var(--ha-font-size-s,12px);line-height:14px;gap:4px}
ha-card[data-short="true"] .time:before{position:absolute;inset-inline-start:0;top:50%;transform:translateY(-50%);width:6px;height:6px}
ha-card[data-short="true"]:has(.header[hidden]) .time{top:calc(50% - 7px)}
@media(hover:hover){.targets summary:hover{background:var(--ha-color-fill-neutral-quiet-hover)}}
</style><ha-card><div class="header"><details class="targets"><summary><ha-icon class="speaker-icon" icon="mdi:volume-high"></ha-icon><span></span><ha-icon class="chevron" icon="mdi:chevron-down"></ha-icon></summary></details></div><div class="list" popover="auto"></div><div class="status-popover" popover="auto"></div><div class="action"><div class="visual"><canvas class="wave" aria-label="${this._t("Mikrofonpegel")}"></canvas><div class="halo" aria-hidden="true"></div><ha-button class="main" appearance="accent" variant="brand"></ha-button></div></div><div class="info"><div class="action-label"></div><ha-button class="discard" appearance="plain" variant="neutral" hidden><ha-icon icon="mdi:delete-outline"></ha-icon><span class="discard-label">${this._t("Verwerfen")}</span></ha-button><div class="message-control"><ha-button class="status-more" appearance="plain" variant="neutral" hidden></ha-button><div class="status" role="status" aria-live="polite"></div></div><div class="time" hidden>1:00</div></div></ha-card>`;
    this._view = this.shadowRoot.querySelector("ha-card");
    const discard = this._view.querySelector(".discard");
    discard.setAttribute("aria-label", this._t("Aufnahme verwerfen"));
    discard.title = this._t("Aufnahme verwerfen");
    discard.onclick = () => this._reset();
    this._view.querySelector(".status-more").onclick = () => this._showStatus();
    this._layoutObserver = new ResizeObserver(() => {
      cancelAnimationFrame(this._layoutRaf);
      this._layoutRaf = requestAnimationFrame(() => this._applyLayout());
    });
    this._layoutObserver.observe(this);
    this._applyLayout();
    const recipients = this._view.querySelector(".targets"),
      list = this._view.querySelector(".list");
    recipients.hidden = this.config.show_speaker_selection === false;
    recipients.querySelector("summary").addEventListener("click", (event) => {
      if (
        ["starting", "recording", "stopping", "recorded", "sending"].includes(
          this._phase,
        )
      )
        event.preventDefault();
    });
    recipients.addEventListener("toggle", () => {
      if (!this._view) return;
      if (!recipients.open) {
        if (list.matches(":popover-open")) list.hidePopover();
        return;
      }
      if (!this._positionTargets()) {
        recipients.open = false;
        return;
      }
      if (!list.matches(":popover-open")) list.showPopover();
    });
    list.addEventListener("toggle", (event) => {
      if (event.newState === "closed") recipients.open = false;
    });
    this._view.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          const status = this._view.querySelector(".status-popover");
          if (status.matches(":popover-open")) status.hidePopover();
          else if (recipients.open) recipients.open = false;
          else if (
            ["starting", "recording", "stopping", "recorded"].includes(
              this._phase,
            )
          )
            this._reset();
        }
      },
      true,
    );
    this._view.querySelector(".main").onclick = () => {
      if (this._phase === "ready") this._start();
      else if (["recording", "recorded"].includes(this._phase)) this._finish();
      else if (this._phase === "sent" && this._partialSend) {
        this._reset();
        this._start();
      } else if (
        !["loading", "starting", "stopping", "sending"].includes(this._phase)
      )
        this._reset();
    };
    this._visibility = () => {
      if (document.hidden) {
        if (["starting", "recording"].includes(this._phase)) this._reset();
        // Let an already requested final flush finish before stopping its input.
        if (this._phase !== "stopping") this._release();
      } else {
        if (this._phase === "error" && this._availabilityError)
          this._retryAvailability();
        else if (this._phase === "ready") this._warmRecorder();
      }
    };
    document.addEventListener("visibilitychange", this._visibility);
    this._dismissTargets = (event) => {
      if (!event.composedPath().includes(list)) recipients.open = false;
    };
    window.addEventListener("resize", this._dismissTargets);
    window.addEventListener("scroll", this._dismissTargets, true);
    this._load();
  }
  _positionTargets() {
    if (!this._view) return false;
    const bounds = homeCallRecipientBounds(
      this._view.getBoundingClientRect(),
      this._view.querySelector("summary").getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight },
      Math.min(16, this._layout?.padding || 16),
      !!this._layout?.short || this.clientWidth < 360,
    );
    if (!bounds) return false;
    const list = this._view.querySelector(".list");
    for (const [key, value] of Object.entries(bounds))
      list.style[key] = value + "px";
    return true;
  }
  _applyLayout() {
    if (!this._view) return;
    const width = this.clientWidth,
      height = this.clientHeight;
    if (!width || !height) return;
    const initial = homeCallLayout(
      width,
      height,
      this.config.show_speaker_selection !== false,
    );
    this._view.dataset.compact = String(initial.compact);
    this._view.dataset.short = String(!!initial.short);
    this._view.dataset.narrow = String(width < 200);
    const narrowFooter = width < 200;
    const measure = this._view.querySelector("canvas").getContext("2d");
    measure.font =
      (narrowFooter ? "12px " : "14px ") + getComputedStyle(this).fontFamily;
    const border = getComputedStyle(this._view);
    const footerWidths = {
      discard: initial.compact
        ? 46
        : Math.ceil(measure.measureText(this._t("Verwerfen")).width) + 54,
      time:
        Math.ceil(measure.measureText("00:00").width) +
        (narrowFooter ? 21 : 29),
      borderX: Math.max(
        parseFloat(border.borderLeftWidth) || 0,
        parseFloat(border.borderRightWidth) || 0,
      ),
      borderY: parseFloat(border.borderBottomWidth) || 0,
    };
    if (narrowFooter && height === 120) {
      measure.font = "14px " + getComputedStyle(this).fontFamily;
      footerWidths.regularTime =
        Math.ceil(measure.measureText("00:00").width) + 29;
    }
    const summary = this._view.querySelector("summary");
    const selectorWidth =
      summary.getBoundingClientRect().width +
      parseFloat(getComputedStyle(summary).marginInlineEnd);
    const layout = homeCallLayout(
      width,
      height,
      this.config.show_speaker_selection !== false,
      selectorWidth,
      footerWidths,
    );
    this._layout = layout;
    this._view.dataset.edgeFooter = String(layout.edgeFooter);
    this._view.style.setProperty("--homecall-padding", layout.padding + "px");
    this._view.style.setProperty(
      "--homecall-footer-bottom",
      layout.footerBottom + "px",
    );
    this._view.style.setProperty(
      "--homecall-selector-top",
      layout.selectorTop + "px",
    );
    this._view.style.setProperty(
      "--homecall-button-size",
      layout.button + "px",
    );
    this._view.style.setProperty("--homecall-icon-size", layout.icon + "px");
    this._view.style.setProperty(
      "--homecall-action-offset",
      layout.centerY - height / 2 + "px",
    );
    this._view.style.setProperty(
      "--homecall-visual-height",
      layout.visualHeight + "px",
    );
    this._view.style.setProperty(
      "--homecall-label-space",
      layout.labelSpace + "px",
    );
    this._view.querySelector(".action-label").hidden = !layout.showLabel;
    this._view.querySelector(".header").hidden =
      this.config.show_speaker_selection === false;
    this._syncPhase();
    const recipients = this._view.querySelector(".targets");
    if (recipients.open && !this._positionTargets()) recipients.open = false;
  }
  _syncPhase() {
    if (!this._view) return;
    this._view.dataset.phase = this._phase;
    this._view.dataset.partialSend = String(!!this._partialSend);
    this._view.dataset.skippedTargets = String(!!this._skippedTargets?.length);
    // Red means the microphone is actively capturing, independent of the next action.
    const capturing = this._phase === "recording";
    this._view.dataset.tone = capturing ? "red" : "blue";
    this._view.querySelector(".main").variant = capturing ? "danger" : "brand";
    const active = ["starting", "recording", "recorded"].includes(this._phase),
      recording = ["recording", "recorded"].includes(this._phase),
      starting = this._phase === "starting",
      busy =
        (this._phase === "loading" && this._loadingIndicator) ||
        ["stopping", "sending"].includes(this._phase);
    this._view.querySelector(".discard").hidden = !active;
    this._view.querySelector(".time").hidden = !recording;
    this._view.querySelector(".main").loading = busy || starting;
    this._view
      .querySelector(".main")
      .setAttribute(
        "aria-busy",
        String(busy || starting || this._phase === "loading"),
      );
    this._view
      .querySelector(".main")
      .setAttribute(
        "aria-disabled",
        String(
          ["loading", "starting", "stopping", "sending"].includes(this._phase),
        ),
      );
    const summary = this._view.querySelector("summary");
    summary.setAttribute(
      "aria-disabled",
      String(
        ["starting", "recording", "stopping", "recorded", "sending"].includes(
          this._phase,
        ),
      ),
    );
    summary.tabIndex = [
      "starting",
      "recording",
      "stopping",
      "recorded",
      "sending",
    ].includes(this._phase)
      ? -1
      : 0;
    const info = this._view.querySelector(".message-control"),
      status = this._view.querySelector(".status"),
      icon = this._view.querySelector(".status-more");
    info.classList.toggle("sr-only", this._phase === "recording" || starting);
    status.classList.toggle("sr-only", true);
    const noSelection =
        this._phase === "ready" && this._selection?.length === 0,
      skipped = this._phase === "ready" && !!this._skippedTargets?.length,
      showDiagnostics =
        this.config?.show_diagnostics === true && !!this._diagnostics;
    // The recorded caption already explains the limit. A second status button
    // sits in the same footer space and overlaps that caption on native HA.
    icon.hidden =
      (this._phase === "sent" && !this._partialSend && !showDiagnostics) ||
      this._phase === "recorded" ||
      ["loading", "recording", "stopping", "sending"].includes(this._phase) ||
      starting ||
      (this._phase === "ready" && !noSelection && !skipped && !showDiagnostics);
    icon.innerHTML = `<ha-icon icon="mdi:${this._phase === "error" || noSelection || skipped || (this._phase === "sent" && this._partialSend) ? "alert-circle-outline" : this._phase === "sent" ? "check-circle-outline" : "clock-outline"}"></ha-icon>`;
    this._syncCaption();
  }
  _showStatus() {
    const popover = this._view.querySelector(".status-popover");
    if (popover.matches(":popover-open")) {
      popover.hidePopover();
      return;
    }
    const anchor = this._view
        .querySelector(".status-more")
        .getBoundingClientRect(),
      width = Math.min(
        360,
        window.innerWidth - 32,
        Math.max(240, this.clientWidth),
      );
    popover.style.width = width + "px";
    popover.style.left =
      Math.max(16, Math.min(anchor.left, window.innerWidth - width - 16)) +
      "px";
    popover.style.maxHeight =
      Math.max(80, Math.min(240, window.innerHeight - 32)) + "px";
    popover.textContent = this._view.querySelector(".status").textContent;
    if (this.config?.show_diagnostics === true && this._diagnostics) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = this._t("Diagnose");
      const text = document.createElement("pre");
      text.style.cssText =
        "white-space:pre-wrap;font-size:12px;user-select:text";
      const serialized = JSON.stringify(this._diagnostics, null, 2);
      text.textContent = serialized;
      const copy = document.createElement("ha-button");
      copy.textContent = this._t("Diagnose kopieren");
      copy.onclick = async () => {
        try {
          const trace = this._diagnostics;
          const contents = this._refreshDiagnostics(trace).then(() => {
            const latest = JSON.stringify(trace, null, 2);
            text.textContent = latest;
            return latest;
          });
          // Safari requires the write call on the click gesture. Supply its data asynchronously.
          if (window.ClipboardItem && navigator.clipboard?.write)
            await navigator.clipboard.write([
              new ClipboardItem({
                "text/plain": contents.then(
                  (latest) => new Blob([latest], { type: "text/plain" }),
                ),
              }),
            ]);
          else await navigator.clipboard.writeText(await contents);
          copy.textContent = this._t("Kopiert");
        } catch {
          copy.textContent = this._t(
            "Kopieren nicht möglich. Bitte Text auswählen.",
          );
        }
      };
      details.append(summary, text, copy);
      popover.append(details);
    }
    popover.showPopover();
    const height = popover.getBoundingClientRect().height;
    popover.style.top =
      Math.max(
        16,
        anchor.top >= height + 24
          ? anchor.top - height - 8
          : Math.min(anchor.bottom + 8, window.innerHeight - height - 16),
      ) + "px";
  }
  async _refreshDiagnostics(trace = this._diagnostics) {
    const identifier = trace?.server?.diagnostic_id;
    if (!identifier) return;
    try {
      const response = await this._hass.fetchWithAuth(
        "/api/homecall/status?diagnostic_id=" + encodeURIComponent(identifier),
      );
      if (!response.ok) return;
      const data = await response.json();
      if (trace.server?.diagnostic_id === identifier && data.diagnostics)
        trace.server = data.diagnostics;
    } catch {
      /* Retain the last measured data if it expired or HA is offline. */
    }
  }
  async _load() {
    this._availabilityError = false;
    this._skippedTargets = [];
    this._recordingSkippedTargets = [];
    this._partialSend = false;
    const session = Symbol();
    this._session = session;
    this._chunks = [];
    this._levels = Array(64).fill(0);
    this._phase = "loading";
    clearTimeout(this._loadingTimer);
    this._loadingIndicator = false;
    this._loadingTimer = setTimeout(() => {
      if (session !== this._session || this._phase !== "loading") return;
      this._loadingIndicator = true;
      this._syncPhase();
    }, 300);
    this._setStatus("Geräte werden geladen …");
    this._button("Geräte werden geladen …");
    const summary = this._view.querySelector("summary");
    summary.querySelector("span").textContent = this._t(
      "Geräte werden geladen …",
    );
    summary.setAttribute("aria-label", this._t("Geräte werden geladen …"));
    summary.title = this._t("Geräte werden geladen …");
    this._view.querySelector(".list").textContent = this._t(
      "Geräte werden geladen …",
    );
    try {
      await homeCallNativeSpeakerControls(this, this._hass);
      if (session !== this._session) return;
      const response = await this._hass.fetchWithAuth("/api/homecall/status");
      const data = await response.json();
      if (session !== this._session) return;
      if (!response.ok)
        throw new Error(data.error || "HomeCall ist noch nicht bereit.");
      this._defaults =
        this._nextSelection ||
        (Array.isArray(this.config.default_targets)
          ? this.config.default_targets
          : data.default_targets || []);
      this._defaultsAll =
        !this._nextSelection &&
        !Array.isArray(this.config.default_targets) &&
        !this._defaults.length;
      this._nextSelection = null;
      this._fillTargets(data.targets);
      this._phase = "ready";
      this._setStatus("Tippe auf das Mikrofon");
      this._button("Mikrofon starten");
      this._updateSelection();
      this._warmRecorder();
    } catch (error) {
      if (session !== this._session) return;
      this._phase = "error";
      const message =
        error.message === "Kein Lautsprecher ist gerade erreichbar."
          ? error.message
          : "Geräte konnten nicht geladen werden.";
      this._availabilityError =
        error.message === "Kein Lautsprecher ist gerade erreichbar.";
      this._availabilitySnapshot = this._availabilityState();
      const summary = this._view.querySelector("summary");
      summary.querySelector("span").textContent = this._t(
        "Kein Lautsprecher ausgewählt",
      );
      summary.setAttribute(
        "aria-label",
        this._t("Kein Lautsprecher ausgewählt"),
      );
      summary.title = this._t("Kein Lautsprecher ausgewählt");
      this._view.querySelector(".list").textContent = this._t(message);
      this._setStatus(message);
      this._doneButton();
    } finally {
      if (session === this._session) clearTimeout(this._loadingTimer);
    }
  }
  _reset() {
    if (!this._view) return;
    // Cancel recording work without replacing the card or its recipient controls.
    this._session = Symbol();
    clearTimeout(this._readyTimer);
    clearTimeout(this._receiptTimer);
    this._release(this._phase !== "starting");
    this._chunks = [];
    this._samples = 0;
    this._partialSend = false;
    this._recordingSkippedTargets = [];
    this._started = 0;
    this._levels = Array(64).fill(0);
    this._view.querySelector(".targets").open = false;
    const status = this._view.querySelector(".status-popover");
    if (status.matches(":popover-open")) status.hidePopover();
    this._view.querySelector(".time").textContent = "1:00";
    if (
      this._availabilityError ||
      !this._view.querySelector(".speaker-list") ||
      !this._targets?.some((t) => t.available)
    ) {
      this._retryAvailability();
      return;
    }
    this._phase = "ready";
    this._button("Mikrofon starten");
    this._setStatus(this._readyStatus());
    this._view.querySelector(".main").disabled = !this._selection.length;
    this._draw();
    this._warmRecorder();
  }
  _warmRecorder() {
    // Prepare code and a suspended context only. Microphone access starts on tap.
    if (document.hidden || !window.isSecureContext) return;
    try {
      this._prepareRecorder(true).loaded.catch(() => {});
    } catch {
      // Report unsupported browsers or module failures on the recording action.
    }
  }
  _prepareRecorder(idle = false) {
    if (this._recorderPreparation?.context.state === "closed")
      this._disposeRecorder();
    if (this._recorderPreparation) return this._recorderPreparation;
    const context = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 48000,
    });
    if (!context.audioWorklet || !window.AudioWorkletNode) {
      context.close().catch(() => {});
      throw new Error(
        "AudioWorklet ist nicht verfügbar. Bitte Browser aktualisieren.",
      );
    }
    const preparation = { context, ready: false };
    this._recorderPreparation = preparation;
    preparation.idle = idle ? context.suspend() : Promise.resolve();
    preparation.loaded = Promise.all([
      preparation.idle,
      context.audioWorklet.addModule(
        "/homecall-assets/homecall-recorder-worklet.js?v=1",
      ),
    ]).then(
      () => {
        preparation.ready = true;
      },
      () => {
        if (this._recorderPreparation === preparation) this._disposeRecorder();
        throw new Error(
          "Aufnahmemodul konnte nicht geladen werden. Bitte HomeCall-Integration aktualisieren.",
        );
      },
    );
    // A cancelled permission request may outlive this context/module load.
    preparation.loaded.catch(() => {});
    return preparation;
  }
  _disposeRecorder() {
    const preparation = this._recorderPreparation;
    this._recorderPreparation = null;
    preparation?.context.close().catch(() => {});
  }
  async _start() {
    if (!this._view || this._phase !== "ready" || !this._selection.length)
      return;
    const session = this._session;
    this._recordingTargets = [...this._selection];
    this._recordingSkippedTargets = [...(this._skippedTargets || [])];
    this._diagnostics = {
      card_version:
        typeof __HOMECALL_CARD_VERSION__ === "undefined"
          ? "development"
          : __HOMECALL_CARD_VERSION__,
      browser_timings_ms: {},
    };
    const tapped = performance.now();
    this._phase = "starting";
    this._view.querySelector(".targets").open = false;
    this._button("Vorbereitung …");
    this._setStatus("Mikrofon wird vorbereitet …");
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Das Mikrofon benötigt HTTPS. Bitte eine sichere HA-Adresse verwenden.",
        );
      const preparation = this._prepareRecorder(),
        context = preparation.context;
      this._diagnostics.recorder_prepared_before_tap = preparation.ready;
      this._context = context;
      context.onstatechange = () => {
        if (
          session === this._session &&
          ["recording", "stopping"].includes(this._phase) &&
          context.state !== "running"
        )
          this._recorderFailed(session, "context_interrupted");
      };
      // Resume on the user gesture, and load code/acquire the microphone concurrently.
      const resumed = context.resume();
      const [stream] = await Promise.all([
        navigator.mediaDevices
          .getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          })
          .then((stream) => {
            if (
              session !== this._session ||
              !this._view ||
              this._phase !== "starting"
            )
              stream.getTracks().forEach((track) => track.stop());
            else {
              this._stream = stream;
              this._trackEnded = () => {
                if (["starting", "recording", "stopping"].includes(this._phase))
                  this._recorderFailed(session, "microphone_ended");
              };
              for (const track of stream.getTracks())
                track.addEventListener?.("ended", this._trackEnded);
              if (
                stream.getTracks().some((track) => track.readyState === "ended")
              )
                this._trackEnded();
              this._diagnostics.browser_timings_ms.tap_to_microphone =
                Math.round(performance.now() - tapped);
            }
            return stream;
          }),
        preparation.loaded,
        preparation.idle,
        resumed,
      ]);
      if (
        session !== this._session ||
        !this._view ||
        this._phase !== "starting"
      )
        return;
      // A tap can race with the previous suspension. The gesture above unlocks
      // the context; finish resuming after any pending idle operation.
      if (context.state !== "running") await context.resume();
      if (session !== this._session || this._phase !== "starting") return;
      this._sampleRate = context.sampleRate;
      this._samples = 0;
      this._chunks = [];
      this._chunkSequence = 0;
      this._recorderStopped = false;
      this._recordedAtLimit = false;
      this._diagnostics.sample_rate = this._sampleRate;
      const connected = performance.now();
      const ready = new Promise((resolve, reject) => {
        this._resolveRecorderReady = resolve;
        this._rejectRecorderReady = reject;
      });
      ready.catch(() => {}); // Construction can fail before the readiness await.
      this._recorderStopPromise = new Promise((resolve, reject) => {
        this._resolveRecorderStop = resolve;
        this._rejectRecorderStop = reject;
      });
      // A cancelled recording may never have a caller awaiting its stop promise.
      this._recorderStopPromise.catch(() => {});
      this._processor = new AudioWorkletNode(context, "homecall-recorder-v1", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: "explicit",
      });
      this._processor.onprocessorerror = () => this._recorderFailed(session);
      this._processor.port.onmessage = ({ data }) => {
        if (session !== this._session || !this._view) return;
        if (data.type === "ready") {
          this._diagnostics.browser_timings_ms.connect_to_first_samples =
            Math.round(performance.now() - connected);
          this._diagnostics.browser_timings_ms.tap_to_ready = Math.round(
            performance.now() - tapped,
          );
          clearTimeout(this._recorderReadyTimer);
          this._resolveRecorderReady?.();
          this._resolveRecorderReady = this._rejectRecorderReady = null;
        } else if (data.type === "chunk") {
          if (
            data.sequence !== this._chunkSequence++ ||
            !(data.samples instanceof Float32Array) ||
            this._samples + data.samples.length > this._sampleRate * 60
          ) {
            this._recorderFailed(session);
            return;
          }
          this._chunks.push(data.samples);
          this._samples += data.samples.length;
          let sum = 0;
          for (const value of data.samples) sum += value * value;
          this._levels.push(
            Math.min(1, Math.sqrt(sum / Math.max(1, data.samples.length)) * 6),
          );
          this._levels.shift();
        } else if (data.type === "stopped") {
          if (data.total !== this._samples) {
            this._recorderFailed(session);
            return;
          }
          this._recorderStopped = true;
          clearTimeout(this._recorderStopTimer);
          this._resolveRecorderStop?.();
          this._resolveRecorderStop = this._rejectRecorderStop = null;
          if (data.reason === "limit") this._stopAtLimit();
        }
      };
      this._source = context.createMediaStreamSource(stream);
      this._source.connect(this._processor);
      this._processor.connect(context.destination); // Worklet output is always silence.
      this._recorderReadyTimer = setTimeout(() => {
        this._rejectRecorderReady?.(
          new Error("Keine Audiodaten vom Mikrofon empfangen."),
        );
      }, 5000); // Failure deadline only: readiness resolves as soon as samples arrive.
      await ready;
      if (
        session !== this._session ||
        !this._view ||
        this._phase !== "starting"
      )
        return;
      this._phase = "recording";
      this._button("Senden", "microphone");
      this._setStatus("Sprich jetzt");
      this._draw();
    } catch (error) {
      if (session !== this._session) return;
      this._release();
      if (this._view) {
        this._phase = "error";
        this._setStatus(
          error.name === "NotAllowedError"
            ? "Bitte den Mikrofonzugriff für Home Assistant erlauben."
            : error.message || "Mikrofon konnte nicht gestartet werden.",
        );
        this._doneButton();
      }
    }
  }
  _recorderFailed(session, reason = "recorder_error") {
    if (session !== this._session) return;
    if (this._diagnostics) this._diagnostics.recorder_error = reason;
    const error = new Error(
      "Aufnahme konnte nicht vollständig abgeschlossen werden.",
    );
    this._rejectRecorderReady?.(error);
    this._rejectRecorderStop?.(error);
    this._release();
    this._chunks = [];
    this._phase = "error";
    if (this._view) {
      this._setStatus(error.message);
      this._doneButton();
    }
  }
  async _flushRecorder() {
    if (this._recorderStopped) return;
    if (!this._processor?.port || !this._recorderStopPromise)
      throw new Error(
        "Aufnahme konnte nicht vollständig abgeschlossen werden.",
      );
    this._recorderStopTimer = setTimeout(() => {
      this._rejectRecorderStop?.(
        new Error("Aufnahme konnte nicht vollständig abgeschlossen werden."),
      );
    }, 2000); // Maximum failure deadline; no minimum wait.
    this._processor.port.postMessage({ type: "stop" });
    await this._recorderStopPromise;
  }
  _fillTargets(targets) {
    this._targets = targets;
    this._selection = targets
      .filter(
        (t) =>
          t.available &&
          (this._defaultsAll || this._defaults.includes(t.entity_id)),
      )
      .map((t) => t.entity_id);
    const requested = this._defaultsAll
      ? targets.map((target) => target.entity_id)
      : this._defaults;
    this._skippedTargets = [...new Set(requested)].filter(
      (id) => !this._selection.includes(id),
    );
    if (!targets.some((t) => t.available))
      throw new Error("Kein Lautsprecher ist gerade erreichbar.");
    const list = this._view.querySelector(".list");
    list.replaceChildren();
    const all = document.createElement("ha-checkbox");
    all.className = "select-all all";
    all.textContent = this._t("Alle auswählen");
    const speakers = homeCallSpeakerList(
      targets,
      this._selection,
      this._lang,
      false,
      (id, checked) => {
        if (this._selection.includes(id) === checked) return;
        this._skippedTargets = this._skippedTargets.filter(
          (value) => value !== id,
        );
        this._selection = checked
          ? [...new Set([...this._selection, id])]
          : this._selection.filter((value) => value !== id);
        this._updateSelection();
      },
    );
    list.append(all, speakers);
    all.addEventListener("change", () => {
      this._selection = all.checked
        ? this._targets
            .filter((target) => target.available)
            .map((target) => target.entity_id)
        : [];
      // Select all explicitly chooses the currently available routes.
      this._skippedTargets = [];
      this._updateSelection();
    });
    this._updateSelection();
  }
  _updateSelection() {
    homeCallSyncSpeakerList(
      this._view.querySelector(".speaker-list"),
      this._targets,
      this._selection,
      this._lang,
      false,
    );
    const available = this._targets.filter((t) => t.available),
      count = this._selection.length,
      all = this._view.querySelector(".select-all");
    all.checked = count === available.length;
    all.indeterminate = count > 0 && count < available.length;
    const text =
      count === 0
        ? "Kein Lautsprecher ausgewählt"
        : count === 1
          ? "1 Lautsprecher"
          : count === available.length
            ? "Alle Lautsprecher"
            : "{count} Lautsprecher";
    const summary = this._view.querySelector("summary");
    summary.querySelector("span").textContent = this._t(text, { count });
    summary.setAttribute("aria-label", this._t(text, { count }));
    summary.title = this._t(text, { count });
    if (this._phase === "ready") this._setStatus(this._readyStatus());
    if (["ready", "recording", "recorded"].includes(this._phase))
      this._view.querySelector(".main").disabled = count === 0;
    this._applyLayout();
  }
  _skippedStatus(ids, pending = false) {
    if (!ids?.length) return "";
    const speakers = ids.map((id) => {
      const target = this._targets?.find((target) => target.entity_id === id);
      if (!target) return id;
      const integration = homeCallSpeakerIntegration(target);
      return target.name + (integration ? " (" + integration + ")" : "");
    });
    return this._t(
      pending
        ? "Diese Lautsprecher werden übersprungen: {speakers}."
        : "Übersprungen: {speakers}.",
      { speakers: speakers.join(", ") },
    );
  }
  _readyStatus() {
    const message = this._selection.length
      ? "Tippe auf das Mikrofon"
      : "Bitte mindestens einen Lautsprecher auswählen.";
    const skipped = this._skippedStatus(this._skippedTargets, true);
    return skipped
      ? this._selection.length
        ? skipped
        : this._t(message) + "\n" + skipped
      : message;
  }
  _stopAtLimit() {
    if (this._phase !== "recording") return;
    this._recordedAtLimit = true;
    this._phase = "recorded";
    this._release(true);
    this._button("Senden", "send-outline");
    this._setStatus("Zeitlimit erreicht - bereit zum Senden.");
    this._draw();
  }
  _draw() {
    if (!this._view) return;
    const canvas = this._view.querySelector("canvas");
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (
      canvas.width !== Math.round(width * dpr) ||
      canvas.height !== Math.round(height * dpr)
    ) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle =
      getComputedStyle(this._view).getPropertyValue("--homecall-tone").trim() ||
      "transparent";
    const step = width / 64;
    for (let i = 0; i < 64; i++) {
      const h = Math.max(2, this._levels[i] * (height - 4));
      ctx.beginPath();
      ctx.roundRect(i * step, (height - h) / 2, Math.max(2, step - 2.4), h, 2);
      ctx.fill();
    }
    if (["recording", "recorded"].includes(this._phase)) {
      const elapsed =
        this._phase === "recorded" && this._recordedAtLimit
          ? 60
          : Math.max(0, Math.min(60, this._samples / this._sampleRate || 0));
      const remaining = Math.ceil(60 - elapsed);
      this._view.style.setProperty(
        "--homecall-recording-progress",
        `${elapsed * 6}deg`,
      );
      this._view.querySelector(".time").textContent =
        String(Math.floor(remaining / 60)) +
        ":" +
        String(remaining % 60).padStart(2, "0");
    }
    if (this._phase === "recording")
      this._raf = requestAnimationFrame(() => this._draw());
  }
  _setStatus(message) {
    if (this._view) {
      const text = this._t(message);
      this._view.querySelector(".status").textContent = text;
      const icon = this._view.querySelector(".status-more");
      icon.label = text;
      icon.setAttribute("aria-label", text);
      icon.title = text;
      this._syncPhase();
    }
  }
  _scheduleReady() {
    clearTimeout(this._readyTimer);
    const session = this._session;
    this._readyTimer = setTimeout(() => {
      if (session === this._session && this._view && this._phase === "sent")
        this._reset();
    }, 5000);
  }
  _doneButton() {
    if (this._phase === "sent" && this._partialSend) {
      this._button("Mikrofon starten");
      return;
    }
    this._button(
      this._phase === "sent" ? "Neue Durchsage" : "Erneut versuchen",
      this._phase === "sent" ? "check" : "refresh",
    );
  }
  _release(keepRecorder = false) {
    clearTimeout(this._timer);
    cancelAnimationFrame(this._raf);
    clearTimeout(this._recorderReadyTimer);
    clearTimeout(this._recorderStopTimer);
    this._rejectRecorderReady?.(new Error("Recording cancelled"));
    this._rejectRecorderStop?.(new Error("Recording cancelled"));
    this._resolveRecorderReady = this._rejectRecorderReady = null;
    this._resolveRecorderStop = this._rejectRecorderStop = null;
    if (this._processor) {
      if (this._processor.port) {
        this._processor.port.onmessage = null;
        this._processor.port.close();
      }
      this._processor.onprocessorerror = null;
      this._processor.disconnect();
      this._processor = null;
    }
    this._source?.disconnect();
    this._source = null;
    this._stream?.getTracks().forEach((t) => {
      t.removeEventListener?.("ended", this._trackEnded);
      t.stop();
    });
    this._trackEnded = null;
    this._stream = null;
    if (this._context) {
      this._context.onstatechange = null;
      if (this._context !== this._recorderPreparation?.context)
        this._context.close().catch(() => {});
    }
    this._context = null;
    const preparation = this._recorderPreparation;
    if (
      keepRecorder &&
      !document.hidden &&
      preparation &&
      preparation.context.state !== "closed"
    ) {
      preparation.idle = preparation.context.suspend().catch(() => {
        if (this._recorderPreparation === preparation) this._disposeRecorder();
      });
    } else this._disposeRecorder();
  }
  _wav() {
    const total = this._chunks.reduce((n, c) => n + c.length, 0);
    const buffer = new ArrayBuffer(44 + total * 2);
    const view = new DataView(buffer);
    const text = (offset, s) => {
      for (let i = 0; i < s.length; i++)
        view.setUint8(offset + i, s.charCodeAt(i));
    };
    text(0, "RIFF");
    view.setUint32(4, 36 + total * 2, true);
    text(8, "WAVE");
    text(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, this._sampleRate, true);
    view.setUint32(28, this._sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, "data");
    view.setUint32(40, total * 2, true);
    let pos = 44;
    for (const chunk of this._chunks)
      for (const s of chunk) {
        const v = Math.max(-1, Math.min(1, s));
        view.setInt16(pos, v < 0 ? v * 32768 : v * 32767, true);
        pos += 2;
      }
    return new Blob([buffer], { type: "audio/wav" });
  }
  async _finish() {
    if (!["recording", "recorded"].includes(this._phase)) return;
    const session = this._session;
    this._view.querySelector(".targets").open = false;
    this._phase = "stopping";
    this._button("Aufnahme wird abgeschlossen …", "stop");
    this._view.querySelector(".main").disabled = true;
    try {
      const stopping = performance.now();
      await this._flushRecorder();
      if (session !== this._session || !this._view) return;
      this._diagnostics.browser_timings_ms.stop_to_flush = Math.round(
        performance.now() - stopping,
      );
    } catch (error) {
      if (session !== this._session || !this._view) return;
      this._recorderFailed(session);
      return;
    }
    this._release(true);
    this._diagnostics.captured_duration_seconds =
      this._samples / this._sampleRate;
    const status = this._view.querySelector(".status-popover");
    if (status.matches(":popover-open")) status.hidePopover();
    this._phase = "sending";
    const targets = [...(this._recordingTargets || this._selection)];
    this._button("Wird gesendet", "volume-high");
    this._view.querySelector(".main").disabled = true;
    this._setStatus("Deine Nachricht wird vorbereitet …");
    try {
      if (this._samples / this._sampleRate < 0.2)
        throw new Error("Die Aufnahme war zu kurz. Bitte erneut aufnehmen.");
      if (!targets.length)
        throw new Error("Bitte mindestens einen Lautsprecher auswählen.");
      const query = new URLSearchParams();
      targets.forEach((t) => query.append("target", t));
      const requestStarted = performance.now();
      const response = await this._hass.fetchWithAuth(
        "/api/homecall/send?" + query,
        {
          method: "POST",
          headers: { "Content-Type": "audio/wav" },
          body: this._wav(),
        },
      );
      const data = await response.json();
      if (session !== this._session || !this._view) return;
      this._diagnostics.browser_timings_ms.upload_request = Math.round(
        performance.now() - requestStarted,
      );
      this._diagnostics.captured_duration_seconds =
        this._samples / this._sampleRate;
      if (data.diagnostics) this._diagnostics.server = data.diagnostics;
      this._chunks = [];
      if (!response.ok)
        throw new Error(
          data.error || "Die Durchsage konnte nicht gesendet werden.",
        );
      const sent = data.results.filter((r) => r.accepted).length;
      if (!sent)
        throw new Error(
          "Die Lautsprecher haben die Durchsage nicht angenommen.",
        );
      this._phase = "sent";
      const skipped = this._skippedStatus(this._recordingSkippedTargets);
      this._partialSend = sent < targets.length || !!skipped;
      this._setStatus(
        this._t("An {count} Lautsprecher gesendet.", { count: sent }) +
          (sent < targets.length
            ? " " + this._t("Einige Geräte konnten nicht erreicht werden.")
            : "") +
          (skipped ? "\n" + skipped : ""),
      );
      this._doneButton();
      this._checkReceipt(data.receipt, 0);
      if (!this._partialSend) this._scheduleReady();
    } catch (error) {
      if (session !== this._session) return;
      this._chunks = [];
      this._phase = "error";
      this._setStatus(error.message || "Die Durchsage ist fehlgeschlagen.");
      if (this._view) this._doneButton();
    }
  }
  async _checkReceipt(receipt, attempt) {
    const session = this._session;
    if (!this._view || !["sent", "ready"].includes(this._phase)) return;
    try {
      const response = await this._hass.fetchWithAuth(
        this._diagnostics?.server?.diagnostic_id
          ? "/api/homecall/status?diagnostic_id=" +
              encodeURIComponent(this._diagnostics.server.diagnostic_id)
          : "/api/homecall/status?receipt=" + encodeURIComponent(receipt),
      );
      const data = await response.json();
      if (session !== this._session) return;
      if (data.diagnostics) this._diagnostics.server = data.diagnostics;
      if ((data.diagnostics?.audio_fetches ?? data.audio_fetches) > 0) {
        if (!this._partialSend)
          this._setStatus("Deine Sprachnachricht wurde abgerufen.");
        return;
      }
    } catch {}
    if (session !== this._session) return;
    if (attempt < 8)
      this._receiptTimer = setTimeout(
        () => this._checkReceipt(receipt, attempt + 1),
        2000,
      );
    else if (!this._partialSend)
      this._setStatus(
        "An die Lautsprecher gesendet. Der Audioabruf ist noch nicht bestätigt.",
      );
  }
  _close() {
    clearTimeout(this._loadingTimer);
    clearTimeout(this._readyTimer);
    this._layoutObserver?.disconnect();
    cancelAnimationFrame(this._layoutRaf);
    this._session = null;
    this._phase = "idle";
    this._release();
    clearTimeout(this._receiptTimer);
    cancelAnimationFrame(this._raf);
    document.removeEventListener("visibilitychange", this._visibility);
    window.removeEventListener("resize", this._dismissTargets);
    window.removeEventListener("scroll", this._dismissTargets, true);
    this._chunks = [];
    const list = this._view?.querySelector(".list");
    if (list?.matches(":popover-open")) list.hidePopover();
    this._view?.remove();
    this._view = null;
  }
  disconnectedCallback() {
    // Moving an element triggers disconnect/connect in the same turn. Keep its
    // view and in-flight status request; release resources on actual removal.
    queueMicrotask(() => {
      if (!this.isConnected) this._close();
    });
  }
}
if (!customElements.get("homecall-card"))
  customElements.define("homecall-card", HomeCallCard);
window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "homecall-card"))
  window.customCards.push({
    type: "homecall-card",
    name: "HomeCall",
    description:
      "Voice announcements to your speakers · Durchsagen auf deinen Lautsprechern",
  });

class HomeCallCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  setConfig(config) {
    if (JSON.stringify(config) === JSON.stringify(this._config)) return;
    this._config = { ...config };
    this._render();
  }
  set hass(hass) {
    this._hass = hass;
    this._lang = (hass.locale?.language || hass.language || "en").split("-")[0];
    if (!this._loading && !this._targets) this._load();
    this._render();
  }
  _emit(config) {
    this._config = config;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config },
        bubbles: true,
        composed: true,
      }),
    );
  }
  _change(data) {
    const config = { ...this._config };
    delete config.title;
    if ("show_diagnostics" in data) {
      if (data.show_diagnostics) config.show_diagnostics = true;
      else delete config.show_diagnostics;
    }
    if ("show_speaker_selection" in data) {
      if (data.show_speaker_selection) delete config.show_speaker_selection;
      else config.show_speaker_selection = false;
    }
    if ("mode" in data) {
      if (data.mode === "all") {
        if (Array.isArray(config.default_targets))
          this._lastSelection = config.default_targets;
        delete config.default_targets;
      } else {
        config.default_targets =
          this._lastSelection ||
          this._targets?.map((target) => target.entity_id) ||
          [];
      }
    }
    this._emit(config);
    this._render();
  }
  async _load() {
    this._loading = true;
    try {
      await homeCallNativeSpeakerControls(this, this._hass);
      const response = await this._hass.fetchWithAuth("/api/homecall/status");
      if (!response.ok) throw Error();
      this._targets = (await response.json()).targets;
      this._error = false;
    } catch {
      this._error = true;
    } finally {
      this._loading = false;
      this._render();
    }
  }
  _render() {
    if (!this._config) return;
    const de = this._lang === "de";
    if (!this.shadowRoot.querySelector(".appearance")) {
      this.shadowRoot.innerHTML = `<style>:host{display:block;min-width:0}ha-expansion-panel{display:block;margin-bottom:24px}ha-icon{color:var(--secondary-text-color)}ha-alert{display:block;margin-top:16px}.speaker-list{min-width:0}</style>
        <ha-expansion-panel outlined class="appearance"><ha-icon slot="leading-icon" icon="mdi:palette-outline"></ha-icon><span slot="header" role="heading" aria-level="3"></span><ha-form></ha-form></ha-expansion-panel>
        <ha-expansion-panel outlined class="recipients"><ha-icon slot="leading-icon" icon="mdi:speaker-multiple"></ha-icon><span slot="header" role="heading" aria-level="3"></span><ha-form></ha-form><div class="speakers"></div><div class="message"></div></ha-expansion-panel>
        <ha-expansion-panel outlined class="troubleshooting"><ha-icon slot="leading-icon" icon="mdi:bug-outline"></ha-icon><span slot="header" role="heading" aria-level="3"></span><ha-form></ha-form></ha-expansion-panel>`;
      for (const form of this.shadowRoot.querySelectorAll("ha-form")) {
        form.addEventListener("value-changed", (event) => {
          if (event.target === form) this._change(event.detail.value);
        });
      }
    }
    const custom = Array.isArray(this._config.default_targets);
    const groups = {
      appearance: {
        title: de ? "Darstellung" : "Appearance",
        fields: [{ name: "show_speaker_selection", selector: { boolean: {} } }],
        data: {
          show_speaker_selection: this._config.show_speaker_selection !== false,
        },
      },
      recipients: {
        title: de ? "Standard-Empfänger" : "Default recipients",
        fields: [
          {
            name: "mode",
            selector: {
              select: {
                mode: "list",
                options: [
                  {
                    value: "all",
                    label: de
                      ? "Alle freigegebenen Geräte"
                      : "All allowed devices",
                  },
                  {
                    value: "custom",
                    label: de ? "Eigene Auswahl" : "Custom selection",
                  },
                ],
              },
            },
          },
        ],
        data: { mode: custom ? "custom" : "all" },
      },
      troubleshooting: {
        title: de ? "Fehlerbehebung" : "Troubleshooting",
        fields: [{ name: "show_diagnostics", selector: { boolean: {} } }],
        data: { show_diagnostics: this._config.show_diagnostics === true },
      },
    };
    const labels = {
      show_speaker_selection: de
        ? "Lautsprecherauswahl anzeigen"
        : "Show speaker selection",
      show_diagnostics: de ? "Diagnose anzeigen" : "Show diagnostics",
    };
    for (const [name, group] of Object.entries(groups)) {
      const panel = this.shadowRoot.querySelector("." + name);
      panel.querySelector('[slot="header"]').textContent = group.title;
      const form = panel.querySelector("ha-form");
      form.hass = this._hass;
      form.schema = group.fields;
      form.data = group.data;
      form.computeLabel = (schema) => labels[schema.name] || "";
    }
    const container = this.shadowRoot.querySelector(".speakers");
    container.hidden = !custom;
    if (custom && this._targets) {
      const targets = this._targets.map((target) => ({
        ...target,
        available: homeCallSpeakerAvailable(target, this._hass),
      }));
      let list = container.querySelector(".speaker-list");
      if (!list) {
        list = homeCallSpeakerList(
          targets,
          this._config.default_targets,
          this._lang,
          true,
          (id, checked) => {
            const selected = this._config.default_targets || [];
            if (selected.includes(id) === checked) return;
            const config = {
              ...this._config,
              default_targets: checked
                ? [...new Set([...selected, id])]
                : selected.filter((value) => value !== id),
            };
            this._lastSelection = config.default_targets;
            this._emit(config);
            this._render();
          },
        );
        container.append(list);
      }
      homeCallSyncSpeakerList(
        list,
        targets,
        this._config.default_targets,
        this._lang,
        true,
      );
    }
    const message = this.shadowRoot.querySelector(".message");
    message.replaceChildren();
    if (custom && !this._targets) {
      const alert = document.createElement("ha-alert");
      alert.setAttribute("alert-type", this._error ? "error" : "info");
      alert.textContent = this._error
        ? de
          ? "Geräte konnten nicht geladen werden."
          : "Could not load devices."
        : de
          ? "Geräte werden geladen …"
          : "Loading devices …";
      message.append(alert);
      if (this._error) {
        const retry = document.createElement("ha-button");
        retry.setAttribute("appearance", "plain");
        retry.textContent = de ? "Erneut versuchen" : "Retry";
        retry.onclick = () => this._load();
        message.append(retry);
      }
    }
  }
}
if (!customElements.get("homecall-card-editor"))
  customElements.define("homecall-card-editor", HomeCallCardEditor);
