// Glowing chips that fly from where the player tapped into a HUD meter.
// Pure DOM + WAAPI (transform/opacity only), appended to <body> so no modal can cover them.
let lx = 0, ly = 0, lt = 0;
let bound = false;
export function trackPointer() {
  if (bound || typeof window === "undefined") return;
  bound = true;
  window.addEventListener("pointerdown", (e) => { lx = e.clientX; ly = e.clientY; lt = performance.now(); }, { capture: true, passive: true });
}
/** where supplies "come from": the last tap if it was recent, else the screen centre */
export function origin() {
  const recent = performance.now() - lt < 2500;
  return recent ? { x: lx, y: ly } : { x: window.innerWidth / 2, y: window.innerHeight * 0.55 };
}
const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function flyChips(el: HTMLElement | null, color: string, emoji: string, count: number, onLand?: () => void) {
  if (!el || typeof document === "undefined") return onLand?.();
  if (reduced()) return onLand?.();
  const to = el.getBoundingClientRect();
  const tx = to.left + to.width / 2, ty = to.top + to.height / 2;
  const o = origin();
  const n = Math.max(3, Math.min(9, Math.round(count / 3)));
  let landed = 0;
  for (let i = 0; i < n; i++) {
    const d = document.createElement("div");
    d.textContent = emoji;
    d.style.cssText = `position:fixed;left:0;top:0;z-index:99999;pointer-events:none;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;display:grid;place-items:center;font-size:16px;background:radial-gradient(circle at 35% 30%,#fff,${color});box-shadow:0 0 14px ${color},0 0 28px ${color};will-change:transform,opacity`;
    document.body.appendChild(d);
    const sx = o.x + (Math.random() - 0.5) * 50, sy = o.y + (Math.random() - 0.5) * 30;
    const bx = sx + (Math.random() - 0.5) * 220, by = Math.min(sy, ty) - 60 - Math.random() * 120;
    const dur = 750 + Math.random() * 250;
    const a = d.animate(
      [
        { transform: `translate(${sx}px,${sy}px) scale(0.2)`, opacity: 0 },
        { transform: `translate(${bx}px,${by}px) scale(1.15)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${tx}px,${ty}px) scale(0.45)`, opacity: 0.9 },
      ],
      { duration: dur, delay: i * 70, easing: "cubic-bezier(.45,.05,.55,.95)", fill: "both" },
    );
    a.onfinish = () => {
      d.remove();
      if (++landed === 1) onLand?.();
    };
  }
}
