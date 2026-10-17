// Power-on intro. "Press to power on" (enables sound), then the ChangeOS boot: ring sweeps in while spinning,
// dots pop, a comet runs the ring, the bullseye lands with a shockwave, the wordmark rises, and the view dives
// through the bullseye's hole into the page. Auto-boots silently if nobody presses anything.
import { G, BULL, arcPath } from "./glyph.js";
import { sfx, sound } from "./sfx.js";

const KEY = "changeos-intro-seen";
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = { out: (x) => 1 - (1 - x) ** 3, inOut: (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  back: (x, s = 1.7) => 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2 };
const clamp = (x) => Math.max(0, Math.min(1, x));

export function playIntro({ force = false } = {}) {
  const el = document.getElementById("intro");
  const done = () => {
    el.hidden = true;
    window.scrollTo(0, 0);
    document.body.classList.remove("intro-active");
    window.dispatchEvent(new Event("intro:done"));
  };
  let seen = false;
  try { seen = sessionStorage.getItem(KEY) === "1"; } catch {}
  if (reduce || (seen && !force)) { done(); return; }
  try { sessionStorage.setItem(KEY, "1"); } catch {}

  el.hidden = false;
  el.classList.remove("booting");
  el.style.setProperty("--hole", "0px");
  document.body.classList.add("intro-active");
  const svg = document.getElementById("intro-mark");
  const word = document.getElementById("intro-word");
  const stage = el.querySelector(".intro-stage");
  const power = document.getElementById("intro-power");
  stage.style.transform = "";
  word.innerHTML = [..."Change"].map((c) => `<span>${c}</span>`).join("") + [..."OS"].map((c) => `<span class="os">${c}</span>`).join("");
  const letters = [...word.children];
  letters.forEach((l) => { l.style.opacity = 0; });
  const accent = () => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#2f6bff";
  const [bx, by] = BULL;
  svg.innerHTML = `<path d="${arcPath(G.a0, G.a1)}" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="${G.stroke}" stroke-linecap="round"/>`;

  let raf, skipped = false, dive = null, started = false, t0 = 0;
  const fired = new Set();
  const once = (k, fn) => { if (!fired.has(k)) { fired.add(k); fn(); } };
  const T_SWEEP = 1.0, T_DOTS = 0.75, T_COMET = 1.25, T_DROP = 1.95, T_WORD = 2.2, T_DIVE = 3.1, T_END = 3.95;

  function boot(withSound) {
    if (started) return;
    started = true;
    if (withSound && sound.preference() !== "off") sound.set(true);
    el.classList.add("booting");
    sfx.power();
    t0 = performance.now() + 250;
    raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    const t = Math.max(0, (now - t0) / 1000);
    const a = accent();
    if (t > 0) once("sweep", sfx.sweep);
    const sweep = ease.inOut(clamp(t / T_SWEEP));
    const spin = -360 * (1 - ease.back(clamp(t / 1.1), 1.1));
    let s = `<g transform="rotate(${spin.toFixed(2)} 50 50)"><path d="${arcPath(G.a0, G.a0 + (G.a1 - G.a0) * sweep)}" fill="none" stroke="#000" stroke-width="${G.stroke}" stroke-linecap="round"/></g>`;
    const c = clamp((t - T_COMET) / 0.65);
    if (c > 0 && c < 1) {
      const head = G.a0 + (G.a1 - G.a0 + 70) * ease.inOut(c);
      const lo = Math.max(G.a0, head - 70), hi = Math.min(G.a1, head);
      if (hi - lo > 1) s += `<path d="${arcPath(lo, hi)}" fill="none" stroke="${a}" stroke-width="${G.stroke}" stroke-linecap="round"/>`;
    }
    G.dots.forEach((x, i) => {
      const k = ease.back(clamp((t - T_DOTS - i * 0.07) / 0.3), 2.2);
      if (k > 0) once("dot" + i, () => sfx.dot(i));
      const wave = c > 0 && c < 1 ? Math.max(0, Math.sin((c * 2 - i * 0.18) * Math.PI)) : 0;
      if (k > 0) s += `<circle cx="${x}" cy="${G.cy - wave * 2.5}" r="${(G.dotR * k * (1 + wave * 0.3)).toFixed(2)}" fill="${wave > 0.6 ? a : "#000"}"/>`;
    });
    const d = clamp((t - T_DROP) / 0.45);
    if (d > 0) {
      if (d > 0.5) once("thump", () => { sfx.thump(); sfx.chime(); });
      const k = ease.back(d, 2.0), y = by - 30 * (1 - clamp(d / 0.6));
      s += `<circle cx="${bx}" cy="${y}" r="${(G.bullR * k).toFixed(2)}" fill="#000"/>`;
      s += `<circle cx="${bx}" cy="${y}" r="${(G.holeR * k).toFixed(2)}" fill="${a}"/>`;
      const w = clamp((t - T_DROP - 0.15) / 0.6);
      if (w > 0 && w < 1) s += `<circle cx="${bx}" cy="${by}" r="${(G.bullR + 24 * ease.out(w)).toFixed(2)}" fill="none" stroke="${a}" stroke-width="1.4" opacity="${(1 - w).toFixed(2)}"/>`;
    }
    svg.innerHTML = s;
    letters.forEach((l, i) => {
      const k = clamp((t - T_WORD - i * 0.045) / 0.4);
      l.style.opacity = k;
      l.style.transform = `translateY(${(0.4 * (1 - ease.back(k, 1.4))).toFixed(3)}em)`;
    });
    const v = clamp((t - T_DIVE) / (T_END - T_DIVE));
    if (v > 0) {
      once("dive", sfx.dive);
      if (!dive) {
        const r = svg.getBoundingClientRect(), sr = stage.getBoundingClientRect();
        const hx = r.left + (bx / 100) * r.width, hy = r.top + (by / 100) * r.height;
        dive = { holePx: (G.holeR / 100) * r.width };
        stage.style.transformOrigin = `${hx - sr.left}px ${hy - sr.top}px`;
        el.style.setProperty("--hx", `${hx}px`);
        el.style.setProperty("--hy", `${hy}px`);
      }
      const scale = 1 + 80 * ease.inOut(v) ** 2;
      stage.style.transform = `scale(${scale.toFixed(3)})`;
      el.style.setProperty("--hole", `${(dive.holePx * scale).toFixed(1)}px`);
    }
    if (t < T_END && !skipped) raf = requestAnimationFrame(frame);
    else finish();
  }

  function finish() {
    cancelAnimationFrame(raf);
    clearTimeout(auto);
    stage.style.transform = "";
    removeEventListener("keydown", onKey);
    done();
  }
  function onKey(e) {
    if (e.key === "Escape") { skipped = true; if (!started) finish(); return; }
    if (!started) boot(true);
  }
  power.onclick = () => boot(true);
  addEventListener("keydown", onKey);
  document.getElementById("intro-skip").onclick = () => { skipped = true; if (!started) finish(); };
  const auto = setTimeout(() => boot(false), 2600);
  power.focus({ preventScroll: true });
}
