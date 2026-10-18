// Niri-style FAQ: cards sit side by side like scrollable-tiling columns. One wheel flick = one card.
// Loops forever: the strip holds three copies and quietly re-centers after each move.
import { sfx } from "./sfx.js";

const FAQ = [
  { chat: [
    ["them", "i love ChangeOS man. the bloat is nonexistent!"],
    ["us", "yeah, it was made only in the GSI file"],
    ["them", "wait, what"],
    ["us", "yeah"],
    ["them", "wasn't it AOSP?"],
    ["us", "no"],
    ["them", "THEN HOW IS IT ANDROID"],
    ["us", ":P"],
  ] },
  { q: "OK but seriously, how is it Android?", a: "A GSI is AOSP that Google already compiled. We skip the 400 GB checkout and the six-hour build, take the finished system image, and do surgery on it. Same Android underneath, none of the extras on top." },
  { q: "Where's the Play Store?", a: "Banned. Not hidden, not disabled: if it ever gets installed, ChangeOS deletes it. Aurora Store gets you the same apps without a Google account." },
  { q: "Why does Google Play get banned?", a: "Play comes with Google Play Services, which runs with deep system access and phones home constantly. Privacy folks have been side-eyeing it for years. Aurora does the same job, anonymously. Enjoy." },
  { q: "Why does it only come with two apps?", a: "Because you didn't ask for the other thirty. Aurora and Firefox, then it's your phone." },
  { q: "Is it fast?", a: "There's nothing on it to slow it down. That's the whole trick." },
  { q: "Why is the logo a ring?", a: "It's your battery, your signal and your Wi-Fi in one icon. It's also the logo. One ring, two jobs, zero extra pixels." },
  { q: "Will it run on my phone?", a: "If your bootloader unlocks, probably. If it doesn't: sorry, your phone belongs to someone else." },
  { q: "Can I root it?", a: "There's a real terminal built in. Root is on the roadmap. Use responsibly-ish." },
  { q: "Why dessert names?", a: "Android stopped saying theirs out loud, so we picked the habit up. Sweet Vanilla now, then Salted Caramel, then Banana Split, the update so big it's splitting apart." },
  { q: "Is the Change Ring a real phone?", a: "No, it's a concept. The ring on the back would be a status light and the bullseye would be the camera. Your wallet is safe, for now." },
  { q: "Does it use systemd?", a: "It's Android. init is init. Please don't start." },
  { q: "Should I use this or postmarketOS?", a: "Want real Linux on a phone? postmarketOS, honestly. Want Android without the junk, built with a Linux user's attitude? Hi." },
  { q: "Who makes this?", a: "A Gentoo user that's lazy. Compiles everything, refuses to compile Android." },
  { q: "Is it done?", a: "No. It's 1.0, the very first version. It boots, it's real, it's early. “Where it stands” below says what works right now." },
];

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

function cardHTML(item, n) {
  if (item.chat) {
    return `<article class="col chat" aria-label="A conversation about ChangeOS"><span class="col-n">${n}</span>
      <div class="bubbles">${item.chat.map(([who, t]) => `<p class="b ${who}">${esc(t)}</p>`).join("")}</div></article>`;
  }
  return `<article class="col"><span class="col-n">${n}</span><h3>${esc(item.q)}</h3><p>${esc(item.a)}</p></article>`;
}

export function mountFaq() {
  const view = document.getElementById("faq-view");
  const track = document.getElementById("faq-track");
  const count = document.getElementById("faq-count");
  if (!view || !track) return;
  const N = FAQ.length;
  track.innerHTML = [0, 1, 2].map(() => FAQ.map((f, i) => cardHTML(f, `${i + 1} / ${N}`)).join("")).join("");
  const cards = [...track.children];

  // continuous position in "cards", smoothed toward a target. Wheel moves the target freely (fast flicks
  // fly through many cards), then it settles on the nearest card. Three copies + wrap = endless.
  let step = 0, pos = N, tgt = N, settleAt = 0, focused = -1;
  const measure = () => { step = cards[1].offsetLeft - cards[0].offsetLeft; };
  function wrap() {
    if (pos < N - 0.5 || pos >= 2 * N - 0.5) {
      const shift = pos < N - 0.5 ? N : -N;
      pos += shift; tgt += shift;
    }
  }
  function render() {
    const center = cards[0].offsetLeft + cards[0].offsetWidth / 2;
    track.style.transform = `translate3d(${(view.clientWidth / 2 - center - pos * step).toFixed(2)}px,0,0)`;
    const f = Math.round(pos);
    if (f !== focused) {
      if (focused >= 0) cards[focused]?.classList.remove("on");
      cards[f]?.classList.add("on");
      focused = f;
      count.textContent = `${(f % N) + 1} / ${N}`;
      sfx.tick();
    }
  }
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (now > settleAt) tgt = Math.round(tgt);  // snap once the wheel goes quiet
    const k = reduce ? 1 : 1 - Math.pow(0.0008, dt);  // critically-damped-ish glide
    pos += (tgt - pos) * k;
    if (Math.abs(tgt - pos) < 0.0005) pos = tgt;
    wrap();
    render();
    requestAnimationFrame(frame);
  }

  view.addEventListener("wheel", (e) => {
    e.preventDefault();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const px = e.deltaMode === 1 ? d * 40 : e.deltaMode === 2 ? d * view.clientWidth : d;
    tgt += px / (step * 0.28);  // sensitive: one notch is most of a card, a fast flick flies
    settleAt = performance.now() + 140;
  }, { passive: false });

  // drag / swipe with momentum
  let dragX = null, dragPos = 0, vel = 0, lastX = 0, lastT = 0;
  view.addEventListener("pointerdown", (e) => {
    dragX = e.clientX; dragPos = tgt; vel = 0; lastX = e.clientX; lastT = performance.now();
    view.setPointerCapture(e.pointerId);
  });
  view.addEventListener("pointermove", (e) => {
    if (dragX === null) return;
    const now = performance.now();
    vel = (lastX - e.clientX) / Math.max(1, now - lastT); lastX = e.clientX; lastT = now;
    tgt = pos = dragPos + (dragX - e.clientX) / step;
    settleAt = Infinity;
  });
  const endDrag = (e) => {
    if (dragX === null) return;
    const moved = Math.abs(e.clientX - dragX);
    dragX = null;
    tgt += vel * 0.35 * (1000 / step) * 0.2;  // fling
    settleAt = performance.now();
    if (moved < 6) {  // a click on a side card focuses it
      const hit = cards.indexOf(e.target.closest(".col"));
      if (hit >= 0 && hit !== Math.round(pos)) tgt = hit;
    }
  };
  view.addEventListener("pointerup", endDrag);
  view.addEventListener("pointercancel", endDrag);
  view.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "l") { tgt = Math.round(tgt) + 1; settleAt = 0; e.preventDefault(); }
    if (e.key === "ArrowLeft" || e.key === "h") { tgt = Math.round(tgt) - 1; settleAt = 0; e.preventDefault(); }
  });
  document.getElementById("faq-prev").onclick = () => { tgt = Math.round(tgt) - 1; settleAt = 0; };
  document.getElementById("faq-next").onclick = () => { tgt = Math.round(tgt) + 1; settleAt = 0; };
  addEventListener("resize", measure);
  document.fonts.ready.then(measure);
  measure();
  requestAnimationFrame(frame);
}
