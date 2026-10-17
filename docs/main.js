import { glyphSVG } from "./glyph.js";
import { playIntro } from "./intro.js";
import { mountTerminal } from "./terminal.js";

const ACCENTS = { blue: "#2f6bff", pink: "#ff2e88", orange: "#ff6a00", lime: "#b6f000", violet: "#7a3cff" };
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.documentElement;
const phones = [];

const onAccent = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 165 ? "#000000" : "#ffffff";
};

let accent = ACCENTS.blue;
try { accent = localStorage.getItem("changeos-accent") || accent; } catch {}

function setAccent(hex) {
  accent = hex;
  root.style.setProperty("--accent", hex);
  root.style.setProperty("--on-accent", onAccent(hex));
  try { localStorage.setItem("changeos-accent", hex); } catch {}
  document.querySelectorAll(".swatch").forEach((s) => s.setAttribute("aria-pressed", String(s.dataset.hex === hex)));
  phones.forEach((p) => p.setAccent(hex));
  renderGlyph();
}

// swatches
const sw = document.getElementById("swatches");
sw.innerHTML = Object.entries(ACCENTS).map(([name, hex]) =>
  `<button class="swatch" type="button" data-hex="${hex}" style="background:${hex}" aria-label="${name}" aria-pressed="false"></button>`).join("");
sw.addEventListener("click", (e) => { const b = e.target.closest(".swatch"); if (b) setAccent(b.dataset.hex); });

// status glyph explainer
const gs = { bat: 82, sig: 4, wf: "c" };
const glyphEl = document.getElementById("glyph-svg");
const title = glyphEl.querySelector("title").outerHTML;
const bat = document.getElementById("bat");
function renderGlyph() {
  glyphEl.innerHTML = title + glyphSVG(gs, { fg: "#000", mute: "#c4c4ca", bg: "#f7f7f8" });
  bat.style.setProperty("--p", `${gs.bat}%`);
  const sig = ["no signal", "weak signal", "fair signal", "good signal", "full signal"][gs.sig];
  const wf = { c: "Wi-Fi connected", n: "Wi-Fi with no internet", o: "Wi-Fi off", h: "on mobile data" }[gs.wf];
  document.getElementById("readout").textContent = `${gs.bat}% battery${gs.bat <= 15 ? ", running low" : ""}, ${sig}, ${wf}.`;
}
function seg(id, key, cast = (v) => v) {
  const el = document.getElementById(id);
  const sync = () => el.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(cast(b.dataset.v) === gs[key])));
  el.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { gs[key] = cast(b.dataset.v); sync(); renderGlyph(); } });
  sync();
}
seg("sig", "sig", Number);
seg("wf", "wf");
bat.addEventListener("input", () => { gs.bat = +bat.value; renderGlyph(); });

mountTerminal({ setAccent, accents: ACCENTS, getAccent: () => accent, replayIntro: () => playIntro({ force: true }) });
setAccent(accent);
playIntro();

// 3D phones load after first paint so the intro stays smooth
async function boot3D() {
  let Phone;
  try { ({ Phone } = await import("./phone.js")); }
  catch (err) { console.warn("3D disabled:", err); return; }
  await document.fonts.ready;
  const heroStage = document.getElementById("hero-stage");
  const hero = new Phone(heroStage, { mode: "lock", accent, distance: 3.2 });
  const story = new Phone(document.getElementById("story-stage"), { mode: "lock", accent, distance: 3.0, interactive: false });
  phones.push(hero, story);
  hero.target.ry = -0.42;

  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger || reduce) {
    document.querySelectorAll(".step").forEach((s) => s.classList.add("is-on"));
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  // hero phone leans back and drifts as you leave the hero
  ScrollTrigger.create({
    trigger: ".hero", start: "top top", end: "bottom top", scrub: true,
    onUpdate: (st) => { hero.target.rx = st.progress * 0.5; hero.target.ry = -0.42 + st.progress * 0.9; hero.target.y = st.progress * 0.25; },
  });
  // story: screen follows the active step, phone turns with overall progress
  document.querySelectorAll(".step").forEach((step) => {
    ScrollTrigger.create({
      trigger: step, start: "top 60%", end: "bottom 40%",
      onToggle: (st) => {
        step.classList.toggle("is-on", st.isActive);
        if (st.isActive) story.setMode(step.dataset.screen);
      },
    });
  });
  ScrollTrigger.create({
    trigger: ".story", start: "top bottom", end: "bottom top", scrub: true,
    onUpdate: (st) => { const p = st.progress; story.target.ry = 0.55 - p * 1.1; story.target.rx = -0.08 + Math.sin(p * Math.PI) * 0.12; },
  });
}
const start3D = () => (window.requestIdleCallback ? requestIdleCallback(boot3D, { timeout: 1500 }) : setTimeout(boot3D, 300));
if (document.body.classList.contains("intro-active")) addEventListener("intro:done", start3D, { once: true });
else start3D();
