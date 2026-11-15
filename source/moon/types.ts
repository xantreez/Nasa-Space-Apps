// Shared contract for the /game Moon outpost game ("Junior Astronaut: Moon Outpost").
// Every module (data, engine, scene, UI) codes against these types only.
// Pure TS — no Vue imports here.

/** The five survival resources. 0..100. Any of them hitting 0 = mission failed. */
export type ResKey = "oxygen" | "energy" | "shield" | "food" | "comms";
export type Resources = Record<ResKey, number>;
export type ResDelta = Partial<Record<ResKey, number>>;

/** Age band picked on the title screen. Drives card difficulty. */
export type AgeBand = "cadet" /* 7–9 */ | "specialist" /* 10–12 */;

/** Places on the base map Tobish can walk to. */
export type LocationId =
  | "habitat" // life support / oxygen
  | "greenhouse" // food
  | "solar" // energy
  | "shelter" // radiation protection
  | "radio" // communication with Earth
  | "lab"; // the working computer — science, sending data to NASA

export const LOCATION_RES: Record<LocationId, ResKey | "science"> = {
  habitat: "oxygen",
  greenhouse: "food",
  solar: "energy",
  shelter: "shield",
  radio: "comms",
  lab: "science",
};

/** Where a fact comes from. Shown on every card as a badge — judges look for it. */
export interface Source {
  name: string; // e.g. "NASA DONKI", "MSL RAD (PDS PPI)", "NASA OSDR", "NASA Moon Trek", "NASA NTRS"
  url: string;
  detail?: string; // e.g. "FLR 2024-05-14T16:46Z, class X8.7"
}

/** A study card + its quiz question. Appears when Tobish reaches a location. */
export interface Card {
  id: string;
  location: LocationId;
  age: AgeBand;
  title: string;
  /** 2–4 short sentences, kid-friendly, scientifically correct. */
  body: string;
  /** One big number/fact to show as a highlight, e.g. { value: "1.3 s", label: "radio delay Earth → Moon" } */
  stat?: { value: string; label: string };
  /** Path under /public, e.g. "/moon/img/veggie.jpg" (real NASA image), optional. */
  image?: string;
  imageCredit?: string;
  source: Source;
  question: {
    q: string;
    options: string[]; // 3 (cadet) or 4 (specialist)
    correct: number; // index into options
    hint: string; // shown after a wrong answer, before the 2nd try
    explain: string; // shown after answering, 1–2 sentences
  };
}

/** A real space-weather event from NASA DONKI, already mapped to game effects. */
export interface SpaceWeatherEvent {
  id: string; // DONKI activityID / flrID / gstID
  kind: "FLR" | "CME" | "SEP" | "GST" | "QUIET";
  /** ISO time from DONKI */
  time: string;
  /** e.g. "X8.7" for flares, speed "1800 km/s" for CMEs, "Kp 9" for GST */
  magnitude: string;
  title: string; // kid-friendly: "Giant solar flare (X8.7)!"
  text: string; // what it means for the Moon outpost
  severity: 0 | 1 | 2 | 3; // 0 quiet … 3 extreme
  /** Raw daily effect if the player does nothing about it. */
  effect: ResDelta;
  source: Source;
}

/** A historical period of real space weather. Each run plays through one window. */
export interface MissionWindow {
  id: string;
  name: string; // "May 2024 — the Gannon Storm"
  blurb: string;
  /** One entry per game day (day 1 = index 0). Use kind "QUIET" for calm days. */
  days: SpaceWeatherEvent[];
}

export interface DecisionOption {
  id: string;
  label: string; // short button text, kid-friendly
  emoji: string;
  effects: ResDelta;
  science?: number; // science points gained (can be 0)
  /** What happens — shown on the consequences screen. Present tense, 1–2 sentences. */
  outcome: string;
  /** The science/engineering lesson behind it, 1 sentence. */
  lesson: string;
}

/** A choice with trade-offs. After picking, ALL options' outcomes are shown side by side. */
export interface Decision {
  id: string;
  title: string;
  prompt: string; // Tobish's radio message describing the dilemma
  options: DecisionOption[]; // 2–3
  source?: Source;
}

