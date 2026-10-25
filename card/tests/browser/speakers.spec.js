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
const targets = [
  {
    entity_id: "media_player.jbl_dlna",
    name: "JBL Charge 5 Wi-Fi",
    transport: "dlna",
    available: false,
  },
  {
    entity_id: "media_player.jbl_ma",
    name: "JBL Charge 5 Wi-Fi",
    transport: "music_assistant",
    available: true,
  },
  {
    entity_id: "notify.living_room_echo_show_speak",
    name: "Living Room Echo Show",
    available: true,
  },
  {
    entity_id: "media_player.long",
    name: "A very long speaker name that must not push status or controls outside the phone screen",
    transport: "cast",
    available: true,
  },
];
async function setup(page, language = "en", editor = false) {
  await page.setContent(
    `<style>body{margin:8px;font:14px Arial;--ha-font-size-m:14px;--ha-font-size-s:12px;--ha-space-3:12px;--ha-space-4:16px;--primary-color:#009ac0;--primary-text-color:#222;--secondary-text-color:#666;--ha-card-background:white;--divider-color:#ddd;--ha-line-height-normal:1.5}homecall-card{display:block;width:200px;height:120px}homecall-card-editor{display:block;max-width:400px}</style><main></main>`,
  );
  await page.evaluate(registerHomeAssistantFixtures);
  await page.addScriptTag({ content: script });
  await page.evaluate(
    ({ targets, language, editor }) => {
      const element = document.createElement(
        editor ? "homecall-card-editor" : "homecall-card",
      );
      const states = Object.fromEntries(
        targets.map((target) => [
          target.entity_id,
          { state: target.available ? "idle" : "unavailable" },
        ]),
      );
      window.speakerConfigChanges = [];
      element.addEventListener("config-changed", (event) =>
        window.speakerConfigChanges.push(event.detail.config),
      );
      element.setConfig({
        type: "custom:homecall-card",
        default_targets: targets.map((target) => target.entity_id),
        show_diagnostics: true,
        unrelated_option: "preserve",
        grid_options: { columns: 6, rows: 2 },
      });
      element._warmRecorder = () => {};
      element.hass = {
        locale: { language },
        states,
        fetchWithAuth: async () => ({
          ok: true,
          json: async () => ({ targets, default_targets: [] }),
        }),
      };
      document.querySelector("main").append(element);
    },
    { targets, language, editor },
  );
  await expect(page.locator("ha-check-list-item")).toHaveCount(4);
  if (editor)
    await page
      .getByRole("button", {
        name: language === "de" ? "Standard-Empfänger" : "Default recipients",
        exact: true,
      })
      .click();
  else await page.locator("homecall-card summary").click();
  await expect(page.locator("ha-list")).toBeVisible();
}
for (const width of [320, 360, 414])
  for (const editor of [false, true]) {
    test(`native speaker ${editor ? "defaults" : "picker"} fits ${width}px phones in both languages`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 740 });
      for (const language of ["en", "de"]) {
        // Each language gets a fresh document, like a dashboard reload.
        await page.goto("about:blank");
        await setup(page, language, editor);
        if (!editor) {
          await expect(page.locator("homecall-card .status")).toContainText(
            language === "de"
              ? "Diese Lautsprecher werden übersprungen:"
              : "These speakers will be skipped:",
          );
          await expect(page.locator("homecall-card .status")).not.toContainText(
            language === "de" ? "Tippe auf das Mikrofon" : "Tap the microphone",
          );
        }
        if (editor) {
          const fields = await page
            .locator("homecall-card-editor .appearance ha-form")
            .evaluate((form) => form.schema.map((field) => field.name));
          expect(fields).toEqual(["show_speaker_selection"]);
          await expect(
            page.getByText("These recipients are selected by default.", {
              exact: true,
            }),
          ).toHaveCount(0);
          await expect(
            page.getByText("Diese Empfänger sind standardmäßig ausgewählt.", {
              exact: true,
            }),
          ).toHaveCount(0);
        }
        const rows = page.locator("ha-check-list-item");
        await expect(rows.nth(0)).toContainText(
          language === "de" ? "DLNA · Nicht verfügbar" : "DLNA · Unavailable",
        );
        await expect(rows.nth(1)).toContainText(
          language === "de"
            ? "Music Assistant · Verfügbar"
            : "Music Assistant · Available",
        );
        await expect(rows.nth(2)).toContainText(
          language === "de" ? "Alexa · Verfügbar" : "Alexa · Available",
        );
        const dimensions = await rows.evaluateAll((rows) =>
          rows.map((row) => {
            const rect = row.getBoundingClientRect(),
              secondary = row.shadowRoot.querySelector(".supporting");
            return {
              left: rect.left,
              right: rect.right,
              textFits: secondary.scrollWidth <= secondary.clientWidth + 1,
            };
          }),
        );
        for (const row of dimensions) {
          expect(row.left).toBeGreaterThanOrEqual(0);
          expect(row.right).toBeLessThanOrEqual(width);
          expect(row.textFits).toBe(true);
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await expect(rows.nth(3)).toHaveAttribute(
          "title",
          /A very long speaker name/,
        );
      }
    });
  }
