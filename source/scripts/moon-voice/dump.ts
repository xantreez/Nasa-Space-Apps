// Dumps every line Tobish voices as JSON: [{cat, text}]. Run: bun scripts/moon-voice/dump.ts
import { MISSIONS } from "../../moon/missions";
import { DECISIONS, stormDecision } from "../../moon/decisions";
import { WINDOWS } from "../../moon/data/donki";
import { CARDS } from "../../moon/data/cards";
import { INTRO_LINES } from "../../moon/intro-lines";
import { VOICE_INTRO, VOICE_WIN, VOICE_FAIL } from "../../moon/voice-lines";

const out: { cat: string; text: string; who?: string; id?: string }[] = [];
const add = (cat: string, text?: string, who?: string, id?: string) => text && text.trim() && out.push({ cat, text, who, id });
for (const m of MISSIONS) add("1-missions", m.briefing);
for (const l of INTRO_LINES) add("1b-intro", l.text, l.who, l.id);
add("3-fixed", VOICE_INTRO); add("3-fixed", VOICE_WIN); add("3-fixed", VOICE_FAIL);
const events = WINDOWS.flatMap((w) => w.days).filter((e) => e.severity >= 2);
const decs = [...Object.values(DECISIONS), ...events.map((e) => stormDecision(e))];
for (const d of decs) add("4-prompts", d.prompt);
for (const d of decs) for (const o of d.options) add("5-outcomes", o.outcome);
for (const m of MISSIONS) add("5b-rewards", m.reward.text);
for (const c of CARDS.filter((c) => c.age === "cadet")) add("6-cadet", c.body);
for (const w of WINDOWS) for (const e of w.days) if (e.kind !== "QUIET") add("7-events", e.text);
// Dropped for now (re-enable when time allows): specialist cards, card questions, event titles.
console.log(JSON.stringify(out));
