// Procedural ChangeOS phone in three.js with a live canvas screen.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { paint, paintBack, SW, SH } from "./screen.js";

const PW = 0.76, PH = (PW - 0.05) * (SH / SW) + 0.05, PD = 0.085; // even bezel on every side
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// A phone-shaped slab: rounded-rectangle outline extruded with a soft bevel on the edges.
function slab(w, h, depth, radius, bevel) {
  const x = -w / 2 + bevel, y = -h / 2 + bevel, iw = w - bevel * 2, ih = h - bevel * 2, r = radius - bevel;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + iw - r, y); s.quadraticCurveTo(x + iw, y, x + iw, y + r);
  s.lineTo(x + iw, y + ih - r); s.quadraticCurveTo(x + iw, y + ih, x + iw - r, y + ih);
  s.lineTo(x + r, y + ih); s.quadraticCurveTo(x, y + ih, x, y + ih - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.0001, depth - bevel * 2), bevelEnabled: true,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 8, curveSegments: 32,
  });
  g.translate(0, 0, -(depth - bevel * 2) / 2);
  g.computeVertexNormals();
  return g;
}

function screenTexture() {
  const c = document.createElement("canvas");
  c.width = SW; c.height = SH;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { canvas: c, ctx: c.getContext("2d"), tex };
}

function shadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  grd.addColorStop(0, "rgba(0,0,0,.55)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export class Phone {
  constructor(container, { mode = "home", accent = "#2f6bff", interactive = true, distance = 3.1 } = {}) {
    this.container = container;
    this.mode = mode; this.prevMode = mode; this.blend = 1;
    this.accent = accent;
    this.target = { rx: 0, ry: -0.35, x: 0, y: 0, s: 1 };
    this.cur = { ...this.target };
    this.spin = 0; this.spinVel = 0; this.dragging = false;
    this.pointer = { x: 0, y: 0 };
    this.visible = true;

    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    container.appendChild(r.domElement);
    r.domElement.setAttribute("aria-label", "3D model of a phone running ChangeOS. Drag to spin it.");
    r.domElement.setAttribute("role", "img");

    const scene = this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, 0, distance);

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(2, 3, 4); scene.add(key);

    this.group = new THREE.Group();
    scene.add(this.group);

    // body
    const body = new THREE.Mesh(
      slab(PW, PH, PD, 0.115, 0.03),
      new THREE.MeshPhysicalMaterial({ color: 0x2a2a2e, metalness: 0.85, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.15 })
    );
    this.group.add(body);

    // front glass: a thin black slab sitting on the body
    const bezel = new THREE.Mesh(
      slab(PW - 0.018, PH - 0.018, 0.006, 0.106, 0.0025),
      new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.05, metalness: 0, clearcoat: 1 })
    );
    bezel.position.z = PD / 2 - 0.001;
    this.group.add(bezel);

    // screen
    this.front = screenTexture();
    const sw = PW - 0.05, sh = sw * (SH / SW);
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh),
      new THREE.MeshBasicMaterial({ map: this.front.tex, transparent: true, toneMapped: false }));
    this.screen.position.z = PD / 2 + 0.0025;
    this.group.add(this.screen);

    // glass sheen over the screen
    const sheen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, roughness: 0, metalness: 0, clearcoat: 1 }));
    sheen.position.z = PD / 2 + 0.004;
    this.group.add(sheen);

    // back
    this.back = screenTexture();
    paintBack(this.back.ctx, accent);
    this.back.tex.needsUpdate = true;
    const backMesh = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh),
      new THREE.MeshPhysicalMaterial({ map: this.back.tex, transparent: true, roughness: 0.35, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1 }));
    backMesh.position.z = -PD / 2 - 0.0008;
    backMesh.rotation.y = Math.PI;
    this.group.add(backMesh);

    // camera bump
    const bump = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.18, 0.03, 4, 0.06),
      new THREE.MeshPhysicalMaterial({ color: 0x1a1a1d, metalness: 0.6, roughness: 0.3, clearcoat: 1 }));
    bump.position.set(-PW / 2 + 0.22, PH / 2 - 0.18, -PD / 2 - 0.015);
    this.group.add(bump);
    const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x050508, roughness: 0.05, metalness: 0.2, clearcoat: 1 });
    [-0.065, 0.065].forEach((dx) => {
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 40), lensMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(bump.position.x + dx, bump.position.y, bump.position.z - 0.02);
      this.group.add(lens);
    });

    // side buttons
    const btnMat = new THREE.MeshPhysicalMaterial({ color: 0x2a2a2e, metalness: 0.9, roughness: 0.25 });
    [[0.32, 0.16], [0.1, 0.1]].forEach(([y, h]) => {
      const b = new THREE.Mesh(new RoundedBoxGeometry(0.014, h, 0.03, 2, 0.006), btnMat);
      b.position.set(PW / 2 + 0.004, y, 0);
      this.group.add(b);
    });
    this.accentBtn = new THREE.Mesh(new RoundedBoxGeometry(0.014, 0.08, 0.03, 2, 0.006),
      new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4 }));
    this.accentBtn.position.set(PW / 2 + 0.004, -0.06, 0);
    this.group.add(this.accentBtn);

    // contact shadow
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.5 }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = -PH / 2 - 0.12;
    scene.add(this.shadow);

    this.repaint();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }).observe(container);
    if (interactive) this.bindDrag();
    addEventListener("pointermove", (e) => {
      this.pointer.x = (e.clientX / innerWidth) * 2 - 1;
      this.pointer.y = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });

    this.last = performance.now();
    this.lastPaint = 0;
    r.setAnimationLoop((t) => this.tick(t));
  }

  bindDrag() {
    const el = this.renderer.domElement;
    el.style.cursor = "grab";
    el.style.touchAction = "pan-y";
    let lastX = 0;
    el.addEventListener("pointerdown", (e) => {
      this.dragging = true; lastX = e.clientX; el.setPointerCapture(e.pointerId); el.style.cursor = "grabbing";
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - lastX; lastX = e.clientX;
      this.spinVel = dx * 0.012; this.spin += this.spinVel;
    });
    const end = () => { this.dragging = false; el.style.cursor = "grab"; };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // pull the camera back until the whole phone (plus room to tilt) fits the stage
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const fitH = (PH * 1.32) / (2 * tan);
    const fitW = (PW * 2.1) / (2 * tan * this.camera.aspect);
    this.camera.position.z = Math.max(fitH, fitW);
    this.camera.updateProjectionMatrix();
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.prevMode = this.mode; this.mode = mode; this.blend = 0;
    if (!reduce) this.spinVel += 0.11; // a small flourish on every screen change
  }

  setAccent(hex) {
    this.accent = hex;
    this.accentBtn.material.color.set(hex);
    paintBack(this.back.ctx, hex); this.back.tex.needsUpdate = true;
    this.repaint();
  }

  repaint(t = performance.now()) {
    const ctx = this.front.ctx;
    if (this.blend >= 1) paint(ctx, this.mode, this.accent, t);
    else {
      paint(ctx, this.prevMode, this.accent, t);
      if (!this._tmp) { this._tmp = document.createElement("canvas"); this._tmp.width = SW; this._tmp.height = SH; }
      const tc = this._tmp.getContext("2d");
      paint(tc, this.mode, this.accent, t);
      ctx.save(); ctx.globalAlpha = this.blend; ctx.drawImage(this._tmp, 0, 0); ctx.restore();
    }
    this.front.tex.needsUpdate = true;
  }

  tick(t) {
    if (!this.visible) return;
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    if (this.blend < 1) { this.blend = Math.min(1, this.blend + dt * 2.6); this.repaint(t); }
    else if (t - this.lastPaint > 1000 || this.mode === "qs" && t - this.lastPaint > 60) { this.lastPaint = t; this.repaint(t); }

    // spin with inertia, settling back to a front-facing multiple of 2π
    if (!this.dragging) {
      this.spinVel *= Math.pow(0.04, dt);
      this.spin += this.spinVel;
      const home = Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2;
      if (Math.abs(this.spinVel) < 0.01) this.spin += (home - this.spin) * Math.min(1, dt * 3);
    }
    const k = 1 - Math.pow(0.002, dt);
    for (const key of Object.keys(this.target)) this.cur[key] += (this.target[key] - this.cur[key]) * k;
    const idle = reduce ? 0 : Math.sin(t / 1600);
    const g = this.group;
    g.rotation.y = this.cur.ry + this.spin + (reduce ? 0 : this.pointer.x * 0.18);
    g.rotation.x = this.cur.rx + (reduce ? 0 : this.pointer.y * 0.08) + idle * 0.03;
    g.rotation.z = idle * 0.015;
    g.position.set(this.cur.x, this.cur.y + idle * 0.025, 0);
    g.scale.setScalar(this.cur.s);
    this.shadow.position.x = this.cur.x;
    this.shadow.material.opacity = 0.45 - idle * 0.05;
    this.renderer.render(this.scene, this.camera);
  }
}
