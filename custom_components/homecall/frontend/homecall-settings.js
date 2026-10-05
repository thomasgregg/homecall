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
  dlnaHint:
    "Add a speaker with a quick sound test. Alexa speakers already work without a test.",
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
  interruption:
    "The test uses the current volume and replaces any playing audio.",
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
    "Lautsprecher mit einem kurzen Klangtest hinzufügen. Alexa funktioniert ohne Test.",
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
  interruption:
    "Der Test verwendet die aktuelle Lautstärke und ersetzt laufende Wiedergabe.",
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
class HomeCallSettings extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._page = "home";
    this._busy = false;
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
    this._loading = true;
    try {
      await Promise.all([homeCallNativeForms(), homeCallNativePage(this)]);
      this._data = await this._hass.callApi("GET", "homecall/settings");
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
    } else if (this._page === "devices") {
      this._draft.use_all = data.mode === "all";
      if (data.targets !== undefined)
        this._draft.default_targets = [
          ...data.targets,
          ...this._draft.default_targets.filter((id) =>
            id.startsWith("media_player."),
          ),
        ];
    }
  }
  _open(page) {
    this._page = page;
    this._test = null;
    this._adding = false;
    this._draft = {
      ...this._data,
      default_targets: [...this._data.default_targets],
    };
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
        this._data = result;
        this._draft = {
          ...result,
          default_targets: [...result.default_targets],
        };
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
  _bindDlna(values) {
    const add = this.shadowRoot.querySelector(".add-speaker");
    if (add)
      add.onclick = () => {
        this._adding = true;
        this._render();
      };
    const form = this.shadowRoot.querySelector("ha-form");
    if (form) {
      form.hass = this._hass;
      form.disabled = this._busy;
      form.schema = [
        {
          name: "speaker",
          required: true,
          selector: {
            select: {
              options: values.dlna_candidates
                .filter((t) => !values.tested_dlna.includes(t.entity_id))
                .map((t) => ({
                  value: t.entity_id,
                  label:
                    t.name + (t.available ? "" : " · " + this._t("offline")),
                })),
            },
          },
        },
      ];
      form.data = { speaker: this._chosenDlna || "" };
      form.computeLabel = () => this._t("choose");
      form.addEventListener("value-changed", () => {
        this._chosenDlna = form.data.speaker;
        this._test = null;
        this._render();
      });
    }
    const test = this.shadowRoot.querySelector(".test-sound");
    if (test)
      test.onclick = () => {
        if (form.reportValidity())
          this._speakerAction("test", form.data.speaker);
      };
    const yes = this.shadowRoot.querySelector(".confirm-test");
    if (yes)
      yes.onclick = () =>
        this._speakerAction(
          "confirm",
          this._test.entity_id,
          this._test.receipt,
        );
    const no = this.shadowRoot.querySelector(".retry-test");
    if (no)
      no.onclick = () => {
        this._test = null;
        this._render();
      };
    for (const button of this.shadowRoot.querySelectorAll("[data-remove]"))
      button.onclick = () =>
        this._speakerAction("remove", button.dataset.remove);
    for (const checkbox of this.shadowRoot.querySelectorAll("[data-resume]")) {
      checkbox.checked = (values.resume_dlna || []).includes(
        checkbox.dataset.resume,
      );
      checkbox.disabled = this._busy;
      checkbox.addEventListener("change", () =>
        this._speakerAction(
          "resume",
          checkbox.dataset.resume,
          undefined,
          checkbox.checked,
        ),
      );
    }
    for (const checkbox of this.shadowRoot.querySelectorAll("[data-visible]")) {
      checkbox.checked = values.default_targets.includes(
        checkbox.dataset.visible,
      );
      checkbox.disabled = this._busy;
      checkbox.addEventListener("change", async () => {
        this._busy = true;
        const selected = values.default_targets.filter(
          (id) => id !== checkbox.dataset.visible,
        );
        if (checkbox.checked) selected.push(checkbox.dataset.visible);
        this._render();
        try {
          const result = await this._hass.callApi("POST", "homecall/settings", {
            page: "devices",
            use_all: values.use_all,
            default_targets: selected,
          });
          this._data = result;
          this._draft = {
            ...result,
            default_targets: [...result.default_targets],
          };
        } catch (error) {
          this._error = this._t(error.body?.error || "failed");
        } finally {
          this._busy = false;
          this._render();
        }
      });
    }
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
      body = `<ha-card><ha-list-base><ha-list-item-base><ha-icon slot="start" class="ready" icon="mdi:check-circle-outline"></ha-icon><div slot="headline">${this._t("ready")}</div><div slot="supporting-text">${total} ${this._t("found")}</div></ha-list-item-base></ha-list-base></ha-card><ha-card class="settings-navigation"><ha-list-base><ha-list-item-button data-page="connection"><ha-icon slot="start" icon="mdi:lan-connect"></ha-icon><div slot="headline">${this._t("connection")}</div><div slot="supporting-text">${this._t(values.use_system_url ? "systemAddress" : "ownAddress")}</div><ha-icon-next slot="end"></ha-icon-next></ha-list-item-button><ha-list-item-button data-page="devices"><ha-icon slot="start" icon="mdi:speaker-multiple"></ha-icon><div slot="headline">${this._t("devices")}</div><div slot="supporting-text">${values.use_all ? this._t("allAllowed") : count === 1 ? (this._lang === "de" ? "1 Lautsprecher in der Karte" : "1 speaker shown in the card") : count + " " + this._t("allowed")}</div><ha-icon-next slot="end"></ha-icon-next></ha-list-item-button><ha-list-item-button data-page="dlna"><ha-icon slot="start" icon="mdi:speaker-wireless"></ha-icon><div slot="headline">${this._t("dlna")}</div><div slot="supporting-text">${values.tested_dlna.filter((id) => values.default_targets.includes(id)).length} ${this._t("allowed")}</div><ha-icon-next slot="end"></ha-icon-next></ha-list-item-button></ha-list-base></ha-card>`;
    } else if (this._page === "dlna") {
      const candidates = values.dlna_candidates || [];
      const added = values.tested_dlna.map(
        (id) =>
          candidates.find((t) => t.entity_id === id) || {
            entity_id: id,
            name: id,
            available: false,
          },
      );
      const choices = candidates.filter(
        (t) => !values.tested_dlna.includes(t.entity_id),
      );
      body = `<p>${this._t("dlnaHint")}</p><div class="speaker-list">${added.map((t) => `<div class="speaker-row"><ha-icon icon="mdi:speaker"></ha-icon><div class="speaker-name">${hcEscape(t.name)}${t.available ? "" : ` <small>· ${this._t("offline")}</small>`}</div><ha-checkbox data-visible="${hcEscape(t.entity_id)}" aria-label="${this._t("shown")}">${this._t("shown")}</ha-checkbox><ha-checkbox data-resume="${hcEscape(t.entity_id)}" aria-label="${this._t("resume")}">${this._t("resume")}</ha-checkbox><ha-button data-remove="${hcEscape(t.entity_id)}" ${disabled}>${this._t("remove")}</ha-button></div>`).join("")}</div>${added.length ? `<p class="secondary">${this._t("resumeHint")}</p>` : ""}<h3>${this._t("add")}</h3>${choices.length ? (!this._adding ? `<ha-button class="add-speaker" appearance="accent">${this._t("add")}</ha-button>` : `<ha-form></ha-form><p class="secondary">${this._t("interruption")}</p><ha-button class="test-sound" appearance="accent" ${disabled}>${this._t(this._busy ? "testing" : "playTest")}</ha-button>`) : `<p>${this._t("emptyDlna")}</p>`}${this._test ? `<div class="confirmation"><h3>${this._t("heard")}</h3><ha-button class="confirm-test" appearance="accent" ${disabled}>${this._t("yes")}</ha-button><ha-button class="retry-test" ${disabled}>${this._t("no")}</ha-button></div>` : ""}`;
    } else {
      body = "<ha-form></ha-form>";
    }
    this.shadowRoot.innerHTML = `<style>
:host{display:block;height:100%;--app-header-background-color:var(--sidebar-background-color);--app-header-text-color:var(--sidebar-text-color);--app-header-border-bottom:1px solid var(--divider-color);color:var(--primary-text-color);font-family:var(--primary-font-family)}.content{max-width:600px;margin:0 auto;padding:24px 16px calc(24px + var(--safe-area-inset-bottom,0px));display:grid;gap:16px}ha-card{overflow:hidden}.ready{color:var(--success-color)}.settings-navigation ha-icon,.settings-navigation ha-icon-next{color:var(--secondary-text-color)}.surface{padding:24px}.footer{display:flex;justify-content:flex-end;margin-top:24px}.error{display:block;margin-top:16px}.speaker-row{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--divider-color)}.speaker-name{flex:1;min-width:0}.secondary,small{color:var(--secondary-text-color)}.confirmation{margin-top:24px;padding:16px;border-radius:12px;background:var(--secondary-background-color)}@media(max-width:500px){.content{padding-top:16px}.surface{padding:16px}}
</style><hass-subpage header="${home ? "HomeCall" : this._t(this._page)}" back-path="/config/integrations/integration/homecall"><ha-icon-button class="close" slot="toolbar-icon" label="${home ? this._t("close") : this._t("cancel")}" ${disabled}></ha-icon-button><main class="content">${home ? body : `<ha-card class="surface">${body}${this._error ? `<ha-alert class="error" alert-type="error">${hcEscape(this._error)}</ha-alert>` : ""}${this._page === "dlna" ? "" : `<footer class="footer"><ha-button class="save" appearance="accent" variant="brand" ${disabled}>${this._busy ? this._t("saving") : this._t("save")}</ha-button></footer>`}</ha-card>`}</main></hass-subpage>`;
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
    if (this._page === "dlna") {
      this._bindDlna(values);
      return;
    }
    const form = this.shadowRoot.querySelector("ha-form");
    if (form) {
      form.hass = this._hass;
      form.disabled = this._busy;
      const connection = this._page === "connection";
      form.data = connection
        ? {
            mode: values.use_system_url ? "system" : "custom",
            public_url: values.public_url,
            local_url: values.local_url,
          }
        : {
            mode: values.use_all ? "all" : "custom",
            targets: values.default_targets.filter(
              (id) => !id.startsWith("media_player."),
            ),
          };
      form.schema = [
        {
          name: "mode",
          selector: {
            select: {
              mode: "list",
              options: connection
                ? [
                    { value: "system", label: this._t("systemAddress") },
                    { value: "custom", label: this._t("ownAddress") },
                  ]
                : [
                    { value: "all", label: this._t("all") },
                    { value: "custom", label: this._t("custom") },
                  ],
            },
          },
        },
      ];
      if (connection && !values.use_system_url)
        form.schema = [
          ...form.schema,
          {
            name: "public_url",
            required: values.targets.some((t) =>
              t.entity_id.startsWith("notify."),
            ),
            selector: { text: { type: "url" } },
          },
        ];
      if (!connection && !values.use_all)
        form.schema = [
          ...form.schema,
          {
            name: "targets",
            selector: {
              select: {
                multiple: true,
                mode: "list",
                options: values.targets
                  .filter((t) => t.transport !== "dlna")
                  .map((t) => ({
                    value: t.entity_id,
                    label:
                      t.name + (t.available ? "" : " · " + this._t("offline")),
                  })),
              },
            },
          },
        ];
      if (connection)
        form.schema = [
          ...form.schema,
          { name: "local_url", selector: { text: { type: "url" } } },
        ];
      form.computeLabel = (s) =>
        s.name === "local_url"
          ? this._t("localAddress")
          : s.name === "public_url"
            ? this._t("address")
            : "";
      form.computeHelper = (s) =>
        s.name === "local_url"
          ? this._t("localHint") + " " + (values.detected_local_url || "")
          : s.name === "public_url"
            ? this._t("hint")
            : s.name === "mode"
              ? connection
                ? values.use_system_url
                  ? values.system_url || this._t("no_system_url")
                  : ""
                : values.use_all
                  ? this._t("future") +
                    " · " +
                    values.targets.filter((t) => t.transport !== "dlna")
                      .length +
                    " " +
                    this._t("allowed")
                  : this._t("description")
              : "";
      form.addEventListener("value-changed", (event) => {
        if (event.target !== form) return;
        const wasMode = connection
          ? this._draft.use_system_url
          : this._draft.use_all;
        this._capture();
        const nowMode = connection
          ? this._draft.use_system_url
          : this._draft.use_all;
        if (wasMode !== nowMode) this._render();
      });
    }
  }
}
if (!customElements.get("homecall-settings"))
  customElements.define("homecall-settings", HomeCallSettings);
