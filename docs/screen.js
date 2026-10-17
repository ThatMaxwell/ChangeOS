// Paints ChangeOS screens onto a 2D canvas (used as the 3D phone's display texture).
import { drawGlyph } from "./glyph.js";

export const SW = 540, SH = 1170, SR = 64; // screen size and corner radius in px

const ICON = {
  camera: "M4 8h3l2-3h6l2 3h3v11H4z M15 13a3 3 0 1 1-6 0a3 3 0 1 1 6 0",
  photos: "M4 5h16v14H4z M4 16l5-5l5 5 M13 14l2-2l5 5",
  firefox: "M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0 M3 12h18 M12 3a14 14 0 0 1 0 18 M12 3a14 14 0 0 0 0 18",
  aurora: "M3 9h18l-1.5 10h-15z M8 9a4 4 0 0 1 8 0",
  messages: "M4 5h16v11H9l-5 4z",
  music: "M9 18V6l10-2v12 M9 18a3 3 0 1 1-6 0a3 3 0 1 1 6 0 M19 16a3 3 0 1 1-6 0a3 3 0 1 1 6 0",
  terminal: "M5 8l4 4l-4 4 M12 17h7",
  settings: "M15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  phone: "M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  dots: "M5 12h.01 M12 12h.01 M19 12h.01",
  at: "M16 12a4 4 0 1 1-8 0a4 4 0 1 1 8 0 M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1",
  toggle: "M7 6h10a6 6 0 0 1 0 12H7A6 6 0 0 1 7 6 M20 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0",
  wifi: "M12 18h.01 M9 15a4 4 0 0 1 6 0 M6 12a8 8 0 0 1 12 0 M3 9a12 12 0 0 1 18 0",
  data: "M8 4v16 M4 8l4-4l4 4 M16 20V4 M12 16l4 4l4-4",
  bt: "M7 8l10 8l-5 4V4l5 4L7 16",
  torch: "M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3",
  moon: "M12 3a9 9 0 1 0 9 9A7 7 0 0 1 12 3",
  rotate: "M4 12a8 8 0 0 1 14-5.3 M18 3v4h-4 M20 12a8 8 0 0 1-14 5.3 M6 21v-4h4",
  hotspot: "M12 12h.01 M8.5 8.5a5 5 0 0 0 0 7 M15.5 8.5a5 5 0 0 1 0 7 M5.6 5.6a9 9 0 0 0 0 12.8 M18.4 5.6a9 9 0 0 1 0 12.8",
  mic: "M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0z M5 11a7 7 0 0 0 14 0 M12 18v3",
  pin: "M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z M15 10a3 3 0 1 1-6 0a3 3 0 1 1 6 0",
  sun: "M16 12a4 4 0 1 1-8 0a4 4 0 1 1 8 0 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4",
  volume: "M4 9h4l5-4v14l-5-4H4z M16 9a4 4 0 0 1 0 6 M19 6a8 8 0 0 1 0 12",
  lock: "M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3",
  chevron: "M6 15l6-6l6 6",
};
const PATHS = {};
const path = (n) => (PATHS[n] ||= new Path2D(ICON[n]));

function icon(ctx, name, x, y, size, color, width = 2) {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(path(name));
  ctx.restore();
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

const onAccent = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 165 ? "#000000" : "#ffffff";
};

const FOG = { wall: "#d9d9de", card: "#f7f7f8", fg: "#000000", sub: "#5a5a60", mute: "#a9a9b0", key: "#ececef", qs: "#d2d2d7" };

function theme(mode, accent) {
  if (mode !== "loud") return FOG;
  const t = onAccent(accent);
  return { wall: accent, card: "#ffffff", fg: t, sub: t, mute: t === "#ffffff" ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.28)",
           key: t === "#ffffff" ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.1)", qs: accent, cardFg: "#000000" };
}

function clock() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0"), mm = String(d.getMinutes()).padStart(2, "0");
  const day = d.toLocaleDateString("en-US", { weekday: "long" });
  const date = d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return { hh, mm, day, date, dnum: d.getDate(), wd: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(), d };
}

function statusBar(ctx, T, c) {
  ctx.fillStyle = T.fg;
  ctx.font = "600 26px 'Atkinson Hyperlegible Next', sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(`${c.hh}:${c.mm}`, 44, 52);
  ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.arc(SW / 2, 52, 15, 0, Math.PI * 2); ctx.fill();
  drawGlyph(ctx, SW - 62, 52, 42, { bat: 82, sig: 4, wf: "c" }, { fg: T.fg, mute: T.mute, bg: T.wall });
}

