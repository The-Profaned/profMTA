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
// HUD / session stats
// ---------------------------------------------------------------------------
const ALCH_ITEM_NAMES = ["Boots", "Kiteshield", "Helm", "Emerald", "Longsword"];

// NATURERUNE / LAWRUNE / COSMICRUNE
const RUNE = Object.freeze({ NATURE: 561, LAW: 563, COSMIC: 564 });

/** The rune each room's spell uses up, indexed by ROOM. */
const ROOM_RUNES = [
    { id: RUNE.LAW, name: "Law" },
    { id: RUNE.NATURE, name: "Nature" },
    { id: RUNE.COSMIC, name: "Cosmic" },
    { id: RUNE.NATURE, name: "Nature" },
];

/** Items handed in for points in each room, indexed by ROOM. */
const DEPOSIT_ITEMS = [null, [ITEM.MTA_COINS], [ITEM.ORB], [ITEM.BANANA, ITEM.PEACH]];
const DEPOSIT_NAMES = ["", "coins", "orbs", "fruit"];

const COLOR = Object.freeze({
    ACCENT: 0xFF9B7BFF,
    XP: 0xFF7FB2FF,
    GOOD: 0xFF68CC92,
    WARN: 0xFFFFD166,
    BAD: 0xFFFF6B6B,
    TEXT: 0xFFFFFFFF,
    DIM: 0xFFA0A8B0,
    BAR_BG: 0xFF24313A,
});

const TICKS_PER_HOUR = 6000;
/** Hourly rates stay hidden until this much data (~30s) exists. */
const RATE_MIN_TICKS = 50;
/** A single points read jumping by more than this is a widget glitch, not a gain. */
const MAX_POINT_STEP = 500;
const EVENT_LOG_SIZE = 30;
const HUD_STATUS_CHARS = 34;

/** ImGuiTableColumnFlags (Dear ImGui 1.92, as embedded in the client) for panel.tableSetupColumn. */
const IMGUI_COLUMN = Object.freeze({ WIDTH_STRETCH: 1 << 3, WIDTH_FIXED: 1 << 4 });
/** Pixels for side-panel value columns; fits "12h 30m" and "1,234,567". */
const VALUE_COLUMN_WIDTH = 72;

// ---------------------------------------------------------------------------
// Error log
// ---------------------------------------------------------------------------
/** Actions kept for context in each error report. */
const CRUMB_LIMIT = 15;
const REPORT_LIMIT = 10;
/** The same action failing this many times in a row is reported. */
const FAIL_STREAK_LIMIT = 3;
const REPORT_KINDS = {
    error: { label: "Script error", tone: 4, color: COLOR.BAD },
    stop: { label: "Stopped", tone: 4, color: COLOR.BAD },
    stuck: { label: "No progress", tone: 3, color: COLOR.WARN },
    failing: { label: "Action failing", tone: 3, color: COLOR.WARN },
    warning: { label: "Warning", tone: 3, color: COLOR.WARN },
};

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

/** Total experience needed for `level`. */
function xpForLevel(level) {
    let total = 0;
    for (let current = 1; current < level; current++) {
        total += Math.floor(current + 300 * Math.pow(2, current / 7));
    }
    return Math.floor(total / 4);
}

