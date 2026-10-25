import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import vm from "node:vm";

test("single-file distribution registers both canonical custom elements", async () => {
  assert.deepEqual(
    (await readdir("../custom_components/homecall/frontend")).filter((name) =>
      name.endsWith(".js"),
    ),
    [
      "homecall-card.js",
      "homecall-recorder-worklet.js",
      "homecall-settings.js",
    ],
  );
  const names = [];
  const source = await readFile(
    "../custom_components/homecall/frontend/homecall-card.js",
    "utf8",
  );
  vm.runInNewContext(source, {
    HTMLElement: class {},
    customElements: {
      get: () => undefined,
      define: (name) => names.push(name),
    },
    window: { customCards: [] },
  });
  assert.deepEqual(names, ["homecall-card", "homecall-card-editor"]);
  const pkg = JSON.parse(
    await readFile("../custom_components/homecall/manifest.json", "utf8"),
  );
  const hacs = JSON.parse(await readFile("../hacs.json", "utf8"));
  assert.equal(hacs.filename, "homecall.zip");
  assert.ok(source.includes(pkg.version));
});

test("all local documentation links resolve", async () => {
  for (const dir of [".", "docs"])
    for (const name of await readdir(dir)) {
      if (!name.endsWith(".md")) continue;
      const source = await readFile(`${dir}/${name}`, "utf8");
      for (const match of source.matchAll(
        /\]\(([^)]+)\)|(?:src|href)="([^"]+)"/g,
      )) {
        const target = match[1] || match[2];
        if (!target.includes(":") && !target.startsWith("#"))
          await access(`${dir}/${target.split("#")[0]}`);
      }
    }
});

test("reloading the bundle preserves canonical elements and one card-picker entry", async () => {
  const elements = new Map();
  const window = { customCards: [] };
  const context = vm.createContext({
    HTMLElement: class {},
    customElements: {
      get: (name) => elements.get(name),
      define: (name, element) => {
        assert.equal(elements.has(name), false);
        elements.set(name, element);
      },
    },
    window,
  });
  const source = await readFile(
    "../custom_components/homecall/frontend/homecall-card.js",
    "utf8",
  );
  vm.runInContext(source, context);
  const original = elements.get("homecall-card");
  vm.runInContext(source, context);
  assert.equal(elements.get("homecall-card"), original);
  assert.equal(elements.size, 2);
  assert.equal(
    window.customCards.filter((card) => card.type === "homecall-card").length,
    1,
  );
});
