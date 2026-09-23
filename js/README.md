# [Prof] Mage Training Arena

A TitanClient JavaScript plugin (QuickJS runtime) that runs Mage Training Arena
rooms for pizazz points. The goal is every reward: 2,825 Telekinetic,
3,275 Alchemist, 29,000 Enchanting and 2,825 Graveyard points.

## Install

```powershell
.\js\fetch-types.ps1   # optional: SDK typings for IntelliSense (js/types/, gitignored)
.\js\deploy.ps1        # copies profMTA.js to %USERPROFILE%\.titanclient\plugins
```

Enable **[Prof] Mage Training Arena** in the controller, choose a room in the
settings, then press **Start** in the MTA side panel.

## Rooms

Set up the inventory and equipment for the room before starting.

| Room | Needs | Loop |
| --- | --- | --- |
| Telekinetic | Law runes, air (or air staff) | Solves the maze by breadth-first search over statue slides, stands on the matching side, casts Telekinetic Grab, and starts a new maze when it's solved. |
| Alchemist | Nature runes, fire (or fire staff) | Reads the price table, finds the 30-coin item's cupboard (infers the clockwise layout from searches), alchs it, drops items below the minimum value, and deposits coins. |
| Enchanting | Cosmic runes plus the staff/runes for the spell | Fills the inventory from the bonus-shape pile, picks up dragonstones, enchants everything, and deposits orbs. |
| Graveyard | Nature runes, earth/water (or mud staff), food | Grabs bones up to a full deposit's worth of fruit, casts Bones to Peaches/Bananas, deposits, and eats below the HP threshold. |

**Auto** mode stays in a room until its goal is met, then moves to the room
furthest from its goal. The inventory must hold the supplies for every room.

Points are read from the room HUD and the lobby overview and persisted between
sessions. Lower the per-room goals under *Point goals* if you've already bought
some rewards.

## Coordinates template

`COORDS` at the top of `profMTA.js` holds lobby, portal, room-centre and deposit
tiles. They're all `0,0,0` for now. The plugin finds everything by object/NPC
id and uses these tiles only as walk fallbacks when a target isn't in the
loaded scene.

## Unverified in-game

These are built from the SDK typings and the wiki, not yet tested against the
live client:

- **Action names:** `Enter` (portals), `New-maze`/`Reset` (guardian), `Search`
  (cupboards), `Take-from` (shape piles), `Grab` (bone piles), `Deposit`. If an
  action is missing, the log lists the actions the object actually has.
- **Maze walls:** the solver assumes the maze walls (object 10755) set collision
  flags, as RuneLite's MTA plugin does.
- **Stand distance:** the side row is 1 tile beyond the outermost wall. This is
  adjustable in settings.
- **Enchanting bonus:** the bonus shape is read as the only visible HUD shape
  icon.
- **Cupboard order:** the Alchemist layout is inferred from cupboard angles
  around the room centre. Contradictions flip the direction or reset knowledge.
- **Graveyard deposit cap:** assumes 3 points per deposit (24 peaches).
