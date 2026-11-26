import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const KIOSK = "assist_satellite.kitchen_kiosk";
const PLAYER = "media_player.kitchen_kiosk_media_player";
const elements = new Map();
const bundle = await readFile(
  new URL(
    "../../custom_components/homecall/frontend/homecall-card.js",
    import.meta.url,
  ),
  "utf8",
);
vm.runInNewContext(bundle, {
  HTMLElement: class {
    attachShadow() {}
  },
  customElements: {
    get: (name) => elements.get(name),
    define: (name, element) => elements.set(name, element),
  },
  window: { customCards: [] },
});

function readyCard() {
  const Card = elements.get("homecall-card");
  const card = new Card();
  card._lang = "en";
  card._phase = "ready";
  card._view = { querySelector: () => ({}) };
  card._targets = [
    {
      entity_id: KIOSK,
      player: PLAYER,
      transport: "voice_satellite",
      available: true,
    },
  ];
  card._selection = [KIOSK];
  card._updateSelection = () => {};
  return card;
}

function updateStates(card, satelliteState, playerState) {
  card.hass = {
    locale: { language: "en" },
    states: {
      ...(satelliteState && { [KIOSK]: { state: satelliteState } }),
      ...(playerState && { [PLAYER]: { state: playerState } }),
    },
  };
}

for (const [satellite, player] of [
  ["idle", "unavailable"],
  ["idle", "unknown"],
  ["unknown", "idle"],
  ["unavailable", "idle"],
  ["idle", undefined],
  [undefined, "idle"],
]) {
  test(`card stops offering a kiosk when satellite is ${satellite} and player is ${player}`, () => {
    const card = readyCard();
    updateStates(card, satellite, player);

    assert.equal(card._targets[0].available, false);
    assert.equal(card._selection.includes(KIOSK), false);

    updateStates(card, "idle", "idle");
    assert.equal(card._targets[0].available, true);
  });
}
