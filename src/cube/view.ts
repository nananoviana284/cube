import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CubeState, HOME_COLOR, homeStickers, type Color, type Turn, type Vec } from './model';
import { parseAlg, parseMove } from './alg';

const PALETTE: Record<Color, number> = {
  W: 0xffffff,
  Y: 0xffd500,
  G: 0x00b84a,
  B: 0x0a5bd8,
  O: 0xff7a00,
  R: 0xe0182d,
};
const DIM = 0x8d939e;
const ARROW = 0xff3dbb;

export type ViewPreset = 'front' | 'top' | 'low';

const CAMERA_POS: Record<ViewPreset, [number, number, number]> = {
  front: [5.0, 4.9, 7.9],
  top: [3.0, 9.0, 5.0],
  low: [5.2, 2.4, 8.8],
};

interface CubieMesh {
  id: string;
  group: THREE.Group;
  stickers: { mesh: THREE.Mesh; color: Color }[];
}

function roundedRect(size: number, r: number): THREE.Shape {
  const s = size / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s);
  shape.quadraticCurveTo(s, -s, s, -s + r);
  shape.lineTo(s, s - r);
  shape.quadraticCurveTo(s, s, s - r, s);
  shape.lineTo(-s + r, s);
  shape.quadraticCurveTo(-s, s, -s, s - r);
  shape.lineTo(-s, -s + r);
  shape.quadraticCurveTo(-s, -s, -s + r, -s);
  return shape;
}

const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

export interface ViewOptions {
  preset?: ViewPreset;
  /** 允许用手指拖动看魔方背面 */
  orbit?: boolean;
}

export class CubeView {
  readonly state: CubeState;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls | null = null;
  private root = new THREE.Group();
  private pivot = new THREE.Group();
  private meshes: CubieMesh[] = [];
  private queue: { turn: Turn; ms: number; text: string; silent: boolean; resolve?: () => void }[] = [];
  /** 每一步开始转时通知（舞台用它在旁边大字显示指令） */
  onMove: ((token: string | null) => void) | null = null;
  private anim: { turn: Turn; ms: number; start: number; moving: CubieMesh[]; resolve?: () => void } | null = null;
  private arrow: THREE.Object3D | null = null;
  private arrowToken: string | null = null;
  private highlighted: Set<string> | null = null;
  private glowing: Set<string> = new Set();
  private raf = 0;
  private resizeObs: ResizeObserver;
  private pickHandler: ((id: string) => void) | null = null;
  private down: { x: number; y: number } | null = null;
  private preset: ViewPreset;
  speedMs = 380;

