// Lightweight native-control fixtures for local layout tests and previews.
// Production continues to use Home Assistant's own components.
export function registerHomeAssistantFixtures() {
  customElements.define(
    "ha-card",
    class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" }).innerHTML =
          "<style>:host{border:1px solid var(--divider-color,#ddd);border-radius:var(--ha-card-border-radius,12px);background:var(--ha-card-background,white)}</style><slot></slot>";
      }
    },
  );
  customElements.define(
    "ha-button",
    class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" }).innerHTML = `<style>
        :host{display:inline-flex}button{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;height:var(--ha-button-height,44px);border:1px solid transparent;border-radius:var(--ha-button-border-radius,8px);background:transparent;color:var(--secondary-text-color,#666);font:inherit;cursor:pointer}:host(.main) button{background:var(--homecall-tone);color:white}button:focus-visible{outline:2px solid var(--primary-color);outline-offset:3px}[part=label]{display:flex;align-items:center;justify-content:center}[part=spinner]{display:none;box-sizing:border-box;width:1em;height:1em;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:turn .8s linear infinite}:host([data-loading]) [part=spinner]{display:block}:host([data-loading]) slot{display:none}button:disabled{cursor:default}@keyframes turn{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){[part=spinner]{animation:none}}
      </style><button part="base"><span part="label"><slot></slot><span part="spinner" aria-hidden="true"></span></span></button>`;
      }
      get loading() {
        return this.hasAttribute("data-loading");
      }
      set loading(value) {
        this.toggleAttribute("data-loading", !!value);
        this._syncDisabled();
      }
      get disabled() {
        return this.hasAttribute("disabled");
      }
      set disabled(value) {
        this.toggleAttribute("disabled", !!value);
        this._syncDisabled();
      }
      _syncDisabled() {
        this.shadowRoot.querySelector("button").disabled =
          this.disabled || this.loading;
      }
    },
  );
  customElements.define(
    "ha-icon",
    class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }
      static get observedAttributes() {
        return ["icon"];
      }
      connectedCallback() {
        this._draw();
      }
      attributeChangedCallback() {
        if (this.isConnected) this._draw();
      }
      _draw() {
        const paths = {
          "volume-high":
            "M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z",
          "chevron-down":
            "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
          microphone:
            "M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z",
          "delete-outline":
            "M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19M8,9H16V19H8V9M15.5,4L14.5,3H9.5L8.5,4H5V6H19V4H15.5Z",
          "clock-outline":
            "M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z",
          "send-outline":
            "M4 6.03L11.5 9.25L4 8.25L4 6.03M11.5 14.75L4 17.97V15.75L11.5 14.75M2 3L2 10L17 12L2 14L2 21L23 12L2 3Z",
          stop: "M18,18H6V6H18V18Z",
          check: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
          refresh:
            "M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",
          "alert-circle-outline":
            "M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z",
        };
        this.shadowRoot.innerHTML =
          '<style>:host{display:inline-flex;width:var(--mdc-icon-size,20px);height:var(--mdc-icon-size,20px);align-items:center;justify-content:center}</style><svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%" aria-hidden="true"><path d="' +
          (paths[this.getAttribute("icon")?.replace("mdi:", "")] ||
            paths.microphone) +
          '"></path></svg>';
      }
    },
  );
  customElements.define(
    "ha-checkbox",
    class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" }).innerHTML =
          `<style>:host{display:inline-flex;align-items:center}label{display:flex;align-items:center;gap:8px;min-height:40px}input{width:20px;height:20px;margin:0}</style><label><input type="checkbox"><slot></slot></label>`;
        this.shadowRoot
          .querySelector("input")
          .addEventListener("change", () =>
            this.dispatchEvent(new Event("change", { bubbles: true })),
          );
      }
      get checked() {
        return this.shadowRoot.querySelector("input").checked;
      }
      set checked(value) {
        this.shadowRoot.querySelector("input").checked = value;
      }
      set indeterminate(value) {
        this.shadowRoot.querySelector("input").indeterminate = value;
      }
      set disabled(value) {
        this.shadowRoot.querySelector("input").disabled = value;
      }
    },
  );
  customElements.define(
    "ha-check-list-item",
    class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" }).innerHTML =
          `<style>:host{display:block;cursor:pointer;font-size:var(--ha-font-size-m,14px);line-height:1.5}:host([disabled]){color:var(--disabled-text-color,#999);pointer-events:none}.base{display:flex;align-items:center;gap:16px;padding:12px 16px;min-height:48px;box-sizing:border-box}.content{flex:1;min-width:0}.headline,.supporting{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.supporting{font-size:var(--ha-font-size-s,12px);color:var(--secondary-text-color,#666)}.checkbox{pointer-events:none;flex-shrink:0}</style><div class="base"><ha-checkbox class="checkbox" inert></ha-checkbox><div class="content"><div class="headline"><slot></slot></div><div class="supporting"><slot name="secondary"></slot></div></div></div>`;
      }
      connectedCallback() {
        this.setAttribute("role", "option");
        this.tabIndex = -1;
      }
      set headline(value) {
        this.shadowRoot.querySelector(".headline").textContent = value;
      }
      set supportingText(value) {
        this.shadowRoot.querySelector(".supporting").textContent = value;
      }
      get selected() {
        return this.hasAttribute("selected");
      }
      set selected(value) {
        this.toggleAttribute("selected", value);
        this.setAttribute("aria-selected", String(!!value));
        this.shadowRoot.querySelector("ha-checkbox").checked = value;
      }
      get disabled() {
        return this.hasAttribute("disabled");
      }
      set disabled(value) {
        this.toggleAttribute("disabled", value);
        this.setAttribute("aria-disabled", String(!!value));
        this.shadowRoot.querySelector("ha-checkbox").disabled = value;
      }
    },
  );
  customElements.define(
    "ha-list",
    class extends HTMLElement {
      constructor() {
        super();
        this.addEventListener("click", (event) => {
          const row = event
            .composedPath()
            .find(
              (node) =>
                node instanceof HTMLElement &&
                node.localName === "ha-check-list-item",
            );
          if (!row || row.disabled) return;
          row.dispatchEvent(
            new CustomEvent("request-selected", {
              detail: { selected: !row.selected },
              bubbles: true,
            }),
          );
        });
        this.addEventListener("keydown", (event) => {
          const rows = [...this.children].filter((row) => !row.disabled);
          const current = rows.indexOf(
            document.activeElement === this
              ? null
              : this.getRootNode().activeElement,
          );
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            const index =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? rows.length - 1
                  : (current +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      rows.length) %
                    rows.length;
            rows[index]?.focus();
          } else if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            event.target.click();
          }
        });
      }
      connectedCallback() {
        this.style.display = "block";
        this.setAttribute("role", "listbox");
        this.setAttribute("aria-multiselectable", "true");
        queueMicrotask(() => {
          const row = [...this.children].find((row) => !row.disabled);
          if (row) row.tabIndex = 0;
        });
      }
    },
  );
  customElements.define(
    "ha-expansion-panel",
    class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" }).innerHTML =
          `<style>:host{display:block}button{width:100%;padding:16px;display:flex;gap:16px;font:inherit;background:transparent;border:1px solid #ddd;border-radius:12px;text-align:start;cursor:pointer}.content{padding:16px}.content[hidden]{display:none}</style><button aria-expanded="false"><slot name="leading-icon"></slot><slot name="header"></slot></button><div class="content" hidden><slot></slot></div>`;
        const button = this.shadowRoot.querySelector("button");
        button.onclick = () => {
          const expanded = button.getAttribute("aria-expanded") !== "true";
          button.setAttribute("aria-expanded", String(expanded));
          this.shadowRoot.querySelector(".content").hidden = !expanded;
        };
      }
    },
  );
  customElements.define("ha-form", class extends HTMLElement {});
}
