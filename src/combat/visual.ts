// 程式化 low-poly 西裝角色：盒狀肢體 + 姿勢狀態機動畫。
// 不依賴外部模型/骨架，保證可玩；之後若 GLB 角色可用可替換實作（同介面）。

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
}

export class CharacterVisual {
  readonly root = new THREE.Group();
  private armL!: THREE.Group;
  private armR!: THREE.Group;
  private legL!: THREE.Group;
  private legR!: THREE.Group;
  private torso!: THREE.Group;
  private head!: THREE.Group;
  /** 右拳世界座標查詢用 */
  private fistR!: THREE.Mesh;

  private state: VisualState = 'idle';
  private stateTime = 0;
  private suitMat: THREE.MeshStandardMaterial;

  constructor(opts: CharacterVisualOptions) {
    const scale = opts.scale ?? 1;
    const suit = (this.suitMat = new THREE.MeshStandardMaterial({ color: opts.suitColor, roughness: 0.7 }));
    const shirt = new THREE.MeshStandardMaterial({ color: opts.shirtColor ?? 0xe8e8e8, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: opts.skinColor ?? 0xd9a878, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.5 });

    // 軀幹（西裝外套 + 襯衫胸口）
    this.torso = new THREE.Group();
    const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), suit);
    jacket.castShadow = true;
    this.torso.add(jacket);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.5, 0.06), shirt);
    chest.position.set(0, 0.1, 0.18);
    this.torso.add(chest);
    if (opts.tieColor !== undefined) {
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.4, 0.03), new THREE.MeshStandardMaterial({ color: opts.tieColor }));
      tie.position.set(0, 0.06, 0.22);
      this.torso.add(tie);
    }
    this.torso.position.y = 1.15;
    this.root.add(this.torso);

    // 頭 + 墨鏡
    this.head = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), skin);
    skull.castShadow = true;
    this.head.add(skull);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.34), dark);
    hair.position.y = 0.2;
    this.head.add(hair);
    if (opts.sunglasses) {
      const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.05), dark);
      glasses.position.set(0, 0.04, 0.17);
      this.head.add(glasses);
    }
    this.head.position.y = 1.78;
    this.root.add(this.head);

    // 手臂（肩部樞紐 → 上臂西裝袖 + 拳頭）
    const makeArm = (side: 1 | -1) => {
      const g = new THREE.Group();
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.52, 0.16), suit);
      sleeve.position.y = -0.26;
      sleeve.castShadow = true;
      g.add(sleeve);
      const fist = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), skin);
      fist.position.y = -0.6;
      g.add(fist);
      g.position.set(0.4 * side, 1.48, 0);
      this.root.add(g);
      return { g, fist };
    };
    const armRight = makeArm(1);
    this.armR = armRight.g;
    this.fistR = armRight.fist;
    this.armL = makeArm(-1).g;

    // 腿（髖部樞紐 → 西裝褲 + 皮鞋）
    const makeLeg = (side: 1 | -1) => {
      const g = new THREE.Group();
      const trouser = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.2), suit);
      trouser.position.y = -0.31;
      trouser.castShadow = true;
      g.add(trouser);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.3), dark);
      shoe.position.set(0, -0.65, 0.05);
      g.add(shoe);
      g.position.set(0.16 * side, 0.74, 0);
      this.root.add(g);
      return g;
    };
    this.legR = makeLeg(1);
    this.legL = makeLeg(-1);

    this.root.scale.setScalar(scale);
  }

  /** 受擊閃白 / 狂暴變紅等 */
  flashTint(color: number, durationMs = 120): void {
    const original = this.suitMat.color.getHex();
    this.suitMat.emissive.setHex(color);
    this.suitMat.emissiveIntensity = 0.7;
    setTimeout(() => {
      this.suitMat.emissive.setHex(0x000000);
      this.suitMat.color.setHex(original);
    }, durationMs);
  }

  setRageGlow(on: boolean): void {
    this.suitMat.emissive.setHex(on ? 0xff2200 : 0x000000);
    this.suitMat.emissiveIntensity = on ? 0.35 : 0;
  }

  setState(s: VisualState): void {
    if (this.state === s) return;
    this.state = s;
    this.stateTime = 0;
  }

  getState(): VisualState {
    return this.state;
  }

  fistWorldPos(out: THREE.Vector3): THREE.Vector3 {
    return this.fistR.getWorldPosition(out);
  }

  update(dt: number): void {
    this.stateTime += dt;
    const t = this.stateTime;

    // 預設姿勢
    let armRx = 0, armLx = 0, armRz = 0.12, armLz = -0.12;
    let legRx = 0, legLx = 0;
    let torsoRx = 0, torsoRy = 0, rootY = 0, rootRx = 0, rootRz = 0;

    switch (this.state) {
      case 'idle': {
        const breathe = Math.sin(t * 2) * 0.03;
        armRx = -0.15 + breathe;
        armLx = -0.15 + breathe;
        rootY = Math.sin(t * 2) * 0.015;
        break;
      }
      case 'walk':
      case 'run': {
        const speed = this.state === 'run' ? 11 : 7;
        const amp = this.state === 'run' ? 0.8 : 0.5;
        const ph = Math.sin(t * speed);
        armRx = ph * amp;
        armLx = -ph * amp;
        legRx = -ph * amp;
        legLx = ph * amp;
        rootY = Math.abs(Math.cos(t * speed)) * 0.05;
        torsoRx = this.state === 'run' ? 0.15 : 0.05;
        break;
      }
      case 'punch1': { // 右直拳
        const p = this.attackCurve(t, 0.28);
        armRx = -Math.PI / 2 * p;
        armRz = 0;
        torsoRy = -0.4 * p;
        break;
      }
      case 'punch2': { // 左直拳
        const p = this.attackCurve(t, 0.28);
        armLx = -Math.PI / 2 * p;
        armLz = 0;
        torsoRy = 0.4 * p;
        break;
      }
      case 'punch3': { // 右上鉤拳（重一點）
        const p = this.attackCurve(t, 0.34);
        armRx = -Math.PI * 0.65 * p;
        armRz = -0.3 * p;
        torsoRy = -0.55 * p;
        torsoRx = -0.1 * p;
        rootY = 0.06 * p;
        break;
      }
      case 'heavy': { // 蓄力雙拳下砸
        const wind = Math.min(t / 0.25, 1);          // 抬手
        const slam = t > 0.25 ? Math.min((t - 0.25) / 0.15, 1) : 0; // 砸下
        const lift = wind * (1 - slam);
        armRx = -Math.PI * 0.9 * lift - Math.PI * 0.35 * slam;
        armLx = -Math.PI * 0.9 * lift - Math.PI * 0.35 * slam;
        torsoRx = -0.2 * lift + 0.35 * slam;
        rootY = 0.08 * lift;
        break;
      }
      case 'dodge': { // 翻滾：root 前傾旋轉
        const p = Math.min(t / 0.4, 1);
        rootRx = Math.PI * 2 * p;
        rootY = Math.sin(p * Math.PI) * 0.3;
        armRx = armLx = -1.2;
        legRx = legLx = 1.2;
        break;
      }
      case 'hit': {
        const p = 1 - Math.min(t / 0.3, 1);
        torsoRx = -0.35 * p;
        rootY = 0.03 * p;
        armRx = armLx = 0.4 * p;
        break;
      }
      case 'down': {
        const p = Math.min(t / 0.5, 1);
        rootRx = -Math.PI / 2 * p;
        rootY = -0.45 * p;
        armRx = armLx = -0.5 * p;
        break;
      }
      case 'block': {
        armRx = armLx = -1.9;
        armRz = -0.35;
        armLz = 0.35;
        torsoRx = 0.1;
        break;
      }
      case 'throw': { // 投擲手丟瓶
        const p = this.attackCurve(t, 0.5);
        armRx = -Math.PI * (1 - p * 1.6);
        torsoRy = -0.5 * p;
        break;
      }
      case 'rage': { // 必殺：雙臂張開咆哮
        const p = Math.min(t / 0.3, 1);
        armRx = armLx = -1.4 * p;
        armRz = 1.2 * p;
        armLz = -1.2 * p;
        torsoRx = -0.2 * p;
        rootY = 0.1 * Math.sin(t * 20) * p;
        break;
      }
    }

    this.armR.rotation.set(armRx, 0, armRz);
    this.armL.rotation.set(armLx, 0, armLz);
    this.legR.rotation.x = legRx;
    this.legL.rotation.x = legLx;
    this.torso.rotation.set(torsoRx, torsoRy, 0);
    this.head.rotation.y = torsoRy * 0.6;
    this.root.position.y = rootY;
    this.root.rotation.x = rootRx;
    this.root.rotation.z = rootRz;
  }

  /** 攻擊曲線：快速出手 → 短暫停留 → 收手 */
  private attackCurve(t: number, duration: number): number {
    const p = Math.min(t / duration, 1);
    if (p < 0.4) return p / 0.4;          // 出手
    if (p < 0.7) return 1;                 // 停留（命中幀）
    return 1 - (p - 0.7) / 0.3;            // 收手
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
      }
    });
  }
}
