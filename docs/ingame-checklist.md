# In-game checklist

Bind "Toggle camera mode" in Controls first (it's unbound by default, under Expanse Cam).
`config/expansecam.json` needs `projectDir` pointing at this folder.

Camera mode
- [ ] Toggle on: camera stays put at first, then swings smoothly right and left
- [ ] Swing stops about 45 deg each side of where you were facing, never further
- [ ] Looking up/down stays exactly where you left it
- [ ] Moving the mouse does nothing
- [ ] WASD, space, shift, left/right click, number keys, T, F5 do nothing
- [ ] HUD, hand and chat all hidden (with Better F1 too), F1 can't bring them back
- [ ] Still sitting on the cushion after a minute of mashing keys
- [ ] Toggle off: full control back, HUD back, no queued clicks or swings fire
- [ ] Swing looks smooth on screen at 60 fps, no stepping

Streaming (as CHUDWOLF)
- [ ] Nothing running, toggle on: MediaMTX, Caddy, backend and OBS start by themselves, page goes Live within ~20 s
- [ ] Toggle off: page shows Paused, OBS stops streaming, everything else keeps running
- [ ] Toggle on again: Live again
- [ ] Viewer count on the page goes up when a second device opens it
- [ ] Leave the server: page shows Paused right away; 6 minutes later the public link shows the maintenance page
- [ ] Leave and rejoin within 6 minutes: nothing stops
- [ ] Quit the game while streaming: maintenance page right away
- [ ] On another account: toggling camera mode starts nothing

Chat (dev page, http://localhost:8082)
- [ ] Player chat shows up within a couple of seconds
- [ ] Joins, leaves, deaths show up
- [ ] Whispers to or from CHUDWOLF never show up
- [ ] Prod page shows no chat at all
