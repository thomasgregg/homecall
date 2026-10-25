const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const source =
  fs
    .readFileSync("src/layout.js", "utf8")
    .replaceAll("export function", "function") + "\nclass HomeCallCard {}";
const context = {};
vm.createContext(context);
vm.runInContext(
  source.slice(
    source.indexOf("function homeCallRecipientBounds("),
    source.indexOf("class HomeCallCard"),
  ),
  context,
);
let checks = 0;
for (const width of [150, 184, 267, 376, 550, 900])
  for (const height of [184, 248, 312, 500])
    for (const offset of [0, 50, 300]) {
      const card = {
        left: 16,
        right: 16 + width,
        top: offset,
        bottom: offset + height,
      };
      const anchor = { bottom: offset + 64 };
      const viewport = { width: width + 32, height: 844 };
      const x = context.homeCallRecipientBounds(
        card,
        anchor,
        viewport,
        width < 280 ? 8 : 16,
      );
      assert.ok(x);
      assert.ok(x.left >= card.left && x.top >= card.top);
      assert.ok(
        x.left + x.width <= card.right && x.top + x.maxHeight <= card.bottom,
      );
      assert.ok(
        x.left + x.width <= viewport.width &&
          x.top + x.maxHeight <= viewport.height,
      );
      assert.ok(x.maxHeight >= 44);
      checks++;
    }
assert.equal(
  context.homeCallRecipientBounds(
    { left: 16, right: 300, top: 800, bottom: 1112 },
    { bottom: 864 },
    { width: 390, height: 844 },
  ),
  null,
);
console.log(
  `Passed ${checks} selector containment cases; insufficient visible space closes safely.`,
);