test("picker excludes unavailable routes, toggles the chosen duplicate and selects only available speakers", async ({
  page,
}) => {
  await setup(page);
  const rows = page.locator("ha-check-list-item");
  await expect(rows.nth(0)).toHaveAttribute("aria-disabled", "true");
  await expect(rows.nth(0)).toHaveAttribute("aria-selected", "false");
  await rows.nth(1).click();
  await expect(rows.nth(1)).toHaveAttribute("aria-selected", "false");
  await expect(rows.nth(2)).toHaveAttribute("aria-selected", "true");
  await page.getByRole("checkbox", { name: "Select all" }).check();
  await expect(page.locator("homecall-card .status-more")).toBeHidden();
  await expect(rows.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(rows.nth(0)).toHaveAttribute("aria-selected", "false");
  await page.getByRole("checkbox", { name: "Select all" }).uncheck();
  await expect(page.locator("homecall-card .main")).toHaveAttribute(
    "disabled",
    "",
  );
});
test("defaults retain unavailable and missing routes, preserve other options and remember custom selection", async ({
  page,
}) => {
  await setup(page, "en", true);
  await page.locator("homecall-card-editor").evaluate((editor) =>
    editor.setConfig({
      ...editor._config,
      default_targets: [
        ...editor._config.default_targets,
        "media_player.missing",
      ],
    }),
  );
  const rows = page.locator("ha-check-list-item");
  await expect(rows.nth(0)).toHaveAttribute("aria-disabled", "false");
  await expect(rows.nth(0)).toHaveAttribute("aria-selected", "true");
  await rows.nth(1).click();
  const config = await page.evaluate(() => window.speakerConfigChanges.at(-1));
  expect(config.default_targets).toContain("media_player.jbl_dlna");
  expect(config.default_targets).toContain("media_player.missing");
  expect(config.default_targets).not.toContain("media_player.jbl_ma");
  expect(config).toMatchObject({
    show_diagnostics: true,
    unrelated_option: "preserve",
    grid_options: { columns: 6, rows: 2 },
  });
  await page
    .locator("homecall-card-editor .recipients ha-form")
    .evaluate((form) =>
      form.dispatchEvent(
        new CustomEvent("value-changed", {
          detail: { value: { mode: "all" } },
        }),
      ),
    );
  await expect(page.locator(".speakers")).toBeHidden();
  await page
    .locator("homecall-card-editor .recipients ha-form")
    .evaluate((form) =>
      form.dispatchEvent(
        new CustomEvent("value-changed", {
          detail: { value: { mode: "custom" } },
        }),
      ),
    );
  expect(
    (await page.evaluate(() => window.speakerConfigChanges.at(-1)))
      .default_targets,
  ).toEqual(config.default_targets);
});
test("availability updates rows in place without selecting recovered routes", async ({
  page,
}) => {
  await setup(page);
  const row = page.locator("ha-check-list-item").nth(1);
  await row.evaluate((row) => {
    window.originalSpeakerRow = row;
    row.focus();
  });
  await page.locator("homecall-card").evaluate((card) => {
    card.hass = {
      ...card._hass,
      states: {
        ...card._hass.states,
        "media_player.jbl_ma": { state: "unavailable" },
        "media_player.jbl_dlna": { state: "idle" },
      },
    };
  });
  await expect(row).toContainText("Music Assistant · Unavailable");
  await expect(row).toHaveAttribute("aria-selected", "false");
  await expect(page.locator("ha-check-list-item").nth(0)).toHaveAttribute(
    "aria-disabled",
    "false",
  );
  await expect(page.locator("ha-check-list-item").nth(0)).toHaveAttribute(
    "aria-selected",
    "false",
  );
  await expect(page.locator("homecall-card .status-more")).toBeVisible();
  await expect(page.locator("homecall-card .status")).toContainText(
    "Music Assistant",
  );
  await row.evaluate((row) => row.scrollIntoView());
  await page.locator("homecall-card").evaluate((card) => {
    card.hass = {
      ...card._hass,
      states: {
        ...card._hass.states,
        "media_player.jbl_ma": { state: "idle" },
      },
    };
  });
  await expect(row).toHaveAttribute("aria-selected", "false");
  await row.click();
  await expect(row).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("homecall-card .status-more")).toBeVisible();
  await expect(page.locator("homecall-card .status")).not.toContainText(
    "Music Assistant",
  );
  // The originally unavailable DLNA route remains skipped until explicitly selected.
  await page.locator("ha-check-list-item").nth(0).click();
  await expect(page.locator("homecall-card .status-more")).toBeHidden();
  expect(await row.evaluate((row) => row === window.originalSpeakerRow)).toBe(
    true,
  );
});
test("native list selection supports keyboard activation", async ({ page }) => {
  await setup(page);
  const row = page.locator("ha-check-list-item").nth(1);
  await row.press("Space");
  await expect(row).toHaveAttribute("aria-selected", "false");
  await row.press("Enter");
  await expect(row).toHaveAttribute("aria-selected", "true");
});
