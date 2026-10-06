async function homeCallNativePage(element) {
  if (customElements.get("hass-subpage")) return;
  // HA exposes page-module loaders on its router. Reuse them instead of
  // copying a header or depending on version-specific hashed bundle URLs.
  let parent = element;
  while (parent && parent.localName !== "partial-panel-resolver")
    parent = parent.parentElement || parent.getRootNode().host;
  const loadConfig = parent?.routerOptions?.routes?.config?.load;
  if (typeof loadConfig !== "function")
    throw new Error("Home Assistant page components are unavailable.");
  await loadConfig();
  const config = document.createElement("ha-panel-config");
  const loadInfo = config.routerOptions?.routes?.info?.load;
  if (typeof loadInfo !== "function")
    throw new Error("Home Assistant page components are unavailable.");
  await loadInfo();
  if (!customElements.get("hass-subpage"))
    throw new Error("Home Assistant page components are unavailable.");
}
async function homeCallNativeForms() {
  if (customElements.get("ha-form")) return;
  if (!window.loadCardHelpers)
    throw new Error("Home Assistant form components are unavailable.");
  const helpers = await window.loadCardHelpers();
  const card = helpers.createCardElement({ type: "entities", entities: [] });
  await card.constructor.getConfigElement();
}
async function homeCallNativeSpeakerControls(element, hass) {
  if (customElements.get("ha-expansion-panel") && customElements.get("ha-checkbox")) return;
  // Let HA's form schema loader import its own lazy controls. No copied
  // components, external packages, or version-specific module URLs.
  const form = document.createElement("ha-form");
  form.hidden = true;
  form.hass = hass;
  form.data = {visible: []};
  form.schema = [
    {name: "settings", type: "expandable", flatten: true, schema: []},
    {name: "visible", type: "multi_select", options: {}},
  ];
  element.shadowRoot.append(form);
  let timeout;
  try {
    await Promise.race([
      Promise.all([customElements.whenDefined("ha-expansion-panel"), customElements.whenDefined("ha-checkbox")]),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("Home Assistant speaker controls are unavailable.")), 10000); }),
    ]);
  } finally {
    clearTimeout(timeout);
    form.remove();
  }
}
const HC_WORDS = {
  de: {
    connection: "Verbindung",
    devices: "Geräte",
    address: "Öffentliche HTTPS-Adresse",
    hint: "Nabu Casa oder deine eigene öffentliche HTTPS-Adresse.",
    ready: "Bereit",
    found: "Geräte erkannt",
    allowed: "Geräte freigegeben",
    allAllowed: "Alle Geräte freigegeben",
    description: "Diese Geräte erscheinen in der Karte.",
    all: "Alle Geräte",
    future: "Neue Geräte automatisch einschließen",
    custom: "Eigene Auswahl",
    save: "Speichern",
    back: "Zurück",
    close: "Schließen",
    cancel: "Änderungen verwerfen",
    saving: "Wird gespeichert …",
    invalid_url: "Bitte eine gültige öffentliche HTTPS-Adresse eingeben.",
    select_echo: "Bitte mindestens ein Gerät auswählen.",
    failed: "Einstellungen konnten nicht geladen oder gespeichert werden.",
    offline: "offline",
    loading: "Wird geladen …",
  },
  en: {
    connection: "Connection",
    devices: "Devices",
    address: "Public HTTPS address",
    hint: "Nabu Casa or your own public HTTPS address.",
    ready: "Ready",
    found: "devices detected",
    allowed: "devices allowed",
    allAllowed: "All devices allowed",
    description: "These devices appear in the card.",
    all: "All devices",
    future: "Automatically include new devices",
    custom: "Custom selection",
    save: "Save",
    back: "Back",
    close: "Close",
    cancel: "Discard changes",
    saving: "Saving …",
    invalid_url: "Enter a valid public HTTPS address.",
    select_echo: "Select at least one device.",
    failed: "Could not load or save settings.",
    offline: "offline",
    loading: "Loading …",
  },
};
Object.assign(HC_WORDS.de, {
  systemAddress: "Home-Assistant-Adresse verwenden",
  ownAddress: "Eigene HTTPS-Adresse",
  systemHint: "Automatisch aus den HA-Netzwerkeinstellungen.",
  no_system_url:
    "Keine öffentliche HTTPS-Adresse gefunden. Bitte eine eigene Adresse verwenden.",
});
Object.assign(HC_WORDS.en, {
  systemAddress: "Use Home Assistant address",
  ownAddress: "Own HTTPS address",
  systemHint: "Automatically use HA network settings.",
  no_system_url: "No public HTTPS address found. Use your own address.",
});
Object.assign(HC_WORDS.en, {
  devices: "Alexa speakers",
  dlna: "DLNA speakers",
  sonos: "Sonos speakers",
  music_assistant: "Music Assistant speakers",
  echomuse: "EchoMuse speakers",
  emptyEchoMuse: "No new EchoMuse speakers found. Connect your Dots through ESPHome in Home Assistant first.",
  cast: "Google Cast speakers",
  emptyCast: "No new Google Cast devices found. Set up Google Cast in Home Assistant first.",
  emptyMusicAssistant: "No new Music Assistant players found. Set up the Music Assistant integration in Home Assistant first.",
  emptyAlexa: "No new Alexa speakers found. Set up the Alexa Devices integration in Home Assistant first.",
  emptySonos: "No new Sonos speakers found. Set up the Sonos integration in Home Assistant first.",
  add: "Add speaker",
  description: "Choose Alexa speakers shown in the card.",
  all: "All Alexa speakers",
  allAllowed: "All Alexa speakers shown in the card",
  allowed: "speakers shown in the card",
  future: "Automatically include new Alexa speakers",
  choose: "Choose a speaker",
  dlnaHint: "Choose a speaker, play a sound, then add it to the card.",
  playTest: "Play test sound",
  heard: "Did you hear the sound?",
  yes: "Yes, add speaker",
  no: "No, try again",
  testing: "Playing test …",
  add: "Add",
  remove: "Remove",
  removeHint: "Remove speaker from your list",
  shown: "Show in the card",
  resume: "Resume music after announcements",
  resumeHint:
    "Restores the previous track where supported. Playlists and streaming services may not resume.",
  emptyDlna:
    "No new DLNA speakers found. Add the DLNA Digital Media Renderer integration in Home Assistant first.",
  no_local_url:
    "No local Home Assistant address found. Check Connection settings.",
  test_failed:
    "The speaker could not start playback. Check its connection and try again.",
  test_not_fetched:
    "The speaker has not downloaded the sound, or the test expired. Play the test again.",
  speaker_unavailable: "This speaker is offline. Turn it on and try again.",
  test_busy: "Another announcement is being sent. Try again shortly.",
  localAddress: "Local address for DLNA / Sonos / Music Assistant / Cast / EchoMuse (optional)",
  localHint: "Leave blank to use Home Assistant’s local address automatically.",
  invalid_local_url: "Enter a valid HTTP or HTTPS address without a path.",
});
Object.assign(HC_WORDS.de, {
  devices: "Alexa-Lautsprecher",
  dlna: "DLNA-Lautsprecher",
  sonos: "Sonos-Lautsprecher",
  music_assistant: "Music Assistant-Lautsprecher",
  echomuse: "EchoMuse-Lautsprecher",
  emptyEchoMuse: "Keine neuen EchoMuse-Lautsprecher gefunden. Die Dots zuerst über ESPHome in Home Assistant verbinden.",
  cast: "Google Cast-Lautsprecher",
  emptyCast: "Keine neuen Google Cast-Geräte gefunden. Zuerst Google Cast in Home Assistant einrichten.",
  emptyMusicAssistant: "Keine neuen Music Assistant-Player gefunden. Zuerst Music Assistant in Home Assistant einrichten.",
  emptyAlexa: "Keine neuen Alexa-Lautsprecher gefunden. Zuerst Alexa Devices in Home Assistant einrichten.",
  emptySonos: "Keine neuen Sonos-Lautsprecher gefunden. Zuerst Sonos in Home Assistant einrichten.",
  add: "Lautsprecher hinzufügen",
  description: "Alexa-Lautsprecher auswählen, die in der Karte erscheinen.",
  all: "Alle Alexa-Lautsprecher",
  allAllowed: "Alle Alexa-Lautsprecher in der Karte",
  allowed: "Lautsprecher in der Karte",
  future: "Neue Alexa-Lautsprecher automatisch einschließen",
  choose: "Lautsprecher auswählen",
  dlnaHint:
    "Lautsprecher auswählen, Testton abspielen und zur Karte hinzufügen.",
  playTest: "Testton abspielen",
  heard: "Hast du den Ton gehört?",
  yes: "Ja, hinzufügen",
  no: "Nein, erneut versuchen",
  testing: "Testton wird abgespielt …",
  add: "Hinzufügen",
  remove: "Entfernen",
  removeHint: "Lautsprecher aus deiner Liste entfernen",
  shown: "In der Karte anzeigen",
  resume: "Musik nach Durchsagen fortsetzen",
  resumeHint:
    "Vorherigen Titel nach Möglichkeit fortsetzen. Wiedergabelisten und Streamingdienste werden möglicherweise nicht wiederhergestellt.",
  emptyDlna:
    "Keine neuen DLNA-Lautsprecher gefunden. Zuerst DLNA Digital Media Renderer in Home Assistant einrichten.",
  no_local_url:
    "Keine lokale Home-Assistant-Adresse gefunden. Verbindungseinstellungen prüfen.",
  test_failed:
    "Wiedergabe konnte nicht gestartet werden. Verbindung prüfen und erneut versuchen.",
  test_not_fetched:
    "Der Ton wurde noch nicht heruntergeladen oder der Test ist abgelaufen. Test wiederholen.",
  speaker_unavailable:
    "Dieser Lautsprecher ist offline. Einschalten und erneut versuchen.",
  test_busy: "Eine Durchsage wird gesendet. Gleich erneut versuchen.",
  localAddress: "Lokale Adresse für DLNA / Sonos / Music Assistant / Cast / EchoMuse (optional)",
  localHint:
    "Leer lassen, um die lokale Home-Assistant-Adresse automatisch zu verwenden.",
  invalid_local_url: "Gültige HTTP- oder HTTPS-Adresse ohne Pfad eingeben.",
});
Object.assign(HC_WORDS.en, {
  announcements: "Announcements",
  announcement_chime: "Play a chime before messages",
  skip_cast_chime: "Skip the chime on direct Google Cast speakers",
  chimeHint: "Play the selected two-tone chime followed by your recorded message. Speaker sound tests are unchanged.",
  skipCastHint: "Send only your voice to speakers selected under Google Cast. Their connection sound may still play. Speakers selected through Music Assistant still receive the chime.",
  chimeOn: "Chime on",
  chimeOff: "Chime off",
});
Object.assign(HC_WORDS.de, {
  announcements: "Durchsagen",
  announcement_chime: "Signalton vor Nachrichten abspielen",
  skip_cast_chime: "Signalton bei direkten Google-Cast-Lautsprechern überspringen",
  chimeHint: "Den ausgewählten Zweiklang vor der aufgenommenen Nachricht abspielen. Lautsprechertests bleiben unverändert.",
  skipCastHint: "An Lautsprecher unter Google Cast nur die Stimme senden. Der Verbindungston kann weiterhin erklingen. Über Music Assistant ausgewählte Lautsprecher erhalten den Signalton weiterhin.",
  chimeOn: "Signalton an",
  chimeOff: "Signalton aus",
});
const hcEscape = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

