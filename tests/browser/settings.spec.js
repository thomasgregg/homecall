import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const script = await readFile(
  new URL(
    "../../custom_components/homecall/frontend/homecall-settings.js",
    import.meta.url,
  ),
  "utf8",
);
async function fixture(page) {
  await page.setContent(
    "<style>body{font:16px Arial;background:#f5f5f5;--primary-text-color:#222;--secondary-text-color:#666;--divider-color:#ddd;--secondary-background-color:#f4f4f4}ha-card{display:block;background:white;border:1px solid #ddd;border-radius:16px}ha-list-item-button{display:flex;padding:20px;gap:14px;cursor:pointer}ha-button{display:inline-block;padding:12px;background:#009ac0;color:white;border-radius:10px;cursor:pointer}ha-button[disabled]{pointer-events:none;opacity:.5}ha-icon{width:24px}ha-list-item-base{display:block;padding:20px}</style><main></main>",
  );
  await page.evaluate(() => {
    customElements.define("hass-subpage", class extends HTMLElement {});
    customElements.define(
      "ha-checkbox",
      class extends HTMLElement {
        get checked() {
          return this.hasAttribute("checked");
        }
        set checked(v) {
          this.toggleAttribute("checked", v);
        }
      },
    );
    customElements.define(
      "ha-form",
      class extends HTMLElement {
        set schema(v) {
          this._schema = v;
          this.innerHTML =
            v[0]?.name === "speaker"
              ? '<label>Choose a speaker<select><option value="">Choose a speaker</option><option value="media_player.jbl">JBL Charge 5 Wi-Fi</option></select></label>'
              : "";
          this.querySelector("select")?.addEventListener("change", (e) => {
            this.data = { speaker: e.target.value };
            this.dispatchEvent(
              new CustomEvent("value-changed", { bubbles: true }),
            );
          });
        }
        get schema() {
          return this._schema;
        }
        reportValidity() {
          return !!this.data.speaker;
        }
      },
    );
  });
  await page.addScriptTag({ content: script });
  await page.evaluate(() => {
    window.calls = [];
    window.failTest = false;
    const candidate = {
      entity_id: "media_player.jbl",
      name: "JBL Charge 5 Wi-Fi",
      available: true,
      transport: "dlna",
    };
    window.settings = {
      public_url: "https://ha.example.com",
      use_system_url: true,
      use_all: true,
      default_targets: [],
      tested_dlna: [],
      resume_dlna: [],
      local_url: "",
      targets: [
        { entity_id: "notify.kitchen_speak", name: "Kitchen", available: true },
      ],
      dlna_candidates: [candidate],
    };
    const el = document.createElement("homecall-settings");
    el.hass = {
      language: "en",
      callApi: async (method, path, data) => {
        window.calls.push({ method, path, data });
        if (method === "GET") return structuredClone(window.settings);
        if (data.action === "test") {
          if (window.failTest) throw { body: { error: "test_failed" } };
          return { receipt: "receipt" };
        }
        if (data.action === "confirm") {
          window.settings.tested_dlna = [candidate.entity_id];
          window.settings.default_targets = [candidate.entity_id];
          window.settings.targets.push(candidate);
          return structuredClone(window.settings);
        }
        if (data.action === "resume") {
          window.settings.resume_dlna = data.enabled
            ? [candidate.entity_id]
            : [];
          return structuredClone(window.settings);
        }
        if (data.action === "remove") {
          window.settings.tested_dlna = [];
          window.settings.default_targets = [];
          return structuredClone(window.settings);
        }
        Object.assign(window.settings, data);
        return structuredClone(window.settings);
      },
    };
    document.querySelector("main").append(el);
  });
  await expect(page.getByText("Alexa speakers", { exact: true })).toBeVisible();
}
test("two groups and DLNA test confirmation before adding", async ({
  page,
}) => {
  await fixture(page);
  await expect(page.getByText("DLNA speakers", { exact: true })).toBeVisible();
  await page.locator('[data-page="dlna"]').click();
  await page.locator(".add-speaker").click();
  await page.getByRole("combobox").selectOption("media_player.jbl");
  await page.locator(".test-sound").click();
  await expect(
    page.getByText("Did you hear the sound?", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.settings.tested_dlna)).toEqual([]);
  await page.locator(".confirm-test").click();
  await expect(
    page.locator('[data-visible="media_player.jbl"]'),
  ).toHaveAttribute("checked", "");
  expect(await page.evaluate(() => window.settings.tested_dlna)).toEqual([
    "media_player.jbl",
  ]);
  await page.locator("[data-remove]").click();
  await expect(page.locator("[data-visible]")).toHaveCount(0);
});
test("failed test does not offer confirmation or enable speaker", async ({
  page,
}) => {
  await fixture(page);
  await page.evaluate(() => (window.failTest = true));
  await page.locator('[data-page="dlna"]').click();
  await page.locator(".add-speaker").click();
  await page.getByRole("combobox").selectOption("media_player.jbl");
  await page.locator(".test-sound").click();
  await expect(
    page.getByText(
      "The speaker could not start playback. Check its connection and try again.",
    ),
  ).toBeVisible();
  await expect(page.locator(".confirm-test")).toHaveCount(0);
  expect(await page.evaluate(() => window.settings.tested_dlna)).toEqual([]);
});
test("Alexa selection retains DLNA visibility", async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => {
    const el = document.querySelector("homecall-settings");
    el._data.default_targets = ["media_player.jbl"];
    el._open("devices");
    const form = el.shadowRoot.querySelector("ha-form");
    form.data = { mode: "custom", targets: ["notify.kitchen_speak"] };
    el._capture();
  });
  expect(
    await page
      .locator("homecall-settings")
      .evaluate((el) => el._draft.default_targets),
  ).toEqual(["notify.kitchen_speak", "media_player.jbl"]);
});

test("resume music is off by default and can be toggled per speaker", async ({
  page,
}) => {
  await fixture(page);
  await page.locator("[data-page=dlna]").click();
  await page.locator(".add-speaker").click();
  await page.getByRole("combobox").selectOption("media_player.jbl");
  await page.locator(".test-sound").click();
  await page.locator(".confirm-test").click();
  const checkbox = page.locator("[data-resume]");
  await expect(checkbox).not.toHaveAttribute("checked", "");
  await checkbox.evaluate((el) => {
    el.checked = true;
    el.dispatchEvent(new Event("change"));
  });
  await expect(checkbox).toHaveAttribute("checked", "");
  expect(await page.evaluate(() => window.settings.resume_dlna)).toEqual([
    "media_player.jbl",
  ]);
  await checkbox.evaluate((el) => {
    el.checked = false;
    el.dispatchEvent(new Event("change"));
  });
  await expect(checkbox).not.toHaveAttribute("checked", "");
});
