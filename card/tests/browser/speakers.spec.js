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
async function setup(
  page,
  language = "en",
  editor = false,
  speakerTargets = targets,
  legacyList = false,
) {
  await page.setContent(
    `<style>body{margin:8px;font:14px Arial;--ha-font-size-m:14px;--ha-font-size-s:12px;--ha-space-3:12px;--ha-space-4:16px;--primary-color:#009ac0;--primary-text-color:#222;--secondary-text-color:#666;--ha-card-background:white;--divider-color:#ddd;--ha-line-height-normal:1.5}homecall-card{display:block;width:200px;height:120px}homecall-card-editor{display:block;max-width:400px}</style><main></main>`,
  );
  await page.evaluate(registerHomeAssistantFixtures, legacyList);
  await page.addScriptTag({ content: script });
  await page.evaluate(
    ({ targets, language, editor }) => {
      const element = document.createElement(
        editor ? "homecall-card-editor" : "homecall-card",
      );
      const states = {};
      for (const target of targets) {
        const state = { state: target.available ? "idle" : "unavailable" };
        states[target.entity_id] = state;
        if (target.player) states[target.player] = state;
      }
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
    { targets: speakerTargets, language, editor },
  );
  const rows = legacyList ? "ha-check-list-item" : "ha-list-item-option";
  await expect(page.locator(rows)).toHaveCount(speakerTargets.length);
  if (editor)
    await page
      .getByRole("button", {
        name: language === "de" ? "Standard-Empfänger" : "Default recipients",
        exact: true,
      })
      .click();
  else await page.locator("homecall-card summary").click();
  await expect(
    page.locator(legacyList ? "ha-list" : "ha-list-selectable"),
  ).toBeVisible();
}

for (const editor of [false, true]) {
  test(`speaker ${editor ? "editor" : "picker"} shows rooms and IDs for ambiguous names`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    const speakers = [
      { entity_id: "media_player.kitchen", area_name: "Kitchen" },
      {
        entity_id: "media_player.window",
        area_name: "Living room",
        show_entity_id: true,
      },
      {
        entity_id: "media_player.door",
        area_name: "Living room",
        show_entity_id: true,
        available: false,
      },
    ].map((target) => ({
      name: "Sonos",
      transport: "sonos",
      available: true,
      ...target,
    }));
    await setup(page, "en", editor, speakers);
    const rows = page.locator("ha-list-item-option");
    await expect(rows.nth(0).locator('[slot="supporting-text"]')).toHaveText(
      "Kitchen · Available",
    );
    await expect(rows.nth(1).locator('[slot="supporting-text"]')).toHaveText(
      "Living room · media_player.window · Available",
    );
    await expect(rows.nth(2).locator('[slot="supporting-text"]')).toHaveText(
      "Living room · media_player.door · Unavailable",
    );
    await expect(rows.nth(2)).toHaveAttribute(
      "title",
      "Sonos · Living room · media_player.door · Unavailable",
    );
  });
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
        const rows = page.locator("ha-list-item-option");
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
  const rows = page.locator("ha-list-item-option");
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
  const rows = page.locator("ha-list-item-option");
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
  const row = page.locator("ha-list-item-option").nth(1);
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
  await expect(page.locator("ha-list-item-option").nth(0)).toHaveAttribute(
    "aria-disabled",
    "false",
  );
  await expect(page.locator("ha-list-item-option").nth(0)).toHaveAttribute(
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
  await page.locator("ha-list-item-option").nth(0).click();
  await expect(page.locator("homecall-card .status-more")).toBeHidden();
  expect(await row.evaluate((row) => row === window.originalSpeakerRow)).toBe(
    true,
  );
});
test("native list selection supports keyboard activation", async ({ page }) => {
  await setup(page);
  const row = page.locator("ha-list-item-option").nth(1);
  await row.press("Space");
  await expect(row).toHaveAttribute("aria-selected", "false");
  await row.press("Enter");
  await expect(row).toHaveAttribute("aria-selected", "true");
});

test("older Home Assistant can still select a speaker with its native list", async ({
  page,
}) => {
  await setup(page, "en", false, targets, true);
  const row = page.locator("ha-check-list-item").nth(1);
  await expect(row).toHaveAttribute("aria-selected", "true");
  await row.press("Space");
  await expect(row).toHaveAttribute("aria-selected", "false");
});

const kiosk = {
  entity_id: "assist_satellite.kitchen_kiosk",
  player: "media_player.kitchen_kiosk",
  name: "Kitchen Kiosk",
  area_name: "Kitchen",
  transport: "voice_satellite",
  available: true,
};

test("Voice Satellite kiosks show their route", async ({ page }) => {
  await setup(page, "en", false, [kiosk]);
  await expect(
    page
      .locator("ha-list-item-option")
      .first()
      .locator('[slot="supporting-text"]'),
  ).toHaveText("Kitchen · Voice Satellite · Available");
});

test("the card reloads when an offline Voice Satellite kiosk comes online", async ({
  page,
}) => {
  await page.setContent("<main></main>");
  await page.evaluate(registerHomeAssistantFixtures);
  await page.addScriptTag({ content: script });
  await page.evaluate((kiosk) => {
    window.statusRequests = 0;
    window.kioskAvailable = false;
    const element = document.createElement("homecall-card");
    element.setConfig({ type: "custom:homecall-card" });
    element._warmRecorder = () => {};
    const hass = (playerState) => ({
      locale: { language: "en" },
      states: {
        [kiosk.entity_id]: { state: "idle" },
        [kiosk.player]: { state: playerState },
      },
      fetchWithAuth: async () => {
        window.statusRequests += 1;
        return {
          ok: true,
          json: async () => ({
            targets: [{ ...kiosk, available: window.kioskAvailable }],
            default_targets: [],
          }),
        };
      },
    });
    window.setKioskState = (state) => {
      window.kioskAvailable = state !== "unavailable";
      element.hass = hass(state);
    };
    element.hass = hass("unavailable");
    document.querySelector("main").append(element);
  }, kiosk);
  await expect(page.locator("homecall-card")).toContainText(
    "No speaker is available right now.",
  );
  const before = await page.evaluate(() => window.statusRequests);
  await page.evaluate(() => window.setKioskState("idle"));
  await expect
    .poll(() => page.evaluate(() => window.statusRequests))
    .toBeGreaterThan(before);
  await expect(page.locator("ha-list-item-option")).toHaveCount(1);
});
