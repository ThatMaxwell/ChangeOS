// A tiny pretend ChangeOS shell. Some commands reach out and change the page.
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

export function mountTerminal({ setAccent, accents, replayIntro, getAccent }) {
  const out = document.getElementById("term-out");
  const form = document.getElementById("term-form");
  const input = document.getElementById("term-in");
  const history = [];
  let hi = 0;

  const print = (html) => { out.insertAdjacentHTML("beforeend", html + "\n"); out.scrollTop = out.scrollHeight; };

  const cmds = {
    help: () => [
      "commands you can try:",
      "  <span class=acc>neofetch</span>            system info",
      "  <span class=acc>pm list packages</span>    what's installed",
      "  <span class=acc>accent</span> &lt;color&gt;      " + Object.keys(accents).join(", ") + " or #hex",
      "  <span class=acc>install</span> &lt;package&gt;   try com.android.vending",
      "  <span class=acc>whoami</span>, <span class=acc>uname -a</span>, <span class=acc>date</span>, <span class=acc>clear</span>, <span class=acc>reboot</span>",
    ].join("\n"),
    neofetch: () => {
      const a = getAccent();
      const art = [
        "    ▄▄████▄▄   <span class=acc>●</span>",
        "  ▄█▀      ▀   ",
        " ██  ● ● ● ●   ",
        "  ▀█▄      ▄█▀ ",
        "    ▀▀████▀▀   ",
      ];
      const info = [
        "<span class=acc>you</span>@<span class=acc>changeos</span>",
        "OS: ChangeOS 0.1",
        "Base: Android 17 (API 37)",
        "Apps: 2 (Aurora Store, Firefox)",
        "Google Play: banned",
        `Accent: ${a}`,
      ];
      return art.map((l, i) => l + "  " + (info[i] || "")).concat(info.slice(art.length).map((l) => " ".repeat(17) + l)).join("\n");
    },
    "pm list packages": () => ["package:com.aurora.store", "package:org.mozilla.firefox", "package:com.android.systemui", "package:com.android.settings", "<span class=dim>(com.android.vending is not here, and can't be)</span>"].join("\n"),
    whoami: () => "you. uid=0(root). full control, handle with care.",
    "uname -a": () => "ChangeOS 0.1 changeos x86_64 Android 17",
    date: () => new Date().toString(),
    clear: () => { out.innerHTML = ""; return null; },
    reboot: () => { setTimeout(() => replayIntro(), 400); return "rebooting…"; },
    ls: () => "Aurora  Firefox  terminal  your-stuff",
    exit: () => "there's no leaving. it's your phone now.",
  };

  function run(raw) {
    const line = raw.trim();
    if (!line) return;
    print(`<span class=acc>you@changeos:~$</span> ${esc(line)}`);
    const [name, ...args] = line.split(/\s+/);
    let res;
    if (cmds[line]) res = cmds[line]();
    else if (name === "accent") {
      const v = (args[0] || "").toLowerCase();
      const hex = accents[v] || (/^#[0-9a-f]{6}$/.test(v) ? v : null);
      if (hex) { setAccent(hex); res = `accent set to <span class=acc>${hex}</span>. look up.`; }
      else res = `accent: pick one of ${Object.keys(accents).join(", ")} or a #rrggbb hex`;
    } else if (name === "install") {
      const pkg = args[0] || "";
      if (/vending|play/i.test(pkg)) res = `<span style="color:#ff3b30">blocked:</span> ${esc(pkg)} is Google Play, and Google Play is banned on ChangeOS.`;
      else if (pkg) res = `open Aurora Store to install ${esc(pkg)}.`;
      else res = "install: which package?";
    } else if (name === "echo") res = esc(args.join(" "));
    else if (name === "sudo") res = "you're already root.";
    else if (cmds[name]) res = cmds[name]();
    else res = `changeos: command not found: ${esc(name)}. type <span class=acc>help</span>.`;
    if (res) print(res);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    history.push(input.value); hi = history.length;
    run(input.value); input.value = "";
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" && hi > 0) { input.value = history[--hi]; e.preventDefault(); }
    if (e.key === "ArrowDown") { hi = Math.min(history.length, hi + 1); input.value = history[hi] || ""; e.preventDefault(); }
  });
  document.getElementById("chips").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) { run(b.textContent); input.focus({ preventScroll: true }); }
  });
  document.getElementById("term").addEventListener("click", (e) => { if (!e.target.closest("button")) input.focus({ preventScroll: true }); });

  print("<span class=dim>ChangeOS terminal. type</span> <span class=acc>help</span> <span class=dim>to see what it can do.</span>");
}
