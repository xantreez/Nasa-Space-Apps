// Standalone build of /game (only the game — nothing else from eduspace) for static hosting (Netlify).
//
//   node moon/web/build.mjs            → moon/web/dist  (deploy this folder)
//
// pages/game.vue is the single source: this script copies it into a throwaway app dir next to pages/
// (so its relative import.meta.glob paths keep working), strips the Nuxt-only bits (definePageMeta/useHead),
// adds explicit Vue imports, builds with Vite and copies public/moon/* (images, intro video, audio).
import { build } from "vite";
import vue from "@vitejs/plugin-vue";
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const GEN = resolve(ROOT, ".moon-web"); // sibling of pages/ → "../components/Moon/..." resolves the same
const OUT = resolve(ROOT, "moon/web/dist");

rmSync(GEN, { recursive: true, force: true });
mkdirSync(GEN, { recursive: true });

// 1) pages/game.vue → App.vue without Nuxt macros
let page = readFileSync(resolve(ROOT, "pages/game.vue"), "utf8");
page = page.replace(/definePageMeta\(\{[\s\S]*?\}\);\s*/, "");
page = page.replace(/useHead\(\{[\s\S]*?\n\}\);\s*/, "");
page = page.replace(
  /<script setup lang="ts">/,
  `<script setup lang="ts">\nimport { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, defineAsyncComponent, nextTick } from "vue";`
);
if (/definePageMeta|useHead|useRoute|navigateTo|useNuxtApp/.test(page)) throw new Error("game.vue uses Nuxt APIs the standalone build does not provide");
writeFileSync(resolve(GEN, "App.vue"), page);

writeFileSync(
  resolve(GEN, "main.ts"),
  `import { createApp } from "vue";\nimport App from "./App.vue";\ncreateApp(App).mount("#app");\n`
);

const SITE = process.env.SITE_URL || "https://tobish.netlify.app";
const title = "Junior Astronaut · Moon Outpost";
const desc =
  "Tobish crashed on the Moon. Be his commander and keep him alive with real NASA science — a free space-survival game for kids 7–12 built on NASA DONKI, MSL RAD, OSDR and Moon Trek data.";
const head = [
  `<title>${title}</title>`,
  `<meta name="description" content="${desc}" />`,
  `<link rel="canonical" href="${SITE}/" />`,
  `<meta property="og:type" content="website" />`,
  `<meta property="og:site_name" content="Junior Astronaut" />`,
  `<meta property="og:url" content="${SITE}/" />`,
  `<meta property="og:title" content="${title}" />`,
  `<meta property="og:description" content="${desc}" />`,
  `<meta property="og:image" content="${SITE}/moon/og.jpg" />`,
  `<meta property="og:image:width" content="1200" />`,
  `<meta property="og:image:height" content="630" />`,
  `<meta property="og:image:alt" content="Junior Astronaut: Tobish the astronaut stands on the Moon next to his crashed rocket, Earth in the sky." />`,
  `<meta property="og:locale" content="en_US" />`,
  `<meta name="twitter:card" content="summary_large_image" />`,
  `<meta name="twitter:title" content="${title}" />`,
  `<meta name="twitter:description" content="${desc}" />`,
  `<meta name="twitter:image" content="${SITE}/moon/og.jpg" />`,
  `<link rel="icon" type="image/png" href="/moon/favicon.png" />`,
  `<link rel="apple-touch-icon" href="/moon/apple-touch-icon.png" />`,
  `<meta name="apple-mobile-web-app-title" content="Junior Astronaut" />`,
  `<meta name="apple-mobile-web-app-capable" content="yes" />`,
  `<meta name="mobile-web-app-capable" content="yes" />`,
].join("\n  ");
writeFileSync(
  resolve(GEN, "index.html"),
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#0b1b3a" />
  ${head}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@600;700;800;900&display=swap" />
  <style>html,body{margin:0;height:100%;background:#0b1b3a;overflow:hidden;overscroll-behavior:none}#app{position:fixed;inset:0}</style>
</head>
<body><div id="app"></div><script type="module" src="./main.ts"></script></body>
</html>
`
);

// 2) Vite build
rmSync(OUT, { recursive: true, force: true });
await build({
  root: GEN,
  base: "/",
  publicDir: false,
  logLevel: "warn",
  plugins: [vue()],
  resolve: { alias: { "~": ROOT } },
  define: { "import.meta.dev": "false" },
  build: { outDir: OUT, emptyOutDir: true, assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
});

// 3) game assets only
cpSync(resolve(ROOT, "public/moon"), resolve(OUT, "moon"), { recursive: true });

// 4) Netlify: SPA fallback + long cache for hashed assets and media
writeFileSync(resolve(OUT, "_redirects"), "/*  /index.html  200\n");
writeFileSync(
  resolve(OUT, "_headers"),
  `/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/moon/*\n  Cache-Control: public, max-age=604800\n`
);

rmSync(GEN, { recursive: true, force: true });
if (!existsSync(resolve(OUT, "index.html"))) throw new Error("build produced no index.html");
console.log("standalone game built →", OUT);
