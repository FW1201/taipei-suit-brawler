// 程式化 low-poly 西裝角色 v2：雙關節四肢（肩+肘、髖+膝）+ 彈性姿勢混合。
// 不依賴外部模型/骨架；視覺細節：西裝翻領、襯衫、領帶、皮帶、袖口、皮鞋。

import * as THREE from 'three';

export type VisualState =
  | 'idle' | 'walk' | 'run'
  | 'punch1' | 'punch2' | 'punch3' | 'heavy'
  | 'dodge' | 'hit' | 'down' | 'block' | 'throw' | 'rage';

export interface CharacterVisualOptions {
  suitColor: number;     // 西裝主色
  shirtColor?: number;   // 襯衫
  tieColor?: number;     // 領帶（hero 用）
  skinColor?: number;
  sunglasses?: boolean;
  scale?: number;
  isHero?: boolean;
  /** 跑/走步伐落地時回呼（接腳步聲） */
  onFootstep?: () => void;
}

/** 角色視覺共同介面：程式化（CharacterVisual）與 GLB（GlbCharacterVisual）皆實作 */
export interface ICharacterVisual {
  readonly root: THREE.Group;
  setState(s: VisualState): void;
  getState(): VisualState;
  update(dt: number): void;
  flashTint(color: number, durationMs?: number): void;
  setRageGlow(on: boolean): void;
  dispose(): void;
}

/** 單側肢體姿勢：[近端關節X, 近端關節Z, 遠端關節X] */
type LimbPose = [number, number, number];

interface Pose {
  armR: LimbPose;   // 肩X, 肩Z, 肘X（肘只彎曲）
  armL: LimbPose;
  legR: LimbPose;   // 髖X, 髖Z, 膝X
  legL: LimbPose;
  torsoRx: number;
  torsoRy: number;
  headRx: number;
  rootY: number;
  rootRx: number;
}

const REST: Pose = {
  armR: [-0.12, 0.18, -0.35], armL: [-0.12, -0.18, -0.35],
  legR: [0, 0, 0.05], legL: [0, 0, 0.05],
  torsoRx: 0, torsoRy: 0, headRx: 0, rootY: 0, rootRx: 0,
};

function lerpPose(out: Pose, a: Pose, b: Pose, t: number): Pose {
  const L = THREE.MathUtils.lerp;
  for (const k of ['armR', 'armL', 'legR', 'legL'] as const) {
    out[k] = [L(a[k][0], b[k][0], t), L(a[k][1], b[k][1], t), L(a[k][2], b[k][2], t)];
  }
  out.torsoRx = L(a.torsoRx, b.torsoRx, t);
  out.torsoRy = L(a.torsoRy, b.torsoRy, t);
  out.headRx = L(a.headRx, b.headRx, t);
  out.rootY = L(a.rootY, b.rootY, t);
  out.rootRx = L(a.rootRx, b.rootRx, t);
  return out;
}

export class CharacterVisual implements ICharacterVisual {
  readonly root = new THREE.Group();

  // 關節階層
  private shoulderR!: THREE.Group; private elbowR!: THREE.Group;
  private shoulderL!: THREE.Group; private elbowL!: THREE.Group;
  private hipR!: THREE.Group; private kneeR!: THREE.Group;
  private hipL!: THREE.Group; private kneeL!: THREE.Group;
  private torso!: THREE.Group;
  private head!: THREE.Group;

  private state: VisualState = 'idle';
  private stateTime = 0;
  private suitMat: THREE.MeshStandardMaterial;
  private blendFrom: Pose = { ...REST, armR: [...REST.armR], armL: [...REST.armL], legR: [...REST.legR], legL: [...REST.legL] };
  private blendTime = 1;       // 0→1 狀態切換混合
  private currentPose: Pose = { ...REST, armR: [...REST.armR], armL: [...REST.armL], legR: [...REST.legR], legL: [...REST.legL] };
  private lastStepPhase = 0;
  private opts: CharacterVisualOptions;

