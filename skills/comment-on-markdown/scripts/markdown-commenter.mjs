import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const REPO = "https://github.com/suchipi/markdown-commenter.git";
const WORK = path.resolve(process.env.MARKDOWN_COMMENTER_WORK || "/tmp/markdown-commenter");
const APP = path.join(WORK, "app");
const SERVER = path.join(APP, "src", "server.js");
const COMMENTS_DIR = path.join(WORK, "comments");
const SERVERS_DIR = path.join(WORK, "servers");

const USAGE = `Usage:
  node markdown-commenter.mjs start <input.md> [--comments <file.md>] [--no-open]
  node markdown-commenter.mjs stop [<port>]

Env: MARKDOWN_COMMENTER_WORK (default /tmp/markdown-commenter)`;

class Fatal extends Error {}

function die(message) {
  throw new Fatal(message);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function realpath(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: ["ignore", 2, 2], ...opts });
  if (result.error) die(`couldn't run ${cmd}: ${result.error.message}`);
  if (result.status !== 0) die(`${cmd} ${args.join(" ")} failed (exit ${result.status})`);
}

function checkNode() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 20 || (major === 20 && minor < 11)) {
    die(`markdown-commenter needs Node 20.11 or newer (found ${process.version})`);
  }
}

function installDeps(dir) {
  const head = spawnSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
  const marker = path.join(dir, "node_modules", ".installed-commit");
  let installed = "";
  try {
    installed = fs.readFileSync(marker, "utf8");
  } catch {}
  if (installed === head) return;
  // server.js imports remark and friends, which only arrive via the mark-applier devDependency.
  run("npm", ["ci", "--include=dev", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: dir });
  fs.writeFileSync(marker, head);
}

