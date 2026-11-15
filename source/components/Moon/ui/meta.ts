import type { ResKey, LocationId } from "../../../moon/types";

export const RES_KEYS: ResKey[] = ["oxygen", "energy", "shield", "food", "comms"];

export const RES: Record<ResKey | "science", { label: string; emoji: string; color: string }> = {
  oxygen: { label: "Oxygen", emoji: "🫧", color: "#4fd1ff" },
  energy: { label: "Energy", emoji: "⚡", color: "#ffd23f" },
  shield: { label: "Shield", emoji: "🛡️", color: "#7cf29c" },
  food: { label: "Food", emoji: "🥕", color: "#ff9f43" },
  comms: { label: "Comms", emoji: "📡", color: "#ff6b9d" },
  science: { label: "Science", emoji: "🔬", color: "#a78bfa" },
};

export const LOC: Record<LocationId, { label: string; emoji: string }> = {
  habitat: { label: "Habitat", emoji: "🏠" },
  greenhouse: { label: "Greenhouse", emoji: "🌱" },
  solar: { label: "Solar Field", emoji: "☀️" },
  shelter: { label: "Storm Shelter", emoji: "🛡️" },
  radio: { label: "Radio Dish", emoji: "📡" },
  lab: { label: "Lab Computer", emoji: "💻" },
};

export const BUILD: Record<string, { label: string; emoji: string }> = {
  "o2-generator": { label: "Oxygen Generator", emoji: "🫧" },
  garden: { label: "Garden", emoji: "🥬" },
  "big-dish": { label: "Big Dish", emoji: "📡" },
  "storm-shelter": { label: "Storm Shelter", emoji: "🛡️" },
  "battery-bank": { label: "Battery Bank", emoji: "🔋" },
  colony: { label: "Colony", emoji: "🏘️" },
  "science-lab": { label: "Science Lab", emoji: "🧪" },
  city: { label: "Moon City", emoji: "🏙️" },
};

export type MissionStatus = {
  mission?: unknown;
  tasks: { location: LocationId; need: number; have: number }[];
  decisionDone: boolean;
  scienceNeeded: number;
  done: boolean;
};
