// Records the active page to video. Spawned detached by `drive-browser
// record-start` with the output path as its argument, because recording has to
// outlive that invocation. It writes its pid only once the screencast is really
// running, which is how record-start knows the recording started.
//
// Unlike the page commands, this connects to the browser itself rather than going
// through the daemon: puppeteer's screencast needs CDP, so it is Chrome-only, and
// Chrome is happy to serve a second CDP client.
import fs from "node:fs";
import type { Browser, Page, ScreenRecorder } from "puppeteer";

import { PROTOCOL_TIMEOUT, REC_PID } from "./paths.ts";
import { loadPuppeteer, liveSession } from "./session.ts";
import { describeError } from "./errors.ts";

/** puppeteer picks the container from the extension, and only knows these three. */
type RecordingPath = `${string}.webm` | `${string}.mp4` | `${string}.gif`;

async function main(output: RecordingPath): Promise<void> {
  const session = liveSession();
  if (!session) throw new Error("no browser is running");

  const puppeteer = loadPuppeteer();
  const browser: Browser = await puppeteer.connect({
    browserWSEndpoint: session.wsEndpoint,
    defaultViewport: null,
    protocolTimeout: PROTOCOL_TIMEOUT,
  });
  const pages: Page[] = (await browser.pages()).filter((page) => !page.isClosed());
  const page = pages[session.pageIndex] || pages[0];

  const recorder: ScreenRecorder = await page.screencast({ path: output });
  fs.writeFileSync(REC_PID, String(process.pid));

  // recorder.stop() is what finalizes the container, so the signal handler has to
  // await it rather than let the process die.
  const stop = async () => {
    await recorder.stop().catch(() => {});
    browser.disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  setInterval(() => {}, 1 << 30);
}

try {
  // record-start validates the extension before spawning this.
  await main(process.argv[2] as RecordingPath);
} catch (error) {
  console.error(`drive-browser recorder: ${describeError(error)}`);
  process.exit(1);
}
