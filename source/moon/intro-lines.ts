// Intro script (7 scenes). Shared by components/Moon/intro/* (on-screen + timing) and scripts/moon-voice (voice clips).
// who: "narrator" = warm storyteller voice; "tobish" = Tobish over radio; "control" = Mission Control radio.
// Keep texts exact — voice clips are looked up by hash of `text`.

export type IntroWho = "narrator" | "tobish" | "control";
export interface IntroLine {
  id: string;
  scene: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  who: IntroWho;
  text: string;
}

export const INTRO_LINES: IntroLine[] = [
  { id: "s1a", scene: 1, who: "narrator", text: "When he was ten years old, a boy named Tobish watched a rocket launch on TV." },
  { id: "s1b", scene: 1, who: "narrator", text: "And he made a promise." },
  { id: "s1c", scene: 1, who: "tobish", text: "One day, I will be a part of it." },
  { id: "s2a", scene: 2, who: "narrator", text: "So he studied. Every night. Mathematics. Physics. Astronomy." },
  { id: "s2b", scene: 2, who: "narrator", text: "Until the impossible began to look like a plan." },
  { id: "s3a", scene: 3, who: "narrator", text: "At twenty-four, Tobish graduated. And NASA chose him as its youngest astronaut." },
  { id: "s4a", scene: 4, who: "control", text: "Three. Two. One. Ignition!" },
  { id: "s4b", scene: 4, who: "narrator", text: "Launch day. Everything was perfect. Until…" },
  { id: "s5a", scene: 5, who: "tobish", text: "Mission Control! The engines are failing! We are losing control!" },
  { id: "s5b", scene: 5, who: "tobish", text: "Mayday! Mayday! We are going down!" },
  { id: "s6a", scene: 6, who: "narrator", text: "The ship crashed on the Moon. Tobish was alone. No rescue. No second chance." },
  { id: "s6b", scene: 6, who: "narrator", text: "Only oxygen, water, food… and his mind." },
  { id: "s6c", scene: 6, who: "narrator", text: "In the wreckage he found seeds, materials… and a computer that still worked." },
  { id: "s7a", scene: 7, who: "tobish", text: "Mission Control, if anyone can hear me… I need a commander." },
  { id: "s7b", scene: 7, who: "tobish", text: "Commander, what is your name?" },
  { id: "s7c", scene: 7, who: "tobish", text: "Nice to meet you, Commander! Let's build a home on the Moon, together." },
];
