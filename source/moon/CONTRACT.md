# /game — Junior Astronaut: Moon Outpost — module contract

Story: at 10 a boy (Tobish) saw a rocket launch and promised to be part of it. At 24 NASA chose him as its
youngest astronaut. Launch failed, he crashed on the Moon, alone. In the wreckage he found seeds, materials and a
WORKING COMPUTER. Through that computer he reaches the player: "Mission Control, if anyone can hear me… I need a
commander." The PLAYER is that commander. Together they turn a garden into a colony, a colony into a city, and in
the finale Tobish sends his research data to NASA: "I will stay here and contribute to humankind." (WIN)

Audience: kids 7–12. English only. Every number must be scientifically correct and traceable to NASA data.

## Files and owners

| Path | Owner | Exports |
|---|---|---|
| `moon/types.ts` | lead | all shared types (read it first, do not change without need) |
| `moon/data/cards.ts` | content | `export const CARDS: Card[]` |
| `moon/data/donki.ts` | content | `export const WINDOWS: MissionWindow[]` (real DONKI records) |
| `moon/data/facts.ts` | content | `export const FAIL_LESSONS: Record<ResKey, {why: string; lesson: string}>`, `export const SOURCES: Record<string, Source>` |
| `public/moon/img/*.jpg` | content | real NASA images (images.nasa.gov, public domain), ≤ 1400px wide, ≤ 250 KB |
| `moon/missions.ts` | engine | `export const MISSIONS: Mission[]` (6) |
| `moon/decisions.ts` | engine | `export const DECISIONS: Record<string, Decision>`, `export function stormDecision(ev: SpaceWeatherEvent): Decision` |
| `moon/engine.ts` | engine | the API below |
| `components/Moon/Scene.vue` (+ `components/Moon/scene/*`) | art | 2D base map scene |
| `components/Moon/ui/*` | ui | HUD, modals, screens |
| `moon/sfx.ts` | ui | tiny WebAudio sound effects, no files |
| `pages/game.vue` | lead | wiring |

## Engine API (`moon/engine.ts`) — pure functions, never mutate input, return a new state

```ts
export const RES_META: Record<ResKey, { label: string; emoji: string; color: string; unit: string; short: string }>
export const START_RES: Resources
export function newGame(age: AgeBand, windowId?: string): GameState      // phase "briefing" for mission 1, day 1
export function closeBriefing(s): GameState                              // -> beginDay
export function beginDay(s): GameState                                   // daily drain + today's DONKI event -> phase "event" (or "failed")
export function ackEvent(s): GameState                                   // -> "decision" if the event needs one (storm) else "map"
export function walkTo(s, loc: LocationId): GameState                    // costs 1 action, sets at, draws a card for loc+age -> phase "card"
export function answer(s, optionIdx: number): { state: GameState; correct: boolean; final: boolean; reward: ResDelta; science: number }
//   correct on 1st try = full reward (+15 to that location's resource, or +10 science at lab), 2nd try = half, wrong twice = 0 (final=true)
export function closeCard(s): GameState                                  // -> "decision" (mission decision due) | "mission-complete" | "map"
export function choose(s, optionId: string): GameState                   // applies option, builds Consequence -> "consequences"
export function closeConsequences(s): GameState                          // -> "failed" | "mission-complete" | "map"
export function endDay(s): GameState                                     // -> beginDay(day+1)
export function nextMission(s): GameState                                // after "mission-complete": applies reward builds -> "briefing" or "won"
export function missionStatus(s): { mission: Mission; tasks: { location: LocationId; need: number; have: number }[]; decisionDone: boolean; scienceNeeded: number; done: boolean }
export function targets(s): LocationId[]                                 // locations still needed for the current mission (to highlight on map)
export function weather(s): "calm" | "flare" | "storm" | "night"        // for the scene
```

Rules: 3 actions per day. Daily drain (before builds): oxygen −6, food −5, energy −7, comms −3, shield −2.
Builds reduce drain (o2-generator: oxygen −2 instead of −6, garden: food −2, battery-bank: energy −3,
storm-shelter: halves radiation hits, big-dish: comms −1). A DONKI event hits `shield` (and `comms` for CME/GST)
unless `sheltered`. Any resource ≤ 0 → phase "failed" with `failReason` from FAIL_LESSONS. Clamp 0..100.
Start resources ≈ 70. A full run (6 missions) should take ~12–18 days and be winnable if the kid reads the cards.

## Scene contract (`components/Moon/Scene.vue`)

```ts
props: { at: LocationId; target: LocationId | null; built: BuildId[]; weather: "calm"|"flare"|"storm"|"night";
         highlight: LocationId[]; disabled: boolean; day: number }
emits: { go: [loc: LocationId]; arrived: [loc: LocationId] }
```
Click a location (when !disabled) → emit `go`. Parent sets `target` → scene animates Tobish walking from `at` to
`target`, then emits `arrived`. Parent then calls engine `walkTo`. `highlight` = pulsing marker "mission here".

## UI components (`components/Moon/ui/`)