/** 1,240 / 45.2k / 1.23m */
function formatShort(value) {
    const n = Math.floor(value);
    if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(2)}m`;
    if (Math.abs(n) >= 10000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
}

/** 45s / 8m 20s / 2h 05m */
function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    if (minutes > 0) return `${minutes}m ${String(total % 60).padStart(2, "0")}s`;
    return `${total}s`;
}

function formatTicks(ticks) {
    return formatDuration(ticks * 0.6);
}

/** Local wall-clock time as HH:MM:SS. */
function clockTime() {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
}

function truncate(text, max) {
    const s = String(text || "");
    return s.length > max ? `${s.slice(0, max - 1)}.` : s;
}

function capitalize(text) {
    const s = String(text || "");
    return s.charAt(0).toUpperCase() + s.slice(1);
}

class MageTrainingArenaPlugin extends titan.Plugin {
    id = "prof_mta";
    name = "[Prof] Mage Training Arena";
    description = "Runs the selected Mage Training Arena room for pizazz points.";
    author = "Prof";
    version = "0.2.0";

    enabled = false;

    panels = [{
        id: "main",
        title: "MTA",
        icon: "lucide:wand-sparkles",
        iconColor: COLOR.ACCENT,
        build: (panel) => this.buildSidePanel(panel),
        onAction: (actionId) => this.onPanelAction(actionId),
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
    hudSection = this.createSection("hud", "HUD", { position: 6, closedByDefault: true });

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

    showHud = this.createSetting("boolSetting", {
        key: "showHud",
        name: "Show HUD",
        section: this.hudSection,
        position: 0,
        default: true,
    });

    hudDetail = this.createSetting("comboSetting", {
        key: "hudDetail",
        name: "HUD layout",
        section: this.hudSection,
        position: 1,
        default: 1,
        choices: [{ value: 0, label: "Compact" }, { value: 1, label: "Detailed" }],
        tooltip: "Compact shows state, XP/h and points/h. Detailed adds level progress, room details and supplies.",
    });

    hudShowGoals = this.createSetting("boolSetting", {
        key: "hudShowGoals",
        name: "Show all room goals",
        section: this.hudSection,
        position: 2,
        default: true,
    });

    hudEventLines = this.createSetting("intSetting", {
        key: "hudEventLines",
        name: "Recent events shown",
        section: this.hudSection,
        position: 3,
        default: 4,
        min: 0,
        max: 8,
    });

    stuckMinutes = this.createSetting("intSetting", {
        key: "stuckMinutes",
        name: "Report no progress after (min)",
        section: this.hudSection,
        position: 5,
        default: 3,
        min: 1,
        max: 15,
        tooltip: "Adds an error report when neither points nor Magic XP have gone up for this long.",
    });

    sceneLabels = this.createSetting("boolSetting", {
        key: "sceneLabels",
        name: "Label targets in the scene",
        section: this.hudSection,
        position: 4,
        default: true,
        tooltip: "Text over the stand tile, maze finish, cupboard contents and the shape pile being used.",
    });

    statusPanel = this.createOverlayPanel({
        name: "status",
        anchor: titan.OverlayAnchor.TopCenter,
        priority: 50,
        preferredWidth: 260,
        render: (panel) => this.guardRender("HUD", () => this.renderHud(panel)),
    });

    sceneOverlay = this.createOverlay({
        layer: titan.OverlayLayer.ABOVE_SCENE,
        render: () => this.guardRender("scene overlay", () => this.renderScene()),
    });

    // ---- Runtime state ------------------------------------------------------
    running = false;
    status = "Stopped";
    tick = 0;
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
    session = this.newSession();
    events = [];
    crumbs = [];            // last CRUMB_LIMIT actions, newest last
    reports = [];           // newest first
    reportSeq = 0;
    dismissedReport = 0;    // highest report id the player has dismissed
    failStreak = { text: "", count: 0 };
    stuckReported = false;
    renderErrors = new Set();

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
        this.status = this.running ? "Starting" : "Stopped";
        // Anything gained while stopped (manual play) isn't the script's doing.
        if (this.running) this.rebaselineSession();
        this.event(this.running ? "Started" : "Stopped by user", this.running ? COLOR.GOOD : COLOR.DIM);
        this.crumb(this.running ? `Started (${this.roomLabelForMode()})` : "Stopped by user", "info");
    }

    /** Stop the run. Pass `details` ({ why, fix }) when it stopped because something went wrong. */
    stop(reason, details) {
        // Report first so it captures what the script was doing, not the stop reason.
        if (details) this.report("stop", `Stopped: ${reason}`, details.why, details.fix);
        this.crumb(`Stopped: ${reason}`, "info");
        this.running = false;
        this.status = reason;
        this.event(`Stopped: ${reason}`, details ? COLOR.BAD : COLOR.GOOD);
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
        this.tele = {
            maze: null, dir: null, standTile: null, castFrom: null, lastTile: null, settledTick: 0,
            guardianTile: null, moves: null, solved: false,
        };
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
        this.grave = { fruitValue: 0, target: 0, bones: 0, peaches: false };
    }

    onGameTick(tick) {
        this.tick = tick;
        if (!this.running) return;

        if (!titan.state.login.isWorldReady) {
            this.status = "Waiting for game";
            return;
        }

        try {
            this.readPoints();
            this.updateSession();
            this.checkStuck();
            if (this.sleepTicks > 0) {
                this.sleepTicks--;
                return;
            }
            this.loop();
            this.errorCount = 0;
        } catch (error) {
            this.errorCount++;
            this.reportException(error);
            if (this.errorCount >= 10) {
                this.stop("Stopped after repeated errors", {
                    why: "The same tick handler threw 10 times in a row, so the script gave up.",
                    fix: "See the script error report below; use 'Write to client log' and send it in.",
                });
            } else this.wait(2, 3);
        }
    }

    onChatMessage(event) {
        if (!this.running) return;
        const message = stripTags(event.message).toLowerCase();
        if (message.includes("cupboard is empty")) {
            this.alch.emptyTick = this.tick;
        } else if ((message.includes("do not have enough") || message.includes("don't have enough"))
            && message.includes("to cast")) {
            this.stop("Out of supplies", {
                why: `The game said: "${stripTags(event.message)}"`,
                fix: "Restock the runes for this room (check the staff and rune pouch too), then start again.",
            });
        } else if (message.includes("you need a magic level")) {
            this.stop("Magic level too low", {
                why: `The game said: "${stripTags(event.message)}"`,
                fix: "Pick a lower spell in the room's settings, or train Magic first.",
            });
        } else if (message.includes("can't reach") || message.includes("cannot reach")) {
            this.crumb(`Game: ${stripTags(event.message)}`, "fail");
        }
    }

    // ---- Main loop ----------------------------------------------------------
    loop() {
        const current = this.detectRoom();
        if (current !== this.currentRoom) {
            this.log(`room: ${this.roomName(this.currentRoom)} -> ${this.roomName(current)}`);
            this.event(current === null ? `Left ${ROOM_NAMES[this.currentRoom]}` : `Entered ${ROOM_NAMES[current]}`);
            this.crumb(current === null ? `Now in the lobby` : `Now in ${ROOM_NAMES[current]}`, "info");
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
            if (!t.solved) {
                t.solved = true;
                this.session.mazes++;
                this.event(`Maze solved (#${this.session.mazes})`, COLOR.GOOD);
            }
            this.status = "Maze solved - starting a new maze";
            if (this.interactPreferred(guardian, ["New-maze"])) {
                t.maze = null;
                t.standTile = null;
                t.moves = null;
                this.wait(3, 5);
            }
            return;
        }
        t.solved = false;

        // The guardian slides a tile per tick; only plan from a tile it has settled on.
        const g = guardian.tile;
        t.guardianTile = { x: g.x, y: g.y, plane: g.plane };
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
            t.moves = 0;
            this.status = "Guardian on the finish tile";
            return;
        }

        const solution = this.solveMaze(t.maze, g);
        const dir = solution ? solution.dir : null;
        t.dir = dir;
        t.moves = solution ? solution.moves : null;
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
                this.action(`Walk to the ${dir.name} side`, titan.state.walk.toScene(t.standTile.x, t.standTile.y));
                this.track(walkKey, tileKey(p));
            }
            return;
        }

        this.status = `Telegrabbing ${dir.name}`;
        if (this.action(`Telekinetic Grab (${dir.name})`,
            guardian.castOn(titan.utils.magic.Standard.TELEKINETIC_GRAB))) {
            this.session.casts++;
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

    /**
     * Breadth-first search over slides. Returns the first direction of a
     * shortest solution and its length in grabs, or null when unsolvable.
     */
    solveMaze(maze, start) {
        const goal = `${maze.finish.x},${maze.finish.y}`;
        const startKey = `${start.x},${start.y}`;
        const seen = new Map([[startKey, { first: null, depth: 0 }]]);
        const queue = [{ x: start.x, y: start.y }];

        while (queue.length > 0) {
            const node = queue.shift();
            const info = seen.get(`${node.x},${node.y}`);
            for (const dir of DIRS) {
                const next = this.slide(maze, node.x, node.y, dir);
                const nextKey = `${next.x},${next.y}`;
                if (seen.has(nextKey)) continue;
                const step = { first: info.first || dir, depth: info.depth + 1 };
                if (nextKey === goal) return { dir: step.first, moves: step.depth };
                seen.set(nextKey, step);
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
            this.action(`Drop ${junk.name}`, junk.interact("Drop"));
            this.wait(0, 1);
            return;
        }

        // Alch between searches, but never while a search result is pending:
        // alching then would hide the item the search added.
        if (held.length > 0 && !a.pendingSearch && this.tick - a.lastAlchTick >= ALCH_COOLDOWN_TICKS) {
            const item = held.sort((l, r) => this.alchValue(r.id) - this.alchValue(l.id))[0];
            this.status = `Alching ${item.name} (${this.alchValue(item.id)} coins)`;
            if (this.action(`Alch ${item.name}`, item.castOn(this.alchemySpell()))) {
                this.session.casts++;
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
            else this.stop("Inventory full - free some slots for alchemy items", {
                why: "Every slot is taken and there are no coins to deposit, so no cupboard item can be taken.",
                fix: "Free a few inventory slots and start again.",
            });
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
            if (a.signature) {
                this.log(`alchemy prices rotated: ${signature}`);
                const best = costs.indexOf(Math.max(...costs));
                this.event(`Prices rotated - best: ${ALCH_ITEM_NAMES[best]}`);
            }
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
            this.stop("No castable enchant spell (check level, runes and staff)", {
                why: this.enchantLevel.value > 0
                    ? `Lvl-${this.enchantLevel.value} Enchant was chosen in settings but can't be resolved.`
                    : "No Lvl-1..7 Enchant spell can be cast with the current level, runes and staff.",
                fix: "Check cosmic runes plus the elemental runes/staff for the spell, or pick a lower spell.",
            });
            return;
        }
        e.bonus = this.readBonusShape();

        if (this.enchantDragonstones.value && inv.emptySlots > 0) {
            const dragonstone = titan.queries.groundItems(20).id(ITEM.DRAGONSTONE).nearest();
            if (dragonstone) {
                this.status = "Picking up a dragonstone";
                if (!this.inProgress("dragonstone", inv.size, 4)) {
                    this.action("Take dragonstone", dragonstone.interact("Take"));
                    this.track("dragonstone", inv.size);
                }
                return;
            }
        }

        const enchantable = titan.queries.inventory().ids(...ENCHANTABLE).toArray();
        const orbs = inv.count(ITEM.ORB);

        if (e.phase === "collect" && inv.emptySlots === 0) {
            if (enchantable.length === 0 && orbs === 0) {
                this.stop("Inventory full - free some slots for shapes", {
                    why: "Every slot is taken and none of it is a shape, dragonstone or orb.",
                    fix: "Free inventory slots (only runes/staff are needed here) and start again.",
                });
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
                if (this.action(`${spell.name || "Enchant"} on ${next.name}`, next.castOn(spell))) {
                    this.session.casts++;
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
                this.action(`Eat ${food.name}`, food.interact("Eat"));
                this.session.eaten++;
                this.session.lastEatTick = this.tick;
                this.wait(2, 3);
                return;
            }
            this.warnOnce("grave-food", "HP is low and there is no food to eat",
                `HP is ${hp}/${maxHp}, below the ${this.graveEatPercent.value}% eat threshold, `
                + "and nothing in the inventory has an Eat option.",
                "Bring food, or let the plugin keep some bananas/peaches by lowering the eat threshold.");
        }

        const bones = titan.queries.inventory().ids(...ITEM.BONES).toArray();
        const fruitValue = bones.reduce((sum, bone) => sum + (BONE_FRUIT[bone.id] || 0), 0);
        const usePeaches = this.useBonesToPeaches();
        const capacity = inv.emptySlots + bones.length;
        const target = Math.min(usePeaches ? PEACHES_PER_DEPOSIT : capacity, capacity);
        Object.assign(this.grave, { fruitValue, target, bones: bones.length, peaches: usePeaches });

        // Stop grabbing once another bone (worth up to 4 fruit) could overflow the inventory.
        if (bones.length > 0 && (fruitValue >= target || fruitValue + 4 > capacity || inv.emptySlots === 0)) {
            if (this.awaiting("bones-to-fruit", false, 5)) {
                this.status = "Casting";
                return;
            }
            const spells = titan.utils.magic.Standard;
            const spell = usePeaches ? spells.BONES_TO_PEACHES : spells.BONES_TO_BANANAS;
            this.status = usePeaches ? "Casting Bones to Peaches" : "Casting Bones to Bananas";
            if (this.action(spell.name || "Bones to fruit", titan.utils.magic.cast(spell))) {
                this.session.casts++;
                this.track("bones-to-fruit", fruitValue);
            }
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
        const target = entity.name || "object";
        const actions = (entity.actions || []).filter((action) => action);
        if (actions.length === 0) return this.action(`${preferred[0]} ${target}`, entity.interact(preferred[0]));

        for (const want of preferred) {
            const match = actions.find((action) => action.toLowerCase() === want.toLowerCase());
            if (match) return this.action(`${match} ${target}`, entity.interact(match));
        }
        for (const want of preferred) {
            const match = actions.find((action) => action.toLowerCase().includes(want.toLowerCase()));
            if (match) return this.action(`${match} ${target}`, entity.interact(match));
        }
        this.action(`${preferred[0]} ${target} (option missing)`, false);
        this.warnOnce(`actions:${target}`, `${target} has no "${preferred.join("/")}" option`,
            `Its menu offers: ${actions.join(", ")}. The option name may differ in-game.`,
            "Update the action name in profMTA.js (see 'Unverified in-game' in the README).");
        return false;
    }

    /** Walk toward a COORDS entry. False when the entry is still the 0,0,0 template. */
    walkFallback(point) {
        if (!isSet(point)) return false;
        const player = this.local();
        if (player && !player.isStationary) return true;
        return this.action(`Walk to ${point.x},${point.y}`, titan.state.walk.toWorld(point.x, point.y, point.z));
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
            if (value === null) return;
            this.notePoints(room, value);
            if (value !== this.points[room]) {
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

    roomProgress(room) {
        const goal = this.goalFor(room);
        if (goal <= 0) return 1;
        return clamp((this.points[room] || 0) / goal, 0, 1);
    }

    // ---- Session stats ------------------------------------------------------
    /**
     * Stats survive Stop/Start so a paused run keeps its rates; only ticks
     * spent running count toward them. "Reset session" starts over.
     */
    newSession() {
        return {
            runTicks: 0,
            travelTicks: 0,
            roomTicks: [0, 0, 0, 0],
            xpStart: null,
            levelStart: null,
            lastXp: null,
            lastLevel: null,
            xpGained: 0,
            xpByRoom: [0, 0, 0, 0],
            seen: [null, null, null, null],   // last points read while running
            gained: [0, 0, 0, 0],
            deposited: [0, 0, 0, 0],
            depositRoom: null,
            depositCount: null,
            lastGainTick: null,
            lastEatTick: -100,
            mazes: 0,
            casts: 0,
            eaten: 0,
        };
    }

    resetSession() {
        this.session = this.newSession();
        this.events = [];
        this.event("Session stats reset");
    }

    /** Forget last-seen values so gains made while stopped aren't counted. */
    rebaselineSession() {
        const s = this.session;
        s.lastXp = null;
        s.seen = [null, null, null, null];
        s.depositCount = null;
        s.lastGainTick = this.tick;
    }

    /** Called every running tick: time per room, magic XP and deposits. */
    updateSession() {
        const s = this.session;
        const room = this.currentRoom;
        s.runTicks++;
        if (room === null) s.travelTicks++;
        else s.roomTicks[room]++;
        if (s.lastGainTick === null) s.lastGainTick = this.tick;

        const skills = titan.state.skills;
        const xp = skills.experience(titan.Skill.MAGIC);
        const level = skills.real(titan.Skill.MAGIC);
        if (xp > 0) {
            if (s.xpStart === null) {
                s.xpStart = xp;
                s.levelStart = level;
                s.lastLevel = level;
            }
            if (s.lastXp !== null && xp > s.lastXp) {
                const gain = xp - s.lastXp;
                s.xpGained += gain;
                if (room !== null) s.xpByRoom[room] += gain;
                s.lastGainTick = this.tick;
            }
            s.lastXp = xp;
            if (s.lastLevel !== null && level > s.lastLevel) {
                this.event(`Magic level ${level}!`, COLOR.GOOD);
            }
            s.lastLevel = level;
        }

        // Deposits: the deposit item count dropping while a deposit is in progress.
        const items = room === null ? null : DEPOSIT_ITEMS[room];
        const count = items ? titan.utils.inventory.count(items) : 0;
        const depositing = this.pending && this.pending.key.startsWith("deposit:");
        const eating = this.tick - s.lastEatTick <= 3;
        if (items && room === s.depositRoom && s.depositCount !== null && count < s.depositCount
            && depositing && !eating) {
            const amount = s.depositCount - count;
            s.deposited[room] += amount;
            this.event(`Deposited ${amount.toLocaleString()} ${DEPOSIT_NAMES[room]}`);
        }
        s.depositRoom = room;
        s.depositCount = count;
    }

    /** Session points gained, ignoring spending and widget glitches. */
    notePoints(room, value) {
        const s = this.session;
        const last = s.seen[room];
        s.seen[room] = value;
        if (!this.running || last === null || value <= last) return;
        const step = value - last;
        if (step > MAX_POINT_STEP) return;
        s.gained[room] += step;
        s.lastGainTick = this.tick;
        const goal = this.goalFor(room);
        if (last < goal && value >= goal) this.event(`${ROOM_NAMES[room]} goal reached`, COLOR.GOOD);
    }

    /** Per-hour rate of `amount` over `ticks`, or null while there's too little data. */
    perHour(amount, ticks) {
        if (ticks < RATE_MIN_TICKS) return null;
        return amount * TICKS_PER_HOUR / ticks;
    }

    xpPerHour() {
        return this.perHour(this.session.xpGained, this.session.runTicks);
    }

    /** Points per hour measured only over the time spent inside `room`. */
    pointsPerHour(room) {
        return this.perHour(this.session.gained[room], this.session.roomTicks[room]);
    }

    xpPerHourIn(room) {
        return this.perHour(this.session.xpByRoom[room], this.session.roomTicks[room]);
    }

    /** Seconds until the room's goal at the current rate, or null when unknown. */
    goalEtaSeconds(room) {
        if (this.goalReached(room)) return 0;
        const rate = this.pointsPerHour(room);
        if (!rate || this.points[room] === null) return null;
        return (this.goalFor(room) - this.points[room]) / rate * 3600;
    }

    ticksSinceProgress() {
        const last = this.session.lastGainTick;
        return last === null ? 0 : Math.max(0, this.tick - last);
    }

    event(text, color) {
        this.log(text);
        this.events.unshift({ tick: this.tick, text, color: color || COLOR.TEXT });
        if (this.events.length > EVENT_LOG_SIZE) this.events.length = EVENT_LOG_SIZE;
    }

    // ---- HUD ----------------------------------------------------------------
    /** The room the points/room sections describe: current, else target, else the chosen room. */
    focusRoom() {
        if (this.currentRoom !== null) return this.currentRoom;
        if (this.targetRoom !== null) return this.targetRoom;
        const mode = this.roomSetting.value;
        return mode === AUTO_ROOM ? null : mode;
    }

    /**
     * The HUD as rows shared by the overlay panel and the side panel:
     * { title, color } | { left, right, color } | { bar, text, color }.
     */
    hudRows(detailed) {
        const rows = [];
        const s = this.session;
        const room = this.focusRoom();
        // The side panel builds on the login screen too; skip live game reads there.
        const ready = titan.state.login.isWorldReady;
        const title =(text, color) => rows.push({ title: text, color: color || COLOR.ACCENT });
        const line = (left, right, color) => rows.push({ left, right: String(right), color: color || COLOR.TEXT });
        const bar = (fraction, text, color) => rows.push({ bar: clamp(fraction, 0, 1), text, color });

        // State
        const runtime = formatTicks(s.runTicks);
        if (this.running) line("Status", `Running  ${runtime}`, COLOR.GOOD);
        else line("Status", s.runTicks > 0 ? `Stopped  ${runtime}` : "Stopped", COLOR.BAD);
        const mode = this.roomSetting.value === AUTO_ROOM ? " (Auto)" : "";
        line("Room", `${this.roomLabel()}${mode}`);
        line("Doing", truncate(this.status, HUD_STATUS_CHARS), this.running ? COLOR.TEXT : COLOR.DIM);

        // Magic XP
        const skills = titan.state.skills;
        const xpRate = this.xpPerHour();
        if (detailed && ready) {
            const level = skills.real(titan.Skill.MAGIC);
            const xp = skills.experience(titan.Skill.MAGIC);
            title("Magic", COLOR.XP);
            const levels = s.levelStart !== null && level > s.levelStart ? `  (+${level - s.levelStart})` : "";
            line("Level", `${level}${levels}`);
            line("XP gained", `${formatShort(s.xpGained)}  (${xpRate === null ? "-" : formatShort(xpRate)}/h)`);
            if (level < 99) {
                const floor = xpForLevel(level);
                const next = xpForLevel(level + 1);
                const eta = xpRate ? `  ${formatDuration((next - xp) / xpRate * 3600)}` : "";
                line(`To level ${level + 1}`, `${formatShort(Math.max(0, next - xp))}${eta}`);
                bar((xp - floor) / Math.max(1, next - floor), null, COLOR.XP);
            }
        } else if (!detailed) {
            line("Magic XP/h", xpRate === null ? "-" : formatShort(xpRate), COLOR.XP);
        }

        // Points for the focus room
        if (room !== null) {
            const rate = this.pointsPerHour(room);
            const eta = this.goalEtaSeconds(room);
            const etaText = eta === 0 ? "Done" : eta === null ? "-" : formatDuration(eta);
            if (detailed) {
                title(`${ROOM_NAMES[room]} points`);
                line("Points", `${this.pointsLabel(room)} / ${this.goalFor(room).toLocaleString()}`,
                    this.goalReached(room) ? COLOR.GOOD : COLOR.TEXT);
                line("Session", `+${s.gained[room].toLocaleString()}  (${rate === null ? "-" : formatShort(rate)}/h)`);
                const roomXp = this.xpPerHourIn(room);
                line("Time in room", `${formatTicks(s.roomTicks[room])}  (${roomXp === null ? "-" : formatShort(roomXp)} xp/h)`);
                line("Goal in", etaText, eta === 0 ? COLOR.GOOD : COLOR.TEXT);
                bar(this.roomProgress(room), null, COLOR.ACCENT);
            } else {
                line(`${ROOM_NAMES[room]} pts/h`, rate === null ? "-" : formatShort(rate), COLOR.ACCENT);
                line("Goal in", etaText);
            }
        }

        if (detailed && ready && this.currentRoom !== null) {
            this.roomDetailRows(this.currentRoom, title, line);
        }

        if (this.hudShowGoals.value) {
            title("Goals");
            ROOMS.forEach((r) => {
                const done = this.goalReached(r);
                const marker = r === this.currentRoom ? "> " : "";
                line(`${marker}${ROOM_NAMES[r]}`, `${this.pointsLabel(r)} / ${this.goalFor(r).toLocaleString()}`,
                    done ? COLOR.GOOD : r === this.currentRoom ? COLOR.ACCENT : COLOR.TEXT);
            });
            bar(this.totalProgress(), `${Math.floor(this.totalProgress() * 100)}% of all goals`, COLOR.GOOD);
        }

        if (this.running) {
            const idle = this.ticksSinceProgress();
            const color = idle < 100 ? COLOR.DIM : idle < 300 ? COLOR.WARN : COLOR.BAD;
            line("Last progress", `${formatTicks(idle)} ago`, color);
        }
        return rows;
    }

    /** Room-specific state, so it's clear what the script is weighing up. */
    roomDetailRows(room, title, line) {
        const inv = titan.utils.inventory;
        switch (room) {
            case ROOM.TELEKINETIC: {
                const t = this.tele;
                title("Maze");
                line("Next grab", t.dir ? capitalize(t.dir.name) : "-");
                line("Grabs to finish", t.moves === null ? "-" : t.moves);
                line("Mazes solved", this.session.mazes);
                break;
            }
            case ROOM.ALCHEMIST: {
                const a = this.alch;
                const bestValue = a.best >= 0 ? a.costs[a.best] : -1;
                title("Alchemy");
                line("Best item", a.best >= 0 ? `${ALCH_ITEM_NAMES[a.best]} (${bestValue})` : "Reading prices");
                const checked = new Set(a.observations.map((obs) => obs.pos)).size;
                line("Best cupboard", a.bestCupboard ? "Known" : `Searching (${checked}/${a.order.length})`,
                    a.bestCupboard ? COLOR.GOOD : COLOR.WARN);
                line("Coins held", `${inv.count(ITEM.MTA_COINS).toLocaleString()} / ${this.alchDepositAt.value.toLocaleString()}`);
                line("Coins deposited", this.session.deposited[ROOM.ALCHEMIST].toLocaleString());
                break;
            }
            case ROOM.ENCHANTING: {
                const e = this.ench;
                title("Enchanting");
                line("Bonus shape", e.bonus ? capitalize(e.bonus.key) : "Unknown", e.bonus ? COLOR.GOOD : COLOR.DIM);
                const shapes = titan.queries.inventory().ids(...ENCHANTABLE).count();
                line("Phase", `${capitalize(e.phase)}  (${shapes} to enchant)`);
                line("Spell", e.spell ? e.spell.name : this.enchantLevel.value > 0 ? `Lvl-${this.enchantLevel.value} Enchant` : "-");
                line("Orbs", `${inv.count(ITEM.ORB)} held, ${this.session.deposited[ROOM.ENCHANTING].toLocaleString()} deposited`);
                break;
            }
            case ROOM.GRAVEYARD: {
                const g = this.grave;
                const skills = titan.state.skills;
                const hp = skills.boosted(titan.Skill.HITPOINTS);
                const maxHp = Math.max(1, skills.real(titan.Skill.HITPOINTS));
                const low = hp * 100 < this.graveEatPercent.value * maxHp;
                title("Graveyard");
                line("Hitpoints", `${hp} / ${maxHp}`, low ? COLOR.BAD : COLOR.TEXT);
                line("Spell", g.peaches ? "Bones to Peaches" : "Bones to Bananas");
                line("Bones", `${g.bones} held (${g.fruitValue}/${g.target} fruit)`);
                line("Fruit", `${this.fruitCount()} held, ${this.session.deposited[ROOM.GRAVEYARD].toLocaleString()} deposited`);
                line("Food eaten", this.session.eaten);
                break;
            }
        }

        const rune = ROOM_RUNES[room];
        const runes = inv.count(rune.id);
        line(`${rune.name} runes`, runes > 0 ? runes.toLocaleString() : "none in inventory",
            runes > 0 && runes < 100 ? COLOR.WARN : runes > 0 ? COLOR.TEXT : COLOR.DIM);
        line("Casts", this.session.casts.toLocaleString());
    }

    renderHud(panel) {
        if (!this.showHud.value) return;
        const detailed = this.hudDetail.value === 1;
        panel.title(`${this.name}  v${this.version}`, COLOR.ACCENT);
        const error = this.latestUnseenReport();
        if (error) panel.line(REPORT_KINDS[error.kind].label, "see MTA side panel", COLOR.BAD, COLOR.BAD);
        this.hudRows(detailed).forEach((row) => {
            if (row.title !== undefined) panel.title(row.title, row.color);
            else if (row.bar !== undefined) panel.progressBar(Math.round(row.bar * 1000), 0, 1000, row.color, COLOR.BAR_BG);
            else panel.line(row.left, row.right, COLOR.DIM, row.color);
        });

        const count = this.hudEventLines.value | 0;
        if (count > 0 && this.events.length > 0) {
            panel.title("Recent", COLOR.DIM);
            this.events.slice(0, count).forEach((ev) => {
                panel.line(truncate(ev.text, HUD_STATUS_CHARS), this.ageLabel(ev.tick), ev.color, COLOR.DIM);
            });
        }
    }

    buildSidePanel(panel) {
        panel.separatorText(this.name)
            .button(this.running ? "Stop" : "Start", 1)
            .spacing();
        this.buildErrorCard(panel);

        panel.beginTabBar("mta_tabs");

        panel.beginTabItem("Overview");
        this.hudRows(true).forEach((row) => {
            if (row.title !== undefined) panel.separatorText(row.title);
            else if (row.bar !== undefined) panel.progress(row.bar, row.text || `${Math.floor(row.bar * 100)}%`);
            else panel.label(row.left, row.right);
        });
        panel.endTabItem();

        panel.beginTabItem("Rooms");
        this.buildRoomsTable(panel);
        panel.endTabItem();

        // Only exists once something has gone wrong.
        if (this.reports.length > 0) {
            panel.beginTabItem(`Errors (${this.reports.length})`);
            this.buildErrorsTab(panel);
            panel.endTabItem();
        }

        panel.endTabBar();

        panel.spacing()
            .button("Reset session stats", 3)
            .sameLine()
            .button("Forget tracked points", 2);
    }

    buildRoomsTable(panel) {
        const s = this.session;
        panel.beginTable("mta_rooms", 6);
        ["Room", "Points", "Session", "Pts/h", "Time", "Goal in"].forEach((label) => panel.tableSetupColumn(label));
        panel.tableHeadersRow();
        ROOMS.forEach((room) => {
            const rate = this.pointsPerHour(room);
            const eta = this.goalEtaSeconds(room);
            const cells = [
                ROOM_NAMES[room],
                `${this.pointsLabel(room)} / ${this.goalFor(room).toLocaleString()}`,
                `+${s.gained[room].toLocaleString()}`,
                rate === null ? "-" : formatShort(rate),
                formatTicks(s.roomTicks[room]),
                eta === 0 ? "Done" : eta === null ? "-" : formatDuration(eta),
            ];
            panel.tableNextRow();
            cells.forEach((cell) => {
                panel.tableNextColumn();
                panel.text(cell);
            });
        });
        panel.endTable();

        const total = s.gained.reduce((sum, v) => sum + v, 0);
        const allRate = this.perHour(total, s.runTicks);
        panel.spacing();
        this.valueTable(panel, "mta_room_totals", [
            ["Points this session", total.toLocaleString()],
            ["Points/h (all, incl. travel)", allRate === null ? "-" : formatShort(allRate)],
            ["Time in lobby / walking", formatTicks(s.travelTicks)],
            ["Mazes solved", String(s.mazes)],
            ["Coins deposited", s.deposited[ROOM.ALCHEMIST].toLocaleString()],
            ["Orbs deposited", s.deposited[ROOM.ENCHANTING].toLocaleString()],
            ["Fruit deposited", s.deposited[ROOM.GRAVEYARD].toLocaleString()],
        ]);
    }

    /**
     * Label/value rows with every value in a fixed-width column on the right
     * edge. panel.label() puts the value at a fixed offset, which long labels
     * run into.
     */
    valueTable(panel, id, rows) {
        panel.beginTable(id, 2);
        panel.tableSetupColumn("Stat", IMGUI_COLUMN.WIDTH_STRETCH, 0);
        panel.tableSetupColumn("Value", IMGUI_COLUMN.WIDTH_FIXED, VALUE_COLUMN_WIDTH);
        rows.forEach(([label, value]) => {
            panel.tableNextRow();
            panel.tableNextColumn();
            panel.text(label);
            panel.tableNextColumn();
            panel.text(value);
        });
        panel.endTable();
    }

    ageLabel(tick) {
        const ticks = Math.max(0, this.tick - tick);
        const seconds = ticks * 0.6;
        if (seconds < 60) return `${Math.floor(seconds)}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        return `${Math.floor(seconds / 3600)}h`;
    }

    // ---- Error log ----------------------------------------------------------
    // Nothing here is shown while things work. Every game action goes into a
    // short breadcrumb trail; when something goes wrong a report captures
    // what happened, why, how to fix it, the state, and that trail. Reports
    // appear in the side panel and are written in full to the client log.

    /** Record a game action for error context. Returns `ok` so calls can be wrapped inline. */
    action(text, ok) {
        const success = !!ok;
        this.crumb(text, success ? "action" : "fail");
        if (success) {
            this.failStreak = { text: "", count: 0 };
            return ok;
        }
        if (this.failStreak.text === text) this.failStreak.count++;
        else this.failStreak = { text, count: 1 };
        if (this.failStreak.count === FAIL_STREAK_LIMIT) {
            this.report("failing", `"${text}" keeps failing`,
                `The client rejected this action ${FAIL_STREAK_LIMIT} times in a row. The target may be `
                + "out of reach, gone, or covered by an open interface.",
                "Close any open interface and check the path is clear. If it keeps happening, the "
                + "object id or option name is probably wrong for this room.");
        }
        return ok;
    }

    /** kind: "action" | "fail" | "info". Consecutive repeats collapse into one entry with a count. */
    crumb(text, kind) {
        const last = this.crumbs[this.crumbs.length - 1];
        if (last && last.text === text && last.kind === kind) {
            last.count++;
            last.tick = this.tick;
            return;
        }
        this.crumbs.push({ tick: this.tick, text, kind, count: 1 });
        if (this.crumbs.length > CRUMB_LIMIT) this.crumbs.shift();
    }

    /**
     * Add an error report. A repeat of the newest report bumps its count
     * (and shows it again if it was dismissed) instead of adding a new one.
     */
    report(kind, title, why, fix, details) {
        const latest = this.reports[0];
        if (latest && latest.kind === kind && latest.title === title && latest.why === why) {
            latest.count++;
            latest.tick = this.tick;
            latest.time = clockTime();
            latest.crumbs = this.crumbs.map((c) => ({ ...c }));
            latest.state = this.snapshot();
            this.dismissedReport = Math.min(this.dismissedReport, latest.id - 1);
            this.log(`${REPORT_KINDS[kind].label} repeated (x${latest.count}): ${title}`);
            return;
        }

        const report = {
            id: ++this.reportSeq,
            kind,
            title,
            why: why || "",
            fix: fix || "",
            details: details || [],
            tick: this.tick,
            time: clockTime(),
            count: 1,
            room: this.roomLabel(),
            status: this.status,
            crumbs: this.crumbs.map((c) => ({ ...c })),
            state: this.snapshot(),
        };
        this.reports.unshift(report);
        if (this.reports.length > REPORT_LIMIT) this.reports.length = REPORT_LIMIT;
        this.writeReportToLog(report);
    }

    /** `context` names what was running when it isn't the tick loop (e.g. "drawing the HUD"). */
    reportException(error, context) {
        const message = error && error.message ? error.message : String(error);
        const stack = error && error.stack ? String(error.stack) : "";
        const frames = stack.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("at "))
            .map((l) => this.describeFrame(l));
        // Point at the plugin's own code rather than the host API it called into.
        const own = frames.find((f) => f.own) || frames[0];
        const where = own ? own.text : "an unknown function";
        const during = context || `"${this.status}" (${this.roomName(this.currentRoom)})`;
        const retry = context ? "" : " The script skips a few ticks and retries; 10 in a row stops it.";
        this.log(`error: ${message}\n${stack}`);
        this.report("error", `Script error: ${truncate(message, 60)}`,
            `${error && error.name ? error.name : "Error"} in ${where} while ${during}.${retry}`,
            "This is a bug in the script. Press 'Write to client log' and send the report in.",
            frames.slice(0, 6).map((f) => f.text));
    }

    /** "at Foo.tickEnchanting (path/profMTA.js:1376:27)" -> "tickEnchanting() line 1376". */
    describeFrame(frame) {
        const body = frame.slice(3);
        const name = (body.split(" (")[0] || "").split(".").pop();
        const line = body.match(/:(\d+)(?::\d+)?\)?$/);
        const own = typeof MageTrainingArenaPlugin.prototype[name] === "function";
        return { own, text: `${name || "?"}()${line ? ` line ${line[1]}` : ""}` };
    }

    /** Run a per-frame draw callback; a throw is reported once instead of every frame. */
    guardRender(what, fn) {
        try {
            fn();
        } catch (error) {
            const key = `${what}:${error && error.message}`;
            if (this.renderErrors.has(key)) return;
            this.renderErrors.add(key);
            this.reportException(error, `drawing the ${what}`);
        }
    }

    /** Report once per stall when neither points nor Magic XP have gone up for a while. */
    checkStuck() {
        const idle = this.ticksSinceProgress();
        if (idle < this.stuckMinutes.value * 100) {
            this.stuckReported = false;
            return;
        }
        if (this.stuckReported) return;
        this.stuckReported = true;
        const room = this.currentRoom === null ? "Any room's" : `${ROOM_NAMES[this.currentRoom]}`;
        this.report("stuck", `No progress for ${formatTicks(idle)}`,
            `${room} points and Magic XP haven't gone up for ${formatTicks(idle)}. `
            + `The script is currently "${this.status}".`,
            this.stuckHint());
    }

    stuckHint() {
        const status = this.status.toLowerCase();
        if (status.includes("coords") || status.includes("not in view") || status.includes("looking for")) {
            return "It can't find its target in the loaded scene. Stand closer, or fill in the matching "
                + "COORDS entry at the top of profMTA.js so it can walk there.";
        }
        if (this.currentRoom === null) {
            return "It hasn't managed to enter a room. Start from the MTA lobby near the four portals.";
        }
        const repeats = this.crumbs.length > 0 ? this.crumbs[this.crumbs.length - 1].count : 0;
        if (repeats >= 3) {
            return "The same action has been repeated with no result (see the last actions). The click "
                + "probably isn't landing: check the option name, and that no interface is open.";
        }
        return "Check the last actions below to see what it has been trying.";
    }

    /** State worth knowing when reading a report. Never throws (it runs on the error path). */
    snapshot() {
        const safe = (fn) => {
            try {
                return String(fn());
            } catch (error) {
                return "?";
            }
        };
        const room = this.currentRoom;
        return [
            ["Version", this.version],
            ["Mode", this.roomLabelForMode()],
            ["Room", this.roomLabel()],
            ["Doing", this.status],
            ["Waiting on", safe(() => this.pending
                ? `${this.pending.key} (${formatTicks(this.tick - this.pending.tick)})` : "nothing")],
            ["Run time", formatTicks(this.session.runTicks)],
            ["Logged in", safe(() => (titan.state.login.isWorldReady ? "yes" : "no"))],
            ["Free slots", safe(() => titan.utils.inventory.emptySlots)],
            ["Hitpoints", safe(() => `${titan.state.skills.boosted(titan.Skill.HITPOINTS)}/`
                + `${titan.state.skills.real(titan.Skill.HITPOINTS)}`)],
            ["Magic level", safe(() => titan.state.skills.boosted(titan.Skill.MAGIC))],
            ["Room points", room === null ? "-" : `${this.pointsLabel(room)} / ${this.goalFor(room).toLocaleString()}`],
            ["Runes", room === null ? "-" : safe(() => `${titan.utils.inventory.count(ROOM_RUNES[room].id)} `
                + `${ROOM_RUNES[room].name.toLowerCase()}`)],
        ];
    }

    /** "-12.6s" relative to the report, so the trail reads as a timeline. */
    crumbOffset(report, crumb) {
        const seconds = (report.tick - crumb.tick) * 0.6;
        return seconds <= 0 ? "now" : `-${seconds.toFixed(1)}s`;
    }

    crumbText(crumb) {
        const repeat = crumb.count > 1 ? ` x${crumb.count}` : "";
        const failed = crumb.kind === "fail" ? " [FAILED]" : "";
        return `${crumb.text}${repeat}${failed}`;
    }

    writeReportToLog(report) {
        const kind = REPORT_KINDS[report.kind];
        const lines = [
            `===== ${kind.label} #${report.id} at ${report.time}${report.count > 1 ? ` (x${report.count})` : ""} =====`,
            `What: ${report.title}`,
            `Why:  ${report.why}`,
        ];
        if (report.fix) lines.push(`Fix:  ${report.fix}`);
        report.details.forEach((detail) => lines.push(`  ${detail}`));
        lines.push(`State: ${report.state.map(([k, v]) => `${k}=${v}`).join("; ")}`);
        lines.push(`Last ${report.crumbs.length} actions (oldest first):`);
        report.crumbs.forEach((crumb) => lines.push(`  ${this.crumbOffset(report, crumb).padStart(7)}  ${this.crumbText(crumb)}`));
        lines.forEach((line) => this.log(line));
    }

    latestUnseenReport() {
        const latest = this.reports[0];
        return latest && latest.id > this.dismissedReport ? latest : null;
    }

    /** One report's body. `suffix` keeps collapsible labels unique when a report is drawn twice. */
    buildReportBody(panel, report, suffix) {
        const kind = REPORT_KINDS[report.kind];
        const repeat = report.count > 1 ? `  (x${report.count})` : "";
        panel.status(`${kind.label}${repeat}`, kind.tone)
            .wrapped(report.title)
            .label("When", `${report.time}  (${this.ageLabel(report.tick)} ago)`)
            .label("Room", report.room)
            .label("Doing", report.status)
            .separatorText("Why")
            .wrapped(report.why);
        if (report.fix) panel.separatorText("Fix").wrapped(report.fix);

        panel.beginCollapsible(`Last ${report.crumbs.length} actions${suffix}`, true);
        if (report.crumbs.length === 0) panel.disabled("No actions yet");
        report.crumbs.forEach((crumb) => {
            const color = crumb.kind === "fail" ? COLOR.BAD : crumb.kind === "info" ? COLOR.DIM : COLOR.TEXT;
            panel.colored(`${this.crumbOffset(report, crumb).padStart(7)}  ${this.crumbText(crumb)}`, color);
        });
        panel.endCollapsible();

        if (report.details.length > 0) {
            panel.beginCollapsible(`Stack${suffix}`, false);
            report.details.forEach((detail) => panel.disabled(detail));
            panel.endCollapsible();
        }

        panel.beginCollapsible(`State at the time${suffix}`, false);
        report.state.forEach(([label, value]) => panel.label(label, value));
        panel.endCollapsible();
    }

    buildErrorCard(panel) {
        const report = this.latestUnseenReport();
        if (!report) return;
        panel.beginCard("mta_error_card");
        this.buildReportBody(panel, report, "");
        panel.spacing()
            .button("Dismiss", 4)
            .sameLine()
            .button("Write to client log", 5);
        panel.endCard();
        panel.spacing();
    }

    buildErrorsTab(panel) {
        this.reports.forEach((report) => {
            const kind = REPORT_KINDS[report.kind];
            panel.beginCollapsible(`#${report.id}  ${report.time}  ${kind.label}: ${truncate(report.title, 40)}`, false);
            this.buildReportBody(panel, report, ` #${report.id}`);
            panel.smallButton(`Write #${report.id} to client log`, 100 + report.id);
            panel.endCollapsible();
        });
        panel.spacing().button("Clear error log", 6);
    }

    onPanelAction(actionId) {
        if (actionId === 1) this.toggleAutomation();
        else if (actionId === 2) this.resetTrackedPoints();
        else if (actionId === 3) this.resetSession();
        else if (actionId === 4 && this.reports[0]) this.dismissedReport = this.reports[0].id;
        else if (actionId === 5 && this.reports[0]) this.writeReportToLog(this.reports[0]);
        else if (actionId === 6) {
            this.reports = [];
            this.dismissedReport = this.reportSeq;
        } else if (actionId > 100) {
            const report = this.reports.find((r) => r.id === actionId - 100);
            if (report) this.writeReportToLog(report);
        }
    }

    roomLabelForMode() {
        const mode = this.roomSetting.value;
        return mode === AUTO_ROOM ? "Auto" : ROOM_NAMES[mode];
    }

    // ---- Overlay ------------------------------------------------------------
    renderScene() {
        if (!this.running || this.currentRoom === null) return;
        const overlay = titan.overlay;

        const labels = this.sceneLabels.value;

        if (this.currentRoom === ROOM.TELEKINETIC && this.tele.maze) {
            const { maze, standTile, dir, moves, guardianTile } = this.tele;
            if (standTile) {
                overlay.tileQuad(standTile.x, standTile.y, standTile.plane, 0x5500FF88, 0xFF00FF88);
                if (labels && dir) this.tileLabel(standTile.x, standTile.y, standTile.plane, `Grab ${dir.name}`, COLOR.GOOD);
            }
            if (maze.finish) {
                overlay.tileQuad(maze.finish.x, maze.finish.y, maze.plane, 0x55FFD700, 0xFFFFD700);
                if (labels) this.tileLabel(maze.finish.x, maze.finish.y, maze.plane, "Finish", COLOR.WARN);
            }
            if (labels && guardianTile && moves !== null) {
                this.tileLabel(guardianTile.x, guardianTile.y, guardianTile.plane, `${moves} to go`, COLOR.TEXT);
            }
        } else if (this.currentRoom === ROOM.ALCHEMIST) {
            const a = this.alch;
            const cupboard = a.bestCupboard ? a.cupboards.get(a.bestCupboard) : null;
            if (cupboard) overlay.tileObjectHull(cupboard, 0xFF00FF88, 0x3300FF88);
            if (labels) this.labelCupboards();
        } else if (this.currentRoom === ROOM.ENCHANTING && this.ench.pile && this.ench.pile.exists) {
            const pile = this.ench.pile;
            overlay.tileObjectHull(pile, COLOR.ACCENT, 0x339B7BFF);
            if (labels) {
                const shape = this.pileShape(pile);
                const bonus = this.ench.bonus && shape === this.ench.bonus.key;
                this.tileLabel(pile.tileX, pile.tileY, pile.plane,
                    `${capitalize(shape || "shapes")}${bonus ? " (bonus)" : ""}`, bonus ? COLOR.GOOD : COLOR.TEXT);
            }
        }
    }

    /** What each cupboard holds: seen (white), inferred (grey), or the target (green). */
    labelCupboards() {
        const a = this.alch;
        a.order.forEach((key, pos) => {
            const obj = a.cupboards.get(key);
            if (!obj) return;
            const seen = a.observations.find((obs) => obs.pos === pos);
            const item = seen ? seen.item : this.predictCupboard(pos, a.dir);
            if (item === null) {
                this.tileLabel(obj.tileX, obj.tileY, obj.plane, "?", COLOR.DIM);
                return;
            }
            const name = item === EMPTY_CUPBOARD ? "Empty" : ALCH_ITEM_NAMES[item];
            const color = key === a.bestCupboard ? COLOR.GOOD : seen ? COLOR.TEXT : COLOR.DIM;
            this.tileLabel(obj.tileX, obj.tileY, obj.plane, name, color);
        });
    }

    /** Text roughly centred over a scene tile. */
    tileLabel(x, y, plane, text, color) {
        const point = titan.overlay.tileToScreen(x, y, plane);
        if (!point) return;
        titan.overlay.screenText(Math.round(point.x - text.length * 3), Math.round(point.y - 6), text, color);
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

    log(message) {
        titan.log(`[Prof] MTA ${message}`);
    }

    /** Report a problem once per run (warnings reset on Start). */
    warnOnce(key, message, why, fix) {
        if (this.warned.has(key)) return;
        this.warned.add(key);
        this.event(message, COLOR.WARN);
        this.report("warning", message, why || message, fix || "");
    }
}

titan.register(new MageTrainingArenaPlugin());
