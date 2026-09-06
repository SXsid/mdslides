// Entry point: wires the three independent modules together. Each one
// only knows about its own piece (nav doesn't know theme exists, theme
// doesn't know live-reload exists) — this is the one file allowed to
// know about all three, so it's the only place a new module needs to be
// registered.
import { init as initNav } from "./nav.js";
import { init as initTheme } from "./theme.js";
import { init as initLiveReload } from "./live-reload.js";

initNav();
initTheme();
initLiveReload();
