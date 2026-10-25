import { build } from "esbuild";
import { readFile } from "node:fs/promises";
const { version } = JSON.parse(
  await readFile(
    new URL("../../custom_components/homecall/manifest.json", import.meta.url),
  ),
);
await build({
  entryPoints: ["src/homecall-card.js"],
  outfile: "../custom_components/homecall/frontend/homecall-card.js",
  bundle: true,
  define: { __HOMECALL_CARD_VERSION__: JSON.stringify(version) },
  format: "iife",
  target: "es2022",
  minify: false,
  banner: {
    js: `/*! HomeCall Card v${version} | MIT License | github.com/thomasgregg/homecall */`,
  },
});