  constructor(opts: CharacterVisualOptions) {
    this.opts = opts;
    const scale = opts.scale ?? 1;
    const suit = (this.suitMat = new THREE.MeshStandardMaterial({ color: opts.suitColor, roughness: 0.72 }));
    const suitDark = new THREE.MeshStandardMaterial({
      color: new THREE.Color(opts.suitColor).multiplyScalar(0.75),
      roughness: 0.72,
    });
    const shirt = new THREE.MeshStandardMaterial({ color: opts.shirtColor ?? 0xe8e8e8, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: opts.skinColor ?? 0xd9a878, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.5 });

    const B = (w: number, h: number, d: number, m: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.castShadow = true;
      return mesh;
    };

    // ── 軀幹：外套 + 翻領 + 襯衫 + 領帶 + 皮帶
    this.torso = new THREE.Group();
    const jacket = B(0.6, 0.72, 0.34, suit);
    jacket.position.y = 0.06;
    this.torso.add(jacket);
    const hips = B(0.5, 0.22, 0.3, suitDark);
    hips.position.y = -0.4;
    this.torso.add(hips);
    const belt = B(0.52, 0.06, 0.32, dark);
    belt.position.y = -0.28;
    this.torso.add(belt);
    const chest = B(0.24, 0.46, 0.05, shirt);
    chest.position.set(0, 0.12, 0.18);
    this.torso.add(chest);
    // 翻領（左右斜板）
    for (const side of [1, -1] as const) {
      const lapel = B(0.13, 0.34, 0.04, suitDark);
      lapel.position.set(side * 0.14, 0.2, 0.2);
      lapel.rotation.z = side * 0.32;
      this.torso.add(lapel);
    }
    if (opts.tieColor !== undefined) {
      const tieM = new THREE.MeshStandardMaterial({ color: opts.tieColor });
      const knot = B(0.08, 0.06, 0.04, tieM);
      knot.position.set(0, 0.33, 0.21);
      this.torso.add(knot);
      const tie = B(0.09, 0.34, 0.035, tieM);
      tie.position.set(0, 0.1, 0.2);
      tie.rotation.x = 0.04;
      this.torso.add(tie);
    }
    // 口袋巾（hero 細節）
    if (opts.isHero) {
      const pocket = B(0.08, 0.05, 0.03, new THREE.MeshStandardMaterial({ color: 0x00d4ff, emissive: 0x00d4ff, emissiveIntensity: 0.4 }));
      pocket.position.set(0.18, 0.22, 0.19);
      this.torso.add(pocket);
    }
    this.torso.position.y = 1.18;
    this.root.add(this.torso);

    // ── 頭：臉 + 下顎 + 鼻 + 髮 + 墨鏡 + 耳
    this.head = new THREE.Group();
    const skull = B(0.32, 0.3, 0.3, skin);
    skull.position.y = 0.05;
    this.head.add(skull);
    const jaw = B(0.28, 0.1, 0.26, skin);
    jaw.position.set(0, -0.12, 0.01);
    this.head.add(jaw);
    const nose = B(0.05, 0.08, 0.06, skin);
    nose.position.set(0, -0.02, 0.17);
    this.head.add(nose);
    const hair = B(0.34, 0.1, 0.32, dark);
    hair.position.y = 0.22;
    this.head.add(hair);
    const hairBack = B(0.34, 0.16, 0.08, dark);
    hairBack.position.set(0, 0.1, -0.14);
    this.head.add(hairBack);
    for (const side of [1, -1] as const) {
      const ear = B(0.04, 0.09, 0.07, skin);
      ear.position.set(side * 0.18, 0, 0);
      this.head.add(ear);
    }
    if (opts.sunglasses) {
      const glasses = B(0.3, 0.07, 0.04, dark);
      glasses.position.set(0, 0.04, 0.16);
      this.head.add(glasses);
    }
    const neck = B(0.12, 0.12, 0.12, skin);
    neck.position.y = -0.2;
    this.head.add(neck);
    this.head.position.y = 1.82;
    this.root.add(this.head);

    // ── 手臂：肩(上臂) → 肘(前臂+拳)
    const makeArm = (side: 1 | -1) => {
      const shoulder = new THREE.Group();
      const upper = B(0.15, 0.32, 0.15, suit);
      upper.position.y = -0.16;
      shoulder.add(upper);
      const pad = B(0.18, 0.1, 0.18, suitDark); // 墊肩
      pad.position.y = 0.02;
      shoulder.add(pad);

      const elbow = new THREE.Group();
      elbow.position.y = -0.32;
      const fore = B(0.13, 0.3, 0.13, suit);
      fore.position.y = -0.15;
      elbow.add(fore);
      const cuff = B(0.145, 0.05, 0.145, shirt); // 襯衫袖口
      cuff.position.y = -0.28;
      elbow.add(cuff);
      const fist = B(0.14, 0.13, 0.14, skin);
      fist.position.y = -0.37;
      elbow.add(fist);
      shoulder.add(elbow);

      shoulder.position.set(0.39 * side, 1.5, 0);
      this.root.add(shoulder);
      return { shoulder, elbow };
    };
    ({ shoulder: this.shoulderR, elbow: this.elbowR } = makeArm(1));
    ({ shoulder: this.shoulderL, elbow: this.elbowL } = makeArm(-1));

    // ── 腿：髖(大腿) → 膝(小腿+皮鞋)
    const makeLeg = (side: 1 | -1) => {
      const hip = new THREE.Group();
      const thigh = B(0.19, 0.34, 0.19, suitDark);
      thigh.position.y = -0.17;
      hip.add(thigh);

      const knee = new THREE.Group();
      knee.position.y = -0.34;
      const shin = B(0.16, 0.32, 0.16, suitDark);
      shin.position.y = -0.16;
      knee.add(shin);
      const shoe = B(0.17, 0.09, 0.3, dark);
      shoe.position.set(0, -0.36, 0.06);
      knee.add(shoe);
      const shoeShine = B(0.17, 0.02, 0.1, new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.2, metalness: 0.6 }));
      shoeShine.position.set(0, -0.32, 0.16);
      knee.add(shoeShine);
      hip.add(knee);

