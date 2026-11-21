# SOLMAR CITY — a GTA-style open-world crime game (gta6-01)

An original 3D open-world game built with three.js (vendored under
`game/vendor/`). No Rockstar names, places, characters or assets appear
anywhere: the city, the people, the cars, the story and the art are all
invented for this entry.

## The game

Jay Marlowe is a hire driver in debt in Solmar City, a sunny fictional
coastal city. Walk the streets or steal one of four car classes (sedan,
taxi, van, sport GT) with arcade driving, handbrake drifts and traffic.
Five chained story missions take Jay from a rushed parcel to a harbour run
at four wanted stars, with a taxi side job and store robberies between them.

- **Open world**: a 12×12 block procedural city — painted roads, sidewalks,
  parks, a beach, a harbour with a lighthouse, and a slow sun cycle from
  morning to golden hour.
- **Traffic + pedestrians**: NPC cars that follow the road grid and stop at
  traffic lights; pedestrians who walk the sidewalks and run from gunfire.
- **Wanted system**: 0–5 stars. Patrol cars chase, foot cops arrest,
  roadblocks at 3+ stars, a searchlight helicopter at 5. Hide, swap cars,
  or wait it out to cool down.
- **Combat**: pistol with aim, reload, hitmarkers and rival gang members
  who chase and shoot back.
- **HUD + minimap**: health/armor, cash, wanted stars, clock, mission
  tracker, speedometer and a live minimap with the mission beacon.
- **Polish**: procedural WebAudio (engine, gunshots, sirens, radio),
  localStorage saves, pause / busted / wasted flows, and deterministic
  screenshot scenes (`?shot=chase|mission|wanted|vista&seed=N`).

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

WASD walk/drive · mouse look · left click shoot · E enter/leave car ·
Space jump/handbrake · R reload · M missions · T taxi job · P/Esc pause.

## Build it (the entrypoint)

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored make.fun library. Screenshots are
taken with the headless-Chrome driver in `../drive.mjs` (not shipped).

## Files

- `game/index.html` — page, HUD, overlays, import map for three.js
- `game/src/main.js` — boot, input, fixed-step loop, chase camera, shots
- `game/src/world.js` — city generation, painted ground, buildings, props
- `game/src/traffic.js` — NPC cars + traffic lights
- `game/src/peds.js` — pedestrians
- `game/src/player.js` — Jay on foot
- `game/src/vehicles.js` — car meshes + arcade driving
- `game/src/police.js` — wanted system, patrols, roadblocks, helicopter
- `game/src/missions.js` — five story missions + taxi side job
- `game/src/combat.js` — pistol + gang AI
- `game/src/hud.js` — DOM HUD + minimap
- `game/src/audio.js` — synthesised WebAudio
- `game/src/shots.js` — deterministic screenshot scenes
- `game/src/config.js` — all tuning numbers and names
- `game/src/random.js` — seeded RNG
- `game/vendor/three.module.min.js` — three.js r187 (vendored)
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `main.ts` — the entrypoint · `serve.ts` — local dev server
- `shots.json` — the four screenshot scenes · `screenshots/` — the shots

## License

MIT — see `LICENSE`.
