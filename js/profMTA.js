/// <reference path="./types/titan-plugin-sdk.d.ts" />
/**
 * [Prof] Mage Training Arena
 *
 * Runs one of the four Mage Training Arena rooms (or all of them, in "Auto"
 * mode) to earn the pizazz points needed for every reward. The player is
 * expected to have the inventory/equipment for the chosen room already set up
 * (runes, staff, food, ...). The plugin only walks between the lobby and the
 * rooms and performs the room activity.
 *
 * Every id below comes from titan-gamevals.d.ts (`titan.gamevals.*`); the
 * gameval constant name is noted next to each value.
 */

// ---------------------------------------------------------------------------
// Coordinate template. A point left at 0,0,0 is "unset": the plugin then
// relies only on finding the relevant object/NPC in the loaded scene, and
// falls back to these tiles when it can't.
// ---------------------------------------------------------------------------
const COORDS = {
    /** Lobby tile within sight of the four room portals. */
    lobby: { x: 0, y: 0, z: 0 },
    /** Tile next to each room's lobby portal, indexed by ROOM. */
    portals: [
        { x: 0, y: 0, z: 0 }, // Telekinetic Theatre
        { x: 0, y: 0, z: 0 }, // Alchemists' Playground
        { x: 0, y: 0, z: 0 }, // Enchanting Chamber
        { x: 0, y: 0, z: 0 }, // Creature Graveyard
    ],
    /** A central tile inside each room, indexed by ROOM. */
    roomCenters: [
        { x: 0, y: 0, z: 0 }, // Telekinetic Theatre
        { x: 0, y: 0, z: 0 }, // Alchemists' Playground
        { x: 0, y: 0, z: 0 }, // Enchanting Chamber
        { x: 0, y: 0, z: 0 }, // Creature Graveyard
    ],
    enchantingHole: { x: 0, y: 0, z: 0 },
    graveyardChute: { x: 0, y: 0, z: 0 },
    alchemistCollector: { x: 0, y: 0, z: 0 },
};

// ---------------------------------------------------------------------------
// Game constants
// ---------------------------------------------------------------------------
const ROOM = Object.freeze({ TELEKINETIC: 0, ALCHEMIST: 1, ENCHANTING: 2, GRAVEYARD: 3 });
const ROOMS = [ROOM.TELEKINETIC, ROOM.ALCHEMIST, ROOM.ENCHANTING, ROOM.GRAVEYARD];
const AUTO_ROOM = 4;
const ROOM_NAMES = ["Telekinetic", "Alchemist", "Enchanting", "Graveyard"];

/** Pizazz points needed to buy every reward, per room (OSRS wiki). */
const REWARD_POINTS = [2825, 3275, 29000, 2825];

const OBJ = Object.freeze({
    // MAGICTRAINING_TELEDOOR / ALCHEMDOOR / ENCHANTDOOR / GRAVEDOOR, indexed by ROOM.
    PORTALS: [23673, 23675, 23674, 23676],
    RETURN_PORTAL: 23677,          // MAGICTRAINING_RETURNDOOR
    MAZE_WALL: 10755,              // MAGICTRAINING_MINIWALL
    MAZE_FINISH: 23672,            // MAGICTRAINING_MINI_STATUE_PITFALL
    // MAGICTRAINING_ALCHEM_CUPBOARD0..5 plus their _OPEN variants.
    CUPBOARDS: [23678, 23679, 23680, 23681, 23682, 23683, 23684, 23685, 23686, 23687, 23688, 23689],
    COIN_COLLECTOR: 10734,         // MAGICTRAINING_COIN_COLLECTOR
    SHAPE_PILES: [23694, 23695, 23696, 23697], // MAGICTRAINING_ENCHAN_SHAPEPILE1..4
    ENCHANT_HOLE: 23698,           // MAGICTRAINING_ENCHA_HOLE
    BONE_PILES: [10725, 10726, 10727, 10728],  // MAGICTRAINING_BONES_PILE1..4
    FOOD_CHUTE: 10735,             // MAGICTRAINING_GRAVE_FOODSHUTE
});

const NPC_ID = Object.freeze({
    GUARDIAN: 6777,                // MAGICTRAINING_GUARD_MAZE_INCOMPLETE
    GUARDIAN_MOVING: 6778,         // MAGICTRAINING_GUARD_MAZE_MOVING
    GUARDIAN_DONE: 6779,           // MAGICTRAINING_GUARD_MAZE_COMPLETE
});

const ITEM = Object.freeze({
    // MAGICTRAINING_LEATHER_BOOTS, ADAMANT_KITESHIELD, ADAMANT_MED_HELM,
    // EMERALD, RUNE_LONGSWORD -- also the clockwise cupboard order.
    ALCH_ITEMS: [6893, 6894, 6895, 6896, 6897],
    MTA_COINS: 8890,               // MAGICTRAINING_COINS
    CYLINDER: 6898,
    CUBE: 6899,
    ICOSAHEDRON: 6900,
    PENTAMID: 6901,
    ORB: 6902,                     // MAGICTRAINING_ENCHAN_SHAPEORB
    DRAGONSTONE: 6903,             // MAGICTRAINING_DRAGONSTONE
    BONES: [6904, 6905, 6906, 6907], // MAGICTRAINING_BONES1..4
    BANANA: 1963,
    PEACH: 6883,
});

/** Fruit produced by each graveyard bone type. */
const BONE_FRUIT = { 6904: 1, 6905: 2, 6906: 3, 6907: 4 };
const ALCH_ITEM_KEYWORDS = ["boots", "kiteshield", "helm", "emerald", "longsword"];
const EMPTY_CUPBOARD = 5;

const VARBIT_PEACHES_UNLOCKED = 1505; // MAGICTRAINING_BONESPEACHES

const WIDGET = Object.freeze({
    // Room HUD roots (UNIVERSE), indexed by ROOM.
    ROOM_ROOT: [12976128, 12713984, 12779520, 12845056],
    // Room HUD points text, indexed by ROOM.
    ROOM_POINTS: [12976134, 12713990, 12779526, 12845062],
    // MagictrainingMain *_POINTS (lobby overview), indexed by ROOM.
    LOBBY_POINTS: [36241418, 36241419, 36241420, 36241421],
    ALCH_ITEM: [12713991, 12713992, 12713993, 12713994, 12713995],
    ALCH_COST: [12713996, 12713997, 12713998, 12713999, 12714000],
});

/** Enchanting shapes: item id plus the HUD layer/icon showing the bonus shape. */
const SHAPES = [
    { key: "cube", item: ITEM.CUBE, layer: 12779529, icon: 12779530 },
    { key: "cylinder", item: ITEM.CYLINDER, layer: 12779531, icon: 12779532 },
    { key: "pentamid", item: ITEM.PENTAMID, layer: 12779533, icon: 12779534 },
    { key: "icosahedron", item: ITEM.ICOSAHEDRON, layer: 12779535, icon: 12779536 },
];
const ENCHANTABLE = [ITEM.DRAGONSTONE, ...SHAPES.map((shape) => shape.item)];

