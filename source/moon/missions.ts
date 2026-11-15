// The six missions: garden -> colony -> city -> data for NASA.
import type { Mission } from "./types";

export const MISSIONS: Mission[] = [
  {
    id: "first-breath",
    game: { id: "blocks", location: "habitat", difficulty: 1, title: "Seal the habitat with regolith bricks!" },
    index: 1,
    title: "First Breath",
    goal: "Study life support and build the oxygen generator",
    briefing:
      "Commander, you hear me? Good. I crashed on the Moon, but my computer works and you found me. The air will run out first. Help me study the habitat and build an oxygen generator. Let's breathe!",
    tasks: [{ location: "habitat", cards: 1 }],
    decisionId: "power-split",
    reward: {
      builds: ["o2-generator"],
      res: { oxygen: 10 },
      text: "The oxygen generator hums. Electrolysis splits water into oxygen and hydrogen, and now I can breathe easy!",
    },
  },
  {
    id: "green-thumb",
    game: { id: "rover", location: "greenhouse", difficulty: 1, title: "Drive to the wreck and rescue the seeds!" },
    index: 2,
    title: "Green Thumb",
    goal: "Learn how plants grow and plant the first garden",
    briefing:
      "I found seeds in the wreckage! Plants make food and oxygen, but they need light, water and care. Visit the greenhouse and the solar panels so we can grow the first Moon garden.",
    tasks: [
      { location: "greenhouse", cards: 1 },
      { location: "solar", cards: 1 },
    ],
    decisionId: "water-split",
    reward: {
      builds: ["garden"],
      res: { food: 10 },
      text: "Green leaves on the Moon! The garden gives me fresh food, and every plant breathes out a little oxygen.",
    },
  },
  {
    id: "hello-earth",
    game: { id: "signal", location: "radio", difficulty: 1, title: "Lock the dish on Earth and send a message!" },
    index: 3,
    title: "Hello, Earth",
    goal: "Learn about radio and build the big dish",
    briefing:
      "I miss home. Radio waves fly at the speed of light, yet it takes 1.3 seconds to reach Earth. Let's study the radio and build a big dish. Then Earth can hear us!",
    tasks: [
      { location: "radio", cards: 2 },
      { location: "solar", cards: 1 },
    ],
    decisionId: "call-earth",
    reward: {
      builds: ["big-dish"],
      res: { comms: 15 },
      text: "The big dish points at Earth. I hear Mission Control! Every word arrives after 1.3 seconds.",
    },
  },
  {
    id: "solar-storm",
    game: { id: "meteor", location: "shelter", difficulty: 2, title: "Protect the base from meteoroids and debris!" },
    index: 4,
    title: "Solar Storm",
    goal: "Study radiation and build the storm shelter",
    briefing:
      "The Sun sends storms of fast particles. Earth has an atmosphere and a magnetic field, but the Moon does not. We need a shelter under Moon dust. Study radiation, then we build it. Stay sharp!",
    tasks: [
      { location: "shelter", cards: 2 },
      { location: "habitat", cards: 1 },
    ],
    decisionId: "storm-warning",
    reward: {
      builds: ["storm-shelter"],
      res: { shield: 15 },
      text: "The storm shelter is ready. A thick layer of regolith, the Moon's own dust, now blocks much of the radiation.",
    },
  },
  {
    id: "long-night",
    game: { id: "rover", location: "solar", difficulty: 2, title: "Collect solar cells before the long night!" },
    index: 5,
    title: "The Long Night",
    goal: "Store power for the 14-day lunar night and grow the colony",
    briefing:
      "A lunar night lasts about 14 Earth days, with no sunlight at all. We must store energy in batteries before it comes. Study the solar field and the greenhouse. Then our outpost becomes a colony!",
    tasks: [
      { location: "solar", cards: 2 },
      { location: "greenhouse", cards: 1 },
    ],
    decisionId: "lunar-night",
    reward: {
      builds: ["battery-bank", "colony"],
      res: { energy: 15 },
      text: "The batteries are full and new modules are up. We are not an outpost anymore. We are a colony!",
    },
  },
  {
    id: "for-humankind",
    game: { id: "signal", location: "lab", difficulty: 3, title: "Send your research data to NASA!" },
    index: 6,
    title: "For Humankind",
    goal: "Run science experiments and send the data to NASA",
    briefing:
      "This is it, Commander. Years of dreams brought me here. Let's finish the research in the lab and send all the data to NASA. Then people on Earth can learn from the Moon.",
    tasks: [
      { location: "lab", cards: 2 },
      { location: "radio", cards: 1 },
    ],
    decisionId: "send-data",
    scienceNeeded: 40,
    reward: {
      builds: ["science-lab", "city"],
      res: { oxygen: 10, food: 10, energy: 10, shield: 10, comms: 10 },
      text: "Data sent! Mission Control cheers. I will stay here and contribute to humankind. Thank you for being my commander. A city grows on the Moon.",
    },
  },
];
