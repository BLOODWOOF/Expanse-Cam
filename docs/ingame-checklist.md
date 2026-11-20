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

Camera modes (bind "Cycle camera mode" too)
- [ ] Cycle key with camera off: chat says "Camera: Pan", "Camera: Stationary", "Camera: Follow" in turn
- [ ] Stationary: holds the exact view (direction and tilt) you had when turning camera mode on
- [ ] Pan: swings around the set view like before, never further than 45 deg either way
- [ ] Follow, nobody near: pans from the set view
- [ ] Follow, someone walks into view (in sight, within 24 blocks): camera turns smoothly to them and
      keeps them in frame, up and down too
- [ ] Someone else comes closer: camera stays on the first person
- [ ] First person walks behind a wall: camera holds for ~5 s, then picks the next person or goes back to panning
- [ ] 5 or more people in view at once: camera pans instead; following resumes when fewer are around
- [ ] Turning is smooth on the stream, no jumps, never spins the long way round
- [ ] Mode is the same after restarting the game

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
