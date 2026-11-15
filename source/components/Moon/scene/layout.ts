import type { LocationId } from "../../../moon/types";

export interface LocPos { x: number; y: number; s: number }
export interface Layout {
  key: "wide" | "tall";
  W: number; H: number; H0: number;
  tScale: number; labelSize: number;
  earth: { x: number; y: number; r: number };
  sun: { x: number; y: number };
  locs: Record<LocationId, LocPos>;
  colony: LocPos; city: LocPos; wreck: LocPos;
}

export const LOC_META: Record<LocationId, { name: string; emoji: string; h: number; stand: number; aria: string }> = {
  habitat: { name: "Habitat", emoji: "🏠", h: 92, stand: 62, aria: "Habitat: oxygen and life support" },
  greenhouse: { name: "Greenhouse", emoji: "🌱", h: 78, stand: 0, aria: "Greenhouse: food" },
  solar: { name: "Solar Farm", emoji: "⚡", h: 60, stand: -6, aria: "Solar farm: energy" },
  shelter: { name: "Shelter", emoji: "🛡️", h: 64, stand: 0, aria: "Radiation shelter: shield" },
  radio: { name: "Radio", emoji: "📡", h: 124, stand: 24, aria: "Radio station: talk to Earth" },
  lab: { name: "Lab", emoji: "💻", h: 84, stand: 40, aria: "Lab: the working computer and science" },
};

export const LAYOUTS: Record<"wide" | "tall", Layout> = {
  wide: {
    key: "wide", W: 1600, H: 900, H0: 450, tScale: 1.35, labelSize: 18,
    earth: { x: 1235, y: 172, r: 118 }, sun: { x: 170, y: 112 },
    locs: {
      greenhouse: { x: 490, y: 570, s: 1.0 },
      solar: { x: 900, y: 552, s: 0.96 },
      radio: { x: 1285, y: 586, s: 1.0 },
      habitat: { x: 360, y: 772, s: 1.2 },
      shelter: { x: 790, y: 788, s: 1.15 },
      lab: { x: 1215, y: 776, s: 1.2 },
    },
    colony: { x: 690, y: 618, s: 0.9 }, city: { x: 255, y: 488, s: 1.05 }, wreck: { x: 135, y: 668, s: 0.9 },
  },
  tall: {
    key: "tall", W: 600, H: 1000, H0: 385, tScale: 1.35, labelSize: 20,
    earth: { x: 445, y: 178, r: 84 }, sun: { x: 80, y: 100 },
    locs: {
      greenhouse: { x: 170, y: 528, s: 0.8 },
      solar: { x: 436, y: 512, s: 0.7 },
      radio: { x: 446, y: 714, s: 0.86 },
      shelter: { x: 160, y: 716, s: 0.9 },
      habitat: { x: 205, y: 870, s: 1.0 },
      lab: { x: 418, y: 882, s: 0.98 },
    },
    colony: { x: 302, y: 600, s: 0.52 }, city: { x: 300, y: 422, s: 0.78 }, wreck: { x: 318, y: 806, s: 0.5 },
  },
};

export const LOC_IDS: LocationId[] = ["greenhouse", "solar", "radio", "habitat", "shelter", "lab"];
