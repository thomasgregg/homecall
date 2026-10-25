const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const source =
  fs
    .readFileSync("src/layout.js", "utf8")
    .replaceAll("export function", "function") + "\nclass HomeCallCard {}";
const helper = source.slice(
  source.indexOf("function homeCallLayout("),
  source.indexOf("class HomeCallCard"),
);
const context = {};
vm.createContext(context);
vm.runInContext(helper, context);
let cases = 0;
for (const width of [
  150, 180, 200, 240, 267, 280, 320, 350, 390, 480, 720, 1200,
]) {
  for (const height of [184, 200, 220, 240, 248, 312, 376, 600, 900]) {
    for (const selector of [false, true]) {
      const x = context.homeCallLayout(width, height, selector);
      assert.ok(x.button >= 52 && x.button <= 240);
      assert.ok(
        x.button * 1.18 <= width - 2 * x.padding,
        `${width}x${height}: halo width`,
      );
      assert.ok(
        x.button * 1.18 <= height - 2 * x.padding,
        `${width}x${height}: halo height`,
      );
      if (selector)
        assert.ok(
          x.button / 2 + 2 <=
            Math.hypot(
              Math.max(0, width / 2 - x.padding - 100),
              Math.max(
                0,
                height / 2 - x.selectorTop - (x.compact ? 44 : 32) - 1,
              ),
            ),
          `${width}x${height}: selector corner clearance`,
        );
      for (const [controlWidth, bottom] of [
        [x.controlWidths.discard, width < 200 ? 32 : 44],
        [x.controlWidths.time, width < 200 ? 24 : 32],
      ])
        assert.ok(
          x.button * 0.59 + 8 <=
            Math.hypot(
              Math.max(0, width / 2 - x.footerPadding - 1 - controlWidth),
              Math.max(0, height - x.centerY - x.footerBottom - 1 - bottom),
            ),
          `${width}x${height}: outer ring clears footer hover area`,
        );
      if (x.showLabel)
        assert.ok(
          x.centerY + x.button * 0.59 + (x.compact ? 8 : 12) <=
            height - x.footerBottom - 1 - (x.compact ? 32 : 38),
          `${width}x${height}: halo clears centered footer caption`,
        );
      assert.ok(
        x.centerY - x.button * 0.59 >= x.padding,
        `${width}x${height}: halo clears top`,
      );
      assert.ok(
        x.centerY + x.button * 0.59 <= height - x.padding,
        `${width}x${height}: halo clears bottom`,
      );
      if (selector || !x.showLabel)
        assert.equal(
          x.centerY,
          height / 2,
          "Visible-selector and icon-only layouts stay centered",
        );
      else {
        assert.ok(
          x.centerY <= height / 2,
          "Hidden-selector action only moves upward",
        );
        assert.ok(
          x.centerY - x.visualHeight / 2 >= x.padding,
          `${width}x${height}: waveform clears top`,
        );
      }
      cases++;
    }
  }
}
assert.ok(
  context.homeCallLayout(184, 184, true).button >= 74,
  "Smallest card must offer a substantial action",
);
assert.ok(
  context.homeCallLayout(184, 184, false).button >=
    context.homeCallLayout(184, 184, true).button,
  "Hiding the selector must not shrink the action",
);
for (const selectorWidth of [50, 78, 100, 140]) {
  const x = context.homeCallLayout(246, 184, true, selectorWidth);
  assert.ok(
    x.button / 2 + 2 <=
      Math.hypot(
        Math.max(0, 123 - x.padding - selectorWidth),
        92 - x.selectorTop - 45,
      ),
    "Selector text and circle must stay clear",
  );
}
assert.ok(
  context.homeCallLayout(246, 184, true, 78).button >= 100,
  "A wider small card uses free space beside the selector",
);
assert.ok(
  context.homeCallLayout(376, 248, true, 72).button >= 100,
  "Normal cards must not shrink the action to a tiny 67px button",
);
assert.ok(
  context.homeCallLayout(376, 312, true, 72).button >= 155,
  "Default-size cards use the available height",
);
for (const [width, height] of [
  [150, 184],
  [184, 184],
  [246, 184],
  [278, 248],
  [376, 248],
  [376, 312],
  [720, 376],
]) {
  for (const selector of [false, true])
    for (const discard of [44, 90, 120, 140])
      for (const time of [57, 67, 77]) {
        const x = context.homeCallLayout(width, height, selector, 44, {
          discard,
          time,
        });
        for (const [w, bottom] of [
          [x.controlWidths.discard, width < 200 ? 32 : 44],
          [x.controlWidths.time, width < 200 ? 24 : 32],
        ])
          assert.ok(
            x.button * 0.59 + 8 <=
              Math.hypot(
                Math.max(0, width / 2 - x.footerPadding - 1 - w),
                Math.max(0, height - x.centerY - x.footerBottom - 1 - bottom),
              ),
            `${width}x${height}: measured footer clearance`,
          );
      }
}
const compact = context.homeCallLayout(246, 184, false, 0, {
  discard: 44,
  time: 67,
  borderX: 1,
  borderY: 1,
});
assert.equal(
  compact.centerY,
  92,
  "Icon-only card has equal top and bottom ring gaps",
);
assert.ok(
  compact.button >= 100,
  "Centred compact action remains substantial with balanced footer insets",
);
console.log("Compact centred layout:", JSON.stringify(compact));
const visible = context.homeCallLayout(500, 312, true, 100, {
  discard: 102,
  time: 67,
  borderX: 1,
  borderY: 1,
});
const hidden = context.homeCallLayout(500, 312, false, 0, {
  discard: 102,
  time: 67,
  borderX: 1,
  borderY: 1,
});
assert.equal(visible.button, 163);
assert.equal(
  hidden.button,
  196,
  "Reclaim the measured free space above the action",
);
assert.ok(hidden.centerY < visible.centerY);
assert.ok(
  hidden.centerY + hidden.button * 0.59 + 12 <= 265,
  "Caption retains its gap",
);
assert.equal(hidden.footerPadding, 20, "Preserve horizontal footer alignment");
assert.equal(
  hidden.footerBottom,
  8,
  "Reclaim only extra vertical footer padding",
);
assert.ok(
  Math.abs(
    hidden.centerY - hidden.button * 0.59 - (hidden.footerBottom + 1 + 14),
  ) <= 3,
  "Single-line caption and halo have balanced top and bottom insets",
);
console.log("Measured-card layout:", JSON.stringify({ visible, hidden }));
console.log(
  `Passed ${cases} size/configuration combinations, including minimum 184px height.`,
);