export type BuildId =
  | "o2-generator"
  | "garden"
  | "big-dish"
  | "storm-shelter"
  | "battery-bank"
  | "colony"
  | "science-lab"
  | "city";

export interface Mission {
  id: string;
  index: number; // 1..6
  title: string; // "First Breath"
  goal: string; // one line for the HUD
  briefing: string; // Tobish radio message at mission start
  /** Location(s) the player must visit and answer cards correctly at. */
  tasks: { location: LocationId; cards: number }[];
  /** Decision that must be made during this mission (ids from decisions). */
  decisionId?: string;
  /** Minimum science to complete (lab missions). */
  scienceNeeded?: number;
  reward: { builds: BuildId[]; res?: ResDelta; text: string };
  /** Arcade mini-game the player must beat at `location` to finish the mission. */
  game?: MissionGame;
}

export interface MissionGame {
  id: MiniGameId;
  location: LocationId;
  difficulty: 1 | 2 | 3;
  title: string; // "Seal the habitat!"
}

export type Phase =
  | "title"
  | "age"
  | "briefing" // mission briefing radio message
  | "map" // walking around the base
  | "event" // start-of-day space weather report
  | "card" // study card → quiz
  | "decision"
  | "consequences"
  | "minigame"
  | "reward" // choose where the earned supplies go
  | "mission-complete"
  | "failed"
  | "won";

export interface Consequence {
  decision: Decision;
  chosenId: string;
  /** Resources before the choice and after EACH option (so UI can draw compare bars). */
  before: Resources;
  after: Record<string, Resources>; // optionId -> resources if that option had been chosen
  failedIf: Record<string, ResKey | null>; // optionId -> resource that would hit 0 (if any)
}

export interface LogEntry {
  day: number;
  text: string;
  tone: "good" | "bad" | "info";
}

export interface GameState {
  phase: Phase;
  age: AgeBand;
  windowId: string;
  day: number; // 1-based
  /** Actions left today. Each location visit costs 1. Day ends at 0 (or "End day" button). */
  actions: number;
  actionsPerDay: number;
  res: Resources;
  science: number;
  missionIdx: number; // 0-based into MISSIONS
  /** progress for current mission: location -> correct cards answered */
  progress: Partial<Record<LocationId, number>>;
  decisionDone: boolean;
  built: BuildId[];
  /** Tobish's position on the map */
  at: LocationId;
  /** Card currently open (phase "card") */
  card: Card | null;
  cardTries: number; // wrong tries so far: 0, 1, 2
  /** (engine) true once the open card is resolved (answered correctly or failed twice); wait for closeCard */
  cardDone?: boolean;
  /** (engine) ids of random daily dilemmas already shown this run */
  seenDilemmas?: string[];
  usedCards: string[];
  /** Today's space-weather event (phase "event" shows it) */
  today: SpaceWeatherEvent | null;
  /** True when Tobish spent the night in the shelter / shields are up */
  sheltered: boolean;
  decision: Decision | null;
  consequence: Consequence | null;
  failReason: { res: ResKey; why: string; lesson: string } | null;
  log: LogEntry[];
  /** Mini-game currently running (phase "minigame"). */
  minigame?: MissionGame | null;
  gameDone?: boolean;
  lastGame?: { won: boolean; score: number; reward: ResDelta; science: number } | null;
  /** Earned supplies waiting for the player to choose where they go (phase "reward"). */
  pendingReward?: { amount: number; home: ResKey; from: string } | null;
  /** Snapshot at the start of the current mission — "emergency reserve" retry after a failure. */
  checkpoint?: GameState | null;
  /** Number of mission retries used (shown on the end screen). */
  retries?: number;
  /** True right after a retry, so the briefing can say so. */
  retried?: boolean;
}

// ---------- mini-games ----------
export type MiniGameId = "meteor" | "rover" | "blocks" | "signal";

/** Every mini-game component (components/Moon/games/*.vue) takes these props and emits `finish`. */
export interface MiniGameProps {
  age: AgeBand;
  /** 1 = first time / easy, 2 = normal, 3 = hard (later missions). */
  difficulty: 1 | 2 | 3;
}
export interface MiniGameResult {
  won: boolean;
  /** 0..100 — how well it went (drives the reward size). */
  score: number;
}
