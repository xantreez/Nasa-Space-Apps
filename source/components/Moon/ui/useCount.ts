import { ref, watch, onBeforeUnmount, type Ref } from "vue";

/** Smoothly count a number toward `source` (ease-out). */
export function useCount(source: () => number, ms = 600, startFromZero = false): Ref<number> {
  const out = ref(startFromZero ? 0 : source());
  let raf = 0;
  function run(to: number) {
    cancelAnimationFrame(raf);
    const from = out.value;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      out.value = Math.round(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  watch(source, run);
  if (startFromZero && typeof window !== "undefined") setTimeout(() => run(source()), 250);
  onBeforeUnmount(() => cancelAnimationFrame(raf));
  return out;
}
