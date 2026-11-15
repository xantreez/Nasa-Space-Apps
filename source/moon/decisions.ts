// Trade-off decisions: one per mission, random "daily dilemmas", and storm decisions built from real DONKI events.
import type { Decision, SpaceWeatherEvent } from "./types";

const NASA: Decision["source"] = { name: "NASA", url: "https://www.nasa.gov/humans-in-space/" };

/** Storm decision made from a real DONKI event; effects scale with severity (1..3). */
export function stormDecision(ev: SpaceWeatherEvent, id?: string): Decision {
  const s = Math.max(1, Math.min(3, ev.severity || 1));
  return {
    id: id ?? `storm-${ev.id}`,
    title: "Storm warning!",
    prompt: `Commander, NASA's DONKI report says: ${ev.title} Fast particles are coming. What do we do? Hide, fix things outside, or power up the water wall?`,
    source: ev.source,
    options: [
      {
        id: "shelter",
        label: "Hide in the shelter",
        emoji: "🛖",
        effects: { shield: -2 * s, food: -2 * s, comms: -2 * s },
        science: 0,
        outcome: "We wait under thick regolith. We are safe, but the garden and the antenna are not tended all day.",
        lesson: "Moon dust (regolith) is a good shield: a few metres of it stops most of the dangerous solar particles.",
      },
      {
        id: "repair",
        label: "Keep repairing outside",
        emoji: "🛠️",
        effects: { shield: -9 * s, oxygen: 6, energy: 8 },
        science: 0,
        outcome: "We finish the repairs, but the suit takes a lot of radiation. The base shield is weak after this.",
        lesson: "The Moon has no air and no magnetic field, so there is nothing to slow solar particles down outside.",
      },
      {
        id: "water-wall",
        label: "Power up the water wall",
        emoji: "💧",
        effects: { energy: -(6 + 4 * s), oxygen: -2 * s, shield: 4 },
        science: 0,
        outcome: "Water tanks around the habitat soak up the particles. It costs a lot of energy and some water.",
        lesson: "Hydrogen-rich water is great at blocking radiation, but pumping and heating it needs electricity.",
      },
    ],
  };
}

/** Fixed storm used in mission 4, equal to a severity-2 DONKI event. */
const MISSION_STORM: SpaceWeatherEvent = {
  id: "training",
  kind: "CME",
  time: "",
  magnitude: "",
  title: "A coronal mass ejection is heading for the Moon.",
  text: "",
  severity: 2,
  effect: {},
  source: { name: "NASA DONKI", url: "https://kauai.ccmc.gsfc.nasa.gov/DONKI/" },
};