Object.assign(HC_WORDS.en, {
  offlineDlna: "Turn on these speakers to run the sound test.",
  connectedSpeakers: "Your speakers",
  speakerDescription: "Choose speakers shown in the HomeCall card.",
  selectAll: "Select all",
  test: "Test",
  testHint: "Play a short sound to check this speaker.",
  diagnostics: "Diagnostics",
  copyDiagnostics: "Copy diagnostics",
  copied: "Copied",
  copyFailed: "Could not copy. Select the text instead.",
  saveChanges: "Save changes",
  availableSpeakers: "Available speakers",
  noAdded: "No speakers added yet",
  noAddedHint: "Add a speaker below to show it in the card.",
  refresh: "Refresh",
  online: "Online",
  allAdded: "All detected speakers have been added.",
});
Object.assign(HC_WORDS.de, {
  offlineDlna: "Diese Lautsprecher einschalten, um den Testton abzuspielen.",
  connectedSpeakers: "Deine Lautsprecher",
  speakerDescription: "Lautsprecher auswählen, die in der HomeCall-Karte erscheinen.",
  selectAll: "Alle auswählen",
  test: "Testen",
  testHint: "Einen kurzen Ton abspielen, um diesen Lautsprecher zu prüfen.",
  diagnostics: "Diagnose",
  copyDiagnostics: "Diagnose kopieren",
  copied: "Kopiert",
  copyFailed: "Kopieren nicht möglich. Bitte Text auswählen.",
  saveChanges: "Änderungen speichern",
  availableSpeakers: "Verfügbare Lautsprecher",
  allAdded: "Alle erkannten Lautsprecher wurden hinzugefügt.",
  noAdded: "Noch keine Lautsprecher hinzugefügt",
  noAddedHint:
    "Unten einen Lautsprecher hinzufügen, damit er in der Karte erscheint.",
  refresh: "Aktualisieren",
  online: "Online",
});
class HomeCallSettings extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._page = "home";
    this._busy = false;
    this._expandedSpeakers = new Set();
  }
  connectedCallback() {
    if (this._hass && !this._loading && !this._data) this._load();
  }
  set hass(hass) {
    this._hass = hass;
    const page = this.shadowRoot.querySelector("hass-subpage");
    if (page) page.hass = hass;
    const lang = (hass.locale?.language || hass.language || "en")
      .toLowerCase()
      .split("-")[0];
    const next = lang === "de" ? "de" : "en";
    if (this._lang !== next) {
      this._lang = next;
      if (this._draft) this._capture();
      this._render();
    }
    if (this.isConnected && !this._loading && !this._data) this._load();
  }
  set narrow(value) {
    this._narrow = value;
    const page = this.shadowRoot.querySelector("hass-subpage");
    if (page) page.narrow = value;
  }
  set panel(value) {
    this._panel = value;
  }
  _t(key) {
    return HC_WORDS[this._lang || "en"][key] || key;
  }
  async _load() {
    if (this._loading) return;
    this._loading = true;
    try {
      await Promise.all([homeCallNativeForms(), homeCallNativePage(this)]);
      await homeCallNativeSpeakerControls(this, this._hass);
      this._data = await this._hass.callApi("GET", "homecall/settings");
      if (this._draft) this._mergeSpeakerData(this._data);
      this._error = "";
    } catch {
      this._error = this._t("failed");
    } finally {
      this._loading = false;
      this._render();
    }
  }
  _capture() {
    const form = this.shadowRoot.querySelector("ha-form");
    if (!this._draft || !form?.data) return;
    const data = form.data;
    if (this._page === "connection") {
      this._draft.use_system_url = data.mode === "system";
      if (data.public_url !== undefined)
        this._draft.public_url = data.public_url;
      this._draft.local_url = data.local_url || "";
    } else if (this._page === "announcements") {
      this._draft.announcement_chime = !!data.announcement_chime;
      const child = this.shadowRoot.querySelector(".chime-subsetting ha-form");
      if (child?.data) this._draft.skip_cast_chime = !!child.data.skip_cast_chime;
    }
  }
  _open(page) {
    this._page = page;
    this._test = null;
    this._draft = {
      ...this._data,
      announcement_chime: this._data.announcement_chime ?? false,
      skip_cast_chime: this._data.skip_cast_chime ?? true,
      default_targets: [...this._data.default_targets],
      resume_dlna: [...(this._data.resume_dlna || [])],
      tested_dlna: [...this._data.tested_dlna],
      added_speakers: [...(this._data.added_speakers ?? this._data.default_targets)],
    };
    if (page === "devices" && this._draft.use_all) {
      this._draft.default_targets = [...new Set([
        ...this._draft.default_targets,
        ...this._data.targets.filter(t => !["dlna", "sonos", "music_assistant", "cast", "echomuse"].includes(t.transport)).map(t => t.entity_id),
      ])];
      this._draft.added_speakers = [...new Set([...this._draft.added_speakers, ...this._draft.default_targets.filter(id => !this._data.tested_dlna.includes(id))])];
      this._draft.use_all = false;
    }
    this._expandedSpeakers.clear();
    this._availableExpanded = null;
    this._error = "";
    this._render();
  }
  _back() {
    if (this._busy) return;
    this._page = "home";
    this._draft = null;
    this._error = "";
    this._render();
  }
  _close() {
    if (this._busy) return;
    history.pushState(null, "", "/config/integrations/integration/homecall");
    window.dispatchEvent(new Event("location-changed"));
  }
  async _save() {
    const form = this.shadowRoot.querySelector("ha-form");
    if (form && !form.reportValidity()) return;
    this._capture();
    this._busy = true;
    this._error = "";
    this._render();
    try {
      const payload =
        this._page === "announcements"
          ? {
              page: "announcements",
              announcement_chime: this._draft.announcement_chime,
              skip_cast_chime: this._draft.skip_cast_chime,
            }
          : this._page === "connection"
          ? {
              page: "connection",
              public_url: this._draft.public_url,
              use_system_url: this._draft.use_system_url,
              local_url: this._draft.local_url,
            }
          : {
              page: "devices",
              use_all: this._draft.use_all,
              default_targets: this._draft.default_targets,
              added_speakers: this._draft.added_speakers,
              ...(this._isLocalSpeakerPage() ? {resume_dlna: this._draft.resume_dlna, removed_dlna: this._data.tested_dlna.filter(id => !this._draft.tested_dlna.includes(id))} : {}),
            };
      this._data = await this._hass.callApi(
        "POST",
        "homecall/settings",
        payload,
      );
      this._page = "home";
      this._draft = null;
    } catch (error) {
      this._error = this._t(error.body?.error || "failed");
    } finally {
      this._busy = false;
      this._render();
    }
  }
  async _speakerAction(action, entity_id, receipt, enabled) {
    this._busy = true;
    this._error = "";
    if (action === "test") { this._test = null; this._diagnostics = null; }
    this._chosenDlna = entity_id;
    this._render();
    try {
      const result = await this._hass.callApi("POST", "homecall/speaker-test", {
        action,
        entity_id,
        receipt,
        enabled,
      });
      if (action === "test") {
        this._diagnostics = result.diagnostics || null;
        this._test = this._page === "dlna" && !this._data.tested_dlna.includes(entity_id) ? { entity_id, receipt: result.receipt } : null;
      }
      else {
        this._mergeSpeakerData(result);
        this._test = null;
        this._chosenDlna = "";
      }
    } catch (error) {
      this._error = this._t(error.body?.error || "failed");
    } finally {
      this._busy = false;
      this._render();
    }
  }
  _mergeSpeakerData(result) {
    const draft = this._draft;
    const previouslyTested = new Set(this._data?.tested_dlna || []);
    const removed = new Set(draft ? [...previouslyTested].filter(id => !draft.tested_dlna.includes(id)) : []);
    const registered = (result.tested_dlna || []).filter(id => !removed.has(id));
    const tested = new Set(registered);
    // Keep pending removal, visibility, and resume edits across refresh and tests.
    this._draft = {
      ...result,
      tested_dlna: registered,
      added_speakers: [...(draft?.added_speakers ?? result.added_speakers ?? result.default_targets)],
      use_all: draft?.use_all ?? result.use_all,
      default_targets: draft ? [
        ...draft.default_targets.filter(id => !id.startsWith("media_player.") || tested.has(id) || (result.dlna_candidates || []).some(t => t.entity_id === id && ["sonos", "music_assistant", "cast", "echomuse"].includes(t.transport))),
        ...(result.tested_dlna || []).filter(id => !previouslyTested.has(id) && result.default_targets.includes(id)),
      ] : [...result.default_targets],
      resume_dlna: [...(draft?.resume_dlna || result.resume_dlna || [])].filter(id => tested.has(id)),
    };
    this._data = result;
  }
  _isLocalSpeakerPage() {
    return ["dlna", "sonos", "music_assistant", "cast", "echomuse"].includes(this._page);
  }
  _localCandidates(values, platform = this._page) {
    return (values.dlna_candidates || []).filter(t => (t.transport || "dlna") === platform);
  }
  _speakerCandidates(values) {
    return this._page === "devices"
      ? values.targets.filter(t => !["dlna", "sonos", "music_assistant", "cast", "echomuse"].includes(t.transport))
      : this._localCandidates(values);
  }
  _speakerList(values) {
    const candidates = this._speakerCandidates(values);
    if (this._page !== "dlna") return candidates.filter(t => (values.added_speakers ?? values.default_targets).includes(t.entity_id));
    return values.tested_dlna.map(id =>
      candidates.find(t => t.entity_id === id) ||
      (!(values.dlna_candidates || []).some(t => t.entity_id === id) && this._page === "dlna"
        ? {entity_id: id, name: id, available: false} : null)).filter(Boolean);
  }
  _bindSpeakers(values) {
    const speakers = this._speakerList(values);
    const selected = id => this._page === "devices" && values.use_all || values.default_targets.includes(id);
    const setSelected = (ids, checked) => {
      // Select all applies to the current list, not future discoveries.
      if (this._page === "devices" && values.use_all) {
        values.default_targets = [...new Set([...values.default_targets, ...speakers.map(t => t.entity_id)])];
        values.use_all = false;
      }
      const targets = new Set(values.default_targets);
      ids.forEach(id => checked ? targets.add(id) : targets.delete(id));
      values.default_targets = [...targets];
      this._render();
    };
    const master = this.shadowRoot.querySelector("[data-select-all]");
    const count = speakers.filter(t => selected(t.entity_id)).length;
    if (master) {
      master.checked = speakers.length > 0 && count === speakers.length;
      master.indeterminate = count > 0 && count < speakers.length;
      master.disabled = this._busy || !speakers.length;
      master.addEventListener("change", () => setSelected(speakers.map(t => t.entity_id), master.checked));
    }
    for (const checkbox of this.shadowRoot.querySelectorAll("[data-visible]")) {
      checkbox.checked = selected(checkbox.dataset.visible);
      checkbox.disabled = this._busy;
      checkbox.addEventListener("change", () => setSelected([checkbox.dataset.visible], checkbox.checked));
      // A checkbox in the native expansion header must not toggle the panel.
      checkbox.addEventListener("click", event => event.stopPropagation());
      checkbox.addEventListener("keydown", event => event.stopPropagation());
    }
    for (const panel of this.shadowRoot.querySelectorAll("[data-speaker-panel]")) {
      panel.expanded = this._expandedSpeakers.has(panel.dataset.speakerPanel);
      panel.addEventListener("expanded-changed", event => {
        if (event.target !== panel) return;
        if (event.detail.expanded) this._expandedSpeakers.add(panel.dataset.speakerPanel);
        else this._expandedSpeakers.delete(panel.dataset.speakerPanel);
      });
    }
    for (const checkbox of this.shadowRoot.querySelectorAll("[data-resume]")) {
      checkbox.checked = (values.resume_dlna || []).includes(checkbox.dataset.resume);
      checkbox.disabled = this._busy;
      checkbox.addEventListener("change", () => {
        const ids = new Set(values.resume_dlna || []);
        if (checkbox.checked) ids.add(checkbox.dataset.resume);
        else ids.delete(checkbox.dataset.resume);
        values.resume_dlna = [...ids];
      });
    }
  }
  _bindLocalSpeakers(values) {
    const refresh = this.shadowRoot.querySelector(".refresh-speakers");
    if (refresh) refresh.onclick = event => { event.stopPropagation(); this._load(); };
    const available = this.shadowRoot.querySelector("[data-available-panel]");
    if (available) available.expanded = !!this._chosenDlna || (this._availableExpanded ?? !this._speakerList(values).length);
    available?.addEventListener("expanded-changed", event => {
      if (event.target === available) this._availableExpanded = event.detail.expanded;
    });
    for (const button of this.shadowRoot.querySelectorAll("[data-test]"))
      button.onclick = () => this._speakerAction("test", button.dataset.test);
    const copy = this.shadowRoot.querySelector(".copy-diagnostics");
    if (copy) copy.onclick = async () => {
      try {
        let trace = this._diagnostics;
        const identifier = trace.diagnostic_id;
        const contents = (async () => {
          try {
            const latest = await this._hass.callApi("GET", "homecall/status?diagnostic_id=" + encodeURIComponent(identifier));
            if (latest.diagnostics) trace = latest.diagnostics;
            if (this._diagnostics?.diagnostic_id === identifier) this._diagnostics = trace;
          } catch { /* Copy the last measurement if the trace expired or HA is offline. */ }
          const serialized = JSON.stringify(trace, null, 2);
          copy.parentElement.querySelector("pre").textContent = serialized;
          return serialized;
        })();
        // Keep Safari's click permission while the fresh data is still in flight.
        if (window.ClipboardItem && navigator.clipboard?.write)
          await navigator.clipboard.write([new ClipboardItem({"text/plain": contents.then(text => new Blob([text], {type: "text/plain"}))})]);
        else await navigator.clipboard.writeText(await contents);
        copy.textContent = this._t("copied");
      } catch { copy.textContent = this._t("copyFailed"); }
    };
    const yes = this.shadowRoot.querySelector(".confirm-test");
    if (yes) yes.onclick = () => this._speakerAction("confirm", this._test.entity_id, this._test.receipt);
    const no = this.shadowRoot.querySelector(".retry-test");
    if (no) no.onclick = () => { this._test = null; this._chosenDlna = ""; this._error = ""; this._render(); };
    for (const button of this.shadowRoot.querySelectorAll("[data-add]"))
      button.onclick = () => {
        const id = button.dataset.add;
        this._draft.added_speakers = [...new Set([...this._draft.added_speakers, id])];
        this._draft.default_targets = [...new Set([...this._draft.default_targets, id])];
        this._render();
      };
    for (const button of this.shadowRoot.querySelectorAll("[data-remove]"))
      button.onclick = () => {
        const id = button.dataset.remove;
        for (const key of ["tested_dlna", "default_targets", "resume_dlna", "added_speakers"])
          this._draft[key] = this._draft[key].filter(value => value !== id);
        this._render();
      };
  }
  _renderSpeakers(values, disabled) {
    const speakers = this._speakerList(values);
    const heading = `<div class="card-content">${this._t("speakerDescription")}</div>`;
    const all = speakers.length ? `<ha-list-base><ha-list-item-base><ha-checkbox slot="start" data-select-all aria-label="${this._t("selectAll")}"></ha-checkbox><div slot="headline">${this._t("selectAll")}</div></ha-list-item-base></ha-list-base>` : "";
    const rows = speakers.map(t => {
      const id = hcEscape(t.entity_id);
      const checkbox = `<ha-checkbox slot="start" data-visible="${id}" aria-label="${hcEscape(t.name)}"></ha-checkbox>`;
      return `<ha-expansion-panel data-speaker-panel="${id}" ><ha-list-item-base slot="header">${checkbox}<div slot="headline">${hcEscape(t.name)}</div><div slot="supporting-text">${this._t(t.available ? "online" : "offline")}</div></ha-list-item-base><ha-list-base>${this._page !== "dlna" ? "" : `<ha-list-item-base><div slot="headline">${this._t("resume")}</div><ha-checkbox slot="end" id="resume-${id}" data-resume="${id}" aria-label="${hcEscape(this._t("resume"))}"></ha-checkbox></ha-list-item-base>`}<ha-list-item-base><div slot="headline">${this._t("testHint")}</div><ha-button slot="end" appearance="plain" variant="brand" data-test="${id}" ${!t.available || this._busy || this._test ? "disabled" : ""}>${this._t(this._chosenDlna === t.entity_id && this._busy ? "testing" : "test")}</ha-button></ha-list-item-base><ha-list-item-base><div slot="headline">${this._t("removeHint")}</div><ha-button slot="end" appearance="plain" variant="brand" data-remove="${id}" ${disabled}>${this._t("remove")}</ha-button></ha-list-item-base></ha-list-base></ha-expansion-panel>`;
    }).join("");
    let body = `<ha-card class="speaker-section" header="${hcEscape(this._t("connectedSpeakers"))}">${heading}${all}<ha-list-base>${rows || `<ha-list-item-base><div slot="headline">${this._t("noAdded")}</div><div slot="supporting-text">${this._t("noAddedHint")}</div></ha-list-item-base>`}</ha-list-base>${speakers.length || this._speakerList(this._data).length || (this._page === "devices" && this._data.use_all && this._speakerCandidates(this._data).length) ? `<footer class="footer card-actions"><ha-button class="save" appearance="accent" variant="brand" ${this._busy || this._test ? "disabled" : ""}>${this._t(this._busy ? "saving" : "save")}</ha-button></footer>` : ""}</ha-card>`;
    {
      const added = new Set(speakers.map(t => t.entity_id));
      const choices = this._speakerCandidates(values).filter(t => !added.has(t.entity_id));
      const availableRows = choices.map(t => {
        const chosen = this._chosenDlna === t.entity_id;
        const confirmation = this._page === "dlna" && chosen && this._test ? `<div class="confirmation card-content"><ha-alert alert-type="info">${this._t("heard")}</ha-alert><div class="confirmation-actions card-actions"><ha-button class="retry-test" appearance="plain" variant="brand" ${disabled}>${this._t("no")}</ha-button><ha-button class="confirm-test" appearance="accent" variant="brand" ${disabled}>${this._t("yes")}</ha-button></div></div>` : "";
        const progress = chosen && this._busy ? `<div class="test-content card-content"><ha-alert alert-type="info" role="status">${this._t("testing")}</ha-alert></div>` : "";
        return `<ha-list-item-base><div slot="headline">${hcEscape(t.name)}</div><div slot="supporting-text">${this._t(t.available ? "online" : "offline")}</div><ha-button slot="end" class="test-sound" data-${this._page === "dlna" ? "test" : "add"}="${hcEscape(t.entity_id)}" appearance="plain" variant="brand" ${(this._page === "dlna" && !t.available) || this._busy || this._test ? "disabled" : ""}>${this._t(this._page === "dlna" ? chosen && this._busy ? "testing" : "test" : "add")}</ha-button></ha-list-item-base>${progress}${confirmation}${chosen && this._error ? `<div class="test-content card-content"><ha-alert alert-type="error">${hcEscape(this._error)}</ha-alert></div>` : ""}`;
      }).join("");
      body += `<ha-card><ha-expansion-panel data-available-panel><span slot="header" class="discovery-label">${this._t("availableSpeakers")}</span><ha-list-item-base><ha-button slot="end" class="refresh-speakers" appearance="plain" variant="brand" ${disabled}>${this._t("refresh")}</ha-button></ha-list-item-base><ha-list-base>${availableRows}</ha-list-base>${!choices.length ? `<div class="test-content card-content"><ha-alert alert-type="info">${this._t(this._speakerCandidates(values).length ? "allAdded" : this._page === "devices" ? "emptyAlexa" : this._page === "sonos" ? "emptySonos" : this._page === "music_assistant" ? "emptyMusicAssistant" : this._page === "cast" ? "emptyCast" : this._page === "echomuse" ? "emptyEchoMuse" : "emptyDlna")}</ha-alert></div>` : this._page === "dlna" && choices.every(t => !t.available) ? `<div class="test-content card-content"><ha-alert alert-type="info">${this._t("offlineDlna")}</ha-alert></div>` : ""}</ha-expansion-panel></ha-card>`;
    }
    if (this._error && (this._page !== "dlna" || !this._chosenDlna)) body += `<ha-alert alert-type="error">${hcEscape(this._error)}</ha-alert>`;
    if (this._diagnostics) body += `<ha-card class="test-diagnostics"><ha-expansion-panel header="${hcEscape(this._t("diagnostics"))}"><div class="diagnostic-content"><pre>${hcEscape(JSON.stringify(this._diagnostics, null, 2))}</pre><ha-button class="copy-diagnostics" appearance="plain" variant="brand">${this._t("copyDiagnostics")}</ha-button></div></ha-expansion-panel></ha-card>`;
    return body;
  }
  _render() {
    if (!this.shadowRoot) return;
    const home = this._page === "home";
    const values = this._draft || this._data;
    const disabled = this._busy ? "disabled" : "";
    let body = "";
    if (!values) {
      body = `<p role="status">${hcEscape(this._error || this._t("loading"))}</p>`;
    } else if (home) {
      const count = values.targets.filter(
        (t) =>
          !["dlna", "sonos", "music_assistant", "cast", "echomuse"].includes(t.transport) &&
          values.default_targets.includes(t.entity_id),
      ).length;
      body = `<ha-card class="connection-navigation"><ha-list-base><ha-list-item-button data-page="connection"><ha-icon slot="start" icon="mdi:lan-connect"></ha-icon><div slot="headline">${this._t("connection")}</div><div slot="supporting-text">${this._t(values.use_system_url ? "systemAddress" : "ownAddress")}</div><ha-icon-next slot="end"></ha-icon-next></ha-list-item-button></ha-list-base></ha-card><ha-card class="announcements-navigation"><ha-list-base><ha-list-item-button data-page="announcements"><ha-icon slot="start" icon="mdi:bullhorn"></ha-icon><div slot="headline">${this._t("announcements")}</div><div slot="supporting-text">${this._t(values.announcement_chime ? "chimeOn" : "chimeOff")}</div><ha-icon-next slot="end"></ha-icon-next></ha-list-item-button></ha-list-base></ha-card><ha-card class="settings-navigation"><ha-list-base><ha-list-item-button data-page="devices"><ha-icon slot="start" icon="mdi:speaker-multiple"></ha-icon><div slot="headline">${this._t("devices")}</div><div slot="supporting-text">${values.use_all ? this._t("allAllowed") : count === 1 ? (this._lang === "de" ? "1 Lautsprecher in der Karte" : "1 speaker shown in the card") : count + " " + this._t("allowed")}</div><ha-icon-next slot="end"></ha-icon-next></ha-list-item-button>${["dlna", "sonos", "music_assistant", "cast", "echomuse"].map(platform => `<ha-list-item-button data-page="${platform}"><ha-icon slot="start" icon="mdi:speaker-multiple"></ha-icon><div slot="headline">${this._t(platform)}</div><div slot="supporting-text">${this._localCandidates(values, platform).filter(t => (platform === "dlna" ? values.tested_dlna : values.added_speakers ?? values.default_targets).includes(t.entity_id) && values.default_targets.includes(t.entity_id)).length} ${this._t("allowed")}</div><ha-icon-next slot="end"></ha-icon-next></ha-list-item-button>`).join("")}</ha-list-base></ha-card>`;
    } else if (this._isLocalSpeakerPage() || this._page === "devices") {
      body = this._renderSpeakers(values, disabled);
    } else if (this._page === "announcements") {
      body = `<div class="chime-settings"><ha-form></ha-form>${values.announcement_chime ? '<div class="chime-subsetting"><ha-form></ha-form></div>' : ""}</div>`;
    } else {
      body = "<ha-form></ha-form>";
    }
    this.shadowRoot.innerHTML = `<style>
:host{display:block;height:100%;color:var(--primary-text-color);font-family:var(--primary-font-family)}.content{max-width:600px;margin:0 auto;padding:var(--ha-space-6,24px) var(--ha-space-4,16px);display:grid;gap:var(--ha-space-4,16px)}ha-card{overflow:hidden}ha-expansion-panel[data-speaker-panel]{--expansion-panel-summary-padding:0 8px 0 0;--expansion-panel-content-padding:0}ha-list-item-base[slot="header"]{font-weight:var(--ha-font-weight-normal,400)}ha-icon,ha-icon-next,.speaker-status{color:var(--secondary-text-color)}.footer{display:flex;justify-content:flex-end}.test-content.card-content,.confirmation.card-content{padding:var(--ha-space-4,16px)}.diagnostic-content{padding:var(--ha-space-4,16px)}.confirmation-actions{display:flex;justify-content:flex-end;gap:var(--ha-space-2,8px);padding-top:var(--ha-space-4,16px)}.chime-subsetting{margin-inline-start:var(--ha-space-4,16px)}.test-diagnostics pre{white-space:pre-wrap;overflow-wrap:anywhere;user-select:text}
</style><hass-subpage header="${home ? "HomeCall" : this._t(this._page)}" back-path="/config/integrations/integration/homecall"><ha-icon-button class="close" slot="toolbar-icon" label="${home ? this._t("close") : this._t("cancel")}" ${disabled}></ha-icon-button><main class="content">${home || this._isLocalSpeakerPage() || this._page === "devices" ? body : `<ha-card class="surface"><div class="card-content">${body}${this._error ? `<ha-alert class="error" alert-type="error">${hcEscape(this._error)}</ha-alert>` : ""}</div>${this._isLocalSpeakerPage() ? "" : `<footer class="footer card-actions"><ha-button class="save" appearance="accent" variant="brand" ${disabled}>${this._busy ? this._t("saving") : this._t("save")}</ha-button></footer>`}</ha-card>`}</main></hass-subpage>`;
    const page = this.shadowRoot.querySelector("hass-subpage");
    page.hass = this._hass;
    page.narrow = !!this._narrow;
    page.backCallback = () => (home ? this._close() : this._back());
    this.shadowRoot.querySelector(".close").onclick = () =>
      home ? this._close() : this._back();
    for (const button of this.shadowRoot.querySelectorAll("[data-page]"))
      button.onclick = () => this._open(button.dataset.page);
    const save = this.shadowRoot.querySelector(".save");
    if (save) save.onclick = () => this._save();
    this.shadowRoot.querySelector(".close").path =
      "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z";
    if (values && (this._isLocalSpeakerPage() || this._page === "devices")) {
      this._bindSpeakers(values);
      this._bindLocalSpeakers(values);
      return;
    }
    const form = this.shadowRoot.querySelector("ha-form");
    if (form) {
      form.hass = this._hass;
      form.disabled = this._busy;
      if (this._page === "announcements") {
        form.data = {
          announcement_chime: values.announcement_chime ?? false,
          skip_cast_chime: values.skip_cast_chime ?? true,
        };
        form.schema = [{name: "announcement_chime", selector: {boolean: {}}}];
        form.computeLabel = schema => this._t(schema.name);
        const child = this.shadowRoot.querySelector(".chime-subsetting ha-form");
        if (child) {
          child.hass = this._hass;
          child.disabled = this._busy;
          child.data = {skip_cast_chime: values.skip_cast_chime ?? true};
          child.schema = [{name: "skip_cast_chime", selector: {boolean: {}}}];
          child.computeLabel = schema => this._t(schema.name);
          child.addEventListener("value-changed", event => {
            if (event.target === child) this._capture();
          });
        }
        form.addEventListener("value-changed", event => {
          if (event.target !== form) return;
          const wasEnabled = this._draft.announcement_chime;
          this._capture();
          if (wasEnabled !== this._draft.announcement_chime) this._render();
        });
        return;
      }
      form.data = {
        mode: values.use_system_url ? "system" : "custom",
        public_url: values.public_url,
        local_url: values.local_url,
      };
      form.schema = [{
        name: "mode",
        selector: {select: {mode: "list", options: [
          {value: "system", label: this._t("systemAddress")},
          {value: "custom", label: this._t("ownAddress")},
        ]}},
      }];
      if (!values.use_system_url) form.schema = [...form.schema, {
        name: "public_url",
        required: values.targets.some(t => t.entity_id.startsWith("notify.")),
        selector: {text: {type: "url"}},
      }];
      form.schema = [...form.schema, {name: "local_url", selector: {text: {type: "url"}}}];
      form.computeLabel = schema => schema.name === "local_url" ? this._t("localAddress")
        : schema.name === "public_url" ? this._t("address") : "";
      form.computeHelper = schema => schema.name === "local_url"
        ? this._t("localHint") + " " + (values.detected_local_url || "")
        : schema.name === "public_url" ? this._t("hint")
        : schema.name === "mode" && values.use_system_url ? values.system_url || this._t("no_system_url") : "";
      form.addEventListener("value-changed", event => {
        if (event.target !== form) return;
        const wasMode = this._draft.use_system_url;
        this._capture();
        if (wasMode !== this._draft.use_system_url) this._render();
      });
    }
  }
}
if (!customElements.get("homecall-settings"))
  customElements.define("homecall-settings", HomeCallSettings);
