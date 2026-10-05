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
  remove: "Remove",
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
  localAddress: "Local address for DLNA (optional)",
  localHint: "Leave blank to use Home Assistant’s local address automatically.",
  invalid_local_url: "Enter a valid HTTP or HTTPS address without a path.",
});
Object.assign(HC_WORDS.de, {
  devices: "Alexa-Lautsprecher",
  dlna: "DLNA-Lautsprecher",
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
  remove: "Entfernen",
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
  localAddress: "Lokale Adresse für DLNA (optional)",
  localHint:
    "Leer lassen, um die lokale Home-Assistant-Adresse automatisch zu verwenden.",
  invalid_local_url: "Gültige HTTP- oder HTTPS-Adresse ohne Pfad eingeben.",
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

    }
  }
  _open(page) {
    this._page = page;
    this._test = null;
    this._draft = {
      ...this._data,
      default_targets: [...this._data.default_targets],
      resume_dlna: [...(this._data.resume_dlna || [])],
    };
    if (page === "devices" && this._draft.use_all) {
      this._draft.default_targets = [...new Set([
        ...this._draft.default_targets,
        ...this._data.targets.filter(t => t.transport !== "dlna").map(t => t.entity_id),
      ])];
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
        this._page === "connection"
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
              ...(this._page === "dlna" ? {resume_dlna: this._draft.resume_dlna} : {}),
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
    if (action === "test") this._test = null;
    this._chosenDlna = entity_id;
    this._render();
    try {
      const result = await this._hass.callApi("POST", "homecall/speaker-test", {
        action,
        entity_id,
        receipt,
        enabled,
      });
      if (action === "test")
        this._test = { entity_id, receipt: result.receipt };
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
    const tested = new Set(result.tested_dlna || []);
    // Test/confirm/remove update registration immediately. Retain unsaved
    // visibility and resume edits for every other speaker.
    this._draft = {
      ...result,
      use_all: draft?.use_all ?? result.use_all,
      default_targets: draft ? [
        ...draft.default_targets.filter(id => !id.startsWith("media_player.") || tested.has(id)),
        ...(result.tested_dlna || []).filter(id => !previouslyTested.has(id) && result.default_targets.includes(id)),
      ] : [...result.default_targets],
      resume_dlna: [...(draft?.resume_dlna || result.resume_dlna || [])].filter(id => tested.has(id)),
    };
    this._data = result;
  }
  _speakerList(values) {
    if (this._page === "devices")
      return values.targets.filter(t => t.transport !== "dlna");
    return values.tested_dlna.map(id =>
      (values.dlna_candidates || []).find(t => t.entity_id === id) ||
      {entity_id: id, name: id, available: false});
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
    master.checked = speakers.length > 0 && count === speakers.length;
    master.indeterminate = count > 0 && count < speakers.length;
    master.disabled = this._busy || !speakers.length;
    master.addEventListener("change", () => setSelected(speakers.map(t => t.entity_id), master.checked));
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
  _bindDlna(values) {
    this.shadowRoot.querySelector(".refresh-speakers").onclick = event => { event.stopPropagation(); this._load(); };
    const available = this.shadowRoot.querySelector("[data-available-panel]");
    available.expanded = !!this._chosenDlna || (this._availableExpanded ?? !values.tested_dlna.length);
    available.addEventListener("expanded-changed", event => {
      if (event.target === available) this._availableExpanded = event.detail.expanded;
    });
    for (const button of this.shadowRoot.querySelectorAll("[data-test]"))
      button.onclick = () => this._speakerAction("test", button.dataset.test);
    const yes = this.shadowRoot.querySelector(".confirm-test");
    if (yes) yes.onclick = () => this._speakerAction("confirm", this._test.entity_id, this._test.receipt);
    const no = this.shadowRoot.querySelector(".retry-test");
    if (no) no.onclick = () => { this._test = null; this._chosenDlna = ""; this._error = ""; this._render(); };
    for (const button of this.shadowRoot.querySelectorAll("[data-remove]"))
      button.onclick = () => this._speakerAction("remove", button.dataset.remove);
  }
  _renderSpeakers(values, disabled) {
    const speakers = this._speakerList(values);
    const heading = `<ha-list-item-base><div slot="headline">${this._t("connectedSpeakers")}</div></ha-list-item-base><p class="section-description">${this._t("speakerDescription")}</p>`;
    const all = `<ha-list-base><ha-list-item-base><ha-checkbox slot="start" data-select-all aria-label="${this._t("selectAll")}"></ha-checkbox><div slot="headline">${this._t("selectAll")}</div></ha-list-item-base></ha-list-base>`;
    const rows = speakers.map(t => {
      const id = hcEscape(t.entity_id);
      const checkbox = `<ha-checkbox ${this._page === "dlna" ? 'slot="leading-icon"' : 'slot="start"'} data-visible="${id}" aria-label="${hcEscape(t.name)}"></ha-checkbox>`;
      if (this._page === "devices")
        return `<ha-list-item-base>${checkbox}<div slot="headline">${hcEscape(t.name)}</div>${t.available ? "" : `<div slot="supporting-text">${this._t("offline")}</div>`}</ha-list-item-base>`;
      return `<ha-expansion-panel data-speaker-panel="${id}" >${checkbox}<div slot="header" class="speaker-label">${hcEscape(t.name)}<div class="speaker-status">${this._t(t.available ? "online" : "offline")}</div></div><div class="speaker-options"><ha-checkbox data-resume="${id}">${this._t("resume")}<span slot="hint">${this._t("resumeHint")}</span></ha-checkbox></div><div class="section-actions"><ha-button appearance="plain" variant="brand" data-remove="${id}" ${disabled}>${this._t("remove")}</ha-button></div></ha-expansion-panel>`;
    }).join("");
    let body = `<ha-card class="speaker-section">${heading}${all}<ha-list-base>${rows || `<ha-list-item-base><div slot="headline">${this._t("noAdded")}</div><div slot="supporting-text">${this._t("noAddedHint")}</div></ha-list-item-base>`}</ha-list-base></ha-card>`;
    if (this._page === "dlna") {
      const choices = (values.dlna_candidates || []).filter(t => !values.tested_dlna.includes(t.entity_id));
      const availableRows = choices.map(t => {
        const chosen = this._chosenDlna === t.entity_id;
        const confirmation = chosen && this._test ? `<div class="confirmation"><ha-alert alert-type="info">${this._t("heard")}</ha-alert><div class="confirmation-actions"><ha-button class="retry-test" appearance="plain" variant="brand" ${disabled}>${this._t("no")}</ha-button><ha-button class="confirm-test" appearance="accent" variant="brand" ${disabled}>${this._t("yes")}</ha-button></div></div>` : "";
        const progress = chosen && this._busy ? `<div class="test-content"><ha-alert alert-type="info" role="status">${this._t("testing")}</ha-alert></div>` : "";
        return `<ha-list-item-base><div slot="headline">${hcEscape(t.name)}</div><div slot="supporting-text">${this._t(t.available ? "online" : "offline")}</div><ha-button slot="end" class="test-sound" data-test="${hcEscape(t.entity_id)}" appearance="plain" variant="brand" ${!t.available || this._busy || this._test ? "disabled" : ""}>${this._t(chosen && this._busy ? "testing" : "test")}</ha-button></ha-list-item-base>${progress}${confirmation}${chosen && this._error ? `<div class="test-content"><ha-alert alert-type="error">${hcEscape(this._error)}</ha-alert></div>` : ""}`;
      }).join("");
      body += `<ha-card><ha-expansion-panel data-available-panel><span slot="header" class="discovery-label">${this._t("availableSpeakers")}</span><div class="section-actions"><ha-button class="refresh-speakers" appearance="plain" variant="brand" ${disabled}>${this._t("refresh")}</ha-button></div><ha-list-base>${availableRows}</ha-list-base>${!choices.length ? `<div class="test-content"><ha-alert alert-type="info">${this._t(values.dlna_candidates.length ? "allAdded" : "emptyDlna")}</ha-alert></div>` : choices.every(t => !t.available) ? `<div class="test-content"><ha-alert alert-type="info">${this._t("offlineDlna")}</ha-alert></div>` : ""}</ha-expansion-panel></ha-card>`;
    }
    if (this._error && !this._chosenDlna) body += `<ha-alert alert-type="error">${hcEscape(this._error)}</ha-alert>`;
    return body + `<footer class="footer"><ha-button class="save" appearance="accent" variant="brand" ${this._busy || this._test ? "disabled" : ""}>${this._t(this._busy ? "saving" : "saveChanges")}</ha-button></footer>`;
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
      const total =
        values.targets.filter((t) => t.transport !== "dlna").length +
        values.dlna_candidates.length;
      const count = values.targets.filter(
        (t) =>
          t.transport !== "dlna" &&
          values.default_targets.includes(t.entity_id),
      ).length;
      body = `<ha-card><ha-list-base><ha-list-item-base><ha-icon slot="start" icon="mdi:check-circle-outline"></ha-icon><div slot="headline">${this._t("ready")}</div><div slot="supporting-text">${total} ${this._t("found")}</div></ha-list-item-base></ha-list-base></ha-card><ha-card class="settings-navigation"><ha-list-base><ha-list-item-button data-page="connection"><ha-icon slot="start" icon="mdi:lan-connect"></ha-icon><div slot="headline">${this._t("connection")}</div><div slot="supporting-text">${this._t(values.use_system_url ? "systemAddress" : "ownAddress")}</div><ha-icon-next slot="end"></ha-icon-next></ha-list-item-button><ha-list-item-button data-page="devices"><ha-icon slot="start" icon="mdi:speaker-multiple"></ha-icon><div slot="headline">${this._t("devices")}</div><div slot="supporting-text">${values.use_all ? this._t("allAllowed") : count === 1 ? (this._lang === "de" ? "1 Lautsprecher in der Karte" : "1 speaker shown in the card") : count + " " + this._t("allowed")}</div><ha-icon-next slot="end"></ha-icon-next></ha-list-item-button><ha-list-item-button data-page="dlna"><ha-icon slot="start" icon="mdi:speaker-wireless"></ha-icon><div slot="headline">${this._t("dlna")}</div><div slot="supporting-text">${values.tested_dlna.filter((id) => values.default_targets.includes(id)).length} ${this._t("allowed")}</div><ha-icon-next slot="end"></ha-icon-next></ha-list-item-button></ha-list-base></ha-card>`;
    } else if (this._page === "dlna" || this._page === "devices") {
      body = this._renderSpeakers(values, disabled);
    } else {
      body = "<ha-form></ha-form>";
    }
    this.shadowRoot.innerHTML = `<style>
:host{display:block;height:100%;color:var(--primary-text-color);font-family:var(--primary-font-family)}.content{max-width:600px;margin:0 auto;padding:24px 16px calc(24px + var(--safe-area-inset-bottom,0px));display:grid;gap:16px}ha-card{overflow:hidden}.surface{padding:24px}ha-icon,ha-icon-next{color:var(--secondary-text-color)}ha-expansion-panel{color:var(--secondary-text-color)}[data-available-panel]{--expansion-panel-summary-padding:4px 16px;--expansion-panel-content-padding:0}.discovery-label{font-weight:var(--ha-font-weight-normal)}.speaker-label{margin-inline-start:8px;font-size:var(--ha-font-size-m);font-weight:var(--ha-font-weight-normal);line-height:var(--ha-line-height-normal)}.speaker-status{color:var(--secondary-text-color);font-size:var(--ha-font-size-s);font-weight:var(--ha-font-weight-normal)}.section-description{margin:0;padding:0 16px 8px;color:var(--secondary-text-color);font-size:var(--ha-font-size-m,14px);line-height:1.5}.section-actions{display:flex;justify-content:flex-end;padding:0 16px 12px}[data-available-panel]>.section-actions{padding:16px 16px 0}.test-content{padding:0 16px 12px}.footer{display:flex;justify-content:flex-end;padding-inline:16px}.speaker-options{padding:8px 16px 4px 48px}.speaker-section>ha-list-base{padding:0 8px}.speaker-section ha-expansion-panel{--expansion-panel-content-padding:0;--expansion-panel-summary-padding:0 16px;margin:0}.error{display:block;margin-top:16px}.confirmation{padding:0 16px 12px}.confirmation-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:12px;margin-top:8px}@media(max-width:500px){.content{padding-top:16px}.surface{padding:16px}}
</style><hass-subpage header="${home ? "HomeCall" : this._t(this._page)}" back-path="/config/integrations/integration/homecall"><ha-icon-button class="close" slot="toolbar-icon" label="${home ? this._t("close") : this._t("cancel")}" ${disabled}></ha-icon-button><main class="content">${home || this._page === "dlna" || this._page === "devices" ? body : `<ha-card class="surface">${body}${this._error ? `<ha-alert class="error" alert-type="error">${hcEscape(this._error)}</ha-alert>` : ""}${this._page === "dlna" ? "" : `<footer class="footer"><ha-button class="save" appearance="accent" variant="brand" ${disabled}>${this._busy ? this._t("saving") : this._t("save")}</ha-button></footer>`}</ha-card>`}</main></hass-subpage>`;
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
    if (values && (this._page === "dlna" || this._page === "devices")) {
      this._bindSpeakers(values);
      if (this._page === "dlna") this._bindDlna(values);
      return;
    }
    const form = this.shadowRoot.querySelector("ha-form");
    if (form) {
      form.hass = this._hass;
      form.disabled = this._busy;
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