export const DECISIONS: Record<string, Decision> = {
  // ---- mission decisions ----
  "power-split": {
    id: "power-split",
    title: "Where does the power go?",
    prompt:
      "Commander, we only have so much electricity. The computer wants it for science experiments, and life support wants it for the air. What do we power?",
    source: NASA,
    options: [
      {
        id: "life",
        label: "Life support first",
        emoji: "🫧",
        effects: { oxygen: 15, energy: -12 },
        science: 0,
        outcome: "The air scrubbers run at full speed and the cabin smells fresh. The experiments wait.",
        lesson: "Life support always comes first: people can live weeks without food but only minutes without air.",
      },
      {
        id: "science",
        label: "Experiments first",
        emoji: "🔬",
        effects: { oxygen: -12, energy: -12 },
        science: 12,
        outcome: "The experiments give great data, but the air scrubbers slow down and the oxygen drops.",
        lesson: "Science is the goal of the mission, but a crew that cannot breathe cannot do science.",
      },
      {
        id: "split",
        label: "Split the power",
        emoji: "⚖️",
        effects: { oxygen: 6, energy: -10 },
        science: 5,
        outcome: "Half of the power goes to each. A little more air and a little more data.",
        lesson: "Engineers call this a power budget: every watt has a job and must be planned.",
      },
    ],
  },
  "water-split": {
    id: "water-split",
    title: "Water for plants or for air?",
    prompt:
      "We have only a little water. The plants are thirsty, but the electrolyser also needs water to make oxygen. We can't do both fully!",
    source: { name: "NASA ISS Life Support", url: "https://www.nasa.gov/humans-in-space/" },
    options: [
      {
        id: "plants",
        label: "Water the plants",
        emoji: "🌱",
        effects: { food: 22, oxygen: -8, energy: -4 },
        science: 0,
        outcome: "The plants perk up and grow. The electrolyser makes less oxygen today.",
        lesson: "Plants use light, water and carbon dioxide to make food and a little oxygen.",
      },
      {
        id: "electrolyser",
        label: "Feed the electrolyser",
        emoji: "🫧",
        effects: { oxygen: 22, food: -12, energy: -8 },
        science: 0,
        outcome: "Electricity splits water into oxygen and hydrogen. The air is great, the plants droop.",
        lesson: "Electrolysis splits water (H2O) into oxygen (O2) and hydrogen (H2), but it needs lots of energy.",
      },
      {
        id: "half",
        label: "Half and half",
        emoji: "💧",
        effects: { food: 8, oxygen: 6, energy: -8 },
        science: 0,
        outcome: "Everybody gets a few sips. Both systems work, but neither is happy.",
        lesson: "Water on the Moon is precious, so the station recycles almost every drop.",
      },
    ],
  },
  "call-earth": {
    id: "call-earth",
    title: "Call Earth?",
    prompt:
      "The big dish is nearly ready! A full video call to Mission Control burns a lot of battery. A short text is cheap. Or we stay quiet.",
    source: { name: "NASA Space Communications", url: "https://www.nasa.gov/directorates/somd/space-communications-navigation-program/" },
    options: [
      {
        id: "full",
        label: "Full call at full power",
        emoji: "📡",
        effects: { comms: 25, energy: -20 },
        science: 5,
        outcome: "We see Earth's engineers smile, with a 1.3 second delay. The battery drops a lot.",
        lesson: "Radio waves travel at light speed, about 384,000 km to Earth in 1.3 seconds. A stronger signal needs more power.",
      },
      {
        id: "text",
        label: "Send a short text",
        emoji: "✉️",
        effects: { comms: 12, energy: -8 },
        science: 0,
        outcome: "A small message flies to Earth. It costs little and it still counts!",
        lesson: "Small messages use less bandwidth and power. NASA does this on distant missions.",
      },
      {
        id: "quiet",
        label: "Stay quiet, save power",
        emoji: "🔋",
        effects: { comms: -10, energy: 0 },
        science: 0,
        outcome: "The battery is safe, but Earth hears nothing from us and starts to worry.",
        lesson: "If a spacecraft stays silent too long, flight controllers on Earth have to assume something is wrong.",
      },
    ],
  },
  "storm-warning": stormDecision(MISSION_STORM, "storm-warning"),
  "lunar-night": {
    id: "lunar-night",
    title: "The long lunar night",
    prompt:
      "Night is coming and it will last 14 Earth days, with no sunlight. The battery can't do everything. Keep the heaters on, call Earth, or sleep mode?",
    source: { name: "NASA Artemis", url: "https://www.nasa.gov/humans-in-space/artemis/" },
    options: [
      {
        id: "heaters",
        label: "Keep the heaters on",
        emoji: "🔥",
        effects: { energy: -15, food: 6, comms: -8 },
        science: 0,
        outcome: "The habitat and the plants stay warm. The radio is switched off to save power.",
        lesson: "At night the Moon's surface drops to about minus 170 °C, so heaters are life-saving.",
      },
      {
        id: "radio",
        label: "Call Earth with the battery",
        emoji: "📡",
        effects: { comms: 20, energy: -12, food: -15, oxygen: -8 },
        science: 0,
        outcome: "We talk to Earth for hours. But the heaters get less power, the plants freeze and the air system slows.",
        lesson: "In the lunar night there is no sunlight, so every watt in the battery has to be spent wisely.",
      },
      {
        id: "sleep",
        label: "Sleep mode with fuel cells",
        emoji: "🌙",
        effects: { energy: -8, comms: -10, shield: -5 },
        science: 0,
        outcome: "Only the important systems run. It is quiet and dark, but we make it through.",
        lesson: "Batteries and fuel cells keep a base alive through the 14-day night, when solar panels get nothing.",
      },
    ],
  },
  "send-data": {
    id: "send-data",
    title: "Sending the data",
    prompt:
      "Our research is ready. If we send everything at once, the dish uses huge power. We can also send it in small pieces over days. What do we do?",
    source: { name: "NASA Space Communications", url: "https://www.nasa.gov/directorates/somd/space-communications-navigation-program/" },
    options: [
      {
        id: "all",
        label: "Send everything now",
        emoji: "🚀",
        effects: { energy: -20, comms: -15 },
        science: 20,
        outcome: "The big dish blasts all the data to Earth at once. The batteries are nearly flat afterwards.",
        lesson: "Sending lots of data fast needs lots of power, and the signal must be aimed carefully at Earth.",
      },
      {
        id: "pieces",
        label: "Send in small pieces",
        emoji: "📦",
        effects: { energy: -8, comms: -6 },
        science: 10,
        outcome: "Small packets fly to Earth all week. It is slower but gentle on the batteries.",
        lesson: "Space data is often split into packets and checked on arrival so errors can be fixed.",
      },
      {
        id: "wait",
        label: "Wait and repair first",
        emoji: "🔧",
        effects: { shield: 6, oxygen: 5, energy: -4 },
        science: 4,
        outcome: "We fix some systems first. The data waits a little longer.",
        lesson: "Good engineers fix the base before bragging about results. A safe base protects the science.",
      },
    ],
  },

  // ---- random daily dilemmas ----
  "daily-dust": {
    id: "daily-dust",
    title: "Dusty solar panels",
    prompt: "Sticky Moon dust covers our solar panels. Less sunlight reaches them. How do we clean them?",
    source: { name: "NASA Lunar Dust", url: "https://www.nasa.gov/" },
    options: [
      {
        id: "brush",
        label: "Brush them outside",
        emoji: "🧹",
        effects: { energy: 18, shield: -8, oxygen: -4 },
        science: 0,
        outcome: "The panels shine again, but the walk outside costs oxygen and gives some radiation.",
        lesson: "Moon dust is sharp and sticky because it has no wind or water to smooth it.",
      },
      {
        id: "vibrate",
        label: "Shake them from inside",
        emoji: "📳",
        effects: { energy: 9, comms: -5 },
        science: 0,
        outcome: "Vibrations shake off some dust. A bit of radio noise comes with it.",
        lesson: "Engineers study electric dust shields for Moon panels instead of risky brushing.",
      },
      {
        id: "ignore",
        label: "Ignore it today",
        emoji: "🙈",
        effects: { energy: -10 },
        science: 0,
        outcome: "Dirty panels make less power, and the battery drops.",
        lesson: "Even a thin layer of dust can cut solar power a lot.",
      },
    ],
  },
  "daily-meteor": {
    id: "daily-meteor",
    title: "Micrometeorite!",
    prompt: "A tiny space rock hit the habitat wall. The Moon has no air to slow it down. There is a small air leak!",
    source: { name: "NASA Meteoroid Environment Office", url: "https://www.nasa.gov/" },
    options: [
      {
        id: "patch",
        label: "Patch it outside now",
        emoji: "🩹",
        effects: { oxygen: 4, energy: -8, shield: -6 },
        science: 0,
        outcome: "The leak is sealed. The spacewalk costs power and some radiation.",
        lesson: "Without air, even a pebble can fly at several km/s and punch through a wall.",
      },
      {
        id: "seal",
        label: "Close the room, keep working",
        emoji: "🚪",
        effects: { oxygen: -14, energy: 2 },
        science: 0,
        outcome: "We seal the room, but air slowly escapes before we do.",
        lesson: "Spacecraft are built with separate sections so one leak does not empty the whole base.",
      },
      {
        id: "tank",
        label: "Use a spare air tank",
        emoji: "🛢️",
        effects: { oxygen: -4, energy: -3, food: -4 },
        science: 0,
        outcome: "The tank keeps the pressure steady while we wait for the repair.",
        lesson: "Spare air tanks buy time, but each tank is only a small stock.",
      },
    ],
  },
  "daily-ice": {
    id: "daily-ice",
    title: "Ice in a crater",
    prompt: "The rover scanner sees water ice in a dark crater. Ice means water, water means air and food. But it's a long way off.",
    source: { name: "NASA LCROSS", url: "https://www.nasa.gov/mission/lcross/" },
    options: [
      {
        id: "dig",
        label: "Go dig the ice ourselves",
        emoji: "⛏️",
        effects: { oxygen: 10, food: 10, energy: -14, shield: -8 },
        science: 0,
        outcome: "We bring back lots of ice! The trip is tiring and the radiation hit is real.",
        lesson: "Permanently shadowed craters near the lunar poles hold water ice that can become air and drinking water.",
      },
      {
        id: "rover",
        label: "Send the rover",
        emoji: "🤖",
        effects: { oxygen: 8, food: 6, energy: -10 },
        science: 3,
        outcome: "The rover brings ice home safely. It uses a lot of battery.",
        lesson: "Robots can go where it is too dangerous for people, but they also need energy.",
      },
      {
        id: "recycle",
        label: "Keep recycling water",
        emoji: "♻️",
        effects: { oxygen: -3, food: -3, energy: 4 },
        science: 0,
        outcome: "We stay home and reuse every drop. A bit less than we need.",
        lesson: "The space station recycles about 90% of its water, including from sweat and breath.",
      },
    ],
  },
  "daily-sample": {
    id: "daily-sample",
    title: "A strange rock",
    prompt: "A glittering rock lies near the base. It could tell us how the Moon formed! Collecting it outside is risky.",
    source: { name: "NASA Apollo Sample Collection", url: "https://curator.jsc.nasa.gov/" },
    options: [
      {
        id: "collect",
        label: "Collect it outside",
        emoji: "🪨",
        effects: { shield: -10, oxygen: -6 },
        science: 15,
        outcome: "A great sample! The walk costs air and gives some radiation.",
        lesson: "Moon rocks from Apollo showed the Moon is about 4.5 billion years old.",
      },
      {
        id: "camera",
        label: "Study it with the camera",
        emoji: "📷",
        effects: { energy: -4 },
        science: 5,
        outcome: "The camera sees the rock's shape and colour. We learn a little.",
        lesson: "Remote science is safer, but samples tell us much more than pictures.",
      },
      {
        id: "rest",
        label: "Skip it and rest",
        emoji: "😴",
        effects: { oxygen: 3, food: -3 },
        science: 0,
        outcome: "We rest and save breath. The rock waits for another day.",
        lesson: "Astronauts need rest too. Tired crews make mistakes.",
      },
    ],
  },
};

/** Ids of the optional random dilemmas. */
export const DAILY_IDS: string[] = Object.keys(DECISIONS).filter((k) => k.startsWith("daily-"));