      hip.position.set(0.15 * side, 0.78, 0);
      this.root.add(hip);
      return { hip, knee };
    };
    ({ hip: this.hipR, knee: this.kneeR } = makeLeg(1));
    ({ hip: this.hipL, knee: this.kneeL } = makeLeg(-1));

    this.root.scale.setScalar(scale);
  }

  flashTint(color: number, durationMs = 120): void {
    this.suitMat.emissive.setHex(color);
    this.suitMat.emissiveIntensity = 0.7;
    setTimeout(() => {
      if (!this.suitMat.userData.rageGlow) {
        this.suitMat.emissive.setHex(0x000000);
        this.suitMat.emissiveIntensity = 0;
      }
    }, durationMs);
  }

  setRageGlow(on: boolean): void {
    this.suitMat.userData.rageGlow = on;
    this.suitMat.emissive.setHex(on ? 0xff2200 : 0x000000);
    this.suitMat.emissiveIntensity = on ? 0.4 : 0;
  }

  setState(s: VisualState): void {
    if (this.state === s) return;
    this.state = s;
    this.stateTime = 0;
    // 記住當前姿勢作為混合起點（攻擊類要快切，移動類柔切）
    this.blendFrom = JSON.parse(JSON.stringify(this.currentPose));
    this.blendTime = 0;
  }

  getState(): VisualState {
    return this.state;
  }

  /** 攻擊曲線：預備(anticipation) → 爆發 → 停留 → 收手 */
  private attackCurve(t: number, duration: number): number {
    const p = Math.min(t / duration, 1);
    if (p < 0.18) return -0.25 * (p / 0.18);           // 預備後拉
    if (p < 0.45) return -0.25 + 1.25 * ((p - 0.18) / 0.27); // 爆發
    if (p < 0.72) return 1;                             // 命中停留
    return 1 - (p - 0.72) / 0.28;                       // 收手
  }

  update(dt: number): void {
    this.stateTime += dt;
    const t = this.stateTime;
    const target: Pose = JSON.parse(JSON.stringify(REST));

    switch (this.state) {
      case 'idle': {
        const breathe = Math.sin(t * 2.2) * 0.025;
        // 拳擊備戰式：雙手微抬
        target.armR = [-0.45 + breathe, 0.1, -1.1];
        target.armL = [-0.45 + breathe, -0.1, -1.1];
        target.legR = [0.04, 0.04, 0.08];
        target.legL = [-0.04, -0.04, 0.08];
        target.torsoRy = 0.12;
        target.rootY = Math.sin(t * 2.2) * 0.012;
        break;
      }
      case 'walk':
      case 'run': {
        const run = this.state === 'run';
        const speed = run ? 11.5 : 7;
        const amp = run ? 0.85 : 0.45;
        const ph = Math.sin(t * speed);
        const phAbs = Math.cos(t * speed);
        target.armR = [ph * amp, 0.06, -0.9 - Math.max(0, -ph) * 0.5];
        target.armL = [-ph * amp, -0.06, -0.9 - Math.max(0, ph) * 0.5];
        // 腿：髖擺 + 膝在後擺時彎曲（自然步態）
        target.legR = [-ph * amp, 0, Math.max(0.06, ph * amp * 0.9)];
        target.legL = [ph * amp, 0, Math.max(0.06, -ph * amp * 0.9)];
        target.rootY = Math.abs(phAbs) * (run ? 0.06 : 0.03);
        target.torsoRx = run ? 0.18 : 0.06;
        target.headRx = run ? -0.1 : 0;
        // 腳步聲：相位過零觸發
        const phase = Math.sign(ph);
        if (phase !== this.lastStepPhase && this.opts.onFootstep) this.opts.onFootstep();
        this.lastStepPhase = phase;
        break;
      }
      case 'punch1': { // 右刺拳
        const p = this.attackCurve(t, 0.28);
        target.armR = [-1.5 * Math.max(0, p) + 0.3 * Math.min(0, p) * 4, 0.05, -0.25 - (1 - Math.abs(p)) * 1.2];
        target.armL = [-0.5, -0.15, -1.3]; // 護臉
        target.torsoRy = -0.45 * p;
        target.legR = [0.1, 0.05, 0.15];
        target.legL = [-0.15, -0.05, 0.1];
        break;
      }
      case 'punch2': { // 左直拳
        const p = this.attackCurve(t, 0.28);
        target.armL = [-1.5 * Math.max(0, p) + 0.3 * Math.min(0, p) * 4, -0.05, -0.25 - (1 - Math.abs(p)) * 1.2];
        target.armR = [-0.5, 0.15, -1.3];
        target.torsoRy = 0.45 * p;
        target.legL = [0.1, -0.05, 0.15];
        target.legR = [-0.15, 0.05, 0.1];
        break;
      }
      case 'punch3': { // 右上鉤拳
        const p = this.attackCurve(t, 0.34);
        target.armR = [-1.9 * Math.max(0, p), -0.25 * p, -1.6 + Math.max(0, p) * 1.3];
        target.armL = [-0.6, -0.15, -1.2];
        target.torsoRy = -0.6 * p;
        target.torsoRx = -0.12 * p;
        target.rootY = Math.max(0, p) * 0.1;
        target.legR = [0.18, 0.05, 0.3];
        target.legL = [-0.2, -0.05, 0.15];
        break;
      }
      case 'heavy': { // 蓄力雙拳下砸
        const wind = Math.min(t / 0.25, 1);
        const slam = t > 0.25 ? Math.min((t - 0.25) / 0.14, 1) : 0;
        const lift = wind * (1 - slam);
        const armX = -2.6 * lift - 0.9 * slam;
        target.armR = [armX, 0.25, -0.4 * lift - 0.2];
        target.armL = [armX, -0.25, -0.4 * lift - 0.2];
        target.torsoRx = -0.25 * lift + 0.42 * slam;
        target.headRx = -0.2 * lift + 0.15 * slam;
        target.rootY = 0.1 * lift - 0.08 * slam;
        target.legR = [0.12, 0.05, 0.35 * slam + 0.1];
        target.legL = [-0.12, -0.05, 0.35 * slam + 0.1];
        break;
      }
      case 'dodge': { // 翻滾
        const p = Math.min(t / 0.4, 1);
        target.rootRx = Math.PI * 2 * p;
        target.rootY = Math.sin(p * Math.PI) * 0.35;
        target.armR = [-1.3, 0.3, -1.8];
        target.armL = [-1.3, -0.3, -1.8];
        target.legR = [1.4, 0, 1.6];
        target.legL = [1.4, 0, 1.6];
        target.torsoRx = 0.5;
        break;
      }
      case 'hit': {
        const p = 1 - Math.min(t / 0.3, 1);
        target.torsoRx = -0.4 * p;
        target.headRx = -0.35 * p;
        target.torsoRy = 0.2 * p;
        target.armR = [0.5 * p - 0.3, 0.3, -0.8];
        target.armL = [0.5 * p - 0.3, -0.3, -0.8];
        target.rootY = 0.02 * p;
        break;
      }
      case 'down': {
        const p = Math.min(t / 0.45, 1);
        const ease = 1 - (1 - p) * (1 - p); // 加速倒地
        target.rootRx = -Math.PI / 2 * ease;
        target.rootY = -0.5 * ease;
        target.armR = [-0.9 * ease, 0.5 * ease, -0.3];
        target.armL = [-0.9 * ease, -0.5 * ease, -0.3];
        target.legR = [0.15, 0.1, 0.25];
        target.legL = [-0.1, -0.1, 0.2];
        target.headRx = 0.3 * ease;
        break;
      }
      case 'block': {
        target.armR = [-1.95, -0.15, -1.9];
        target.armL = [-1.95, 0.15, -1.9];
        target.torsoRx = 0.12;
        target.headRx = 0.15;
        target.legR = [0.15, 0.08, 0.2];
        target.legL = [-0.15, -0.08, 0.2];
        break;
      }
      case 'throw': {
        const p = this.attackCurve(t, 0.5);
        target.armR = [-2.8 + Math.max(0, p) * 2.2, 0.2, -0.3];
        target.armL = [-0.6, -0.2, -1.0];
        target.torsoRy = -0.55 * p;
        target.torsoRx = 0.2 * Math.max(0, p);
        break;
      }
      case 'rage': { // 怒吼蓄力
        const p = Math.min(t / 0.3, 1);
        target.armR = [-1.5 * p, 1.1 * p, -0.6];
        target.armL = [-1.5 * p, -1.1 * p, -0.6];
        target.torsoRx = -0.25 * p;
        target.headRx = -0.4 * p;
        target.rootY = 0.06 * Math.sin(t * 22) * p;
        target.legR = [0.2, 0.15, 0.3];
        target.legL = [-0.2, -0.15, 0.3];
        break;
      }
    }

    // 狀態切換平滑混合（攻擊快、移動柔）
    const blendSpeed = this.state.startsWith('punch') || this.state === 'heavy' ? 14 : 9;
    this.blendTime = Math.min(1, this.blendTime + dt * blendSpeed);
    const pose = this.blendTime >= 1 ? target : lerpPose(this.currentPose, this.blendFrom, target, this.blendTime);
    this.currentPose = JSON.parse(JSON.stringify(pose));

    // 套用姿勢
    this.shoulderR.rotation.set(pose.armR[0], 0, pose.armR[1]);
    this.elbowR.rotation.x = pose.armR[2];
    this.shoulderL.rotation.set(pose.armL[0], 0, pose.armL[1]);
    this.elbowL.rotation.x = pose.armL[2];
    this.hipR.rotation.set(pose.legR[0], 0, pose.legR[1]);
    this.kneeR.rotation.x = pose.legR[2];
    this.hipL.rotation.set(pose.legL[0], 0, pose.legL[1]);
    this.kneeL.rotation.x = pose.legL[2];
    this.torso.rotation.set(pose.torsoRx, pose.torsoRy, 0);
    this.head.rotation.set(pose.headRx, pose.torsoRy * 0.55, 0);
    this.root.position.y = pose.rootY;
    this.root.rotation.x = pose.rootRx;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}