function lock(ctx, T, a, c) {
  ctx.fillStyle = T.sub;
  ctx.font = "400 28px 'Atkinson Hyperlegible Next', sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${c.day}, ${c.date}`, 52, 200);
  ctx.fillStyle = T.fg;
  ctx.font = "700 250px Unbounded, sans-serif";
  ctx.fillText(c.hh, 36, 430);
  ctx.fillText(c.mm, 36, 660);
  // notification
  rr(ctx, 36, 820, SW - 72, 112, 34); ctx.fillStyle = T.card; ctx.fill();
  rr(ctx, 62, 848, 58, 58, 18); ctx.fillStyle = a; ctx.fill();
  icon(ctx, "aurora", 91, 877, 34, onAccent(a));
  ctx.fillStyle = T.cardFg || T.fg;
  ctx.font = "600 26px 'Atkinson Hyperlegible Next', sans-serif";
  ctx.fillText("Aurora Store", 142, 870);
  ctx.globalAlpha = 0.65; ctx.font = "400 23px 'Atkinson Hyperlegible Next', sans-serif";
  ctx.fillText("3 updates ready", 142, 902); ctx.globalAlpha = 1;
  // shortcuts
  [["torch", 88], ["camera", SW - 88]].forEach(([n, x]) => {
    ctx.fillStyle = T.key; ctx.beginPath(); ctx.arc(x, 1060, 46, 0, Math.PI * 2); ctx.fill();
    icon(ctx, n, x, 1060, 40, T.fg);
  });
  icon(ctx, "chevron", SW / 2, 1040, 34, T.sub);
  ctx.fillStyle = T.sub; ctx.font = "400 22px 'Atkinson Hyperlegible Next', sans-serif"; ctx.textAlign = "center";
  ctx.fillText("Swipe up", SW / 2, 1082); ctx.textAlign = "left";
}

function home(ctx, T, a, c, loud) {
  const cf = T.cardFg || T.fg;
  rr(ctx, 30, 110, SW - 60, 240, 44); ctx.fillStyle = T.card; ctx.fill();
  ctx.fillStyle = cf; ctx.textBaseline = "alphabetic";
  ctx.font = "600 46px Unbounded, sans-serif"; ctx.fillText(c.wd, 62, 200);
  ctx.font = "700 92px Unbounded, sans-serif"; ctx.fillText(String(c.dnum), 56, 306);
  // mini calendar
  const first = new Date(c.d.getFullYear(), c.d.getMonth(), 1).getDay();
  const days = new Date(c.d.getFullYear(), c.d.getMonth() + 1, 0).getDate();
  ctx.font = "400 17px 'Atkinson Hyperlegible Next', sans-serif"; ctx.textAlign = "center";
  for (let i = 0; i < days; i++) {
    const cell = first + i, col = cell % 7, row = Math.floor(cell / 7);
    const x = 262 + col * 33, y = 156 + row * 34;
    if (i + 1 === c.dnum) { ctx.fillStyle = loud ? a : cf; rr(ctx, x - 15, y - 21, 30, 28, 8); ctx.fill(); ctx.fillStyle = loud ? onAccent(a) : T.card; }
    else ctx.fillStyle = cf;
    ctx.globalAlpha = i + 1 === c.dnum ? 1 : 0.7; ctx.fillText(String(i + 1), x, y); ctx.globalAlpha = 1;
  }
  ctx.textAlign = "left";
  const apps = [["camera", "Camera"], ["photos", "Photos"], ["firefox", "Firefox"], ["aurora", "Aurora"], ["messages", "Messages"], ["music", "Music"], ["terminal", "Terminal"], ["settings", "Settings"]];
  apps.forEach(([n, label], i) => {
    const col = i % 4, row = Math.floor(i / 4), x = 82 + col * 125, y = 460 + row * 170;
    rr(ctx, x - 46, y - 46, 92, 92, 28); ctx.fillStyle = T.card; ctx.fill();
    icon(ctx, n, x, y, 46, loud ? a : a);
    ctx.fillStyle = T.fg; ctx.font = "400 19px 'Atkinson Hyperlegible Next', sans-serif"; ctx.textAlign = "center";
    ctx.fillText(label, x, y + 78); ctx.textAlign = "left";
  });
  rr(ctx, 26, SH - 170, SW - 52, 130, 48); ctx.fillStyle = loud ? "rgba(255,255,255,.28)" : "#c9c9cf"; ctx.fill();
  ["phone", "dots", "at", "toggle"].forEach((n, i) => {
    const x = 92 + i * 119, y = SH - 105;
    rr(ctx, x - 40, y - 40, 80, 80, 24); ctx.fillStyle = T.card; ctx.fill();
    icon(ctx, n, x, y, 40, a);
  });
}

