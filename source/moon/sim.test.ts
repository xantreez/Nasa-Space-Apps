// Balance simulation: `npx tsx moon/sim.test.ts [games=500]`
// Plays full games with a "careful" and a "careless" bot for each age band.
// If the content agent's data files are missing, the engine is copied to a temp dir together with mock data.
import { existsSync, mkdirSync, copyFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const GAMES = Number(process.argv[2]) || 500;

// ---------- seeded RNG (engine uses Math.random) ----------
let seed = 12345;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
Math.random = rnd;

// ---------- load engine (with mock data when needed) ----------
const MOCK_CARDS = `
const locs = ["habitat","greenhouse","solar","shelter","radio","lab"];
export const CARDS = [] as any[];
for (const l of locs) for (const age of ["cadet","specialist"]) for (let i = 0; i < 6; i++) {
  CARDS.push({ id: l + "-" + age + "-" + i, location: l, age, title: l + " " + i, body: "b",
    source: { name: "mock", url: "x" },
    question: { q: "q", options: age === "cadet" ? ["a","b","c"] : ["a","b","c","d"], correct: i % 3, hint: "h", explain: "e" } });
}`;
const MOCK_DONKI = `
const q = (i: number) => ({ id: "q" + i, kind: "QUIET", time: "", magnitude: "", title: "Quiet Sun.", text: "", severity: 0, effect: {}, source: { name: "m", url: "x" } });
const f = (i: number, sev: number, eff: any) => ({ id: "e" + i, kind: sev >= 2 ? "CME" : "FLR", time: "", magnitude: "X1", title: "Flare " + i + "!", text: "", severity: sev, effect: eff, source: { name: "m", url: "x" } });
export const WINDOWS = [
  { id: "calm", name: "Calm", blurb: "", days: [q(0), f(1, 1, { shield: -6 }), q(2), q(3), f(4, 2, { shield: -12, comms: -6 }), q(5), q(6), f(7, 1, { shield: -6 }), q(8), q(9), q(10), f(11, 2, { shield: -12, comms: -6 }), q(12), q(13), q(14), q(15), q(16), q(17), q(18), q(19)] },
  { id: "may2024", name: "May 2024", blurb: "", days: [f(0, 1, { shield: -6 }), f(1, 2, { shield: -12, comms: -6 }), f(2, 3, { shield: -20, comms: -10 }), f(3, 3, { shield: -20, comms: -10 }), f(4, 2, { shield: -12, comms: -6 }), f(5, 1, { shield: -6 }), q(6), f(7, 2, { shield: -12, comms: -6 }), q(8), q(9), f(10, 1, { shield: -6 }), q(11), q(12), q(13), q(14), q(15), q(16), q(17), q(18), q(19)] },
];`;
const MOCK_FACTS = `
export const FAIL_LESSONS: any = Object.fromEntries(["oxygen","energy","shield","food","comms"].map((k) => [k, { why: k + " ran out", lesson: "keep " + k }]));
export const SOURCES: any = {};`;

async function loadEngine() {
  const need = ["cards", "donki", "facts"].map((n) => join(here, "data", n + ".ts"));
  let dir = here;
  let mocked = false;
  if (!need.every(existsSync)) {
    mocked = true;
    dir = mkdtempSync(join(tmpdir(), "moon-sim-"));
    mkdirSync(join(dir, "data"));
    for (const f of ["types.ts", "missions.ts", "decisions.ts", "engine.ts"]) copyFileSync(join(here, f), join(dir, f));
    const mocks: Record<string, string> = { cards: MOCK_CARDS, donki: MOCK_DONKI, facts: MOCK_FACTS };
    for (const n of Object.keys(mocks)) {
      const real = join(here, "data", n + ".ts");
      if (existsSync(real)) copyFileSync(real, join(dir, "data", n + ".ts")); // use real data where it exists
      else writeFileSync(join(dir, "data", n + ".ts"), mocks[n]);
    }
  }
  const E = await import(pathToFileURL(join(dir, "engine.ts")).href);
  const D = await import(pathToFileURL(join(dir, "decisions.ts")).href);
  const M = await import(pathToFileURL(join(dir, "missions.ts")).href);
  return { E, D, M, mocked };
}

// ---------- bots ----------
const RES = ["oxygen", "energy", "shield", "food", "comms"] as const;
const LOC_OF: Record<string, string> = { oxygen: "habitat", energy: "solar", shield: "shelter", food: "greenhouse", comms: "radio" };
const ALL_LOCS = ["habitat", "greenhouse", "solar", "shelter", "radio", "lab"];

type Bot = "careful" | "careless";

async function main() {
  const { E, M, mocked } = await loadEngine();
  console.log(mocked ? "(using MOCK data in a temp dir)" : "(using real data from moon/data)");

  // static checks
  let bad = 0;
  for (const m of M.MISSIONS) {
    const words = m.briefing.trim().split(/\s+/).length;
    if (words > 45) { console.log(`briefing too long (${words}): ${m.id}`); bad++; }
  }
  if (M.MISSIONS.length !== 6) { console.log("need 6 missions"); bad++; }

  function chooseDecision(s: any, bot: Bot): string {
    const scored = s.decision.options.map((o: any) => {
      const after = E.applyDelta(s.res, o.effects);
      const vals = RES.map((k) => after[k]);
      return { id: o.id, min: Math.min(...vals), sum: vals.reduce((a, b) => a + b, 0) + (o.science ?? 0) * 0.5 };
    });
    scored.sort((a: any, b: any) => (bot === "careful" ? b.min - a.min || b.sum - a.sum : a.min - b.min || a.sum - b.sum));
    return scored[0].id;
  }

  function chooseLoc(s: any, bot: Bot): string {
    if (bot === "careless") {
      const t = E.targets(s);
      if (t.length && rnd() < 0.6) return t[0];
      const locs = ALL_LOCS.filter((l) => l !== "shelter");
      return locs[Math.floor(rnd() * locs.length)];
    }
    const lowest = [...RES].sort((a, b) => s.res[a] - s.res[b])[0];
    if (s.res[lowest] < 45) return LOC_OF[lowest];
    const t = E.targets(s);
    if (t.length) return t[0];
    return LOC_OF[lowest];
  }

  function answerCard(s: any, bot: Bot) {
    let st = s;
    for (let i = 0; i < 3 && !st.cardDone; i++) {
      const q = st.card.question;
      let idx: number;
      if (bot === "careful" && rnd() < 0.8) idx = q.correct;
      else {
        const wrong = q.options.map((_: any, j: number) => j).filter((j: number) => j !== q.correct);
        idx = bot === "careful" ? wrong[Math.floor(rnd() * wrong.length)] : Math.floor(rnd() * q.options.length);
      }
      st = E.answer(st, idx).state;
    }
    return st;
  }

  function play(age: string, bot: Bot) {
    let s = E.newGame(age);
    for (let step = 0; step < 5000; step++) {
      if (s.phase === "won" || s.phase === "failed") break;
      if (s.day > 60) return { s, timeout: true };
      switch (s.phase) {
        case "briefing": s = E.closeBriefing(s); break;
        case "event": s = E.ackEvent(s); break;
        case "decision": s = E.choose(s, chooseDecision(s, bot)); break;
        case "consequences": s = E.closeConsequences(s); break;
        case "card": s = E.closeCard(answerCard(s, bot)); break;
        case "mission-complete": s = E.nextMission(s); break;
        case "reward": { const low = [...RES].sort((a, b) => s.res[a] - s.res[b])[0]; s = E.claimReward(s, bot === "careful" ? low : s.pendingReward.home); break; }
        case "minigame": { const won = rnd() < (bot === "careful" ? 0.75 : 0.4); s = E.finishGame(s, { won, score: won ? 40 + rnd() * 60 : rnd() * 40 }); break; }
        case "map":
          if (s.actions <= 0) s = E.endDay(s);
          else {
            // the careful bot also hides in the shelter when the shield is middling
            s = E.walkTo(s, chooseLoc(s, bot));
          }
          break;
        default: throw new Error("stuck in phase " + s.phase);
      }
    }
    return { s, timeout: s.phase !== "won" && s.phase !== "failed" };
  }

  const out: Record<string, { win: number; days: number[]; fails: Record<string, number>; timeouts: number }> = {};
  for (const age of ["cadet", "specialist"]) {
    for (const bot of ["careful", "careless"] as Bot[]) {
      const r = { win: 0, days: [] as number[], fails: {} as Record<string, number>, timeouts: 0 };
      for (let g = 0; g < GAMES; g++) {
        const { s, timeout } = play(age, bot);
        if (timeout) { r.timeouts++; if (process.env.DEBUG && r.timeouts < 4) console.log("TIMEOUT", s.windowId, s.missionIdx, JSON.stringify(s.progress), s.science, JSON.stringify(s.res), s.built.join(), s.log.slice(-6).map((l: any) => l.text).join(" | ")); }
        else if (s.phase === "won") { r.win++; r.days.push(s.day); }
        else r.fails[s.failReason.res] = (r.fails[s.failReason.res] ?? 0) + 1;
      }
      out[`${age}/${bot}`] = r;
      const avg = r.days.length ? (r.days.reduce((a, b) => a + b, 0) / r.days.length).toFixed(1) : "-";
      const sorted = [...r.days].sort((a, b) => a - b);
      const p = (q: number) => (sorted.length ? sorted[Math.floor(q * (sorted.length - 1))] : "-");
      console.log(
        `${age.padEnd(10)} ${bot.padEnd(8)} win ${((100 * r.win) / GAMES).toFixed(1)}%  avg days ${avg} (p10 ${p(0.1)} p90 ${p(0.9)})  timeouts ${r.timeouts}  fails ${JSON.stringify(r.fails)}`,
      );
    }
  }

  for (const age of ["cadet", "specialist"]) {
    const c = out[`${age}/careful`], l = out[`${age}/careless`];
    const cw = (100 * c.win) / GAMES, lw = (100 * l.win) / GAMES;
    const avg = c.days.reduce((a, b) => a + b, 0) / Math.max(1, c.days.length);
    if (cw < 85) { console.log(`FAIL ${age}: careful win ${cw.toFixed(1)}% < 85`); bad++; }
    if (100 - lw < 60) { console.log(`FAIL ${age}: careless lose ${(100 - lw).toFixed(1)}% < 60`); bad++; }
    if (avg < 4 || avg > 12) { console.log(`FAIL ${age}: avg win days ${avg.toFixed(1)} outside 4-12`); bad++; }
  }
  console.log(bad ? `\n${bad} problem(s)` : "\nAll balance targets met.");
  process.exit(bad ? 1 : 0);
}

main();
