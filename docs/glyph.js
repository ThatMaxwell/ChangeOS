// The ChangeOS mark: battery ring + signal dots + Wi-Fi bullseye. Geometry matches Logo.svg (viewBox 0 0 100 100).
export const G = {
  cx: 50, cy: 50, r: 36, stroke: 7,
  gapAt: -45, gapHalf: 37,
  dots: [36.5, 45.5, 54.5, 63.5], dotR: 3.6,
  bullR: 14, holeR: 6.5,
};
G.a0 = G.gapAt + G.gapHalf;
G.a1 = G.gapAt + 360 - G.gapHalf;
const rad = (a) => (a * Math.PI) / 180;
export const pt = (a, r = G.r) => [G.cx + r * Math.cos(rad(a)), G.cy + r * Math.sin(rad(a))];
export const BULL = pt(G.gapAt);

export function arcPath(a0, a1, r = G.r) {
  if (a1 - a0 < 0.05) return "";
  const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r);
  return `M${x0.toFixed(3)} ${y0.toFixed(3)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(3)} ${y1.toFixed(3)}`;
}

const LOW = "#ff3b30";

/** SVG markup for a live status glyph. state = {bat 0-100, sig 0-4, wf 'c'|'n'|'o'|'h'} */
export function glyphSVG(state, c) {
  const { bat, sig, wf } = state;
  const split = G.a1 - (G.a1 - G.a0) * (bat / 100);
  const low = bat <= 15;
  let s = `<path d="${arcPath(G.a0, split)}" fill="none" stroke="${c.mute}" stroke-width="${G.stroke}" stroke-linecap="round"/>`;
  s += `<path d="${arcPath(split, G.a1)}" fill="none" stroke="${low ? LOW : c.fg}" stroke-width="${G.stroke}" stroke-linecap="round"/>`;
  G.dots.forEach((x, i) => { s += `<circle cx="${x}" cy="${G.cy}" r="${G.dotR}" fill="${i < sig ? c.fg : c.mute}"/>`; });
  const [bx, by] = BULL;
  s += `<circle cx="${bx}" cy="${by}" r="${G.bullR}" fill="${c.fg}"/>`;
  if (wf === "c") s += `<circle cx="${bx}" cy="${by}" r="${G.holeR}" fill="${c.bg}"/>`;
  if (wf === "n") s += `<circle cx="${bx}" cy="${by}" r="${G.holeR}" fill="${c.mute}"/>`;
  if (wf === "o") s += `<circle cx="${bx}" cy="${by}" r="${G.holeR}" fill="none" stroke="${c.bg}" stroke-width="2.4"/>`;
  if (wf === "h") {
    const d = G.holeR * Math.SQRT1_2;
    s += `<circle cx="${bx}" cy="${by}" r="${G.holeR}" fill="none" stroke="${c.bg}" stroke-width="1.6"/>`;
    s += `<path d="M${bx - d} ${by - d}A${G.holeR} ${G.holeR} 0 0 1 ${bx + d} ${by + d}Z" fill="${c.bg}"/>`;
  }
  return s;
}

/** Same glyph on a 2D canvas, centered at (x, y), `size` px wide. */
export function drawGlyph(ctx, x, y, size, state, c) {
  const k = size / 100;
  ctx.save();
  ctx.translate(x - 50 * k, y - 50 * k);
  ctx.scale(k, k);
  const { bat, sig, wf } = state;
  const split = G.a1 - (G.a1 - G.a0) * (bat / 100);
  ctx.lineCap = "round";
  ctx.lineWidth = G.stroke;
  const arc = (a0, a1, col) => {
    if (a1 - a0 < 0.05) return;
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.arc(G.cx, G.cy, G.r, rad(a0), rad(a1));
    ctx.stroke();
  };
  arc(G.a0, split, c.mute);
  arc(split, G.a1, bat <= 15 ? LOW : c.fg);
  G.dots.forEach((dx, i) => {
    ctx.fillStyle = i < sig ? c.fg : c.mute;
    ctx.beginPath(); ctx.arc(dx, G.cy, G.dotR, 0, Math.PI * 2); ctx.fill();
  });
  const [bx, by] = BULL;
  ctx.fillStyle = c.fg;
  ctx.beginPath(); ctx.arc(bx, by, G.bullR, 0, Math.PI * 2); ctx.fill();
  if (wf === "c" || wf === "n") {
    ctx.fillStyle = wf === "c" ? c.bg : c.mute;
    ctx.beginPath(); ctx.arc(bx, by, G.holeR, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
