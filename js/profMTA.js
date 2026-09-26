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

/**
 * Rewards shop (wiki: Mage Training Arena shop stock). `cost` is in ROOM order
 * [Telekinetic, Alchemist, Enchanting, Graveyard]; wand prices are upgrades
 * (the wand below is handed in). `log` = on the collection log's Magic
 * Training Arena page; the others count toward the green-log goal only when
 * their `optional` setting is on. The totals are REWARD_POINTS.
 */
const REWARDS = [
    { key: "wand1", name: "Beginner wand", item: 6908, cost: [30, 30, 300, 30], log: true },
    { key: "wand2", name: "Apprentice wand", item: 6910, cost: [60, 60, 600, 60], log: true },
    { key: "wand3", name: "Teacher wand", item: 6912, cost: [150, 200, 1500, 150], log: true },
    { key: "wand4", name: "Master wand", item: 6914, cost: [240, 240, 2400, 240], log: true },
    { key: "hat", name: "Infinity hat", item: 6918, cost: [350, 400, 3000, 350], log: true },
    { key: "top", name: "Infinity top", item: 6916, cost: [400, 450, 4000, 400], log: true },
    { key: "bottoms", name: "Infinity bottoms", item: 6924, cost: [450, 500, 5000, 450], log: true },
    { key: "boots", name: "Infinity boots", item: 6920, cost: [120, 120, 1200, 120], log: true },
    { key: "gloves", name: "Infinity gloves", item: 6922, cost: [175, 225, 1500, 175], log: true },
    { key: "book", name: "Mage's book", item: 6889, cost: [500, 550, 6000, 500], log: true },
    { key: "peaches", name: "Bones to Peaches", item: null, cost: [200, 300, 2000, 200], log: false, optional: "goalPeaches" },
    { key: "pouch", name: "Rune pouch", item: 12791, cost: [150, 200, 1500, 150], log: false, optional: "goalRunePouch" },
];
const REWARD_ITEMS = REWARDS.filter((reward) => reward.item !== null).map((reward) => reward.item);
const GOAL_MODE = Object.freeze({ MANUAL: 0, GREEN_LOG: 1 });

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
const NUM_CUPBOARDS = 6;

const VARBIT_PEACHES_UNLOCKED = 1505; // MAGICTRAINING_BONESPEACHES

