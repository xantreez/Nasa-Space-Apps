// Game engine for /game (Moon outpost). Pure functions: never mutate the input, always return a new state.
import { LOCATION_RES } from "./types";
import type {
  AgeBand,
  BuildId,
  Card,
  Consequence,
  GameState,
  LocationId,
  LogEntry,
  Mission,
  ResDelta,
  ResKey,
  Resources,
  SpaceWeatherEvent,
} from "./types";
import { CARDS } from "./data/cards";
import { WINDOWS } from "./data/donki";
import { FAIL_LESSONS } from "./data/facts";
import { MISSIONS } from "./missions";
import { DAILY_IDS, DECISIONS, stormDecision } from "./decisions";

export const RES_KEYS: ResKey[] = ["oxygen", "energy", "shield", "food", "comms"];

export const RES_META: Record<ResKey, { label: string; emoji: string; color: string; unit: string; short: string }> = {
  oxygen: { label: "Oxygen", emoji: "🫧", color: "#4fd1ff", unit: "%", short: "O₂" },
  energy: { label: "Energy", emoji: "⚡", color: "#ffd23f", unit: "%", short: "PWR" },
  shield: { label: "Shield", emoji: "🛡️", color: "#7cf29c", unit: "%", short: "RAD" },
  food: { label: "Food", emoji: "🥕", color: "#ff9f43", unit: "%", short: "FOOD" },
  comms: { label: "Comms", emoji: "📡", color: "#ff6b9d", unit: "%", short: "COM" },
};

export const START_RES: Resources = { oxygen: 70, energy: 70, shield: 70, food: 70, comms: 70 };

/** Balance knobs (the sim in moon/sim.test.ts tunes these). */
export const TUNING = {
  actionsPerDay: 4,
  reward: 15, // resource gained for a first-try correct answer
  science: 10, // science gained at the lab for a first-try correct answer
  drain: { oxygen: 6, food: 5, energy: 7, comms: 3, shield: 2 } as Resources,
  drainBuilt: { oxygen: 2, food: 2, energy: 3, comms: 1 } as Partial<Resources>,
  colonyDrain: { oxygen: 1, food: 1, energy: 1 } as Partial<Resources>,
  nightEnergy: 5, // extra energy drain during the lunar night mission
  hitScale: 1.0, // multiplies every negative space-weather effect
  maxHit: 35, // cap on one negative event effect
  shelterFactor: 0.5, // visiting the shelter the day before
  shelterBuildFactor: 0.5, // storm-shelter build
  dilemmaChance: 0.3,
};

const BUILD_FOR_DRAIN: Record<string, BuildId> = {
  oxygen: "o2-generator",
  food: "garden",
  energy: "battery-bank",
  comms: "big-dish",
};

// ---------- helpers ----------

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function applyDelta(res: Resources, d: ResDelta): Resources {
  const out = { ...res };
  for (const k of RES_KEYS) if (d[k] != null) out[k] = clamp(out[k] + (d[k] as number));
  return out;
}

function clone(s: GameState): GameState {
  return structuredClone(s);
}

function pushLog(s: GameState, text: string, tone: LogEntry["tone"] = "info") {
  s.log.push({ day: s.day, text, tone });
  if (s.log.length > 200) s.log.splice(0, s.log.length - 200);
}

