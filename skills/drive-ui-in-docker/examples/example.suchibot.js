// Example suchibot script. Runs INSIDE the container against DISPLAY=:0.
//
//   drive-ui-in-docker run examples/example.suchibot.js
//
// Use `sleep.sync` to pace actions between screenshots.
const { Mouse, Keyboard, Key, MouseButton, sleep } = require("suchibot");

// Move + click somewhere, then type.
Mouse.moveTo(400, 300);
sleep.sync(200);
Mouse.click(MouseButton.LEFT);
sleep.sync(200);

Keyboard.type("hello from suchibot");
sleep.sync(200);
Keyboard.tap(Key.ENTER);