const iconOnly = context.homeCallLayout(246, 184, false, 0, {
  discard: 44,
  time: 67,
  borderX: 1,
  borderY: 1,
});
assert.equal(iconOnly.showLabel, false);
assert.ok(
  iconOnly.button >= 100,
  "Hidden-selector icon remains large and centered",
);
assert.equal(
  iconOnly.centerY,
  92,
  "Hidden caption must not shift the microphone upward",
);

const live = context.homeCallLayout(215.25, 184, false, 0, {
  discard: 46,
  time: 67,
  borderX: 1,
  borderY: 1,
});
assert.ok(live.button >= 96);
assert.equal(live.centerY, 92);
console.log("Live compact sizing:", JSON.stringify(live));

assert.equal(
  live.footerPadding,
  8,
  "Compact footer must stay inset from the card edge",
);

// Two-row cards must not shrink as they cross the narrow-control breakpoint.
for (const selector of [false, true]) {
  let previous = 0;
  for (let width = 150; width <= 210; width += 0.5) {
    const x = context.homeCallLayout(width, 120, selector, 32, {
      discard: 46,
      time: width < 200 ? 51 : 64,
      regularTime: 64,
      borderX: 1,
      borderY: 1,
    });
    assert.ok(
      x.button >= previous,
      `${width}x120: widening must not shrink the circle`,
    );
    assert.ok(
      x.button - previous <= 1 || previous === 0,
      `${width}x120: no sizing jump`,
    );
    assert.equal(x.padding, 8);
    assert.equal(x.centerY, 60);
    if (!selector && width >= 172)
      assert.ok(x.button >= 60, `${width}x120: usable action`);
    previous = x.button;
  }
}