function mission(s: GameState): Mission {
  return MISSIONS[Math.min(s.missionIdx, MISSIONS.length - 1)];
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** The lowest resource, if any is at 0 (or below). */
function zeroed(res: Resources): ResKey | null {
  let worst: ResKey | null = null;
  for (const k of RES_KEYS) if (res[k] <= 0 && (worst === null || res[k] < res[worst])) worst = k;
  return worst;
}

function failIfDead(s: GameState): boolean {
  const k = zeroed(s.res);
  if (!k) return false;
  const f = FAIL_LESSONS?.[k] ?? { why: `${RES_META[k].label} ran out.`, lesson: "Keep every resource above zero." };
  s.failReason = { res: k, why: f.why, lesson: f.lesson };
  s.phase = "failed";
  pushLog(s, `${RES_META[k].label} ran out. Mission failed.`, "bad");
  return true;
}

function dailyDrain(built: BuildId[], missionIdx: number): Resources {
  const d = { ...TUNING.drain };
  for (const k of Object.keys(BUILD_FOR_DRAIN) as (keyof typeof BUILD_FOR_DRAIN)[]) {
    if (built.includes(BUILD_FOR_DRAIN[k])) d[k as ResKey] = TUNING.drainBuilt[k as ResKey] ?? d[k as ResKey];
  }
  // more people in the colony use more air, food and power
  if (built.includes("colony")) for (const k of Object.keys(TUNING.colonyDrain) as ResKey[]) d[k] += TUNING.colonyDrain[k] ?? 0;
  // the lunar night (mission 5): no sunlight, panels give nothing
  if (missionIdx === 4) d.energy += TUNING.nightEnergy;
  return d;
}

// ---------- start ----------

export function newGame(age: AgeBand, windowId?: string): GameState {
  const w = (windowId && WINDOWS.find((x) => x.id === windowId)) || pick(WINDOWS);
  const s: GameState = {
    phase: "briefing",
    age,
    windowId: w.id,
    day: 1,
    actions: TUNING.actionsPerDay,
    actionsPerDay: TUNING.actionsPerDay,
    res: { ...START_RES },
    science: 0,
    missionIdx: 0,
    progress: {},
    decisionDone: false,
    built: [],
    at: "habitat",
    card: null,
    cardTries: 0,
    cardDone: false,
    usedCards: [],
    today: null,
    sheltered: false,
    decision: null,
    consequence: null,
    failReason: null,
    seenDilemmas: [],
    log: [],
  };
  pushLog(s, `Window: ${w.name}`, "info");
  s.checkpoint = snapshot(s);
  return s;
}

export function closeBriefing(s: GameState): GameState {
  if (s.phase !== "briefing") return s;
  if (s.retried) s = { ...s, retried: false };
  // first briefing starts day 1, later briefings continue the current day
  if (s.today === null) return beginDay(s);
  const n = clone(s);
  n.phase = "map";
  return n;
}

// ---------- day cycle ----------

export function beginDay(s: GameState): GameState {
  const n = clone(s);
  n.actions = n.actionsPerDay;
  n.card = null;
  n.cardDone = false;
  n.decision = null;
  n.consequence = null;

  // daily drain (builds reduce it)
  const drain = dailyDrain(n.built, n.missionIdx);
  n.res = applyDelta(n.res, {
    oxygen: -drain.oxygen,
    food: -drain.food,
    energy: -drain.energy,
    comms: -drain.comms,
    shield: -drain.shield,
  });

  // today's real space weather
  const w = WINDOWS.find((x) => x.id === n.windowId) ?? WINDOWS[0];
  const ev: SpaceWeatherEvent = w.days[(n.day - 1) % w.days.length];
  n.today = ev;
  const hitFactor =
    (n.sheltered ? TUNING.shelterFactor : 1) * (n.built.includes("storm-shelter") ? TUNING.shelterBuildFactor : 1);
  const hit: ResDelta = {};
  for (const k of RES_KEYS) {
    const v = ev.effect?.[k];
    if (v == null || v === 0) continue;
    hit[k] = v < 0 ? -Math.min(TUNING.maxHit, Math.round(-v * hitFactor * TUNING.hitScale)) : v;
  }
  n.res = applyDelta(n.res, hit);

  if (ev.kind !== "QUIET" && ev.severity > 0) {
    pushLog(
      n,
      n.sheltered ? `${ev.title} We were sheltered, so the damage is smaller.` : `${ev.title}`,
      ev.severity >= 2 ? "bad" : "info",
    );
  }
  n.phase = "event";
  failIfDead(n);
  return n;
}

export function ackEvent(s: GameState): GameState {
  if (s.phase !== "event") return s;
  const n = clone(s);
  n.sheltered = false;
  const ev = n.today;
  // не каждый день: первый день — знакомство с картой; дальше экстремальные события всегда, сильные — через раз
  const stormDue = !!ev && n.day >= 2 && (ev.severity >= 3 || (ev.severity === 2 && n.day % 2 === 0));
  if (ev && stormDue) {
    n.decision = stormDecision(ev);
    n.phase = "decision";
    return n;
  }
  const seen = n.seenDilemmas ?? [];
  const fresh = DAILY_IDS.filter((id) => !seen.includes(id));
  if (n.day >= 2 && fresh.length && Math.random() < TUNING.dilemmaChance) {
    const id = pick(fresh);
    n.seenDilemmas = [...seen, id];
    n.decision = DECISIONS[id];
    n.phase = "decision";
    return n;
  }
  n.phase = "map";
  return n;
}

export function endDay(s: GameState): GameState {
  if (s.phase !== "map") return s;
  const n = clone(s);
  n.day += 1;
  pushLog(n, `Day ${n.day} begins.`, "info");
  return beginDay(n);
}

// ---------- cards ----------

function drawCard(s: GameState, loc: LocationId): Card {
  let pool = CARDS.filter((c) => c.location === loc && c.age === s.age);
  if (!pool.length) pool = CARDS.filter((c) => c.location === loc);
  const fresh = pool.filter((c) => !s.usedCards.includes(c.id));
  if (fresh.length) return pick(fresh);
  if (pool.length) return pick(pool);
  return {
    id: `stub-${loc}`,
    location: loc,
    age: s.age,
    title: "Quiet day",
    body: "Nothing new to learn here today.",
    source: { name: "NASA", url: "https://www.nasa.gov" },
    question: { q: "Ready to move on?", options: ["Yes", "No", "Maybe"], correct: 0, hint: "Pick Yes.", explain: "Onwards!" },
  };
}

export function walkTo(s: GameState, loc: LocationId): GameState {
  if (s.phase !== "map" || s.actions <= 0) return s;
  const n = clone(s);
  n.actions -= 1;
  n.at = loc;
  if (loc === "shelter") n.sheltered = true;
  const g = mission(n).game;
  if (g && !n.gameDone && g.location === loc) {
    n.minigame = g;
    n.lastGame = null;
    n.phase = "minigame";
    return n;
  }
  const card = drawCard(n, loc);
  n.card = card;
  n.cardTries = 0;
  n.cardDone = false;
  if (!n.usedCards.includes(card.id)) n.usedCards.push(card.id);
  n.phase = "card";
  return n;
}

export function answer(
  s: GameState,
  optionIdx: number,
): { state: GameState; correct: boolean; final: boolean; reward: ResDelta; science: number } {
  if (s.phase !== "card" || !s.card || s.cardDone) return { state: s, correct: false, final: true, reward: {}, science: 0 };
  const n = clone(s);
  const card = n.card as Card;
  const loc = card.location;
  const correct = optionIdx === card.question.correct;
  if (!correct) {
    n.cardTries += 1;
    if (n.cardTries >= 2) {
      n.cardDone = true;
      pushLog(n, `${card.title}: not this time. No reward.`, "bad");
      return { state: n, correct: false, final: true, reward: {}, science: 0 };
    }
    return { state: n, correct: false, final: false, reward: {}, science: 0 };
  }
  const full = n.cardTries === 0;
  const kind = LOCATION_RES[loc];
  const reward: ResDelta = {};
  let science = 0;
  if (kind === "science") {
    science = full ? TUNING.science : Math.ceil(TUNING.science / 2);
    n.science += science;
  } else {
    reward[kind] = full ? TUNING.reward : Math.ceil(TUNING.reward / 2);
    n.pendingReward = { amount: reward[kind]!, home: kind, from: card.title };
  }
  n.progress[loc] = (n.progress[loc] ?? 0) + 1;
  n.cardDone = true;
  pushLog(n, `${card.title}: correct${full ? "" : " on the second try"}!`, "good");
  return { state: n, correct: true, final: true, reward, science };
}

// ---------- missions ----------

export function missionStatus(s: GameState) {
  const m = mission(s);
  const tasks = m.tasks.map((t) => ({ location: t.location, need: t.cards, have: Math.min(t.cards, s.progress[t.location] ?? 0) }));
  const decisionDone = !m.decisionId || s.decisionDone;
  const scienceNeeded = m.scienceNeeded ?? 0;
  const game = m.game ? { ...m.game, done: !!s.gameDone } : null;
  const done = tasks.every((t) => t.have >= t.need) && decisionDone && s.science >= scienceNeeded && (!game || game.done);
  return { mission: m, tasks, decisionDone, scienceNeeded, game, done };
}

export function targets(s: GameState): LocationId[] {
  const st = missionStatus(s);
  const out: LocationId[] = st.tasks.filter((t) => t.have < t.need).map((t) => t.location);
  if (st.scienceNeeded > s.science && !out.includes("lab")) out.push("lab");
  if (st.game && !st.game.done && !out.includes(st.game.location)) out.push(st.game.location);
  return out;
}

/** Decide what comes after a card or a decision: mission decision, mission complete, or the map. */
function settle(n: GameState): GameState {
  const st = missionStatus(n);
  const tasksDone = st.tasks.every((t) => t.have >= t.need) && (!st.game || st.game.done);
  const m = st.mission;
  if (tasksDone && m.decisionId && !n.decisionDone && DECISIONS[m.decisionId]) {
    n.decision = DECISIONS[m.decisionId];
    n.phase = "decision";
    return n;
  }
  if (st.done) {
    n.phase = "mission-complete";
    pushLog(n, `Mission complete: ${m.title}!`, "good");
    return n;
  }
  n.phase = "map";
  return n;
}

export function closeCard(s: GameState): GameState {
  if (s.phase !== "card") return s;
  const n = clone(s);
  n.card = null;
  n.cardDone = false;
  n.cardTries = 0;
  if (n.pendingReward) {
    n.phase = "reward";
    return n;
  }
  return settle(n);
}

/** Mini-game finished. Win = mission game done + reward scaled by score; loss = small penalty, retry on next visit. */
export function finishGame(s: GameState, r: { won: boolean; score: number }): GameState {
  if (s.phase !== "minigame" || !s.minigame) return s;
  const n = clone(s);
  const g = n.minigame!;
  const kind = LOCATION_RES[g.location];
  const reward: ResDelta = {};
  let science = 0;
  const score = Math.max(0, Math.min(100, r.score || 0));
  if (r.won) {
    const amt = Math.round(12 + (score / 100) * 13); // 12..25
    if (kind === "science") science = amt;
    else {
      reward[kind] = amt;
      n.pendingReward = { amount: amt, home: kind, from: g.title };
    }
    n.gameDone = true;
    pushLog(n, `${g.title} Done! Score ${Math.round(score)}.`, "good");
  } else {
    if (kind !== "science") reward[kind] = -5;
    pushLog(n, `${g.title} Not this time — try again!`, "bad");
  }
  n.science += science;
  if (!r.won) n.res = applyDelta(n.res, reward);
  n.lastGame = { won: r.won, score, reward, science };
  n.minigame = null;
  if (failIfDead(n)) return n;
  if (n.pendingReward) {
    n.phase = "reward";
    return n;
  }
  return settle(n);
}

/** How much a resource gets if the player sends the reward there (home resource = full, others lose a third in transfer). */
export function rewardFor(s: GameState, k: ResKey): number {
  const r = s.pendingReward;
  if (!r) return 0;
  return k === r.home ? r.amount : Math.round((r.amount * 2) / 3);
}

/** Player chose where the earned supplies go. */
export function claimReward(s: GameState, k: ResKey): GameState {
  if (s.phase !== "reward" || !s.pendingReward) return s;
  const n = clone(s);
  const amt = rewardFor(n, k);
  n.res = applyDelta(n.res, { [k]: amt });
  pushLog(n, `+${amt} ${RES_META[k].label} (${n.pendingReward!.from})`, "good");
  n.pendingReward = null;
  return settle(n);
}

function snapshot(s: GameState): GameState {
  const c = clone({ ...s, checkpoint: null, log: [] });
  return c;
}

/** Emergency reserve: after a failure, replay the current mission from its start with topped-up supplies. */
export function retryMission(s: GameState): GameState {
  if (s.phase !== "failed" || !s.checkpoint) return s;
  const n = clone(s.checkpoint);
  for (const k of RES_KEYS) n.res[k] = Math.max(n.res[k], 55);
  n.checkpoint = snapshot(n);
  n.retries = (s.retries ?? 0) + 1;
  n.retried = true;
  n.failReason = null;
  n.log = [...s.log];
  pushLog(n, "Emergency reserve used. Mission restarted.", "info");
  n.phase = "briefing";
  return n;
}

export function choose(s: GameState, optionId: string): GameState {
  if (s.phase !== "decision" || !s.decision) return s;
  const opt = s.decision.options.find((o) => o.id === optionId);
  if (!opt) return s;
  const n = clone(s);
  const d = n.decision!;
  const before = { ...n.res };
  const after: Record<string, Resources> = {};
  const failedIf: Record<string, ResKey | null> = {};
  for (const o of d.options) {
    after[o.id] = applyDelta(before, o.effects);
    failedIf[o.id] = zeroed(after[o.id]);
  }
  n.res = { ...after[opt.id] };
  n.science += opt.science ?? 0;
  if (d.id === mission(n).decisionId) n.decisionDone = true;
  const consequence: Consequence = { decision: d, chosenId: opt.id, before, after, failedIf };
  n.consequence = consequence;
  n.phase = "consequences";
  pushLog(n, `${d.title}: ${opt.label}.`, failedIf[opt.id] ? "bad" : "info");
  return n;
}

export function closeConsequences(s: GameState): GameState {
  if (s.phase !== "consequences") return s;
  const n = clone(s);
  n.decision = null;
  n.consequence = null;
  if (failIfDead(n)) return n;
  return settle(n);
}

export function nextMission(s: GameState): GameState {
  if (s.phase !== "mission-complete") return s;
  const n = clone(s);
  const m = mission(n);
  for (const b of m.reward.builds) if (!n.built.includes(b)) n.built.push(b);
  if (m.reward.res) n.res = applyDelta(n.res, m.reward.res);
  pushLog(n, m.reward.text, "good");
  if (n.missionIdx >= MISSIONS.length - 1) {
    n.phase = "won";
    return n;
  }
  n.missionIdx += 1;
  n.progress = {};
  n.decisionDone = false;
  n.gameDone = false;
  n.minigame = null;
  n.retried = false;
  n.phase = "briefing";
  n.checkpoint = snapshot(n);
  return n;
}

export function weather(s: GameState): "calm" | "flare" | "storm" | "night" {
  const sev = s.today?.severity ?? 0;
  if (sev >= 2) return "storm";
  if (s.missionIdx === 4) return "night";
  if (sev >= 1) return "flare";
  return "calm";
}
