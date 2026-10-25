import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const script = await readFile(
  new URL(
    "../../../custom_components/homecall/frontend/homecall-card.js",
    import.meta.url,
  ),
  "utf8",
);

test("bundled resource loads as a module and survives repeated resource URLs", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://homecall.test/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      contentType: path === "/" ? "text/html" : "text/javascript",
      body:
        path === "/" ? "<!doctype html><title>HomeCall bundle</title>" : script,
    });
  });
  await page.goto("https://homecall.test/");
  const state = await page.evaluate(async () => {
    await import("/homecall-assets/homecall-card.js?v=first");
    const original = customElements.get("homecall-card");
    await import("/homecall-assets/homecall-card.js?v=first");
    await import("/homecall-assets/homecall-card.js?v=next");
    return {
      sameElement: original === customElements.get("homecall-card"),
      editor: Boolean(customElements.get("homecall-card-editor")),
      pickerEntries: window.customCards.filter(
        (card) => card.type === "homecall-card",
      ).length,
    };
  });
  expect(state).toEqual({ sameElement: true, editor: true, pickerEntries: 1 });
  expect(errors).toEqual([]);
});
