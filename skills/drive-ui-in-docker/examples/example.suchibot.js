// Example suchibot script. Runs INSIDE the container against DISPLAY=:0.
//
//   drive-ui-in-docker run examples/example.suchibot.js
//
// `run` executes this with `node` (suchibot as a library), so a pure-action
// script exits on its own — no process.exit needed. Use `sleep.sync` (not
// `sleep.async`) to pace actions between screenshots.
const { Mouse, Keyboard, Key, MouseButton, sleep } = require("suchibot");

// Move + click somewhere, then type.
Mouse.moveTo(400, 300);
sleep.sync(200);
Mouse.click(MouseButton.LEFT);
sleep.sync(200);

Keyboard.type("hello from suchibot");
sleep.sync(200);
Keyboard.tap(Key.ENTER);
