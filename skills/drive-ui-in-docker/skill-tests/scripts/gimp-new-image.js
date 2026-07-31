// Used by 03-complex-app-gimp (display 1280x800). Focuses the GIMP window via
// its title bar, then opens File > New with Ctrl+N. Note LEFT_CONTROL - there
// is no bare Key.CONTROL in suchibot.
const { Mouse, Keyboard, Key, sleep } = require("suchibot");

Mouse.moveTo(698, 43);
sleep.sync(200);
Mouse.click();
sleep.sync(300);
Keyboard.hold(Key.LEFT_CONTROL);
Keyboard.tap(Key.N);
Keyboard.release(Key.LEFT_CONTROL);
sleep.sync(1200);
