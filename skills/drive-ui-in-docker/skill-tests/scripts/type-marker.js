// Used by 02-drive-with-suchibot. Clicks into a terminal at ~(350,250) on a
// 1024x768 display and runs `echo SKILLTEST_DRIVE_OK`, so the marker string
// appears on screen for visual verification.
const { Mouse, Keyboard, Key, sleep } = require("suchibot");

Mouse.moveTo(350, 250);
sleep.sync(200);
Mouse.click();
sleep.sync(200);
Keyboard.type("echo SKILLTEST_DRIVE_OK");
sleep.sync(200);
Keyboard.tap(Key.ENTER);
sleep.sync(300);
