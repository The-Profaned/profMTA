# [Prof] Mage Training Arena

A TitanClient JavaScript plugin (QuickJS runtime) that runs Mage Training Arena
rooms for pizazz points. The goal is every reward: 2,825 Telekinetic,
3,275 Alchemist, 29,000 Enchanting and 2,825 Graveyard points.

## Run / test

```powershell
.\gradlew.bat runViaTitan
```

This opens a dedicated **prof-mta** DEV tab with the plugin loaded from
`build/.titan/dev/prof-mta/load/gen-N/`. After editing `js/profMTA.js`, run
`.\gradlew.bat build` to stage the change, then click the refresh button in
the prof-mta tab to load it. Running `runViaTitan` again recycles only the
prof-mta tab.
`runViaTitanDebug` works too, although it only attaches a Java debugger.

Enable **[Prof] Mage Training Arena** in the tab, choose a room in the
settings, then press **Start** in the MTA side panel.

Other scripts:

```powershell
.\js\fetch-types.ps1   # optional: SDK typings for IntelliSense (js/types/, gitignored)
.\js\deploy.ps1        # permanent install to %USERPROFILE%\.titanclient\plugins (no hot reload)
```

## Rooms

Set up the inventory and equipment for the room before starting.

| Room | Needs | Loop |
| --- | --- | --- |
| Telekinetic | Law runes, air (or air staff) | Solves the maze by breadth-first search over statue slides, stands on the matching side, casts Telekinetic Grab, and starts a new maze when it's solved. |
| Alchemist | Nature runes, fire (or fire staff) | Reads the price table, searches one cupboard to learn the layout (the 6 cupboards cycle through the items by object id, as in RuneLite's MTA plugin), takes the 30-coin item, alchs it, drops items below the minimum value, and deposits coins. |
| Enchanting | Cosmic runes plus the staff/runes for the spell | Fills the inventory from the bonus-shape pile, picks up dragonstones, enchants everything, and deposits orbs. |
| Graveyard | Nature runes, earth/water (or mud staff), food | Sticks to the bone pile nearest the food chute and clicks it every tick. Peaches stops once the bones are worth 24 (the 3-point cap); Bananas fills the inventory. It tracks the pile's 4-bones-per-type rotation so it knows whether the next bone still fits. It then casts, deposits, dodges falling bones, and eats only below the HP threshold. |

**Auto** mode stays in a room until its goal is met, then moves to the room
furthest from its goal. The inventory must hold the supplies for every room.

Points are read from the room HUD and the lobby overview and persisted between
sessions. Lower the per-room goals under *Point goals* if you've already bought
some rewards.

## HUD

The in-game overlay panel (Alt-drag to move) shows:

- **State:** running/stopped with run time, current room and mode, and what the
  script is doing right now.
- **Magic:** level (+levels gained), XP gained and XP/h, XP to next level with
  ETA, and a progress bar.
- **Room points:** points / goal, session gain and points/h, time in the room
  (with that room's XP/h), and time to goal. Points/h only counts time spent
  inside that room, so walking and Auto-mode room swaps don't skew it.
- **Room details:** maze next grab and grabs to finish; alchemy best item,
  cupboard search progress and coins; enchanting bonus shape, phase, spell and
  orbs; graveyard HP, spell, bones/fruit, next bone from the pile, food eaten
  and bones dodged. Also the room's rune
  count and cast count.
- **Goals:** all four rooms against their goals, and **Last progress**, which
  turns yellow or red if points and XP stop going up.
- **Recent:** the last few notable events (0 hides them).

*Settings → HUD* switches between Compact and Detailed and toggles the
sections and scene labels. The side panel shows the same data in an
*Overview* tab plus a *Rooms* table (points/h, time and ETA for every room).

## Error log

While everything works, the error log shows nothing. The script keeps a
breadcrumb trail of its last 15 game actions (clicks, casts, walks, eats and
drops, with repeats collapsed to `x3` and failures flagged). A report is
created when:

| Report | Trigger |
| --- | --- |
| Script error | An exception in the tick loop or a draw callback. Shows the plugin function and line. |
| Stopped | The script stopped itself for a reason other than reaching the goal (out of runes, level too low, full inventory, 10 errors in a row). |
| Action failing | The same action was rejected 3 times in a row. |
| No progress | No points or Magic XP for *HUD → Report no progress after* minutes (default 3). |
| Warning | A menu option isn't on the object, or HP is low with no food. |

Each report states what happened, why, and how to fix it. It also records a
state snapshot and the last 15 actions as a timeline. The newest unread report
appears as a card at the top of the MTA side panel, and an *Errors* tab
(present only once something has failed) keeps the last 10. The HUD shows a
single "see MTA side panel" line until the report is dismissed. *Write to
client log* prints the full report to the client log for sharing.

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
- **Stand distance:** the plugin stands on the outer wall line, where RuneLite
  marks the cast tiles, never on a corner. This is adjustable in settings.
- **Enchanting bonus:** the bonus shape is read as the only visible HUD shape
  icon.
- **Cupboard order:** follows RuneLite. Slot n (from the object id) holds the
  item after slot n-1's, and one slot is empty. One search (or the "You found:"
  chat line) reveals every cupboard until the next price rotation.
- **Graveyard deposit cap:** assumes 3 points per deposit (24 peaches).
- **Graveyard bone piles:** assumes a click loots a bone every tick and that each
  pile keeps its own rotation (the wiki says to use a single pile). The HUD "Pile"
  line shows the predicted next bone, so a wrong guess is easy to spot. Varbits
  1500-1502/1507 (`MAGICTRAINING_GRAVE_BONE*COUNT`) may hold the rotation
  directly, but that isn't confirmed.
