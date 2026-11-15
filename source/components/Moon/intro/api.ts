import type { gsap } from "gsap";
export interface IntroApi {
  reduced: boolean;
  track<T extends gsap.core.Animation>(a: T): T;
  wait(sec: number): Promise<void>;
  line(id: string, shown?: string): Promise<void>;
  lines(ids: string[]): Promise<void>;
  /** planned seconds for these lines (voice clip length if known, else 55ms/char + 600ms) */
  dur(...ids: string[]): number;
  lineDur(id: string): number;
  hideSub(): void;
  shake(amp: number, dur: number): gsap.core.Animation | null;
  flash(color?: string, peak?: number, inS?: number, outS?: number): void;
  onKey(fn: (e: KeyboardEvent, down: boolean) => void): () => boolean;
  alive(): boolean;
  /** pixel position of the lab (computer) on the base map, for the final pull-back */
  labPos(): { x: number; y: number };
  /** fade the intro background away (reveals the real base map underneath) and retract the letterbox */
  reveal(sec: number): void;
  music(n: "title" | "base" | "storm" | "night" | "minigame" | "victory"): void;
}