const WIDGET = Object.freeze({
    // Room HUD roots (UNIVERSE), indexed by ROOM.
    ROOM_ROOT: [12976128, 12713984, 12779520, 12845056],
    // Room HUD points text, indexed by ROOM.
    ROOM_POINTS: [12976134, 12713990, 12779526, 12845062],
    // MagictrainingMain *_POINTS (lobby overview), indexed by ROOM.
    LOBBY_POINTS: [36241418, 36241419, 36241420, 36241421],
    CLOG_GROUP: 621,               // Collection log
    CLOG_ITEMS: 40697893,          // Collection.ITEMS_CONTENTS: the open page's item slots
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
const BONE_BLOCK = 4;             // a bone pile gives 4 of one type, then the next (1 -> 2 -> 3 -> 4 -> 1)
const BONE_DROP_SPOTANIMS = [520, 521, 522, 523]; // MAGICTRAINING_BONE_DROP1..4 (falling bones, 2 damage)
const SCAN_RADIUS = 40;
const SCENE_RADIUS = 104;         // the whole loaded scene

// World hopping (Enchanting dragonstone mode)
const ENCH_MODE = Object.freeze({ SHAPES: 0, DRAGONSTONES: 1 });
// RuneLite WorldType bits to avoid: PVP, BOUNTY, PVP_ARENA, SKILL_TOTAL, QUEST_SPEEDRUNNING,
// HIGH_RISK, LAST_MAN_STANDING, BETA, NOSAVE_MODE, TOURNAMENT, FRESH_START_WORLD, DEADMAN, SEASONAL.
const HOP_EXCLUDED_FLAGS = (1 << 2) | (1 << 5) | (1 << 6) | (1 << 7) | (1 << 8) | (1 << 10) | (1 << 14)
    | (1 << 16) | (1 << 25) | (1 << 26) | (1 << 27) | (1 << 29) | (1 << 30);
const HOP_EXCLUDED_ACTIVITY = /pvp|high risk|deadman|skill total|beta|tournament|speedrun|last man|fresh start|seasonal|bounty|leagues/i;
const HOP_SETTLE_TICKS = 3;       // let ground items load on the new world before looking
const HOP_TIMEOUT_TICKS = 30;
// The six dragonstone spawns (wiki, world tiles), in order round the Enchanting
// Chamber, clockwise from the north-west.
const DRAGONSTONE_RING = [
    { x: 3354, y: 9646 },   // north-west
    { x: 3373, y: 9651 },   // north-east
    { x: 3374, y: 9643 },   // east
    { x: 3375, y: 9633 },   // south-east
    { x: 3359, y: 9632 },   // south
    { x: 3353, y: 9635 },   // south-west
];
const RECENT_WORLDS = 10;         // don't hop back to these (dragonstones respawn slowly)
const BAD_WORLD_TICKS = 500;      // skip a world the client refused to hop to for ~5 minutes
const HOP_FAIL_REPORT = 3;        // report after this many refused hops in a row

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
    version = "0.5.1";

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
        description: "Manual: the points to earn per room below (defaults are every reward). "
            + "Green log: what the rewards missing from your collection log still cost.",
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

    goalMode = this.createSetting("comboSetting", {
        key: "goalMode",
        name: "Goal mode",
        section: this.goalsSection,
        position: 4,
        default: GOAL_MODE.MANUAL,
        choices: [
            { value: GOAL_MODE.MANUAL, label: "Manual (goals above)" },
            { value: GOAL_MODE.GREEN_LOG, label: "Green log (collection log)" },
        ],
        tooltip: "Green log: each room's goal is what the rewards you don't own yet cost, so buying one "
            + "lowers the goal as much as your points. Open the collection log's Magic Training Arena "
            + "page once so the plugin can read it.",
    });

    goalRunePouch = this.createSetting("boolSetting", {
        key: "goalRunePouch",
        name: "Green log: include rune pouch",
        section: this.goalsSection,
        position: 5,
        default: false,
        tooltip: "The rune pouch isn't on the collection log; count its cost until one is seen in the inventory.",
    });

    goalPeaches = this.createSetting("boolSetting", {
        key: "goalPeaches",
        name: "Green log: include Bones to Peaches",
        section: this.goalsSection,
        position: 6,
        default: false,
        tooltip: "The Bones to Peaches unlock isn't on the collection log; count its cost until the spell is unlocked.",
    });

    /** Owned rewards (keys) and whether the collection log has been read, persisted. */
    rewardsStore = this.createSetting("stringSetting", {
        key: "ownedRewards",
        name: "Owned rewards",
        section: this.goalsSection,
        position: 99,
        default: "",
        hidden: true,
    });

    teleSideOffset = this.createSetting("intSetting", {
        key: "teleSideOffset",
        name: "Stand distance outside maze",
        section: this.teleSection,
        position: 0,
        default: 0,
        min: 0,
        max: 4,
        tooltip: "Tiles beyond the outer maze wall line to stand on when casting. 0 stands on the "
            + "wall line itself, which is where RuneLite's MTA plugin marks the cast tiles.",
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
        name: "Don't alch spares worth less than",
        section: this.alchSection,
        position: 1,
        default: 15,
        min: 0,
        max: 30,
        tooltip: "Spare items (above the reserve, not the best item) worth fewer coins than this are kept, "
            + "not alched. Items are only dropped to make room for the next take.",
    });

    alchReserve = this.createSetting("intSetting", {
        key: "alchReserve",
        name: "Reserve of each item",
        section: this.alchSection,
        position: 2,
        default: 2,
        min: 0,
        max: 5,
        tooltip: "Keep this many of every item type, so when the prices rotate there's something to alch "
            + "while running to the new best cupboard. The best item is taken 5 at a time once this few are left.",
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

    enchantMode = this.createSetting("comboSetting", {
        key: "enchantMode",
        name: "Mode",
        section: this.enchSection,
        position: 3,
        default: ENCH_MODE.SHAPES,
        choices: [
            { value: ENCH_MODE.SHAPES, label: "Shapes" },
            { value: ENCH_MODE.DRAGONSTONES, label: "Dragonstones + world hop" },
        ],
        tooltip: "Dragonstones: take every dragonstone in the room (double points), enchant them, "
            + "deposit the orbs, then hop worlds for fresh spawns.",
    });

    hopSameRegion = this.createSetting("boolSetting", {
        key: "hopSameRegion",
        name: "Hop within my region",
        section: this.enchSection,
        position: 4,
        default: true,
        tooltip: "Only hop to worlds in the same region as the current one (lower ping).",
    });

    hopMinSeconds = this.createSetting("intSetting", {
        key: "hopMinSeconds",
        name: "Min seconds between hops",
        section: this.enchSection,
        position: 5,
        default: 6,
        min: 3,
        max: 60,
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

    graveDodge = this.createSetting("boolSetting", {
        key: "graveDodge",
        name: "Dodge falling bones",
        section: this.graveSection,
        position: 2,
        default: true,
        tooltip: "Step off the tile a falling bone is about to land on (it hits for 2).",
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
    owned = new Set();      // reward keys the player has (collection log, inventory, unlock varbit)
    logRead = false;        // the collection log's MTA page has been read at least once
    hopping = null;         // { from, to, tick, arrived } while a world hop is in progress
    lastHopTick = -1000;
    recentWorlds = [];
    badWorlds = new Map();  // world id -> tick until which it's skipped
    hopFails = 0;
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
        this.loadRewards();
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
        this.hopping = null;
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
            next: null,             // { dir, tile, walked }: side for the grab after the one in flight
        };
        this.alch = {
            signature: "",
            costs: [-1, -1, -1, -1, -1],
            best: -1,
            cupboards: new Map(),   // world key -> live TileObject
            anchor: null,           // { idx, item }: one searched cupboard's contents
            pendingSearch: null,    // { key, item, action, tick, start } while a cupboard click is being answered
            lastCounts: null,       // alchemy items held per type last tick
            emptyTick: -1,
            lastAlchTick: -100,
            bestCupboard: null,
        };
        this.ench = { phase: "collect", bonus: null, spell: null, spellTick: -100, castSlot: -1, castItem: -1, pile: null, pileKey: null,
            stones: null, runCastTick: -100,
            sweep: null };          // { dir: +1 clockwise / -1 anticlockwise / 0 unset, index, target } on DRAGONSTONE_RING
        this.grave = {
            fruitValue: 0, target: 0, bones: 0, peaches: false,
            pile: null, pileKey: null,  // the pile nearest the chute, kept for the whole visit
            type: 0, run: 0,            // last bone type taken from it (0 = unknown) and how many in a row
            synced: false,              // true once `run` counts from the start of a 4-bone block
            counts: null,               // bones held per type last tick
            dodgeKey: null, dodgeTick: -100,
        };
    }

    onGameTick(tick) {
        this.tick = tick;
        if (titan.state.login.isWorldReady) {
            try {
                this.trackRewards();
            } catch (error) {
                this.reportException(error);
            }
        }
        if (!this.running) return;

        if (!titan.state.login.isWorldReady) {
            this.status = "Waiting for game";
            return;
        }

        try {
            this.readPoints();
            this.updateSession();
            this.checkStuck();
            if (this.currentRoom === ROOM.GRAVEYARD && this.graveDodge.value && this.dodgeFallingBones()) return;
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
        } else if (message.includes("you found:") && this.alch.pendingSearch) {
            const item = ALCH_ITEM_KEYWORDS.findIndex((keyword) => message.includes(keyword));
            if (item >= 0) {
                this.recordCupboard(this.alch.pendingSearch.key, item);
                this.alch.pendingSearch = null;
            }
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
        if (this.hopping && this.waitForHop()) return;
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
            if (!this.walkTowardMaze()) this.walkFallback(COORDS.roomCenters[ROOM.TELEKINETIC]);
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
                t.next = null;
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
            this.teleRunAhead();
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
                t.next = null;
                this.wait(3, 5);
            }
            return;
        }

        const player = this.local();
        if (!player) return;
        const p = player.tile;
        t.standTile = this.pickStandTile(t.maze, solution, p, g);

        const onSide = this.onMazeSide(t.maze, dir, p);
        const tooFar = t.standTile && chebyshev(p, g) > 10 && tileKey(p) !== tileKey(t.standTile);
        if (!onSide || tooFar) {
            if (!t.standTile) {
                this.status = `No free tile on the ${dir.name} side`;
                this.wait(2, 3);
                return;
            }
            this.status = `Moving to the ${dir.name} side`;
            // Already running there from the last grab: let that run finish.
            const ahead = t.next && t.next.walked && t.next.dir === dir;
            if (ahead && !player.isStationary) {
                t.standTile = t.next.tile;
                return;
            }
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
            t.next = this.planNextGrab(t.maze, g, dir, p);
            this.track("telegrab", t.castFrom);
        }
    }

    /**
     * Where to stand for the grab after this one: slide the guardian to where
     * it will stop, solve from there, and pick that side's stand tile (see
     * pickStandTile). Null when there is nothing to run to.
     */
    planNextGrab(maze, from, dir, player) {
        const landing = this.slide(maze, from.x, from.y, dir);
        if (maze.finish && landing.x === maze.finish.x && landing.y === maze.finish.y) return null;
        const solution = this.solveMaze(maze, landing);
        if (!solution) return null;
        const landingTile = { x: landing.x, y: landing.y, plane: maze.plane };
        if (this.onMazeSide(maze, solution.dir, player) && chebyshev(player, landingTile) <= 10) return null;
        const tile = this.pickStandTile(maze, solution, player, landingTile);
        return tile ? { dir: solution.dir, tile, walked: false } : null;
    }

    /** While the guardian slides from a grab, run to the next grab's side so it can be cast on arrival. */
    teleRunAhead() {
        const t = this.tele;
        const next = t.next;
        if (!next || next.walked || !t.castFrom) return;
        next.walked = true;
        t.standTile = next.tile;
        this.status = `Guardian sliding - running to the ${next.dir.name} side`;
        this.action(`Run ahead to the ${next.dir.name} side`, titan.state.walk.toScene(next.tile.x, next.tile.y));
    }

    /**
     * The guardian can be far from where the room starts you, out of view.
     * Walk to the nearest maze wall to bring it into range; if it still isn't
     * in view from there, head for the middle of the walls in view.
     * False when no maze wall is loaded either.
     */
    walkTowardMaze() {
        const player = this.local();
        if (!player) return false;
        const walls = titan.queries.objects(SCENE_RADIUS).id(OBJ.MAZE_WALL).toArray();
        if (walls.length === 0) return false;
        if (!player.isStationary) return true;

        const p = player.tile;
        walls.sort((l, r) => chebyshev(p, l.tile) - chebyshev(p, r.tile));
        let target = walls[0].tile;
        if (chebyshev(p, target) <= 2) {
            const mean = (pick) => Math.round(walls.reduce((sum, wall) => sum + pick(wall.tile), 0) / walls.length);
            target = { x: mean((tile) => tile.x), y: mean((tile) => tile.y), plane: p.plane };
        }
        const tile = this.walkableNear(target, p) || target;
        return this.action(`Walk toward the maze (${tile.x},${tile.y})`, titan.state.walk.toScene(tile.x, tile.y));
    }

    /** `target` or its walkable neighbour closest to `origin`; null when all are blocked. */
    walkableNear(target, origin) {
        let best = null;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const tile = { x: target.x + dx, y: target.y + dy, plane: target.plane };
                if (!this.isWalkable(tile.plane, tile.x, tile.y)) continue;
                if (!best || chebyshev(tile, origin) < chebyshev(best, origin)) best = tile;
            }
        }
        return best;
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
     * Breadth-first search over slides. Returns a shortest solution as its
     * grab directions (`path`), with the first one and the count broken out,
     * or null when unsolvable.
     */
    solveMaze(maze, start) {
        const goal = `${maze.finish.x},${maze.finish.y}`;
        const startKey = `${start.x},${start.y}`;
        const prev = new Map([[startKey, null]]);
        const queue = [{ x: start.x, y: start.y, key: startKey }];

        while (queue.length > 0) {
            const node = queue.shift();
            for (const dir of DIRS) {
                const next = this.slide(maze, node.x, node.y, dir);
                const nextKey = `${next.x},${next.y}`;
                if (prev.has(nextKey)) continue;
                prev.set(nextKey, { from: node.key, dir });
                if (nextKey === goal) {
                    const path = [];
                    for (let step = prev.get(nextKey); step; step = prev.get(step.from)) path.unshift(step.dir);
                    return { dir: path[0], moves: path.length, path };
                }
                queue.push({ x: next.x, y: next.y, key: nextKey });
            }
        }
        return null;
    }

    /**
     * True when `tile` is on the side of the maze that pulls the guardian
     * toward `dir`: on or beyond that side's wall line, never a corner (a
     * corner cast wastes the rune). Same test as RuneLite's getPosition().
     */
    onMazeSide(maze, dir, tile) {
        if (tile.plane !== maze.plane) return false;
        const inColumn = tile.x > maze.minX && tile.x < maze.maxX;
        const inRow = tile.y > maze.minY && tile.y < maze.maxY;
        switch (dir.name) {
            case "north": return inColumn && tile.y >= maze.maxY;
            case "south": return inColumn && tile.y <= maze.minY;
            case "east": return inRow && tile.x >= maze.maxX;
            case "west": return inRow && tile.x <= maze.minX;
        }
        return false;
    }

    /**
     * Stand tile for a solution's first grab, within spell range of the
     * guardian. Looks one grab ahead: along the side it prefers the end nearest
     * the side the following grab needs, so a U-turn (north, west, south) runs
     * down the west side toward the south while the guardian slides. A cast
     * goes off from wherever the player is on the side once the guardian stops,
     * so a long slide means a long run and a short slide a short one.
     */
    pickStandTile(maze, solution, player, guardian) {
        const g = { x: guardian.x, y: guardian.y, plane: maze.plane };
        return this.mazeStandTile(maze, solution.dir, player, { toward: solution.path[1] || null, rangeFrom: g })
            || this.mazeStandTile(maze, solution.dir, g);
    }

    /**
     * Walkable tile on the side for `dir`, never a corner. With `toward` (a
     * perpendicular direction) the end of the side nearest that way wins;
     * otherwise, and as a tie-break, the tile closest to `origin` (the player,
     * like RuneLite's hint arrow). `rangeFrom` limits it to spell range of that tile.
     */
    mazeStandTile(maze, dir, origin, { toward = null, rangeFrom = null } = {}) {
        const base = this.teleSideOffset.value;
        const vertical = dir.dy !== 0;
        const along = vertical
            ? { min: maze.minX + 1, max: maze.maxX - 1, origin: origin.x }
            : { min: maze.minY + 1, max: maze.maxY - 1, origin: origin.y };
        const edge = dir.name === "north" ? maze.maxY
            : dir.name === "south" ? maze.minY
                : dir.name === "east" ? maze.maxX : maze.minX;
        const outward = dir.dx + dir.dy;

        const positions = [];
        for (let v = along.min; v <= along.max; v++) positions.push(v);
        const pull = toward ? (vertical ? toward.dx : toward.dy) : 0;
        const goal = pull > 0 ? along.max : pull < 0 ? along.min : null;
        const cost = (v) => (goal === null ? 0 : Math.abs(v - goal));
        positions.sort((a, b) => cost(a) - cost(b) || Math.abs(a - along.origin) - Math.abs(b - along.origin));

        for (let offset = base; offset <= base + 2; offset++) {
            const across = edge + outward * offset;
            for (const v of positions) {
                const tile = { x: vertical ? v : across, y: vertical ? across : v, plane: maze.plane };
                if (rangeFrom && chebyshev(tile, rangeFrom) > 10) continue;
                if (this.isWalkable(maze.plane, tile.x, tile.y)) return tile;
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
    /**
     * Wiki strategy: one Search reveals the layout, then Take-5 from the best
     * item's cupboard. A reserve of each item type is kept so a price rotation
     * never leaves nothing to alch; items are only dropped to make room for
     * the next take. Alching doesn't interrupt walking, searching or taking,
     * so it runs every cooldown alongside whatever the cupboard step is doing.
     */
    tickAlchemist() {
        const a = this.alch;
        this.readAlchTable();
        this.refreshCupboards();
        const counts = this.alchItemCounts();
        this.resolveCupboardSearch(counts);
        a.lastCounts = counts;
        a.droppedSlot = -1;

        const coins = titan.utils.inventory.count(ITEM.MTA_COINS);
        if (coins >= this.alchDepositAt.value) this.depositAlchemyCoins();
        else this.alchCupboardStep(counts, coins);
        if (this.running) this.alchAlongside(counts);
    }

    /** Cast on the next item if the spell is off cooldown, on top of the tick's other action. */
    alchAlongside(counts) {
        const a = this.alch;
        if (this.tick - a.lastAlchTick < ALCH_COOLDOWN_TICKS) return;
        const item = this.nextAlchItem(counts, a.droppedSlot);
        if (!item) return;
        const doing = this.status;
        if (this.action(`Alch ${item.name}`, item.castOn(this.alchemySpell()))) {
            this.session.casts++;
            a.lastAlchTick = this.tick;
            this.status = `${doing} + alching ${item.name}`;
        }
    }

    /** Search to learn the layout, Take-5 the best item, or top up the reserve. */
    alchCupboardStep(counts, coins) {
        const a = this.alch;
        if (a.pendingSearch) {
            this.retryCupboardClick(a.pendingSearch);
            return;
        }

        // Layout unknown (start, or a price rotation): one Search of the nearest cupboard reveals it.
        if (!a.anchor) {
            const nearest = this.pickCupboard();
            if (!nearest) {
                this.status = "No cupboards found";
                this.walkFallback(COORDS.roomCenters[ROOM.ALCHEMIST]);
                this.wait(2, 3);
                return;
            }
            this.status = "Searching a cupboard for the layout";
            this.clickCupboard(nearest, null, "Search");
            return;
        }
        if (a.best < 0) {
            this.status = "Reading prices";
            return;
        }

        const reserve = this.alchReserve.value | 0;
        if (counts[a.best] <= reserve) {
            this.takeFromCupboard(a.best, true, counts, coins);
            return;
        }
        // Top up the reserve (one at a time) while there are best items to alch on the way.
        const short = [0, 1, 2, 3, 4].filter((item) => item !== a.best && counts[item] < reserve);
        if (short.length > 0) {
            const player = this.local();
            const dist = (item) => {
                const target = this.cupboardFor(item);
                return target && player ? player.distanceTo(target.obj.tile) : 99;
            };
            this.takeFromCupboard(short.sort((l, r) => dist(l) - dist(r))[0], false, counts, coins);
            return;
        }
        this.status = `${counts[a.best]} ${ALCH_ITEM_NAMES[a.best]} left`;
    }

    /**
     * Highest-value item worth alching now: any of the best item (reserve
     * included, that's what it's for), or a spare above the reserve worth at
     * least the minimum.
     */
    nextAlchItem(counts, skipSlot = -1) {
        const a = this.alch;
        const reserve = this.alchReserve.value | 0;
        const bestValue = a.best >= 0 ? a.costs[a.best] : -1;
        const alchable = this.heldAlchItems().filter((item) => {
            if (item.slot === skipSlot) return false;
            const idx = ITEM.ALCH_ITEMS.indexOf(item.id);
            const value = this.alchValue(item.id);
            if (value < 0) return false;
            if (value === bestValue) return true;
            return counts[idx] > reserve && value >= this.alchMinValue.value;
        });
        return alchable.sort((l, r) => this.alchValue(r.id) - this.alchValue(l.id))[0] || null;
    }

    /** Take the best item 5 at a time, or one to top up the reserve; drops a spare first if short of room. */
    takeFromCupboard(item, many, counts, coins) {
        const a = this.alch;
        const inv = titan.utils.inventory;
        const target = this.cupboardFor(item);
        if (!target) {
            a.anchor = null;    // layout no longer matches; search again
            return;
        }
        if (item === a.best) a.bestCupboard = target.key;

        if (inv.emptySlots < (many ? 5 : 1)) {
            const spare = this.spareAlchItem(counts, item);
            if (spare) {
                this.status = `Dropping ${spare.name} for room`;
                this.action(`Drop ${spare.name}`, spare.interact("Drop"));
                a.droppedSlot = spare.slot;     // so this tick's alch doesn't pick the same item
                return;
            }
            if (inv.emptySlots === 0) {
                if (coins > 0) this.depositAlchemyCoins();
                else this.stop("Inventory full - free some slots for alchemy items", {
                    why: "Every slot is taken, nothing is spare above the reserve, and there are no coins to deposit.",
                    fix: "Free a few inventory slots or lower 'Reserve of each item', then start again.",
                });
                return;
            }
        }
        this.status = many ? `Taking 5 ${ALCH_ITEM_NAMES[item]}` : `Topping up ${ALCH_ITEM_NAMES[item]}`;
        this.clickCupboard(target, item, many ? this.takeManyAction(target.obj) : "Search");
    }

    /** Lowest-value item above the reserve that isn't `keep` or the best item, or null. */
    spareAlchItem(counts, keep) {
        const a = this.alch;
        const reserve = this.alchReserve.value | 0;
        return this.heldAlchItems()
            .filter((item) => {
                const idx = ITEM.ALCH_ITEMS.indexOf(item.id);
                return idx !== keep && idx !== a.best && counts[idx] > reserve;
            })
            .sort((l, r) => this.alchValue(l.id) - this.alchValue(r.id))[0] || null;
    }

    /** The cupboard's take-many option (Take-5), falling back to Search when it has none. */
    takeManyAction(obj) {
        const actions = (obj.actions || []).filter((action) => action);
        if (actions.length === 0) return "Take-5";
        return actions.find((action) => /take/i.test(action)) || "Search";
    }

    clickCupboard(target, item, action) {
        if (this.interactPreferred(target.obj, [action])) {
            this.alch.pendingSearch = { key: target.key, item, action, tick: this.tick, start: this.tick };
        }
    }

    /**
     * Waiting on a cupboard click. At the cupboard with no answer after 3
     * ticks, the result was missed (a take and an alch of the same item in one
     * tick cancel out in the counts), so drop the wait and go again; stopped
     * short of it, click it again.
     */
    retryCupboardClick(search) {
        const a = this.alch;
        const obj = a.cupboards.get(search.key);
        const player = this.local();
        this.status = search.action === "Search" ? "Searching cupboard" : `${search.action} from cupboard`;
        if (!obj || !player || !player.isStationary || this.tick - search.tick < 3) return;
        if (this.nextTo(obj)) {
            a.pendingSearch = null;
            return;
        }
        if (this.tick - search.tick >= 4 && this.interactPreferred(obj, [search.action])) search.tick = this.tick;
    }

    /** The cupboard holding `item` under the known layout, or null. */
    cupboardFor(item) {
        for (const [key, obj] of this.alch.cupboards) {
            if (this.predictCupboard(this.cupboardIndex(obj)) === item) return { key, obj };
        }
        return null;
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
            a.anchor = null;
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

    /**
     * Cupboard slot 0..5 from its object id (MAGICTRAINING_ALCHEM_CUPBOARDn and
     * its _OPEN twin). As in RuneLite's MTA plugin, contents follow the slot
     * order: slot n+1 holds the item after slot n's, with one empty slot.
     */
    cupboardIndex(obj) {
        const idx = OBJ.CUPBOARDS.indexOf(obj.id);
        return idx >= 0 ? idx >> 1 : -1;
    }

    refreshCupboards() {
        const found = new Map();
        titan.queries.objects(SCAN_RADIUS).ids(...OBJ.CUPBOARDS).forEach((obj) => {
            const wp = obj.worldPoint;
            found.set(`${wp.x},${wp.y},${wp.z}`, obj);
        });
        this.alch.cupboards = found;
    }

    resolveCupboardSearch(counts) {
        const a = this.alch;
        const search = a.pendingSearch;
        if (!search) return;

        // Alching only ever lowers counts, so any rise this tick is the cupboard's answer.
        const prev = a.lastCounts || counts;
        const gained = counts.findIndex((count, idx) => count > prev[idx]);
        let item;
        if (gained >= 0) item = gained;
        else if (a.emptyTick >= search.start) item = EMPTY_CUPBOARD;
        else if (this.tick - search.start > 20) {
            a.pendingSearch = null;
            return;
        } else return;

        a.pendingSearch = null;
        this.recordCupboard(search.key, item);
    }

    /** One search (item or empty) fixes the whole layout until the next rotation. */
    recordCupboard(key, item) {
        const a = this.alch;
        const obj = a.cupboards.get(key);
        const idx = obj ? this.cupboardIndex(obj) : -1;
        if (idx < 0) return;
        const predicted = this.predictCupboard(idx);
        if (predicted !== null && predicted !== item) {
            this.log(`cupboard ${idx} held ${item}, expected ${predicted}; relearning layout`);
        }
        a.anchor = { idx, item };
        a.bestCupboard = null;
    }

    /** Item index 0..4, EMPTY_CUPBOARD, or null while the layout is unknown. */
    predictCupboard(idx) {
        const anchor = this.alch.anchor;
        if (!anchor || idx < 0) return null;
        return mod(anchor.item + idx - anchor.idx, NUM_CUPBOARDS);
    }

    /** The nearest cupboard (to search when the layout is unknown). */
    pickCupboard() {
        const a = this.alch;
        const player = this.local();
        if (!player || a.cupboards.size === 0) return null;
        a.bestCupboard = null;

        const nearest = Array.from(a.cupboards.entries())
            .sort(([, l], [, r]) => player.distanceTo(l.tile) - player.distanceTo(r.tile))[0];
        return nearest ? { key: nearest[0], obj: nearest[1] } : null;
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
        this.countDragonstones();
        if (this.enchantMode.value === ENCH_MODE.DRAGONSTONES) {
            this.tickDragonstones(spell);
            return;
        }

        if (this.enchantDragonstones.value && inv.emptySlots > 0) {
            const dragonstone = titan.queries.groundItems(SCAN_RADIUS).id(ITEM.DRAGONSTONE).nearest();
            if (dragonstone) {
                this.status = "Picking up a dragonstone";
                const key = `dragonstone:${dragonstone.tileX},${dragonstone.tileY}`;
                if (!this.walkingTo(key)) {
                    this.action("Take dragonstone", dragonstone.interact("Take"));
                    this.track(key, inv.size);
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
                this.enchantNext(spell, enchantable);
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
        // Standing directly next to the pile, a click takes shapes every tick, so
        // click every tick. Anywhere else, click once and let the run finish.
        const pileKey = `collect:${pile.tileX},${pile.tileY}`;
        if (!this.nextTo(pile) && this.walkingTo(pileKey)) return;
        if (this.interactPreferred(pile, ["Take-from", "Take"])) this.track(pileKey, inv.size);
    }

    /** Cast the enchant on the next held item, waiting for the last cast to land first. */
    enchantNext(spell, enchantable) {
        const e = this.ench;
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
    }

    /** Session count of dragonstones picked up (from the floor or the shape piles). */
    countDragonstones() {
        const e = this.ench;
        const held = titan.utils.inventory.count(ITEM.DRAGONSTONE);
        if (e.stones !== null && held > e.stones) this.session.dragonstones += held - e.stones;
        e.stones = held;
    }

    /**
     * Dragonstone mode (wiki: Enchanting Chamber). Take every dragonstone
     * lying in the room in one sweep around it, enchanting a held one while
     * running to the next, then enchant the rest and hop worlds for fresh
     * spawns instead of waiting for the slow respawn. Orbs are deposited only
     * when the inventory is full.
     */
    tickDragonstones(spell) {
        const e = this.ench;
        const inv = titan.utils.inventory;
        const held = titan.queries.inventory().ids(...ENCHANTABLE).toArray();
        const ground = inv.emptySlots > 0 ? this.nextSweepStone() : null;

        if (ground) {
            const key = `dragonstone:${ground.tileX},${ground.tileY}`;
            if (!this.walkingTo(key)) {
                this.status = "Picking up a dragonstone";
                if (this.action("Take dragonstone", ground.interact("Take"))) this.track(key, inv.size);
                return;
            }
            this.status = "Running to a dragonstone";
            // Enchant one on the way (spells are 3 ticks apart); this doesn't stop the run.
            if (held.length > 0 && this.tick - e.runCastTick >= 3) {
                const next = this.nextEnchantTarget(held, e.bonus);
                if (this.action(`${spell.name || "Enchant"} on ${next.name} (running)`, next.castOn(spell))) {
                    this.session.casts++;
                    e.runCastTick = this.tick;
                }
            }
            return;
        }

        if (held.length > 0) {
            this.enchantNext(spell, held);
            return;
        }
        if (inv.emptySlots === 0 && inv.count(ITEM.ORB) > 0) {
            this.depositOrbs();
            return;
        }
        this.hopForDragonstones();
    }

    /**
     * The next dragonstone going round the room like a player would: start at
     * the nearest spawn with a stone, head whichever way round the ring reaches
     * the next stone in fewer spawns, then keep that direction for the rest of
     * this world. The current target is kept until it's picked up. A stone off
     * the ring (unexpected) is taken last, nearest first.
     */
    nextSweepStone() {
        const e = this.ench;
        const stones = titan.queries.groundItems(SCAN_RADIUS).id(ITEM.DRAGONSTONE).toArray();
        if (stones.length === 0) return null;
        const wp = (stone) => stone.worldPoint;
        const sweep = e.sweep;
        if (sweep && sweep.target) {
            const target = stones.find((stone) => wp(stone).x === sweep.target.x && wp(stone).y === sweep.target.y);
            if (target) return target;
            if (sweep.target.index >= 0) sweep.index = sweep.target.index;   // picked up: carry on from there
            sweep.target = null;
        }

        const player = this.local();
        const byDistance = (l, r) => (player ? player.distanceTo(l.tile) - player.distanceTo(r.tile) : 0);
        const onRing = stones.filter((stone) => this.ringIndex(wp(stone)) >= 0);
        let next;
        if (onRing.length === 0) {
            next = stones.sort(byDistance)[0];
            if (!e.sweep) e.sweep = { dir: 0, index: -1, target: null };
        } else if (!sweep || sweep.index < 0) {
            next = onRing.sort(byDistance)[0];
            e.sweep = { dir: 0, index: this.ringIndex(wp(next)), target: null };
        } else {
            const n = DRAGONSTONE_RING.length;
            // Spawns to walk past going `dir`; a stone back on the current spot counts as a full lap.
            const steps = (stone, dir) => mod(dir * (this.ringIndex(wp(stone)) - sweep.index), n) || n;
            const closest = (dir) => onRing.slice().sort((l, r) => steps(l, dir) - steps(r, dir) || byDistance(l, r))[0];
            if (sweep.dir === 0) {
                const cw = closest(1);
                const ccw = closest(-1);
                const diff = steps(cw, 1) - steps(ccw, -1);
                sweep.dir = diff < 0 || (diff === 0 && byDistance(cw, ccw) <= 0) ? 1 : -1;
            }
            next = closest(sweep.dir);
        }
        e.sweep.target = { x: wp(next).x, y: wp(next).y, index: this.ringIndex(wp(next)) };
        return next;
    }

    /** Position of a world tile on DRAGONSTONE_RING (within a tile), or -1. */
    ringIndex(point) {
        return DRAGONSTONE_RING.findIndex((spot) => chebyshev(spot, point) <= 1);
    }

    hopForDragonstones() {
        const minTicks = Math.ceil((this.hopMinSeconds.value | 0) / 0.6);
        const wait = minTicks - (this.tick - this.lastHopTick);
        if (wait > 0) {
            this.status = `No dragonstones - hopping in ${formatTicks(wait)}`;
            return;
        }
        const from = titan.state.world.current();
        const to = this.nextHopWorld(from);
        if (to === null) {
            this.warnOnce("hop-none", "No world to hop to",
                "No members world passed the filters (not PvP, high-risk, skill-total, beta or seasonal"
                + (this.hopSameRegion.value ? ", same region" : "") + ").",
                "Turn off 'Hop within my region', or check the world list has loaded.");
            this.wait(5, 8);
            return;
        }
        this.status = `Hopping to world ${to}`;
        const ok = titan.state.world.hopIngame(to);
        this.crumb(`Hop to world ${to}`, ok ? "action" : "fail");
        if (ok) {
            this.hopping = { from, to, tick: this.tick, arrived: -1 };
            this.lastHopTick = this.tick;
            this.hopFails = 0;
            this.session.hops++;
            if (from !== null) {
                this.recentWorlds.push(from);
                if (this.recentWorlds.length > RECENT_WORLDS) this.recentWorlds.shift();
            }
            return;
        }
        // Refused: skip this world for a while and try the next one.
        this.badWorlds.set(to, this.tick + BAD_WORLD_TICKS);
        this.hopFails++;
        if (this.hopFails === HOP_FAIL_REPORT) this.reportHopFailure(to);
        this.wait(2, 3);
    }

    /** Why hopIngame said no: it only accepts worlds in the client's own list, and not while busy. */
    reportHopFailure(to) {
        const world = titan.state.world;
        const live = world.list() || [];
        const info = (world.metadata() || []).find((w) => w.id === to);
        const skipped = [...this.badWorlds.entries()].filter(([, until]) => until > this.tick).map(([id]) => id);
        this.report("failing", "World hops keep failing",
            `The client refused ${this.hopFails} hops in a row (last: world ${to}). It only accepts worlds in `
            + `its own world list and not while a hop is still in progress. Client list: ${live.length} worlds, `
            + `world ${to} ${live.some((w) => w.id === to) ? "is" : "is NOT"} in it`
            + (info ? `; SLR says activity "${info.activity}", flags ${info.flags}.` : ".")
            + ` Skipping for now: ${skipped.join(", ") || "none"}.`,
            "It keeps trying other worlds on its own. If every hop fails, open the world switcher once "
            + "(so the client loads its list) or hop by hand, then send this report.");
    }

    /**
     * Next world after `current` by id: members, not PvP/high-risk/skill-total/
     * beta/seasonal, online, not visited recently, and (by setting) in the same
     * region. Null when none qualify.
     */
    nextHopWorld(current) {
        const world = titan.state.world;
        const meta = world.metadata() || [];
        const worlds = meta.length > 0 ? meta : (world.list() || []);
        const here = meta.find((w) => w.id === current);
        const region = this.hopSameRegion.value && here ? here.region : null;
        // hopIngame only accepts worlds in the client's own list, which can lag the SLR one.
        const live = new Set((world.list() || []).map((w) => w.id));
        const usable = worlds.filter((w) => w.isMembers && !w.isBeta
            && (live.size === 0 || live.has(w.id))
            && !(this.badWorlds.get(w.id) > this.tick)
            && (w.flags & HOP_EXCLUDED_FLAGS) === 0
            && !HOP_EXCLUDED_ACTIVITY.test(w.activity || "")
            && (w.population === undefined || w.population >= 0)
            && (!region || w.region === region)
            && w.id !== current);
        if (usable.length === 0) return null;
        const fresh = usable.filter((w) => !this.recentWorlds.includes(w.id));
        const pool = (fresh.length > 0 ? fresh : usable).sort((l, r) => l.id - r.id);
        const next = pool.find((w) => current === null || w.id > current) || pool[0];
        return next.id;
    }

    /** True while a world hop is in flight or the new world is still loading. */
    waitForHop() {
        const h = this.hopping;
        const now = titan.state.world.current();
        const arrived = now !== null ? now !== h.from : this.tick - h.tick >= 10;
        if (arrived) {
            if (h.arrived < 0) h.arrived = this.tick;
            if (this.tick - h.arrived < HOP_SETTLE_TICKS) {
                this.status = `World ${now === null ? h.to : now}: loading`;
                return true;
            }
            this.event(`Hopped to world ${now === null ? h.to : now}`);
            this.hopping = null;
            this.pending = null;
            if (this.ench) this.ench.sweep = null;
            return false;
        }
        if (this.tick - h.tick > HOP_TIMEOUT_TICKS) {
            this.crumb(`Hop to world ${h.to} timed out`, "fail");
            this.hopping = null;
            return false;
        }
        this.status = `Hopping to world ${h.to}`;
        return true;
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

    /**
     * The pile to take from: the bonus shape's when "bonus only" is on, else
     * the nearest. Once picked it's kept until the bonus shape changes, so
     * running past other piles (or a one-tick unreadable bonus) never retargets.
     */
    pickShapePile(bonus) {
        const e = this.ench;
        const piles = titan.queries.objects(SCAN_RADIUS).ids(...OBJ.SHAPE_PILES).toArray();
        const player = this.local();
        if (piles.length === 0 || !player) return null;
        const want = this.enchantBonusOnly.value && bonus ? bonus.key : null;
        const locked = e.pileKey && piles.find((pile) => tileKey(pile.tile) === e.pileKey);
        if (locked && (!want || this.pileShape(locked) === want)) return locked;

        piles.sort((l, r) => player.distanceTo(l.tile) - player.distanceTo(r.tile));
        const pile = (want && piles.find((candidate) => this.pileShape(candidate) === want)) || piles[0];
        e.pileKey = tileKey(pile.tile);
        return pile;
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

        const g = this.grave;
        const bones = titan.queries.inventory().ids(...ITEM.BONES).toArray();
        this.observeBones(bones);
        const fruitValue = bones.reduce((sum, bone) => sum + (BONE_FRUIT[bone.id] || 0), 0);
        const usePeaches = this.useBonesToPeaches();
        const capacity = inv.emptySlots + bones.length;
        const target = usePeaches ? Math.min(PEACHES_PER_DEPOSIT, capacity) : capacity;
        Object.assign(g, { fruitValue, target, bones: bones.length, peaches: usePeaches });

        if (bones.length > 0 && this.graveShouldCast(fruitValue, capacity, usePeaches)) {
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

        const pile = this.gravePile();
        if (!pile) {
            this.status = "No bone piles found";
            this.walkFallback(COORDS.roomCenters[ROOM.GRAVEYARD]);
            this.wait(2, 3);
            return;
        }
        this.status = `Grabbing bones (${fruitValue}/${target} fruit)`;
        // Running to the pile: click once and let the walk finish. Once the first bone
        // lands, a click loots a bone every tick, so click every tick until the threshold.
        if (bones.length === 0 && this.walkingTo("grab-bones")) return;
        if (this.interactPreferred(pile, ["Grab"])) this.track("grab-bones", bones.length);
    }

    /**
     * When to stop grabbing and cast. Peaches: once the total reaches 24, the
     * 3-point cap per deposit. Bananas have no reachable cap (16 per point), so
     * fill the inventory: cast when the next bone might not fit as fruit.
     */
    graveShouldCast(fruitValue, capacity, usePeaches) {
        if (fruitValue + (this.nextBoneValue() || 4) > capacity) return true;
        return usePeaches && fruitValue >= PEACHES_PER_DEPOSIT;
    }

    /** Fruit value of the pile's next bone, or 0 while its place in the rotation is unknown. */
    nextBoneValue() {
        const g = this.grave;
        if (!g.synced) return 0;
        return g.run < BONE_BLOCK ? g.type : g.type % 4 + 1;
    }

    /** Learn the pile's place in its rotation from the bones that just landed in the inventory. */
    observeBones(bones) {
        const g = this.grave;
        const counts = [0, 0, 0, 0, 0];
        bones.forEach((bone) => { counts[BONE_FRUIT[bone.id] || 0]++; });
        const prev = g.counts;
        g.counts = counts;
        if (!prev) return;
        const gained = [1, 2, 3, 4].filter((type) => counts[type] > prev[type]);
        if (gained.length > 1) {
            // Several types in one tick: the order is unclear, so relearn.
            Object.assign(g, { type: 0, run: 0, synced: false });
        } else if (gained.length === 1) {
            const type = gained[0];
            for (let i = prev[type]; i < counts[type]; i++) this.recordBone(type);
        }
    }

    recordBone(type) {
        const g = this.grave;
        if (type !== g.type) {
            // A new type starts a block; the very first bone seen could be anywhere in one.
            Object.assign(g, { synced: g.type !== 0, type, run: 1 });
            return;
        }
        g.run++;
        if (g.run === BONE_BLOCK) g.synced = true;
        else if (g.run > BONE_BLOCK) Object.assign(g, { synced: false, run: 1 });
    }

    /** The bone pile nearest a food chute (the wiki's route), kept for the whole visit. */
    gravePile() {
        const g = this.grave;
        const piles = titan.queries.objects(SCAN_RADIUS).ids(...OBJ.BONE_PILES).toArray();
        if (piles.length === 0) return null;
        const locked = g.pileKey && piles.find((pile) => tileKey(pile.tile) === g.pileKey);
        if (locked) return (g.pile = locked);

        const chutes = titan.queries.objects(SCAN_RADIUS).id(OBJ.FOOD_CHUTE).toArray();
        const player = this.local();
        const toChute = (pile) => Math.min(...chutes.map((chute) => chebyshev(pile.tile, chute.tile)));
        const toPlayer = (pile) => (player ? player.distanceTo(pile.tile) : 0);
        piles.sort((l, r) => (chutes.length ? toChute(l) - toChute(r) : 0) || toPlayer(l) - toPlayer(r));
        g.pile = piles[0];
        g.pileKey = tileKey(g.pile.tile);
        Object.assign(g, { type: 0, run: 0, synced: false });
        this.crumb(`Using the bone pile at ${g.pileKey}`, "info");
        return g.pile;
    }

    /**
     * Falling bones hit the tile they land on for 2 damage. Their graphic shows
     * on the tile before the hit, so when one is on the player's tile, step to
     * a free neighbour (next to the pile when possible). Returns true while dodging.
     */
    dodgeFallingBones() {
        const player = this.local();
        if (!player) return false;
        const drops = titan.queries.graphicsObjects()
            .where((drop) => BONE_DROP_SPOTANIMS.includes(drop.spotAnimId)).toArray();
        if (drops.length === 0) return false;
        const danger = new Set(drops.map((drop) => `${drop.worldX},${drop.worldY}`));
        if (!danger.has(`${player.worldX},${player.worldY}`)) return false;

        const g = this.grave;
        const drop = drops.find((d) => d.worldX === player.worldX && d.worldY === player.worldY);
        const key = `${drop.worldX},${drop.worldY},${drop.startCycle}`;
        if (g.dodgeKey === key && this.tick - g.dodgeTick < 2) return true;

        const here = player.tile;
        const collisions = titan.state.collisions;
        const pile = g.pile && g.pile.exists ? g.pile.tile : null;
        const steps = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                if (danger.has(`${player.worldX + dx},${player.worldY + dy}`)) continue;
                if (collisions.isBlocked(here.plane, here.x, here.y, dx, dy)) continue;
                const tile = { x: here.x + dx, y: here.y + dy, plane: here.plane };
                if (!this.isWalkable(tile.plane, tile.x, tile.y)) continue;
                steps.push({ tile, toPile: pile ? chebyshev(tile, pile) : 0, diagonal: dx !== 0 && dy !== 0 });
            }
        }
        if (steps.length === 0) return false;
        steps.sort((l, r) => l.toPile - r.toPile || l.diagonal - r.diagonal);
        const step = steps[0].tile;
        this.status = "Dodging a falling bone";
        this.action(`Dodge to ${step.x},${step.y}`, titan.state.walk.toScene(step.x, step.y));
        g.dodgeKey = key;
        g.dodgeTick = this.tick;
        this.session.dodges++;
        this.pending = null;
        return true;
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
        const pile = this.grave.pile;
        const chute = pile ? titan.queries.objects(SCAN_RADIUS).id(OBJ.FOOD_CHUTE).nearestTo(pile.tile) : null;
        return this.depositInto(OBJ.FOOD_CHUTE, "Depositing fruit", this.fruitCount(), COORDS.graveyardChute, chute);
    }

    // ---- Shared actions -----------------------------------------------------
    /**
     * Use the "Deposit" option of `objectId` until `amount` stops dropping.
     * Returns true while it acted (or is waiting on the deposit).
     */
    depositInto(objectId, label, amount, fallback, preferred = null) {
        this.status = label;
        const target = preferred || titan.queries.objects(SCAN_RADIUS).id(objectId).nearest();
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

    /**
     * True while the last click on `key` is still being walked to: the player
     * is moving, or clicked under 2 ticks ago. Once idle again, click again.
     */
    walkingTo(key) {
        const p = this.pending;
        if (!p || p.key !== key) return false;
        const player = this.local();
        return (player && !player.isStationary) || this.tick - p.tick < 2;
    }

    /** True when the player stands still, directly (not diagonally) next to `obj`'s footprint. */
    nextTo(obj) {
        const player = this.local();
        if (!player || !obj || !player.isStationary) return false;
        const p = player.tile;
        const w = Math.max(1, obj.sizeX | 0);
        const h = Math.max(1, obj.sizeY | 0);
        if (p.plane !== obj.plane) return false;
        const alongX = p.x >= obj.tileX && p.x < obj.tileX + w;
        const alongY = p.y >= obj.tileY && p.y < obj.tileY + h;
        return (alongX && (p.y === obj.tileY - 1 || p.y === obj.tileY + h))
            || (alongY && (p.x === obj.tileX - 1 || p.x === obj.tileX + w));
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
        if (this.goalMode.value !== GOAL_MODE.GREEN_LOG) return this.goalSettings[room].value;
        return this.missingRewards().reduce((sum, reward) => sum + reward.cost[room], 0);
    }

    // ---- Rewards / green log -------------------------------------------------
    /** Rewards the green-log goal still needs, cheapest wand first. */
    goalRewards() {
        return REWARDS.filter((reward) => this.countsTowardGoal(reward));
    }

    countsTowardGoal(reward) {
        return reward.log || (!!reward.optional && !!this[reward.optional].value);
    }

    missingRewards() {
        return this.goalRewards().filter((reward) => !this.owned.has(reward.key));
    }

    /**
     * Keep `owned` current: the Bones to Peaches unlock varbit, any reward item
     * in the inventory (a fresh purchase lands there), and the collection log's
     * Magic Training Arena page while it's open (authoritative for its items).
     */
    trackRewards() {
        let changed = false;
        const add = (key) => {
            if (this.owned.has(key)) return;
            this.owned.add(key);
            changed = true;
            const reward = REWARDS.find((r) => r.key === key);
            if (this.logRead || !reward.log) this.event(`${reward.name} owned - goal lowered`, COLOR.GOOD);
        };
        if (titan.state.vars.varbit(VARBIT_PEACHES_UNLOCKED) > 0) add("peaches");
        titan.queries.inventory().ids(...REWARD_ITEMS).forEach((item) => {
            const reward = REWARDS.find((r) => r.item === item.id);
            if (reward) add(reward.key);
        });
        if (this.readCollectionLog()) changed = true;
        if (changed) this.saveRewards();
    }

    /** Read owned items off the open collection log page; true when anything changed. */
    readCollectionLog() {
        if (!this.isWidgetVisible(WIDGET.CLOG_ITEMS)) return false;
        const slots = titan.queries.widgets(WIDGET.CLOG_GROUP)
            .where((w) => w.packedId === WIDGET.CLOG_ITEMS && w.dynamicChildSlot === -1)
            .children()
            .toArray();
        const logged = REWARDS.filter((reward) => reward.log);
        const found = logged.filter((reward) => slots.some((slot) => slot.itemId === reward.item));
        if (found.length < 6) return false;     // some other page
        let changed = !this.logRead;
        this.logRead = true;
        found.forEach((reward) => {
            // Like RuneLite: obtained items are drawn at full opacity, missing ones faded.
            const have = slots.some((slot) => slot.itemId === reward.item && slot.opacity === 0);
            if (have === this.owned.has(reward.key)) return;
            if (have) this.owned.add(reward.key);
            else this.owned.delete(reward.key);
            changed = true;
        });
        if (changed) {
            const done = logged.filter((reward) => this.owned.has(reward.key)).length;
            this.event(`Collection log read: ${done}/${logged.length} MTA items`, COLOR.GOOD);
        }
        return changed;
    }

    loadRewards() {
        try {
            const saved = JSON.parse(this.rewardsStore.value || "null");
            if (saved && Array.isArray(saved.owned)) {
                this.owned = new Set(saved.owned.filter((key) => REWARDS.some((r) => r.key === key)));
                this.logRead = !!saved.logRead;
            }
        } catch (error) {
            this.owned = new Set();
            this.logRead = false;
        }
    }

    saveRewards() {
        this.rewardsStore.value = JSON.stringify({ owned: [...this.owned], logRead: this.logRead });
    }

    resetRewards() {
        this.owned = new Set();
        this.logRead = false;
        this.saveRewards();
        this.event("Forgot owned rewards - open the collection log to re-read them");
    }

    buildRewardsTab(panel) {
        const green = this.goalMode.value === GOAL_MODE.GREEN_LOG;
        panel.separatorText(green ? "Green log goal" : "Rewards (goal mode: Manual)");
        if (!this.logRead) panel.label("Collection log", "not read - open its Magic Training Arena page");
        panel.beginTable("mta_rewards", 3);
        ["Reward", "Owned", "Cost (T / A / E / G)"].forEach((label) => panel.tableSetupColumn(label));
        panel.tableHeadersRow();
        REWARDS.forEach((reward) => {
            const counted = this.countsTowardGoal(reward);
            const cells = [
                reward.name + (counted ? "" : " (not counted)"),
                this.owned.has(reward.key) ? "Yes" : "-",
                reward.cost.map((c) => c.toLocaleString()).join(" / "),
            ];
            panel.tableNextRow();
            cells.forEach((cell) => {
                panel.tableNextColumn();
                panel.text(cell);
            });
        });
        panel.endTable();
        const missing = this.missingRewards();
        const left = ROOMS.map((room) => missing.reduce((sum, r) => sum + r.cost[room], 0).toLocaleString());
        panel.label("Still to buy", `${missing.length} (${left.join(" / ")} pts)`);
        panel.spacing().button("Forget owned rewards", 7);
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
            dodges: 0,
            dragonstones: 0,
            hops: 0,
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
            if (this.goalMode.value === GOAL_MODE.GREEN_LOG) {
                const all = this.goalRewards();
                const have = all.filter((reward) => this.owned.has(reward.key)).length;
                line("Green log", this.logRead ? `${have} / ${all.length} owned` : "open collection log",
                    this.logRead ? (have === all.length ? COLOR.GOOD : COLOR.TEXT) : COLOR.WARN);
            }
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
                line("Best cupboard", a.bestCupboard ? "Known" : "Searching (1 search reveals all)",
                    a.bestCupboard ? COLOR.GOOD : COLOR.WARN);
                const held = this.alchItemCounts();
                line("Held", ALCH_ITEM_NAMES.map((name, i) => `${name.slice(0, 4)} ${held[i]}`).join("  "));
                line("Coins held", `${inv.count(ITEM.MTA_COINS).toLocaleString()} / ${this.alchDepositAt.value.toLocaleString()}`);
                line("Coins deposited", this.session.deposited[ROOM.ALCHEMIST].toLocaleString());
                break;
            }
            case ROOM.ENCHANTING: {
                const e = this.ench;
                title("Enchanting");
                const stoneMode = this.enchantMode.value === ENCH_MODE.DRAGONSTONES;
                line("Mode", stoneMode ? "Dragonstones + hop" : "Shapes");
                const shapes = titan.queries.inventory().ids(...ENCHANTABLE).count();
                if (stoneMode) {
                    const world = titan.state.world.current();
                    line("Dragonstones", `${this.session.dragonstones} taken, ${shapes} to enchant`);
                    line("World hops", `${this.session.hops}${world === null ? "" : `  (now w${world})`}`);
                } else {
                    line("Bonus shape", e.bonus ? capitalize(e.bonus.key) : "Unknown", e.bonus ? COLOR.GOOD : COLOR.DIM);
                    line("Phase", `${capitalize(e.phase)}  (${shapes} to enchant)`);
                }
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
                const next = this.nextBoneValue();
                line("Pile", !g.pile ? "-" : next
                    ? `next: ${next}-fruit bone (${g.run < BONE_BLOCK ? BONE_BLOCK - g.run : BONE_BLOCK} of that type left)`
                    : "learning rotation");
                line("Fruit", `${this.fruitCount()} held, ${this.session.deposited[ROOM.GRAVEYARD].toLocaleString()} deposited`);
                line("Food eaten", this.session.eaten);
                line("Bones dodged", this.session.dodges);
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

        panel.beginTabItem("Rewards");
        this.buildRewardsTab(panel);
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
        else if (actionId === 7) this.resetRewards();
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
        } else if (this.currentRoom === ROOM.GRAVEYARD && this.grave.pile && this.grave.pile.exists) {
            const pile = this.grave.pile;
            overlay.tileObjectHull(pile, COLOR.ACCENT, 0x339B7BFF);
            const next = this.nextBoneValue();
            if (labels) this.tileLabel(pile.tileX, pile.tileY, pile.plane, next ? `Next: ${next}` : "Bones", COLOR.TEXT);
        }
    }

    /** What each cupboard holds: seen (white), inferred (grey), or the target (green). */
    labelCupboards() {
        const a = this.alch;
        a.cupboards.forEach((obj, key) => {
            const idx = this.cupboardIndex(obj);
            const seen = !!a.anchor && a.anchor.idx === idx;
            const item = this.predictCupboard(idx);
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
