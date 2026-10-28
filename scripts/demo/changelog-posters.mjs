// Makes a WebP poster for each release video in packages/client/public/releases, so the
// website can load videos with preload="none". Run it when upstream adds release videos:
//   node scripts/demo/changelog-posters.mjs
// It uses the Playwright Chromium of the smoke tests, which decodes H.264.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const releases = resolve(root, "packages/client/public/releases");
export const POSTERS = resolve(root, "packages/client/public/demo-assets/changelog-posters");

export function releaseVideos() {
  return readdirSync(releases, { recursive: true })
    .filter((file) => file.endsWith(".mp4"))
    .map((file) => ({ file, poster: resolve(POSTERS, file.replace(/\.mp4$/, ".webp")) }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { chromium } = createRequire(resolve(root, "package.json"))("@playwright/test");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const { file, poster } of releaseVideos()) {
    if (existsSync(poster)) continue;
    const data = readFileSync(resolve(releases, file)).toString("base64");
    const webp = await page.evaluate(async (base64) => {
      const video = document.createElement("video");
      video.muted = true;
      video.src = `data:video/mp4;base64,${base64}`;
      await new Promise((done) => (video.onloadedmetadata = done));
      video.currentTime = Math.min(1.5, video.duration / 3);
      await new Promise((done) => (video.onseeked = done));
      const scale = Math.min(1, 1280 / video.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/webp", 0.8).split(",")[1];
    }, data);
    mkdirSync(dirname(poster), { recursive: true });
    writeFileSync(poster, Buffer.from(webp, "base64"));
    console.log(`[changelog-posters] ${file}`);
  }
  await browser.close();
}
