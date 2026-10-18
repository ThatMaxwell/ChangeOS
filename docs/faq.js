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
  { q: "Why does it only come with two apps?", a: "Because you didn't ask for the other thirty. Aurora and Firefox, then it's your phone." },
  { q: "Is it fast?", a: "There's nothing on it to slow it down. That's the whole trick." },
  { q: "Why is the logo a ring?", a: "It's your battery, your signal and your Wi-Fi in one icon. It's also the logo. One ring, two jobs, zero extra pixels." },
  { q: "Will it run on my phone?", a: "If your bootloader unlocks, probably. If you own a Moto g05: we're so sorry. We have one too." },
  { q: "Can I root it?", a: "There's a real terminal built in. Root is on the roadmap. Use responsibly-ish." },
  { q: "Why dessert names?", a: "Android stopped saying theirs out loud, so we picked the habit up. Sweet Vanilla now, then Salted Caramel, then Banana Split, the update so big it's splitting apart." },
  { q: "Is the Change Ring a real phone?", a: "No, it's a concept. The ring on the back would be a status light and the bullseye would be the camera. Your wallet is safe, for now." },
  { q: "Does it use systemd?", a: "It's Android. init is init. Please don't start." },
  { q: "Should I use this or postmarketOS?", a: "Want real Linux on a phone? postmarketOS, honestly. Want Android without the junk, built with a Linux user's attitude? Hi." },
  { q: "Who makes this?", a: "One Gentoo user on a borrowed Windows PC, a CYD on the desk, a dog on emotional-support duty, a grumpy sleeping cat, and cup noodles (8/10)." },
  { q: "Is it done?", a: "No. It's 0.1. It boots, it's real, it's early. “Where it stands” below says what works right now." },
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
  let idx = N;  // middle copy

  function place(animate = true) {
    const card = cards[idx];
    const offset = card.offsetLeft + card.offsetWidth / 2 - view.clientWidth / 2;
    track.style.transition = animate && !reduce ? "transform .45s cubic-bezier(.2,.8,.2,1)" : "none";
    track.style.transform = `translateX(${-offset}px)`;
    cards.forEach((c, i) => c.classList.toggle("on", i === idx));
    count.textContent = `${(idx % N) + 1} / ${N}`;
  }
  function go(d) {
    idx += d;
    sfx.tick();
    place(true);
  }
  // after moving into the outer copies, jump back to the middle copy without animation
  track.addEventListener("transitionend", () => {
    if (idx < N || idx >= 2 * N) { idx = (idx % N) + N; place(false); }
  });

  // one wheel flick = one column (niri style). Trackpads send many small events, so accumulate.
  let acc = 0, lock = 0;
  view.addEventListener("wheel", (e) => {
    e.preventDefault();
    const now = performance.now();
    acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (now < lock) return;
    if (Math.abs(acc) > 30) { go(acc > 0 ? 1 : -1); acc = 0; lock = now + 380; }
  }, { passive: false });

  let sx = null;
  view.addEventListener("pointerdown", (e) => { sx = e.clientX; });
  view.addEventListener("pointerup", (e) => {
    if (sx !== null && Math.abs(e.clientX - sx) > 40) go(e.clientX < sx ? 1 : -1);
    sx = null;
  });
  view.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "l") { go(1); e.preventDefault(); }
    if (e.key === "ArrowLeft" || e.key === "h") { go(-1); e.preventDefault(); }
  });
  document.getElementById("faq-prev").onclick = () => go(-1);
  document.getElementById("faq-next").onclick = () => go(1);
  cards.forEach((c, i) => c.addEventListener("click", () => { if (i !== idx) go(i - idx); }));
  addEventListener("resize", () => place(false));
  document.fonts.ready.then(() => place(false));
  place(false);
}
