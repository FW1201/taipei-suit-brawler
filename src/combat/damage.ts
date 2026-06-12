import * as THREE from 'three';

/** 可被打的目標（敵人實作此介面；避免 player ↔ enemies 循環依賴） */
export interface Hittable {
  readonly position: THREE.Vector3;
  isAlive(): boolean;
  /** @returns 實際是否命中（被格擋回傳 false） */
  takeHit(damage: number, opts: HitOptions): boolean;
}

export interface HitOptions {
  fromPos: THREE.Vector3;
  knockback: number;       // 擊退距離 m
  breaksBlock?: boolean;   // 重拳/三段拳可破格擋
  knockdown?: boolean;     // 擊倒
  isCrit?: boolean;
}

export interface HitQuery {
  /** 取得攻擊者面向扇形範圍內的所有目標 */
  queryArc(pos: THREE.Vector3, facingRad: number, range: number, arcDeg: number): Hittable[];
  /** 取得半徑內所有目標（必殺 AOE 用） */
  queryRadius(pos: THREE.Vector3, radius: number): Hittable[];
}

const _toTarget = new THREE.Vector3();

/** pos 面向 facing，target 是否在 range/arc 內 */
export function inArc(pos: THREE.Vector3, facingRad: number, range: number, arcDeg: number, target: THREE.Vector3): boolean {
  _toTarget.copy(target).sub(pos);
  _toTarget.y = 0;
  const dist = _toTarget.length();
  if (dist > range || dist < 0.001) return false;
  const angleTo = Math.atan2(_toTarget.x, _toTarget.z);
  let diff = angleTo - facingRad;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) <= (arcDeg * Math.PI) / 360;
}