function ensureApp() {
  fs.mkdirSync(WORK, { recursive: true });
  if (fs.existsSync(APP)) {
    if (!fs.existsSync(path.join(APP, ".git"))) {
      die(`${APP} exists but isn't a git checkout; move it aside and rerun`);
    }
    const pull = spawnSync("git", ["-C", APP, "pull", "--quiet", "--ff-only"], {
      stdio: ["ignore", 2, 2],
    });
    if (pull.status !== 0) {
      console.error("markdown-commenter: couldn't update the app; using the copy already installed");
    }
    installDeps(APP);
    return;
  }

  // Install beside the final path and rename it into place, so a failed or concurrent
  // first install never leaves a half-built app where the next start would use it.
  const staging = `${APP}.partial-${process.pid}`;
  try {
    run("git", ["clone", "--quiet", "--depth", "1", REPO, staging]);
    installDeps(staging);
    try {
      fs.renameSync(staging, APP);
    } catch (err) {
      // Another start finished installing first, and its copy is just as good.
      if (err.code !== "ENOTEMPTY" && err.code !== "EEXIST") throw err;
    }
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function freshCommentsPath(input) {
  fs.mkdirSync(COMMENTS_DIR, { recursive: true });
  const base = `${path.basename(input, path.extname(input))}-${timestamp()}`;
  for (let n = 1; ; n++) {
    const candidate = path.join(COMMENTS_DIR, n === 1 ? `${base}.md` : `${base}-${n}.md`);
    try {
      fs.writeFileSync(candidate, "", { flag: "wx" });
      return candidate;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
    }
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on("error", reject);
    probe.listen(0, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function readRecords() {
  let names;
  try {
    names = fs.readdirSync(SERVERS_DIR);
  } catch {
    return [];
  }
  return names
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(fs.readFileSync(path.join(SERVERS_DIR, name), "utf8")));
}

function recordPaths(port) {
  return {
    json: path.join(SERVERS_DIR, `${port}.json`),
    log: path.join(SERVERS_DIR, `${port}.log`),
  };
}

// A record can outlive its server (reboot, crash), and its pid may since belong to
// something unrelated, so only trust a pid whose command line is still ours.
function isRunning(record) {
  const ps = spawnSync("ps", ["-ww", "-o", "command=", "-p", String(record.pid)], { encoding: "utf8" });
  return ps.status === 0 && ps.stdout.includes(SERVER) && ps.stdout.includes(record.comments);
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function start(args) {
  let input;
  let comments;
  let open = true;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--comments") {
      comments = args[++i];
      if (!comments) die("--comments needs a path");
    } else if (arg === "--no-open") {
      open = false;
    } else if (arg.startsWith("-")) {
      die(`unknown option ${arg}\n${USAGE}`);
    } else if (input === undefined) {
      input = arg;
    } else {
      die(`unexpected argument ${arg}\n${USAGE}`);
    }
  }
  if (!input) die(USAGE);

  input = path.resolve(input);
  if (!fs.statSync(input, { throwIfNoEntry: false })?.isFile()) die(`not a file: ${input}`);

  if (comments) {
    comments = path.resolve(comments);
    if (realpath(comments) === realpath(input)) {
      die("the comments file can't be the input file; markdown-commenter would overwrite it");
    }
    const owner = readRecords().find((r) => realpath(r.comments) === realpath(comments) && isRunning(r));
    if (owner) die(`${comments} is already in use by the server on port ${owner.port}`);
  }

  checkNode();
  ensureApp();

  if (comments) {
    fs.mkdirSync(path.dirname(comments), { recursive: true });
  } else {
    comments = freshCommentsPath(input);
  }

  fs.mkdirSync(SERVERS_DIR, { recursive: true });
  const port = await freePort();
  const paths = recordPaths(port);
  const logFd = fs.openSync(paths.log, "w");
  const child = spawn(process.execPath, [SERVER, input, comments, String(port)], {
    cwd: APP,
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  fs.closeSync(logFd);

  const record = { pid: child.pid, port, url: `http://localhost:${port}`, input, comments, log: paths.log };
  fs.writeFileSync(paths.json, JSON.stringify(record, null, 2) + "\n");

  let exited = false;
  child.on("exit", () => (exited = true));
  const deadline = Date.now() + 15_000;
  for (;;) {
    if (exited) {
      const log = fs.readFileSync(paths.log, "utf8");
      fs.rmSync(paths.json);
      fs.rmSync(paths.log);
      die(`the server exited during startup:\n${log}`);
    }
    try {
      if ((await fetch(`${record.url}/api/comments`)).ok) break;
    } catch {}
    if (Date.now() > deadline) {
      child.kill();
      fs.rmSync(paths.json);
      die(`the server didn't answer within 15s; see ${paths.log}`);
    }
    await sleep(100);
  }
  child.removeAllListeners("exit");
  child.unref();

  if (open) {
    const opener = process.platform === "darwin" ? "open" : "xdg-open";
    const browser = spawn(opener, [record.url], { detached: true, stdio: "ignore" });
    browser.on("error", () => {});
    browser.unref();
  }

  console.log(`markdown-commenter is running.
  url:      ${record.url}
  input:    ${input}
  comments: ${comments}
Stop it with: stop ${port}`);
}

async function stop(args) {
  if (args.length > 1) die(USAGE);
  let records = readRecords();
  if (args[0]) {
    records = records.filter((r) => String(r.port) === args[0]);
    if (records.length === 0) die(`no server on port ${args[0]} was started from ${WORK}`);
  }
  if (records.length === 0) {
    console.log(`no servers were started from ${WORK}`);
    return;
  }

  for (const record of records) {
    const paths = recordPaths(record.port);
    if (isRunning(record)) {
      process.kill(record.pid, "SIGTERM");
      const deadline = Date.now() + 5_000;
      while (isAlive(record.pid) && Date.now() < deadline) await sleep(50);
      if (isAlive(record.pid)) process.kill(record.pid, "SIGKILL");
      console.log(`stopped port ${record.port}; comments: ${record.comments}`);
    } else {
      let log = "";
      try {
        log = fs.readFileSync(paths.log, "utf8");
      } catch {}
      console.log(`port ${record.port} had already exited; comments: ${record.comments}\nits log:\n${log}`);
    }
    fs.rmSync(paths.json, { force: true });
    fs.rmSync(paths.log, { force: true });
  }
}

const [command, ...rest] = process.argv.slice(2);
try {
  if (command === "start") await start(rest);
  else if (command === "stop") await stop(rest);
  else die(USAGE);
} catch (err) {
  if (!(err instanceof Fatal)) throw err;
  console.error(`markdown-commenter: ${err.message}`);
  process.exit(1);
}