| Component | Props | Emits |
|---|---|---|
| `TitleScreen.vue` | – | `start` |
| `AgeSelect.vue` | – | `pick(age: AgeBand)` |
| `Hud.vue` | `res, day, actions, actionsPerDay, science, mission: Mission, status (missionStatus result), weather` | `endDay`, `openMission` |
| `RadioMessage.vue` | `title, text, from?: string (default "TOBISH"), cta: string` | `close` | (typewriter, radio static look; used for briefings) |
| `EventCard.vue` | `event: SpaceWeatherEvent, day: number, sheltered: boolean` | `close` |
| `StudyCard.vue` | `card: Card, age: AgeBand` | `answer(idx) → parent calls engine and passes result back via prop`, `close` |
|   | plus prop `result: { picked: number; correct: boolean; final: boolean; reward: ResDelta; science: number } \| null`, `tries: number` |  |
| `DecisionModal.vue` | `decision: Decision, res: Resources` | `choose(optionId)` |
| `Consequences.vue` | `consequence: Consequence` | `close` |
| `MissionComplete.vue` | `mission: Mission, nextMission: Mission \| null` | `next` |
| `EndScreen.vue` | `kind: "failed" \| "won", state: GameState` | `restart` |

Shared look: see "Visual direction" below. All UI is self-contained scoped CSS. No eduspace global components,
no i18n (English strings inline), no stores.

## Visual direction (everyone)

Modern, juicy 2D mobile-game feel (think Alto's Odyssey / Monument Valley / Kurzgesagt), NOT dark muddy gray.
- Sky: deep navy → teal gradient `#0b1b3a → #123a5c`, soft nebula glows, twinkling stars, big friendly Earth.
- Moon ground: warm light grays with lilac-blue shadows `#d9dbe4 / #b8bccb / #8e93a8`, soft craters.
- Accents: oxygen `#4fd1ff`, energy `#ffd23f`, shield `#7cf29c`, food `#ff9f43`, comms `#ff6b9d`, science `#a78bfa`.
- UI panels: frosted glass `rgba(12,24,48,.72)` + `backdrop-filter: blur(14px)`, 1px border `rgba(255,255,255,.12)`,
  radius 22–28px, chunky buttons with a 4px bottom "3D" edge, press = translateY(2px).
- Fonts (Google Fonts, loaded by the page): headings `"Fredoka", sans-serif` 600/700; body `"Nunito", sans-serif` 600/800.
- Motion: springy (cubic-bezier(.34,1.56,.64,1)), pop-in modals, counting numbers, floating "+15 🫧" chips.
- Must work at 360px phone width and on a 1440px laptop. Touch friendly (≥44px targets).

## Audio (added)

`moon/audio-bus.ts` (lead, done): one AudioContext with channels music / sfx / voice → master. `unlockAudio()` on first
gesture, `channel(name)`, `duck(on)` (voice ducks music), `setMuted/isMuted/onMuted`, `loadBuffer(url)` (fetch+decode+cache).

- `moon/sfx.ts` (sfx agent) — keeps the current exported `sfx` object API and adds sounds. Files: `public/moon/sfx/*.mp3`,
  music loops `public/moon/music/*.mp3`. Required names (all no-arg, fire-and-forget, never throw):
  `click pop correct wrong alarm radio win fail walk hop build whoosh typewriter cardFlip coin explosion laser jump land
  blockDrop blockRotate lineClear countdown go gameOver powerUp beep static`
  Plus `music.play(name: "title" | "base" | "storm" | "night" | "minigame" | "victory")` crossfading, `music.stop()`,
  `preloadAudio()` (fetch+decode everything in background), `setMuted(b)`, `isMuted()`, `unlock()`.
- `moon/voice.ts` (voice agent) — `voice.say(text: string): Promise<void>` plays Tobish's pre-rendered line for exactly
  that text (lookup by hash in `public/moon/voice/manifest.json`); silently resolves if no clip. `voice.stop()`,
  `voice.speaking` (reactive-free boolean), auto `duck(true/false)`. Lines are OmniVoice clips with a radio filter.

## Mini-games (added)

`components/Moon/games/{Meteor,Rover,Blocks,Signal}.vue`. Props `MiniGameProps` (`age`, `difficulty`), emit
`finish(result: MiniGameResult)`. Each game is a full-screen overlay (position:absolute; inset:0; z-index 60) with its
own: intro card (title, 1-line goal, controls for mouse/touch/keyboard, a REAL science fact with a NASA source), 3-2-1
countdown, ~45–75 s of play, result card (won/lost, score, what you learned, button "Continue" → emit finish). Canvas
2D, devicePixelRatio aware, 60 fps, requestAnimationFrame cleaned up on unmount, pause when tab hidden.
Cadet = gentler (slower, bigger targets). Must be spectacular: particles, screen shake, glow, juicy feedback.
Uses `sfx.*` from `moon/sfx.ts` (call as `sfx.explosion?.()` style is not needed — names above are guaranteed) and
`music.play("minigame")` on start / `music.play("base")` on finish.