  constructor(
    private container: HTMLElement,
    opts: ViewOptions = {},
  ) {
    this.state = new CubeState();
    this.preset = opts.preset ?? 'front';
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.classList.add('cube-canvas');

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.setPreset(this.preset);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(4, 8, 6);
    this.scene.add(dir);
    this.scene.add(this.root);
    this.root.add(this.pivot);

    this.build();

    if (opts.orbit !== false) {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enablePan = false;
      this.controls.enableZoom = false;
      this.controls.enableDamping = true;
      this.controls.rotateSpeed = 0.8;
    }

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => (this.down = { x: e.clientX, y: e.clientY }));
    el.addEventListener('pointerup', (e) => {
      if (!this.down || !this.pickHandler) return;
      const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
      this.down = null;
      if (moved > 8) return;
      const id = this.pickAt(e.clientX, e.clientY);
      if (id) this.pickHandler(id);
    });

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    this.loop();
  }

  private build(): void {
    const body = new RoundedBoxGeometry(0.96, 0.96, 0.96, 3, 0.1);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.6 });
    const stickerGeo = new THREE.ShapeGeometry(roundedRect(0.8, 0.13));
    for (const c of this.state.cubies) {
      const group = new THREE.Group();
      const bodyMesh = new THREE.Mesh(body, bodyMat);
      bodyMesh.userData.id = c.id;
      group.add(bodyMesh);
      const stickers: CubieMesh['stickers'] = [];
      for (const s of homeStickers(c.home)) {
        const color = HOME_COLOR[s.face];
        const mat = new THREE.MeshStandardMaterial({ color: PALETTE[color], roughness: 0.35, emissive: 0x000000 });
        const m = new THREE.Mesh(stickerGeo, mat);
        const n = new THREE.Vector3(...s.local);
        m.position.copy(n.clone().multiplyScalar(0.485));
        m.lookAt(n.clone().multiplyScalar(2));
        m.userData.id = c.id;
        group.add(m);
        stickers.push({ mesh: m, color });
      }
      this.root.add(group);
      this.meshes.push({ id: c.id, group, stickers });
    }
    this.syncAll();
  }

  private syncAll(): void {
    const m4 = new THREE.Matrix4();
    for (const cm of this.meshes) {
      const c = this.state.byId(cm.id);
      const r = c.rot;
      m4.set(r[0], r[1], r[2], 0, r[3], r[4], r[5], 0, r[6], r[7], r[8], 0, 0, 0, 0, 1);
      cm.group.quaternion.setFromRotationMatrix(m4);
      cm.group.position.set(c.pos[0], c.pos[1], c.pos[2]);
    }
  }

  setPreset(p: ViewPreset): void {
    this.preset = p;
    this.camera.position.set(...CAMERA_POS[p]);
    this.camera.lookAt(0, 0, 0);
    this.controls?.target.set(0, 0, 0);
    this.controls?.update();
    if (this.arrowToken) this.showArrow(this.arrowToken);
  }

  resetView(): void {
    this.setPreset(this.preset);
  }

  /** 立即把魔方设成"从复原开始做 alg"之后的样子 */
  setAlg(alg: string): void {
    this.onMove?.(null);
    const pending = this.queue;
    this.queue = [];
    this.finishAnim();
    for (const q of pending) q.resolve?.();
    const fresh = new CubeState();
    for (const m of parseAlg(alg)) fresh.applyTurn(m.turn);
    this.state.cubies = fresh.cubies;
    this.syncAll();
  }

  /** 播放一段公式，返回动画全部完成的 Promise */
  play(alg: string, ms = this.speedMs, silent = false): Promise<void> {
    const moves = parseAlg(alg);
    if (!moves.length) return Promise.resolve();
    return new Promise((resolve) => {
      moves.forEach((m, i) => this.queue.push({ turn: m.turn, ms, text: m.text, silent, resolve: i === moves.length - 1 ? resolve : undefined }));
    });
  }

  get busy(): boolean {
    return !!this.anim || this.queue.length > 0;
  }

  /** 只亮这些方块，其它变灰。传 null 恢复全部彩色 */
  highlight(ids: string[] | null): void {
    this.highlighted = ids ? new Set(ids) : null;
    this.paint();
  }

  /** 让方块发光（用于"记住它"） */
  glow(ids: string[]): void {
    this.glowing = new Set(ids);
    this.paint();
  }

  private paint(): void {
    for (const cm of this.meshes) {
      const lit = !this.highlighted || this.highlighted.has(cm.id);
      const glow = this.glowing.has(cm.id);
      for (const s of cm.stickers) {
        const mat = s.mesh.material as THREE.MeshStandardMaterial;
        mat.color.setHex(lit ? PALETTE[s.color] : DIM);
        mat.emissive.setHex(glow ? 0x555555 : 0x000000);
      }
    }
  }

  onPick(handler: ((id: string) => void) | null): void {
    this.pickHandler = handler;
    this.renderer.domElement.style.cursor = handler ? 'pointer' : '';
  }

  private pickAt(cx: number, cy: number): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = ray.intersectObjects(this.root.children, true).find((h) => h.object.userData.id);
    return hit ? (hit.object.userData.id as string) : null;
  }

  /** 在魔方上画出下一步的转动箭头 */
  showArrow(token: string | null): void {
    if (this.arrow) {
      this.scene.remove(this.arrow);
      this.arrow.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      this.arrow = null;
    }
    this.arrowToken = token;
    if (!token) return;
    const { turn } = parseMove(token);
    const a = turn.axis;
    const axis = AXES[a];
    const u = AXES[(a + 1) % 3];
    const v = AXES[(a + 2) % 3];
    const offset = turn.layers.reduce((s, x) => s + x, 0) / turn.layers.length;
    const whole = turn.layers.length === 3;
    const r = whole ? 2.05 : 1.78;
    const cam = this.camera.position.clone();
    const theta0 = Math.atan2(cam.dot(v), cam.dot(u));
    const span = Math.abs(turn.quarter) === 2 ? Math.PI * 1.15 : Math.PI * 0.62;
    const ccw = turn.quarter > 0;
    const pts: THREE.Vector3[] = [];
    const N = 40;
    for (let i = 0; i <= N; i++) {
      const t = theta0 - span / 2 + (span * i) / N;
      pts.push(
        axis
          .clone()
          .multiplyScalar(offset)
          .add(u.clone().multiplyScalar(Math.cos(t) * r))
          .add(v.clone().multiplyScalar(Math.sin(t) * r)),
      );
    }
    if (!ccw) pts.reverse();
    const mat = new THREE.MeshBasicMaterial({ color: ARROW, depthTest: false, transparent: true, opacity: 0.95 });
    const group = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.07, 10), mat);
    tube.renderOrder = 10;
    group.add(tube);
    const end = pts[pts.length - 1];
    const dirv = end.clone().sub(pts[pts.length - 3]).normalize();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 16), mat);
    cone.position.copy(end);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirv);
    cone.renderOrder = 10;
    group.add(cone);
    this.arrow = group;
    this.scene.add(group);
  }

  private startNext(now: number): void {
    const next = this.queue.shift();
    if (!next) return;
    if (!next.silent) this.onMove?.(next.text);
    const moving = this.meshes.filter((cm) => next.turn.layers.includes(this.state.byId(cm.id).pos[next.turn.axis]));
    for (const cm of moving) this.pivot.attach(cm.group);
    this.anim = { turn: next.turn, ms: next.ms, start: now, moving, resolve: next.resolve };
  }

  private finishAnim(): void {
    if (!this.anim) return;
    const { turn, moving, resolve } = this.anim;
    this.state.applyTurn(turn);
    for (const cm of moving) this.root.attach(cm.group);
    this.pivot.rotation.set(0, 0, 0);
    this.syncAll();
    this.anim = null;
    resolve?.();
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    if (!this.anim && this.queue.length) this.startNext(now);
    if (this.anim) {
      const { turn, ms, start } = this.anim;
      const t = Math.min(1, (now - start) / ms);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const angle = (turn.quarter * Math.PI) / 2;
      this.pivot.rotation.set(0, 0, 0);
      this.pivot.rotateOnAxis(AXES[turn.axis], angle * e);
      if (t >= 1) this.finishAnim();
    }
    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
  };

  private resize(): void {
    const w = this.container.clientWidth || 300;
    const h = this.container.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.controls?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export type { Vec };