function qs(ctx, T, a, c, t) {
  ctx.fillStyle = T.qs; ctx.fillRect(0, 0, SW, SH);
  ctx.fillStyle = T.fg; ctx.textBaseline = "alphabetic";
  ctx.font = "700 92px Unbounded, sans-serif"; ctx.fillText(`${c.hh}:${c.mm}`, 36, 210);
  ctx.fillStyle = T.sub; ctx.font = "400 24px 'Atkinson Hyperlegible Next', sans-serif"; ctx.fillText(`${c.day}, ${c.date}`, 40, 252);
  drawGlyph(ctx, SW - 84, 180, 80, { bat: 82, sig: 4, wf: "c" }, { fg: T.fg, mute: T.mute, bg: T.qs });
  const sl = (y, v, ic) => {
    rr(ctx, 30, y, SW - 60, 96, 48); ctx.fillStyle = T.card; ctx.fill();
    ctx.save(); rr(ctx, 30, y, SW - 60, 96, 48); ctx.clip();
    ctx.fillStyle = a; ctx.fillRect(30, y, (SW - 60) * v, 96); ctx.restore();
    icon(ctx, ic, 82, y + 48, 38, onAccent(a));
    ctx.fillStyle = "#000"; ctx.font = "600 24px 'Atkinson Hyperlegible Next', sans-serif"; ctx.textAlign = "right";
    ctx.fillText(`${Math.round(v * 100)}%`, SW - 64, y + 57); ctx.textAlign = "left";
  };
  sl(300, 0.62 + Math.sin(t / 900) * 0.08, "sun");
  sl(414, 0.45, "volume");
  const tiles = [["wifi", 1], ["data", 1], ["bt", 0], ["torch", 0], ["moon", 0], ["rotate", 1], ["terminal", 1], ["hotspot", 0]];
  tiles.forEach(([n, on], i) => {
    const col = i % 4, row = Math.floor(i / 4), x = 30 + col * 124, y = 548 + row * 124;
    rr(ctx, x, y, 110, 110, 34); ctx.fillStyle = on ? a : T.card; ctx.fill();
    icon(ctx, n, x + 55, y + 55, 44, on ? onAccent(a) : "#000");
  });
  ctx.fillStyle = T.sub; ctx.font = "400 22px 'Atkinson Hyperlegible Next', sans-serif"; ctx.fillText("Privacy switches", 36, 832);
  [["camera", "Camera", 1], ["mic", "Mic", 1], ["pin", "Location", 0]].forEach(([n, label, on], i) => {
    const x = 30 + i * 164, y = 856;
    rr(ctx, x, y, 152, 82, 30); ctx.fillStyle = on ? T.card : "#ff3b30"; ctx.fill();
    icon(ctx, n, x + 38, y + 41, 30, on ? "#000" : "#fff");
    ctx.fillStyle = on ? "#000" : "#fff"; ctx.font = "600 21px 'Atkinson Hyperlegible Next', sans-serif"; ctx.fillText(label, x + 62, y + 49);
  });
}

/** Paint one full screen. mode: lock | home | qs | loud */
export function paint(ctx, mode, accent, t = performance.now()) {
  const T = theme(mode, accent), c = clock();
  ctx.save();
  ctx.clearRect(0, 0, SW, SH);
  rr(ctx, 0, 0, SW, SH, SR); ctx.clip();
  ctx.fillStyle = T.wall; ctx.fillRect(0, 0, SW, SH);
  if (mode === "lock") lock(ctx, T, accent, c);
  else if (mode === "qs") qs(ctx, T, accent, c, t);
  else home(ctx, T, accent, c, mode === "loud");
  statusBar(ctx, mode === "qs" ? { ...T, wall: T.qs } : T, c);
  ctx.restore();
}

/** Back glass texture with the ring mark. */
export function paintBack(ctx, accent) {
  ctx.clearRect(0, 0, SW, SH);
  rr(ctx, 0, 0, SW, SH, SR); ctx.fillStyle = "#cfcfd5"; ctx.fill();
  drawGlyph(ctx, SW / 2, SH * 0.56, 230, { bat: 100, sig: 4, wf: "c" }, { fg: "#000", mute: "#000", bg: "#cfcfd5" });
  ctx.fillStyle = accent; ctx.beginPath();
  const bx = SW / 2 - 115 + (75.46 / 100) * 230, by = SH * 0.56 - 115 + (24.54 / 100) * 230;
  ctx.arc(bx, by, (6.5 / 100) * 230, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#000"; ctx.font = "600 30px Unbounded, sans-serif"; ctx.textAlign = "center";
  ctx.fillText("ChangeOS", SW / 2, SH * 0.56 + 190); ctx.textAlign = "left";
}
