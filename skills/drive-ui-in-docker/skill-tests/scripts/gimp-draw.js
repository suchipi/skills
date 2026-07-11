// Used by 03-complex-app-gimp (display 1280x800), run after gimp-new-image.js
// while the "Create a New Image" dialog is open. Clicks OK to create the image,
// selects the Pencil tool (shortcut N), then click-drags a zig-zag stroke.
const { Mouse, Keyboard, Key, MouseButton, sleep } = require("suchibot");

// Click OK in the New Image dialog.
Mouse.moveTo(854, 262);
sleep.sync(200);
Mouse.click();
sleep.sync(1500);

// Pencil tool, then draw.
Keyboard.tap(Key.N);
sleep.sync(500);
Mouse.moveTo(500, 250);
sleep.sync(200);
Mouse.hold(MouseButton.LEFT);
sleep.sync(150);
Mouse.moveTo(650, 550, true);
sleep.sync(150);
Mouse.moveTo(800, 250, true);
sleep.sync(150);
Mouse.moveTo(950, 550, true);
sleep.sync(150);
Mouse.release(MouseButton.LEFT);
sleep.sync(400);
