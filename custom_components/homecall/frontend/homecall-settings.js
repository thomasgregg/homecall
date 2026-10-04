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
    } else if (this._page === "devices") {
      this._draft.use_all = data.mode === "all";
      if (data.targets !== undefined)
        this._draft.default_targets = [...data.targets];
    }
  }
  _open(page) {
    this._page = page;
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
  _render() {
    if (!this.shadowRoot) return;
    const home = this._page === "home";
    const values = this._draft || this._data;
    const disabled = this._busy ? "disabled" : "";
    let body = "";
    if (!values) {
      body = `<p role="status">${hcEscape(this._error || this._t("loading"))}</p>`;
    } else if (home) {
      const total = values.targets.length;
      const count = values.targets.filter((t) =>
        values.default_targets.includes(t.entity_id),
      ).length;
      body = `<ha-card><ha-list-base><ha-list-item-base><ha-icon slot="start" class="ready" icon="mdi:check-circle-outline"></ha-icon><div slot="headline">${this._t("ready")}</div><div slot="supporting-text">${total} ${this._t("found")}</div></ha-list-item-base></ha-list-base></ha-card><ha-card class="settings-navigation"><ha-list-base><ha-list-item-button data-page="connection"><ha-icon slot="start" icon="mdi:lan-connect"></ha-icon><div slot="headline">${this._t("connection")}</div><div slot="supporting-text">${this._t(values.use_system_url ? "systemAddress" : "ownAddress")}</div><ha-icon-next slot="end"></ha-icon-next></ha-list-item-button><ha-list-item-button data-page="devices"><ha-icon slot="start" icon="mdi:speaker-multiple"></ha-icon><div slot="headline">${this._t("devices")}</div><div slot="supporting-text">${values.use_all ? this._t("allAllowed") : count === 1 ? (this._lang === "de" ? "1 Gerät freigegeben" : "1 device allowed") : count + " " + this._t("allowed")}</div><ha-icon-next slot="end"></ha-icon-next></ha-list-item-button></ha-list-base></ha-card>`;
    } else {
      body = "<ha-form></ha-form>";
    }
    this.shadowRoot.innerHTML = `<style>
:host{display:block;height:100%;--app-header-background-color:var(--sidebar-background-color);--app-header-text-color:var(--sidebar-text-color);--app-header-border-bottom:1px solid var(--divider-color);color:var(--primary-text-color);font-family:var(--primary-font-family)}.content{max-width:600px;margin:0 auto;padding:24px 16px calc(24px + var(--safe-area-inset-bottom,0px));display:grid;gap:16px}ha-card{overflow:hidden}.ready{color:var(--success-color)}.settings-navigation ha-icon,.settings-navigation ha-icon-next{color:var(--secondary-text-color)}.surface{padding:24px}.footer{display:flex;justify-content:flex-end;margin-top:24px}.error{display:block;margin-top:16px}@media(max-width:500px){.content{padding-top:16px}.surface{padding:16px}}
</style><hass-subpage header="${home ? "HomeCall" : this._t(this._page)}" back-path="/config/integrations/integration/homecall"><ha-icon-button class="close" slot="toolbar-icon" label="${home ? this._t("close") : this._t("cancel")}" ${disabled}></ha-icon-button><main class="content">${home ? body : `<ha-card class="surface">${body}${this._error ? `<ha-alert class="error" alert-type="error">${hcEscape(this._error)}</ha-alert>` : ""}<footer class="footer"><ha-button class="save" appearance="accent" variant="brand" ${disabled}>${this._busy ? this._t("saving") : this._t("save")}</ha-button></footer></ha-card>`}</main></hass-subpage>`;
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
    const form = this.shadowRoot.querySelector("ha-form");
    if (form) {
      form.hass = this._hass;
      form.disabled = this._busy;
      const connection = this._page === "connection";
      form.data = connection
        ? {
            mode: values.use_system_url ? "system" : "custom",
            public_url: values.public_url,
          }
        : {
            mode: values.use_all ? "all" : "custom",
            targets: values.default_targets,
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
            required: true,
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
                options: values.targets.map((t) => ({
                  value: t.entity_id,
                  label:
                    t.name + (t.available ? "" : " · " + this._t("offline")),
                })),
              },
            },
          },
        ];
      form.computeLabel = (s) =>
        s.name === "public_url" ? this._t("address") : "";
      form.computeHelper = (s) =>
        s.name === "public_url"
          ? this._t("hint")
          : s.name === "mode"
            ? connection
              ? values.use_system_url
                ? values.system_url || this._t("no_system_url")
                : ""
              : values.use_all
                ? this._t("future") +
                  " · " +
                  values.targets.length +
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