/** Telekinetic Grab directions. The statue moves toward the side the player stands on. */
const DIRS = [
    { name: "north", dx: 0, dy: 1 },
    { name: "south", dx: 0, dy: -1 },
    { name: "east", dx: 1, dy: 0 },
    { name: "west", dx: -1, dy: 0 },
];

const ALCH_COOLDOWN_TICKS = 5;
const PEACHES_PER_DEPOSIT = 24;   // 8 peaches per point, 3 points max per deposit
const SCAN_RADIUS = 40;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function mod(value, n) {
    return ((value % n) + n) % n;
}

function stripTags(text) {
    return String(text || "").replace(/<[^>]*>/g, "");
}

/** Parse the first integer in widget text, ignoring colour tags and commas. */
function parseNumber(text) {
    const match = stripTags(text).replace(/,/g, "").match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
}

function isSet(point) {
    return !!point && (point.x !== 0 || point.y !== 0);
}

function tileKey(tile) {
    return `${tile.x},${tile.y},${tile.plane}`;
}

function chebyshev(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

class MageTrainingArenaPlugin extends titan.Plugin {
    id = "prof_mta";
    name = "[Prof] Mage Training Arena";
    description = "Runs the selected Mage Training Arena room for pizazz points.";
    author = "Prof";
    version = "0.1.0";

    enabled = false;

    panels = [{
        id: "main",
        title: "MTA",
        icon: "lucide:wand-sparkles",
        iconColor: 0xFF9B7BFF,
        build: (panel) => {
            panel.separatorText(this.name)
                .label("Status", this.running ? "Running" : "Stopped")
                .button(this.running ? "Stop" : "Start", 1)
                .spacing()
                .label("State", this.status)
                .label("Room", this.roomLabel())
                .separatorText("Pizazz points");
            ROOMS.forEach((room) => {
                panel.label(ROOM_NAMES[room], `${this.pointsLabel(room)} / ${this.goalFor(room)}`);
            });
            panel.progress(this.totalProgress(), `${Math.floor(this.totalProgress() * 100)}% of goal`)
                .spacing()
                .button("Forget tracked points", 2);
        },
        onAction: (actionId) => {
            if (actionId === 1) this.toggleAutomation();
            if (actionId === 2) this.resetTrackedPoints();
        },
    }];

    // ---- Settings -----------------------------------------------------------
    generalSection = this.createSection("general", "General", { position: 0 });
    goalsSection = this.createSection("goals", "Point goals", {
        position: 1,
        closedByDefault: true,
        description: "Points to earn per room. Defaults are the totals for every reward.",
    });
    teleSection = this.createSection("tele", "Telekinetic Theatre", { position: 2, closedByDefault: true });
    alchSection = this.createSection("alch", "Alchemists' Playground", { position: 3, closedByDefault: true });
    enchSection = this.createSection("ench", "Enchanting Chamber", { position: 4, closedByDefault: true });
    graveSection = this.createSection("grave", "Creature Graveyard", { position: 5, closedByDefault: true });

    startStop = this.createSetting("buttonSetting", {
        key: "startStop",
        name: "Start / Stop",
        section: this.generalSection,
        position: 0,
        onClick: () => this.toggleAutomation(),
    });

    roomSetting = this.createSetting("comboSetting", {
        key: "room",
        name: "Room",
        section: this.generalSection,
        position: 1,
        default: ROOM.TELEKINETIC,
        choices: [
            ...ROOMS.map((room) => ({ value: room, label: ROOM_NAMES[room] })),
            { value: AUTO_ROOM, label: "Auto (all goals)" },
        ],
        tooltip: "Auto stays in a room until its goal is met, then moves to the room furthest from its goal. "
            + "It needs the supplies for every room in the inventory.",
    });

    stopAtGoal = this.createSetting("boolSetting", {
        key: "stopAtGoal",
        name: "Stop when goal reached",
        section: this.generalSection,
        position: 2,
        default: true,
    });

    tickJitter = this.createSetting("intSetting", {
        key: "tickJitter",
        name: "Extra random delay (ticks)",
        section: this.generalSection,
        position: 3,
        default: 1,
        min: 0,
        max: 4,
        tooltip: "Up to this many extra ticks are added after each action.",
    });

    goalSettings = ROOMS.map((room) => this.createSetting("intSetting", {
        key: `goal_${ROOM_NAMES[room].toLowerCase()}`,
        name: `${ROOM_NAMES[room]} goal`,
        section: this.goalsSection,
        position: room,
        default: REWARD_POINTS[room],
        min: 0,
        max: room === ROOM.ENCHANTING ? 32000 : room === ROOM.ALCHEMIST ? 16000 : 8000,
    }));

    teleSideOffset = this.createSetting("intSetting", {
        key: "teleSideOffset",
        name: "Stand distance outside maze",
        section: this.teleSection,
        position: 0,
        default: 1,
        min: 1,
        max: 4,
        tooltip: "Tiles beyond the outermost maze wall to stand on when casting.",
    });

    teleScanRadius = this.createSetting("intSetting", {
        key: "teleScanRadius",
        name: "Maze wall scan radius",
        section: this.teleSection,
        position: 1,
        default: 14,
        min: 8,
        max: 24,
        tooltip: "Maze walls within this many tiles of the guardian define the maze bounds.",
    });

    alchSpell = this.createSetting("comboSetting", {
        key: "alchSpell",
        name: "Alchemy spell",
        section: this.alchSection,
        position: 0,
        default: 0,
        choices: [{ value: 0, label: "High Level Alchemy" }, { value: 1, label: "Low Level Alchemy" }],
    });

    alchMinValue = this.createSetting("intSetting", {
        key: "alchMinValue",
        name: "Drop items worth less than",
        section: this.alchSection,
        position: 1,
        default: 15,
        min: 0,
        max: 30,
        tooltip: "Held items worth fewer coins than this (after a price rotation) are dropped instead of alched.",
    });

    alchHoldCount = this.createSetting("intSetting", {
        key: "alchHoldCount",
        name: "Best items to hold",
        section: this.alchSection,
        position: 2,
        default: 1,
        min: 1,
        max: 5,
        tooltip: "How many of the best item to take from its cupboard before stopping to alch.",
    });

    alchDepositAt = this.createSetting("intSetting", {
        key: "alchDepositAt",
        name: "Deposit coins at",
        section: this.alchSection,
        position: 3,
        default: 1000,
        min: 100,
        max: 12000,
    });

    enchantLevel = this.createSetting("comboSetting", {
        key: "enchantLevel",
        name: "Enchant spell",
        section: this.enchSection,
        position: 0,
        default: 0,
        choices: [
            { value: 0, label: "Auto (highest castable)" },
            ...[1, 2, 3, 4, 5, 6, 7].map((level) => ({ value: level, label: `Lvl-${level} Enchant` })),
        ],
    });

    enchantBonusOnly = this.createSetting("boolSetting", {
        key: "enchantBonusOnly",
        name: "Take the bonus shape",
        section: this.enchSection,
        position: 1,
        default: true,
        tooltip: "Take shapes from the pile matching the bonus shape shown on the HUD (+2 points each).",
    });

    enchantDragonstones = this.createSetting("boolSetting", {
        key: "enchantDragonstones",
        name: "Pick up dragonstones",
        section: this.enchSection,
        position: 2,
        default: true,
    });

    graveSpell = this.createSetting("comboSetting", {
        key: "graveSpell",
        name: "Fruit spell",
        section: this.graveSection,
        position: 0,
        default: 0,
        choices: [
            { value: 0, label: "Auto (Peaches if unlocked)" },
            { value: 1, label: "Bones to Bananas" },
            { value: 2, label: "Bones to Peaches" },
        ],
    });

    graveEatPercent = this.createSetting("intSetting", {
        key: "graveEatPercent",
        name: "Eat below HP %",
        section: this.graveSection,
        position: 1,
        default: 50,
        min: 10,
        max: 90,
    });

    /** Last seen points, persisted so the goal survives restarts. */
    pointsStore = this.createSetting("stringSetting", {
        key: "trackedPoints",
        name: "Tracked points",
        section: this.generalSection,
        position: 99,
        default: "",
        hidden: true,
    });

    statusPanel = this.createOverlayPanel({
        name: "status",
        anchor: titan.OverlayAnchor.TopCenter,
        priority: 50,
        preferredWidth: 250,
        render: (panel) => {
            panel.title(this.name);
            panel.line("State", this.status);
            panel.line("Room", this.roomLabel());
            ROOMS.forEach((room) => {
                const done = this.goalReached(room);
                panel.line(ROOM_NAMES[room], `${this.pointsLabel(room)} / ${this.goalFor(room)}`,
                    0xFFFFFFFF, done ? 0xFF68CC92 : 0xFFFFFFFF);
            });
            panel.progressBar(Math.round(this.totalProgress() * 1000), 0, 1000, 0xFF9B7BFF, 0xFF24313A);
            if (this.running) panel.line("Runtime", this.formatDuration((this.tick - this.startTick) * 0.6));
        },
    });

    sceneOverlay = this.createOverlay({
        layer: titan.OverlayLayer.ABOVE_SCENE,
        render: () => this.renderScene(),
    });

    // ---- Runtime state ------------------------------------------------------
    running = false;
    status = "Stopped";
    tick = 0;
    startTick = 0;
    sleepTicks = 0;
    currentRoom = null;
    targetRoom = null;
    points = [null, null, null, null];
    pending = null;
    warned = new Set();
    errorCount = 0;
    tele = null;
    alch = null;
    ench = null;
    grave = null;

    // ---- Setting helpers (tolerate hosts missing a helper, like stallThieving) ----
    createSection(key, name, opts) {
        if (typeof this.section === "function") return this.section(key, name, opts);
        return undefined;
    }

    createSetting(kind, init) {
        if (typeof this[kind] === "function") return this[kind](init);
        return { key: init.key, name: init.name, value: init.default };
    }

    createOverlayPanel(init) {
        if (typeof this.overlayPanel === "function") return this.overlayPanel(init);
        return { name: init.name };
    }

    createOverlay(init) {
        if (typeof this.overlay === "function") return this.overlay(init);
        return init;
    }

    // ---- Lifecycle ----------------------------------------------------------
    onEnable() {
        this.loadPoints();
        this.resetState();
        this.log("enabled");
    }

    onDisable() {
        this.running = false;
        this.resetState();
        this.log("disabled");
    }

    toggleAutomation() {
        this.running = !this.running;
        this.resetState();
        this.startTick = this.tick;
        this.status = this.running ? "Starting" : "Stopped";
        this.log(this.running ? "started" : "stopped");
    }

    stop(reason) {
        this.running = false;
        this.status = reason;
        this.log(`stopped: ${reason}`);
    }

    resetState() {
        this.sleepTicks = 0;
        this.pending = null;
        this.currentRoom = null;
        this.targetRoom = null;
        this.errorCount = 0;
        this.warned.clear();
        this.resetRoomState();
    }

    resetRoomState() {
        this.tele = { maze: null, dir: null, standTile: null, castFrom: null, lastTile: null, settledTick: 0 };
        this.alch = {
            signature: "",
            costs: [-1, -1, -1, -1, -1],
            best: -1,
            cupboards: new Map(),   // world key -> live TileObject
            order: [],              // world keys, clockwise
            dir: 1,
            observations: [],       // { pos, item } with item 0..4 or EMPTY_CUPBOARD
            pendingSearch: null,
            emptyTick: -1,
            lastAlchTick: -100,
            bestCupboard: null,
        };
        this.ench = { phase: "collect", bonus: null, spell: null, spellTick: -100, castSlot: -1, castItem: -1, pile: null };
        this.grave = {};
    }

    onGameTick(tick) {
        this.tick = tick;
        if (!this.running) return;

        if (!titan.state.login.isWorldReady) {
            this.status = "Waiting for game";
            return;
        }

        this.readPoints();
        if (this.sleepTicks > 0) {
            this.sleepTicks--;
            return;
        }

        try {
            this.loop();
            this.errorCount = 0;
        } catch (error) {
            this.errorCount++;
            this.log(`error: ${error && error.stack ? error.stack : error}`);
            if (this.errorCount >= 10) this.stop("Stopped after repeated errors (see log)");
            else this.wait(2, 3);
        }
    }

    onChatMessage(event) {
        if (!this.running) return;
        const message = stripTags(event.message).toLowerCase();
        if (message.includes("cupboard is empty")) {
            this.alch.emptyTick = this.tick;
        } else if ((message.includes("do not have enough") || message.includes("don't have enough"))
            && message.includes("to cast")) {
            this.stop(`Out of supplies: ${stripTags(event.message)}`);
        } else if (message.includes("you need a magic level")) {
            this.stop(stripTags(event.message));
        }
    }

    // ---- Main loop ----------------------------------------------------------
    loop() {
        const current = this.detectRoom();
        if (current !== this.currentRoom) {
            this.log(`room: ${this.roomName(this.currentRoom)} -> ${this.roomName(current)}`);
            this.currentRoom = current;
            this.pending = null;
            this.resetRoomState();
        }

        const target = this.chooseTargetRoom();
        this.targetRoom = target;
        if (target === null) {
            if (current !== null && !this.cleanupRoom(current)) return;
            this.stop("Goal reached");
            return;
        }

        if (current !== null && current !== target) {
            this.leaveRoom(current);
            return;
        }

        if (current === null) {
            this.enterRoom(target);
            return;
        }

        switch (current) {
            case ROOM.TELEKINETIC: this.tickTelekinetic(); break;
            case ROOM.ALCHEMIST: this.tickAlchemist(); break;
            case ROOM.ENCHANTING: this.tickEnchanting(); break;
            case ROOM.GRAVEYARD: this.tickGraveyard(); break;
        }
    }

    chooseTargetRoom() {
        const mode = this.roomSetting.value;
        if (mode !== AUTO_ROOM) {
            return this.stopAtGoal.value && this.goalReached(mode) ? null : mode;
        }

        const open = ROOMS.filter((room) => !this.goalReached(room));
        if (open.length === 0) return null;
        if (this.currentRoom !== null && open.includes(this.currentRoom)) return this.currentRoom;
        return open.sort((a, b) => this.remainingFraction(b) - this.remainingFraction(a))[0];
    }

    detectRoom() {
        for (const room of ROOMS) {
            if (this.isWidgetVisible(WIDGET.ROOM_ROOT[room])) return room;
        }

        // HUD not readable: fall back to room landmarks.
        if (this.findGuardian()) return ROOM.TELEKINETIC;
        if (titan.queries.objects(SCAN_RADIUS).ids(...OBJ.CUPBOARDS).any()) return ROOM.ALCHEMIST;
        if (titan.queries.objects(SCAN_RADIUS).ids(...OBJ.SHAPE_PILES).any()) return ROOM.ENCHANTING;
        if (titan.queries.objects(SCAN_RADIUS).ids(...OBJ.BONE_PILES).any()) return ROOM.GRAVEYARD;
        return null;
    }

    enterRoom(room) {
        const portal = titan.queries.objects(SCAN_RADIUS).id(OBJ.PORTALS[room]).nearest();
        if (!portal) {
            this.status = `Looking for the ${ROOM_NAMES[room]} portal`;
            if (!this.walkFallback(COORDS.portals[room]) && !this.walkFallback(COORDS.lobby)) {
                this.status = `${ROOM_NAMES[room]} portal not in view - set COORDS.portals`;
            }
            this.wait(2, 3);
            return;
        }

        this.status = `Entering ${ROOM_NAMES[room]}`;
        if (this.interactPreferred(portal, ["Enter"])) this.wait(4, 6);
    }

    leaveRoom(room) {
        if (!this.cleanupRoom(room)) return;

        const portal = titan.queries.objects(SCAN_RADIUS).id(OBJ.RETURN_PORTAL).nearest();
        if (!portal) {
            this.status = "Looking for the exit portal";
            this.walkFallback(COORDS.roomCenters[room]);
            this.wait(2, 3);
            return;
        }

        this.status = `Leaving ${ROOM_NAMES[room]}`;
        if (this.interactPreferred(portal, ["Enter"])) this.wait(4, 6);
    }

    /** Bank anything worth points before leaving. True once nothing is left. */
    cleanupRoom(room) {
        switch (room) {
            case ROOM.ALCHEMIST:
                return titan.utils.inventory.count(ITEM.MTA_COINS) === 0 || !this.depositAlchemyCoins();
            case ROOM.ENCHANTING:
                return titan.utils.inventory.count(ITEM.ORB) === 0 || !this.depositOrbs();
            case ROOM.GRAVEYARD:
                return this.fruitCount() === 0 || !this.depositFruit();
            default:
                return true;
        }
    }

    // ---- Telekinetic Theatre -----------------------------------------------
    tickTelekinetic() {
        const t = this.tele;
        const guardian = this.findGuardian();
        if (!guardian) {
            this.status = "Looking for the maze guardian";
            this.walkFallback(COORDS.roomCenters[ROOM.TELEKINETIC]);
            this.wait(2, 3);
            return;
        }

        if (this.guardianIs(guardian, NPC_ID.GUARDIAN_DONE) || guardian.hasAction("New-maze")) {
            this.status = "Maze solved - starting a new maze";
            if (this.interactPreferred(guardian, ["New-maze"])) {
                t.maze = null;
                t.standTile = null;
                this.wait(3, 5);
            }
            return;
        }

        // The guardian slides a tile per tick; only plan from a tile it has settled on.
        const g = guardian.tile;
        if (tileKey(g) !== t.lastTile) {
            t.lastTile = tileKey(g);
            t.settledTick = this.tick;
        }
        if (this.guardianIs(guardian, NPC_ID.GUARDIAN_MOVING) || this.tick - t.settledTick < 1) {
            this.status = "Guardian sliding";
            return;
        }

        if (this.awaiting("telegrab", tileKey(g) !== t.castFrom, 6)) {
            this.status = "Waiting for the guardian to move";
            return;
        }

        if (!t.maze || t.maze.plane !== g.plane || !this.insideMaze(t.maze, g.x, g.y)) {
            t.maze = this.scanMaze(guardian);
        }
        if (!t.maze) {
            this.status = "Maze walls not found";
            this.wait(2, 3);
            return;
        }
        if (!t.maze.finish) {
            this.status = "Maze finish tile not found";
            this.wait(2, 3);
            return;
        }

        if (g.x === t.maze.finish.x && g.y === t.maze.finish.y) {
            this.status = "Guardian on the finish tile";
            return;
        }

        const dir = this.solveMaze(t.maze, g);
        t.dir = dir;
        if (!dir) {
            this.status = "No route found - resetting the maze";
            if (this.interactPreferred(guardian, ["Reset"])) {
                t.maze = null;
                this.wait(3, 5);
            }
            return;
        }

        const player = this.local();
        if (!player) return;
        const p = player.tile;
        t.standTile = this.mazeStandTile(t.maze, dir, g);

        const onSide = this.onMazeSide(t.maze, dir, p);
        const tooFar = t.standTile && chebyshev(p, g) > 10 && tileKey(p) !== tileKey(t.standTile);
        if (!onSide || tooFar) {
            if (!t.standTile) {
                this.status = `No free tile on the ${dir.name} side`;
                this.wait(2, 3);
                return;
            }
            this.status = `Moving to the ${dir.name} side`;
            const walkKey = `tele-walk:${tileKey(t.standTile)}`;
            if (!this.inProgress(walkKey, tileKey(p), 3)) {
                titan.state.walk.toScene(t.standTile.x, t.standTile.y);
                this.track(walkKey, tileKey(p));
            }
            return;
        }

        this.status = `Telegrabbing ${dir.name}`;
        if (guardian.castOn(titan.utils.magic.Standard.TELEKINETIC_GRAB)) {
            t.castFrom = tileKey(g);
            this.track("telegrab", t.castFrom);
            this.wait(1, 2);
        }
    }

    /** The maze statue, whether the host reports its id directly or as a morph transform. */
    findGuardian() {
        const ids = [NPC_ID.GUARDIAN, NPC_ID.GUARDIAN_MOVING, NPC_ID.GUARDIAN_DONE];
        return titan.queries.npcs().ids(...ids).nearest()
            || titan.queries.npcs().where((npc) => ids.includes(npc.overrideTransform)).nearest()
            || titan.queries.npcs().nameEquals("Maze Guardian").nearest();
    }

    guardianIs(guardian, npcId) {
        return guardian.id === npcId || guardian.overrideTransform === npcId;
    }

    /** Maze bounds (scene tiles) from the walls around the guardian, plus the finish tile. */
    scanMaze(guardian) {
        const radius = this.teleScanRadius.value;
        const walls = titan.queries.objects(SCAN_RADIUS)
            .id(OBJ.MAZE_WALL)
            .within(radius, guardian)
            .toArray();
        if (walls.length < 4) return null;

        const maze = {
            minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity,
            plane: guardian.tile.plane,
            finish: null,
        };
        walls.forEach((wall) => {
            maze.minX = Math.min(maze.minX, wall.tileX);
            maze.maxX = Math.max(maze.maxX, wall.tileX);
            maze.minY = Math.min(maze.minY, wall.tileY);
            maze.maxY = Math.max(maze.maxY, wall.tileY);
        });

        const finish = titan.queries.objects(SCAN_RADIUS)
            .id(OBJ.MAZE_FINISH)
            .within(radius, guardian)
            .nearestTo(guardian);
        if (finish) maze.finish = { x: finish.tileX, y: finish.tileY };
        return maze;
    }

    insideMaze(maze, x, y) {
        return x >= maze.minX && x <= maze.maxX && y >= maze.minY && y <= maze.maxY;
    }

    /** Where the guardian ends up when grabbed toward `dir`: it slides until blocked. */
    slide(maze, x, y, dir) {
        const collisions = titan.state.collisions;
        for (let steps = 0; steps < 32; steps++) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            if (!this.insideMaze(maze, nx, ny)) break;
            if (collisions.isBlocked(maze.plane, x, y, dir.dx, dir.dy)) break;
            x = nx;
            y = ny;
        }
        return { x, y };
    }

    /** Breadth-first search over slides; returns the first direction of a shortest solution. */
    solveMaze(maze, start) {
        const goal = `${maze.finish.x},${maze.finish.y}`;
        const startKey = `${start.x},${start.y}`;
        const firstDir = new Map([[startKey, null]]);
        const queue = [{ x: start.x, y: start.y }];

        while (queue.length > 0) {
            const node = queue.shift();
            const nodeKey = `${node.x},${node.y}`;
            for (const dir of DIRS) {
                const next = this.slide(maze, node.x, node.y, dir);
                const nextKey = `${next.x},${next.y}`;
                if (firstDir.has(nextKey)) continue;
                const first = firstDir.get(nodeKey) || dir;
                if (nextKey === goal) return first;
                firstDir.set(nextKey, first);
                queue.push(next);
            }
        }
        return null;
    }

    /** True when `tile` is on the side of the maze that pulls the guardian toward `dir`. */
    onMazeSide(maze, dir, tile) {
        if (tile.plane !== maze.plane) return false;
        const inColumn = tile.x >= maze.minX && tile.x <= maze.maxX;
        const inRow = tile.y >= maze.minY && tile.y <= maze.maxY;
        switch (dir.name) {
            case "north": return inColumn && tile.y > maze.maxY;
            case "south": return inColumn && tile.y < maze.minY;
            case "east": return inRow && tile.x > maze.maxX;
            case "west": return inRow && tile.x < maze.minX;
        }
        return false;
    }

    /** Closest walkable tile to the guardian on the side for `dir` (never a corner). */
    mazeStandTile(maze, dir, guardianTile) {
        const base = this.teleSideOffset.value;
        const vertical = dir.dy !== 0;
        const along = vertical
            ? { min: maze.minX, max: maze.maxX, origin: guardianTile.x }
            : { min: maze.minY, max: maze.maxY, origin: guardianTile.y };
        const edge = dir.name === "north" ? maze.maxY
            : dir.name === "south" ? maze.minY
                : dir.name === "east" ? maze.maxX : maze.minX;
        const outward = dir.dx + dir.dy;

        const positions = [];
        for (let v = along.min; v <= along.max; v++) positions.push(v);
        positions.sort((a, b) => Math.abs(a - along.origin) - Math.abs(b - along.origin));

        for (let offset = base; offset <= base + 2; offset++) {
            const across = edge + outward * offset;
            for (const v of positions) {
                const x = vertical ? v : across;
                const y = vertical ? across : v;
                if (this.isWalkable(maze.plane, x, y)) return { x, y, plane: maze.plane };
            }
        }
        return null;
    }

    isWalkable(plane, x, y) {
        const collisions = titan.state.collisions;
        const flag = collisions.flag(plane, x, y);
        if (flag < 0) return true;
        const F = collisions.Flag;
        const mask = (F.BLOCK_OBJECT | 0) | (F.BLOCK_FLOOR | 0) | (F.BLOCK_FULL | 0);
        return (flag & mask) === 0;
    }

    // ---- Alchemists' Playground --------------------------------------------
    tickAlchemist() {
        const a = this.alch;
        this.readAlchTable();
        this.refreshCupboards();
        this.resolveCupboardSearch();

        const inv = titan.utils.inventory;
        const coins = inv.count(ITEM.MTA_COINS);
        if (coins >= this.alchDepositAt.value) {
            this.depositAlchemyCoins();
            return;
        }

        const held = this.heldAlchItems();
        const junk = held.find((item) => {
            const value = this.alchValue(item.id);
            return value >= 0 && value < this.alchMinValue.value;
        });
        if (junk) {
            this.status = `Dropping ${junk.name}`;
            junk.interact("Drop");
            this.wait(0, 1);
            return;
        }

        // Alch between searches, but never while a search result is pending:
        // alching then would hide the item the search added.
        if (held.length > 0 && !a.pendingSearch && this.tick - a.lastAlchTick >= ALCH_COOLDOWN_TICKS) {
            const item = held.sort((l, r) => this.alchValue(r.id) - this.alchValue(l.id))[0];
            this.status = `Alching ${item.name} (${this.alchValue(item.id)} coins)`;
            if (item.castOn(this.alchemySpell())) {
                a.lastAlchTick = this.tick;
                this.wait(0, 1);
            }
            return;
        }

        if (a.pendingSearch) {
            this.status = "Searching cupboard";
            return;
        }

        const bestValue = a.best >= 0 ? a.costs[a.best] : -1;
        const bestHeld = held.filter((item) => this.alchValue(item.id) === bestValue).length;
        if (held.length > 0 && bestHeld >= this.alchHoldCount.value) {
            this.status = "Waiting for alch cooldown";
            return;
        }
        if (inv.emptySlots === 0) {
            if (coins > 0) this.depositAlchemyCoins();
            else this.stop("Inventory full - free some slots for alchemy items");
            return;
        }

        const target = this.pickCupboard();
        if (!target) {
            this.status = "No cupboards found";
            this.walkFallback(COORDS.roomCenters[ROOM.ALCHEMIST]);
            this.wait(2, 3);
            return;
        }

        this.status = a.bestCupboard === target.key ? "Taking the best item" : "Exploring cupboards";
        if (this.interactPreferred(target.obj, ["Search"])) {
            a.pendingSearch = { key: target.key, tick: this.tick, snapshot: this.alchItemCounts() };
        }
    }

    alchemySpell() {
        const spells = titan.utils.magic.Standard;
        return this.alchSpell.value === 1 ? spells.LOW_LEVEL_ALCHEMY : spells.HIGH_LEVEL_ALCHEMY;
    }

    /** Read the item/coin table from the room HUD; resets cupboard knowledge on a price rotation. */
    readAlchTable() {
        const a = this.alch;
        const costs = [-1, -1, -1, -1, -1];
        for (let row = 0; row < 5; row++) {
            const itemWidget = titan.state.widgets.find(WIDGET.ALCH_ITEM[row]);
            const costWidget = titan.state.widgets.find(WIDGET.ALCH_COST[row]);
            const cost = costWidget ? parseNumber(costWidget.text) : null;
            if (cost === null) continue;
            costs[this.alchRowItem(itemWidget, row)] = cost;
        }

        const signature = costs.join(",");
        if (costs.some((cost) => cost >= 0) && signature !== a.signature) {
            if (a.signature) this.log(`alchemy prices rotated: ${signature}`);
            a.signature = signature;
            a.observations = [];
            a.bestCupboard = null;
        }
        a.costs = costs;
        a.best = costs.reduce((best, cost, idx) => (cost > (best >= 0 ? costs[best] : -1) ? idx : best), -1);
    }

    /** Which alchemy item a price-table row refers to (widget item id, then name, then row order). */
    alchRowItem(widget, row) {
        if (widget) {
            const byId = ITEM.ALCH_ITEMS.indexOf(widget.itemId);
            if (byId >= 0) return byId;
            const text = stripTags(widget.text).toLowerCase();
            const byName = ALCH_ITEM_KEYWORDS.findIndex((keyword) => text.includes(keyword));
            if (byName >= 0) return byName;
        }
        return row;
    }

    alchValue(itemId) {
        const idx = ITEM.ALCH_ITEMS.indexOf(itemId);
        return idx >= 0 ? this.alch.costs[idx] : -1;
    }

    heldAlchItems() {
        return titan.queries.inventory().ids(...ITEM.ALCH_ITEMS).toArray();
    }

    alchItemCounts() {
        return ITEM.ALCH_ITEMS.map((id) => titan.queries.inventory().id(id).count());
    }

    /** Track the cupboards and their clockwise order around the room centre. */
    refreshCupboards() {
        const a = this.alch;
        const found = new Map();
        titan.queries.objects(SCAN_RADIUS).ids(...OBJ.CUPBOARDS).forEach((obj) => {
            const wp = obj.worldPoint;
            found.set(`${wp.x},${wp.y},${wp.z}`, obj);
        });
        a.cupboards = found;

        const keys = Array.from(found.keys());
        const sameSet = keys.length === a.order.length && keys.every((key) => a.order.includes(key));
        if (sameSet) return;

        const points = keys.map((key) => {
            const [x, y] = key.split(",").map(Number);
            return { key, x, y };
        });
        const cx = points.reduce((sum, p) => sum + p.x, 0) / Math.max(1, points.length);
        const cy = points.reduce((sum, p) => sum + p.y, 0) / Math.max(1, points.length);
        // Clockwise when viewed from above (north = +y): decreasing angle.
        points.sort((l, r) => Math.atan2(r.y - cy, r.x - cx) - Math.atan2(l.y - cy, l.x - cx));
        a.order = points.map((p) => p.key);
        a.observations = [];
        a.bestCupboard = null;
    }

    resolveCupboardSearch() {
        const a = this.alch;
        const search = a.pendingSearch;
        if (!search) return;

        const counts = this.alchItemCounts();
        const gained = counts.findIndex((count, idx) => count > search.snapshot[idx]);
        let item;
        if (gained >= 0) item = gained;
        else if (a.emptyTick >= search.tick) item = EMPTY_CUPBOARD;
        else if (this.tick - search.tick > 12) {
            a.pendingSearch = null;
            return;
        } else return;

        a.pendingSearch = null;
        this.recordCupboard(search.key, item);
    }

    /** Record what a cupboard held and re-check the clockwise-order inference. */
    recordCupboard(key, item) {
        const a = this.alch;
        const pos = a.order.indexOf(key);
        if (pos < 0) return;

        a.observations = a.observations.filter((obs) => obs.pos !== pos);
        a.observations.push({ pos, item });
        if (!this.cupboardsConsistent(a.dir)) {
            if (this.cupboardsConsistent(-a.dir)) {
                a.dir = -a.dir;
            } else {
                // Contradiction: the layout shuffled. Keep only the newest fact.
                a.observations = [{ pos, item }];
            }
        }
        a.bestCupboard = null;
    }

    predictCupboard(pos, dir) {
        const a = this.alch;
        const anchor = a.observations.find((obs) => obs.item !== EMPTY_CUPBOARD);
        if (!anchor || a.order.length < 5) return null;
        const item = mod(anchor.item + dir * (pos - anchor.pos), a.order.length);
        return item < 5 ? item : EMPTY_CUPBOARD;
    }

    cupboardsConsistent(dir) {
        return this.alch.observations.every((obs) => {
            const predicted = this.predictCupboard(obs.pos, dir);
            return predicted === null || predicted === obs.item;
        });
    }

    /** The cupboard holding the best item if it can be inferred, else the nearest unexplored one. */
    pickCupboard() {
        const a = this.alch;
        const player = this.local();
        if (!player || a.order.length === 0) return null;

        if (a.best >= 0) {
            for (let pos = 0; pos < a.order.length; pos++) {
                const key = a.order[pos];
                if (this.predictCupboard(pos, a.dir) === a.best && a.cupboards.has(key)) {
                    a.bestCupboard = key;
                    return { key, obj: a.cupboards.get(key) };
                }
            }
        }
        a.bestCupboard = null;

        const explored = new Set(a.observations.map((obs) => a.order[obs.pos]));
        let candidates = a.order.filter((key) => !explored.has(key) && a.cupboards.has(key));
        if (candidates.length === 0) {
            a.observations = [];
            candidates = a.order.filter((key) => a.cupboards.has(key));
        }
        candidates.sort((l, r) => player.distanceTo(a.cupboards.get(l).tile)
            - player.distanceTo(a.cupboards.get(r).tile));
        const key = candidates[0];
        return key ? { key, obj: a.cupboards.get(key) } : null;
    }

    /** Deposit coins; returns true while the deposit is being worked on. */
    depositAlchemyCoins() {
        const coins = titan.utils.inventory.count(ITEM.MTA_COINS);
        return this.depositInto(OBJ.COIN_COLLECTOR, "Depositing coins", coins, COORDS.alchemistCollector);
    }

    // ---- Enchanting Chamber -------------------------------------------------
    tickEnchanting() {
        const e = this.ench;
        const inv = titan.utils.inventory;
        const spell = this.enchantSpell();
        if (!spell) {
            this.stop("No castable enchant spell (check level, runes and staff)");
            return;
        }
        e.bonus = this.readBonusShape();

        if (this.enchantDragonstones.value && inv.emptySlots > 0) {
            const dragonstone = titan.queries.groundItems(20).id(ITEM.DRAGONSTONE).nearest();
            if (dragonstone) {
                this.status = "Picking up a dragonstone";
                if (!this.inProgress("dragonstone", inv.size, 4)) {
                    dragonstone.interact("Take");
                    this.track("dragonstone", inv.size);
                }
                return;
            }
        }

        const enchantable = titan.queries.inventory().ids(...ENCHANTABLE).toArray();
        const orbs = inv.count(ITEM.ORB);

        if (e.phase === "collect" && inv.emptySlots === 0) {
            if (enchantable.length === 0 && orbs === 0) {
                this.stop("Inventory full - free some slots for shapes");
                return;
            }
            e.phase = "enchant";
        }

        if (e.phase === "enchant") {
            if (enchantable.length === 0) {
                e.phase = orbs > 0 ? "deposit" : "collect";
            } else {
                const slotStillHolds = titan.queries.inventory().slot(e.castSlot).id(e.castItem).any();
                if (this.awaiting("enchant", !slotStillHolds, 5)) {
                    this.status = "Enchanting";
                    return;
                }
                const next = this.nextEnchantTarget(enchantable, e.bonus);
                this.status = `Enchanting ${next.name}`;
                if (next.castOn(spell)) {
                    e.castSlot = next.slot;
                    e.castItem = next.id;
                    this.track("enchant", next.slot);
                }
                return;
            }
        }

        if (e.phase === "deposit") {
            if (orbs === 0) {
                e.phase = "collect";
            } else {
                this.depositOrbs();
                return;
            }
        }

        const pile = this.pickShapePile(e.bonus);
        e.pile = pile;
        if (!pile) {
            this.status = "No shape piles found";
            this.walkFallback(COORDS.roomCenters[ROOM.ENCHANTING]);
            this.wait(2, 3);
            return;
        }
        this.status = `Taking ${this.pileShape(pile) || "shapes"}`;
        const pileKey = `collect:${pile.tileX},${pile.tileY}`;
        if (!this.inProgress(pileKey, inv.size, 4)) {
            if (this.interactPreferred(pile, ["Take-from", "Take"])) this.track(pileKey, inv.size);
        }
    }

    enchantSpell() {
        const e = this.ench;
        const standard = titan.utils.magic.Standard;
        const spells = [
            standard.LVL_1_ENCHANT, standard.LVL_2_ENCHANT, standard.LVL_3_ENCHANT, standard.LVL_4_ENCHANT,
            standard.LVL_5_ENCHANT, standard.LVL_6_ENCHANT, standard.LVL_7_ENCHANT,
        ];
        const choice = this.enchantLevel.value;
        if (choice > 0) return spells[choice - 1];

        // canCast is re-checked every ~30s rather than every tick.
        if (!e.spell || this.tick - e.spellTick > 50) {
            e.spell = null;
            e.spellTick = this.tick;
            for (let level = spells.length - 1; level >= 0; level--) {
                if (titan.utils.magic.canCast(spells[level])) {
                    e.spell = spells[level];
                    break;
                }
            }
        }
        return e.spell;
    }

    /** The shape the HUD marks as the current +2 bonus, or null when unreadable. */
    readBonusShape() {
        const visible = SHAPES.filter((shape) => this.isWidgetVisible(shape.layer)
            && this.isWidgetVisible(shape.icon));
        return visible.length === 1 ? visible[0] : null;
    }

    nextEnchantTarget(items, bonus) {
        const rank = (item) => item.id === ITEM.DRAGONSTONE ? 0 : bonus && item.id === bonus.item ? 1 : 2;
        return items.sort((l, r) => rank(l) - rank(r) || l.slot - r.slot)[0];
    }

    pileShape(pile) {
        const name = String(pile.name || "").toLowerCase();
        const shape = SHAPES.find((candidate) => name.includes(candidate.key));
        return shape ? shape.key : null;
    }

    pickShapePile(bonus) {
        const piles = titan.queries.objects(SCAN_RADIUS).ids(...OBJ.SHAPE_PILES).toArray();
        const player = this.local();
        if (piles.length === 0 || !player) return null;
        piles.sort((l, r) => player.distanceTo(l.tile) - player.distanceTo(r.tile));
        if (this.enchantBonusOnly.value && bonus) {
            const bonusPile = piles.find((pile) => this.pileShape(pile) === bonus.key);
            if (bonusPile) return bonusPile;
        }
        return piles[0];
    }

    depositOrbs() {
        const orbs = titan.utils.inventory.count(ITEM.ORB);
        return this.depositInto(OBJ.ENCHANT_HOLE, "Depositing orbs", orbs, COORDS.enchantingHole);
    }

    // ---- Creature Graveyard -------------------------------------------------
    tickGraveyard() {
        const inv = titan.utils.inventory;
        const skills = titan.state.skills;
        const hp = skills.boosted(titan.Skill.HITPOINTS);
        const maxHp = Math.max(1, skills.real(titan.Skill.HITPOINTS));
        if (hp * 100 < this.graveEatPercent.value * maxHp) {
            const food = this.pickFood();
            if (food) {
                this.status = `Eating ${food.name}`;
                food.interact("Eat");
                this.wait(2, 3);
                return;
            }
            this.warnOnce("grave-food", "HP is low and there is no food to eat");
        }

        const bones = titan.queries.inventory().ids(...ITEM.BONES).toArray();
        const fruitValue = bones.reduce((sum, bone) => sum + (BONE_FRUIT[bone.id] || 0), 0);
        const usePeaches = this.useBonesToPeaches();
        const capacity = inv.emptySlots + bones.length;
        const target = Math.min(usePeaches ? PEACHES_PER_DEPOSIT : capacity, capacity);

        // Stop grabbing once another bone (worth up to 4 fruit) could overflow the inventory.
        if (bones.length > 0 && (fruitValue >= target || fruitValue + 4 > capacity || inv.emptySlots === 0)) {
            if (this.awaiting("bones-to-fruit", false, 5)) {
                this.status = "Casting";
                return;
            }
            const spells = titan.utils.magic.Standard;
            const spell = usePeaches ? spells.BONES_TO_PEACHES : spells.BONES_TO_BANANAS;
            this.status = usePeaches ? "Casting Bones to Peaches" : "Casting Bones to Bananas";
            if (titan.utils.magic.cast(spell)) this.track("bones-to-fruit", fruitValue);
            return;
        }

        if (bones.length === 0 && this.fruitCount() > 0) {
            this.depositFruit();
            return;
        }

        const pile = titan.queries.objects(SCAN_RADIUS).ids(...OBJ.BONE_PILES).nearest();
        if (!pile) {
            this.status = "No bone piles found";
            this.walkFallback(COORDS.roomCenters[ROOM.GRAVEYARD]);
            this.wait(2, 3);
            return;
        }
        this.status = `Grabbing bones (${fruitValue}/${target} fruit)`;
        if (!this.inProgress("grab-bones", bones.length, 3)) {
            if (this.interactPreferred(pile, ["Grab"])) this.track("grab-bones", bones.length);
        }
    }

    useBonesToPeaches() {
        const choice = this.graveSpell.value;
        if (choice === 1) return false;
        if (choice === 2) return true;
        return titan.state.vars.varbit(VARBIT_PEACHES_UNLOCKED) > 0;
    }

    fruitCount() {
        return titan.utils.inventory.count([ITEM.BANANA, ITEM.PEACH]);
    }

    /** Peaches heal the most; bananas are the last resort since they're worth points. */
    pickFood() {
        const edible = titan.queries.inventory().hasAction("Eat").toArray();
        const rank = (item) => item.id === ITEM.PEACH ? 0 : item.id === ITEM.BANANA ? 2 : 1;
        return edible.sort((l, r) => rank(l) - rank(r))[0] || null;
    }

    depositFruit() {
        return this.depositInto(OBJ.FOOD_CHUTE, "Depositing fruit", this.fruitCount(), COORDS.graveyardChute);
    }

    // ---- Shared actions -----------------------------------------------------
    /**
     * Use the "Deposit" option of `objectId` until `amount` stops dropping.
     * Returns true while it acted (or is waiting on the deposit).
     */
    depositInto(objectId, label, amount, fallback) {
        this.status = label;
        const target = titan.queries.objects(SCAN_RADIUS).id(objectId).nearest();
        if (!target) {
            if (!this.walkFallback(fallback)) this.status = `${label}: target not in view`;
            this.wait(2, 3);
            return true;
        }
        const key = `deposit:${objectId}`;
        if (!this.inProgress(key, amount, 4)) {
            if (this.interactPreferred(target, ["Deposit"])) this.track(key, amount);
        }
        return true;
    }

    /**
     * Interact using the first preferred action the entity actually offers
     * (exact match, then substring). When the host exposes no action list,
     * the first preference is tried blindly.
     */
    interactPreferred(entity, preferred) {
        if (!entity) return false;
        const actions = (entity.actions || []).filter((action) => action);
        if (actions.length === 0) return entity.interact(preferred[0]);

        for (const want of preferred) {
            const match = actions.find((action) => action.toLowerCase() === want.toLowerCase());
            if (match) return entity.interact(match);
        }
        for (const want of preferred) {
            const match = actions.find((action) => action.toLowerCase().includes(want.toLowerCase()));
            if (match) return entity.interact(match);
        }
        this.warnOnce(`actions:${entity.name}`,
            `${entity.name} has no ${preferred.join("/")} action (has: ${actions.join(", ")})`);
        return false;
    }

    /** Walk toward a COORDS entry. False when the entry is still the 0,0,0 template. */
    walkFallback(point) {
        if (!isSet(point)) return false;
        const player = this.local();
        if (player && !player.isStationary) return true;
        return titan.state.walk.toWorld(point.x, point.y, point.z);
    }

    /** Start tracking an action whose effect shows up as a change in `value`. */
    track(key, value) {
        this.pending = { key, value, tick: this.tick, lastChange: this.tick };
    }

    /**
     * Continuous actions (taking shapes, grabbing bones, walking): true while
     * `value` keeps changing, or hasn't been still for `stallTicks` yet.
     */
    inProgress(key, value, stallTicks) {
        const p = this.pending;
        if (!p || p.key !== key) return false;
        if (value !== p.value) {
            p.value = value;
            p.lastChange = this.tick;
        }
        return this.tick - p.lastChange < stallTicks;
    }

    /** One-shot actions (casts): true until `done` or `timeoutTicks` since the action. */
    awaiting(key, done, timeoutTicks) {
        const p = this.pending;
        if (!p || p.key !== key) return false;
        if (done) {
            this.pending = null;
            return false;
        }
        return this.tick - p.tick < timeoutTicks;
    }

    wait(min, max) {
        this.sleepTicks = randInt(min, max) + randInt(0, this.tickJitter.value | 0);
    }

    // ---- Points -------------------------------------------------------------
    readPoints() {
        let changed = false;
        ROOMS.forEach((room) => {
            let value = null;
            if (this.isWidgetVisible(WIDGET.ROOM_POINTS[room])) {
                value = parseNumber(titan.state.widgets.find(WIDGET.ROOM_POINTS[room]).text);
            }
            if (this.isWidgetVisible(WIDGET.LOBBY_POINTS[room])) {
                value = parseNumber(titan.state.widgets.find(WIDGET.LOBBY_POINTS[room]).text);
            }
            if (value !== null && value !== this.points[room]) {
                this.points[room] = value;
                changed = true;
            }
        });
        if (changed) this.pointsStore.value = JSON.stringify(this.points);
    }

    loadPoints() {
        try {
            const saved = JSON.parse(this.pointsStore.value || "null");
            if (Array.isArray(saved) && saved.length === 4) this.points = saved;
        } catch (error) {
            this.points = [null, null, null, null];
        }
    }

    resetTrackedPoints() {
        this.points = [null, null, null, null];
        this.pointsStore.value = "";
    }

    goalFor(room) {
        return this.goalSettings[room].value;
    }

    goalReached(room) {
        return this.points[room] !== null && this.points[room] >= this.goalFor(room);
    }

    remainingFraction(room) {
        const goal = this.goalFor(room);
        if (goal <= 0) return 0;
        return Math.max(0, goal - (this.points[room] || 0)) / goal;
    }

    totalProgress() {
        const goal = ROOMS.reduce((sum, room) => sum + this.goalFor(room), 0);
        if (goal <= 0) return 1;
        const earned = ROOMS.reduce((sum, room) => sum + Math.min(this.points[room] || 0, this.goalFor(room)), 0);
        return earned / goal;
    }

    // ---- Overlay ------------------------------------------------------------
    renderScene() {
        if (!this.running || this.currentRoom === null) return;
        const overlay = titan.overlay;

        if (this.currentRoom === ROOM.TELEKINETIC && this.tele.maze) {
            const { maze, standTile } = this.tele;
            if (standTile) overlay.tileQuad(standTile.x, standTile.y, standTile.plane, 0x5500FF88, 0xFF00FF88);
            if (maze.finish) overlay.tileQuad(maze.finish.x, maze.finish.y, maze.plane, 0x55FFD700, 0xFFFFD700);
        } else if (this.currentRoom === ROOM.ALCHEMIST && this.alch.bestCupboard) {
            const cupboard = this.alch.cupboards.get(this.alch.bestCupboard);
            if (cupboard) overlay.tileObjectHull(cupboard, 0xFF00FF88, 0x3300FF88);
        } else if (this.currentRoom === ROOM.ENCHANTING && this.ench.pile && this.ench.pile.exists) {
            overlay.tileObjectHull(this.ench.pile, 0xFF9B7BFF, 0x339B7BFF);
        }
    }

    // ---- Misc ---------------------------------------------------------------
    local() {
        return titan.state.client.localPlayer;
    }

    isWidgetVisible(packedId) {
        const widget = titan.state.widgets.find(packedId);
        return !!widget && widget.exists !== false && widget.visible && !widget.hidden;
    }

    roomName(room) {
        return room === null ? "lobby" : ROOM_NAMES[room];
    }

    roomLabel() {
        const target = this.targetRoom === null ? "-" : ROOM_NAMES[this.targetRoom];
        if (this.currentRoom === null) return `Lobby -> ${target}`;
        return ROOM_NAMES[this.currentRoom];
    }

    pointsLabel(room) {
        return this.points[room] === null ? "?" : this.points[room].toLocaleString();
    }

    formatDuration(seconds) {
        const total = Math.floor(seconds);
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }

    log(message) {
        titan.log(`[Prof] MTA ${message}`);
    }

    warnOnce(key, message) {
        if (this.warned.has(key)) return;
        this.warned.add(key);
        this.log(message);
    }
}

titan.register(new MageTrainingArenaPlugin());
