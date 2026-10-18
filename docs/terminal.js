// A pretend ChangeOS shell. Some commands reach out and change the page.
import { G, BULL } from "./glyph.js";
import { sfx } from "./sfx.js";

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const bootedAt = Date.now();

// Rasterize the ChangeOS mark into half-block characters (each char = 1 x 2 "pixels").
function asciiMark(cols = 30) {
  const rows = cols; // square pixel grid, printed as cols x rows/2
  const px = (x, y) => {
    const u = ((x + 0.5) / cols) * 100, v = ((y + 0.5) / rows) * 100;
    const [bx, by] = BULL;
    const db = Math.hypot(u - bx, v - by);
    if (db <= G.bullR + 1) return db <= G.holeR ? 0 : 2; // 2 = accent bullseye
    for (const dx of G.dots) if (Math.hypot(u - dx, v - G.cy) <= G.dotR + 1.6) return 1;
    const d = Math.hypot(u - G.cx, v - G.cy);
    if (Math.abs(d - G.r) <= G.stroke / 2 + 1.2) {
      let a = (Math.atan2(v - G.cy, u - G.cx) * 180) / Math.PI;
      if (a < G.a0) a += 360;
      if (a >= G.a0 && a <= G.a1) return 1;
    }
    return 0;
  };
  const lines = [];
  for (let y = 0; y < rows; y += 2) {
    let line = "";
    for (let x = 0; x < cols; x++) {
      const t = px(x, y), b = px(x, y + 1);
      const ch = t && b ? "█" : t ? "▀" : b ? "▄" : " ";
      line += (t === 2 || b === 2) && ch !== " " ? `<span class=acc>${ch}</span>` : ch;
    }
    lines.push(line);
  }
  return lines;
}

function uptime() {
  const s = Math.floor((Date.now() - bootedAt) / 1000);
  const m = Math.floor(s / 60);
  return m ? `${m} min${m > 1 ? "s" : ""}, ${s % 60} secs` : `${s} secs`;
}

export function mountTerminal({ setAccent, accents, replayIntro, getAccent }) {
  const out = document.getElementById("term-out");
  const form = document.getElementById("term-form");
  const input = document.getElementById("term-in");
  const history = [];
  let hi = 0;
  const print = (html) => { out.insertAdjacentHTML("beforeend", html + "\n"); out.scrollTop = out.scrollHeight; };

  const neofetch = () => {
    const art = asciiMark(24);
    const k = (label, value) => `<span class=acc>${label}</span>: ${value}`;
    const palette = ["#000000", "#ff3b30", "#b6f000", "#ff6a00", "#2f6bff", "#7a3cff", "#ff2e88", "#d9d9de"];
    const info = [
      "<span class=acc>you</span>@<span class=acc>changeos</span>",
      "<span class=dim>------------</span>",
      k("OS", "ChangeOS 1.0 Sweet Vanilla x86_64"),
      k("Base", "Android 17 (API 37)"),
      k("Kernel", "Linux, Android GKI"),
      k("Uptime", uptime()),
      k("Packages", "2 (Aurora Store, Firefox)"),
      k("Shell", "changeos-sh"),
      k("Resolution", "1080x2400"),
      k("Theme", "Fog [light]"),
      k("Accent", getAccent()),
      k("Google Play", "<span class=bad>banned</span>"),
      k("Root", "yes, handle with care"),
      "",
      palette.map((c) => `<span class=blk style="background:${c}"></span>`).join(""),
    ];
    const n = Math.max(art.length, info.length);
    const rows = [];
    for (let i = 0; i < n; i++) rows.push(`<span class=art>${art[i] ?? " ".repeat(24)}</span>  ${info[i] ?? ""}`);
    return `<div class=neo>${rows.join("\n")}</div>`;
  };

  const cmds = {
    help: () => [
      "<span class=dim>commands you can try:</span>",
      "  <span class=acc>neofetch</span>             system info",
      "  <span class=acc>pm list packages</span>     what's installed",
      "  <span class=acc>accent</span> &lt;color&gt;       " + Object.keys(accents).join(", ") + ", or a #hex",
      "  <span class=acc>install</span> &lt;package&gt;    try com.android.vending",
      "  <span class=acc>whoami  uname -a  uptime  date  clear  reboot</span>",
    ].join("\n"),
    neofetch,
    "pm list packages": () => ["package:com.aurora.store", "package:org.mozilla.firefox", "package:com.android.systemui", "package:com.android.settings", "package:com.android.dialer", "<span class=dim># com.android.vending isn't here, and can't be</span>"].join("\n"),
    whoami: () => "root",
    id: () => "uid=0(root) gid=0(root) groups=0(root)",
    "uname -a": () => "Linux changeos 6.x android17-gki x86_64 ChangeOS",
    uptime: () => `up ${uptime()}`,
    date: () => new Date().toString(),
    clear: () => { out.innerHTML = ""; return null; },
    reboot: () => { setTimeout(() => replayIntro(), 500); return "<span class=dim>broadcasting reboot…</span>"; },
    ls: () => "Aurora  Firefox  Download  Pictures  your-stuff",
    exit: () => "there's no leaving. it's your phone now.",
  };

  function run(raw) {
    const line = raw.trim();
    if (!line) return;
    sfx.enter();
    print(`<span class=acc>you@changeos</span>:<span class=dim>~</span># ${esc(line)}`);
    const [name, ...args] = line.split(/\s+/);
    let res;
    if (cmds[line]) res = cmds[line]();
    else if (name === "accent") {
      const v = (args[0] || "").toLowerCase();
      const hex = accents[v] || (/^#[0-9a-f]{6}$/.test(v) ? v : null);
      if (hex) { setAccent(hex); res = `accent set to <span class=acc>${hex}</span>. look up.`; }
      else res = `accent: pick ${Object.keys(accents).join(", ")}, or a #rrggbb hex`;
    } else if (name === "install") {
      const pkg = args[0] || "";
      if (/vending|play/i.test(pkg)) { sfx.error(); res = `<span class=bad>install blocked:</span> ${esc(pkg)} is Google Play, and Google Play is banned on ChangeOS.`; }
      else if (pkg) res = `open Aurora Store to install ${esc(pkg)}.`;
      else res = "install: which package?";
    } else if (name === "echo") res = esc(args.join(" "));
    else if (name === "sudo" || name === "su") res = "you're already root.";
    else if (cmds[name]) res = cmds[name]();
    else { sfx.error(); res = `changeos-sh: ${esc(name)}: command not found. try <span class=acc>help</span>`; }
    if (res) print(res);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    history.push(input.value); hi = history.length;
    run(input.value); input.value = "";
  });
  input.addEventListener("keydown", (e) => {
    if (e.key.length === 1 || e.key === "Backspace") sfx.key();
    if (e.key === "ArrowUp" && hi > 0) { input.value = history[--hi]; e.preventDefault(); }
    if (e.key === "ArrowDown") { hi = Math.min(history.length, hi + 1); input.value = history[hi] || ""; e.preventDefault(); }
  });
  document.getElementById("chips").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) { run(b.textContent); input.focus({ preventScroll: true }); }
  });
  document.getElementById("term").addEventListener("click", (e) => { if (!e.target.closest("button")) input.focus({ preventScroll: true }); });

  print("<span class=dim>ChangeOS 1.0 Sweet Vanilla (tty1)</span>");
  print(neofetch());
  print("<span class=dim>type</span> <span class=acc>help</span> <span class=dim>for commands.</span>");
}
