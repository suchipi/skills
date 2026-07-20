// Example drive-browser script. Runs on the host, connected to the live browser:
//
//   drive-browser.ts run examples/example.mts https://example.com
//
// Scripts may be TypeScript or JavaScript - Node strips the types, so there is no
// build step either way. This one is `.mts`, which is ESM wherever it lives; a plain
// `.ts` script follows its own project's package.json. Import the context type to get
// completion on `page`.
// Whatever you return is printed (JSON-encoded), so a script can double as a query.
import type { ScriptContext } from "../scripts/lib/browser-commands.ts";

export default async function example({ page, args, log, screenshot }: ScriptContext) {
  const url = args[0] || "https://example.com";

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { visible: true });

  const heading = await page.$eval("h1", (element) => (element as HTMLElement).innerText);
  log(`heading: ${heading}`);

  await screenshot("example.png");

  return { url: page.url(), title: await page.title(), heading };
}
