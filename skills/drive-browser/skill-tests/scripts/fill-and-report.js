// Used by skill-test 04.
//   drive-browser run skills/drive-browser/skill-tests/scripts/fill-and-report.js <name>
module.exports = async ({ page, args, log, screenshot }) => {
  const name = args[0] || "scripted";

  await page.waitForSelector("#name", { visible: true });
  await page.type("#name", name);
  await page.click("#greet");
  await page.waitForSelector("#later", { visible: true });
  log(`filled in ${name}`);

  await screenshot("04-script.png");

  return {
    out: await page.$eval("#out", (el) => el.innerText),
    buttons: await page.$$eval("button", (els) => els.map((e) => e.id)),
  };
};
