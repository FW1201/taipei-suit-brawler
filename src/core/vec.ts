// 輕量 3D 向量：取代 three.js 的 Vector3（API 同名子集），戰鬥邏輯零改動。
// 座標慣例：x = 關卡橫向（公尺）、z = 街道縱深（0=遠/螢幕上方）、y = 高度（跳/拋物線）。

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class Vec3 {
  constructor(public x = 0, public y = 0, public z = 0) {}

  set(x: number, y: number, z: number): this { this.x = x; this.y = y; this.z = z; return this; }
  copy(v: Vec3): this { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone(): Vec3 { return new Vec3(this.x, this.y, this.z); }
  setY(y: number): this { this.y = y; return this; }

  add(v: Vec3): this { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v: Vec3): this { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  multiplyScalar(s: number): this { this.x *= s; this.y *= s; this.z *= s; return this; }
  addScaledVector(v: Vec3, s: number): this { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }

  length(): number { return Math.hypot(this.x, this.y, this.z); }
  lengthSq(): number { return this.x * this.x + this.y * this.y + this.z * this.z; }
  normalize(): this {
    const l = this.length();
    if (l > 1e-8) this.multiplyScalar(1 / l);
    return this;
  }

  distanceTo(v: Vec3): number { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  distanceToSquared(v: Vec3): number {
    const dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }

  lerp(v: Vec3, t: number): this {
    this.x = lerp(this.x, v.x, t);
    this.y = lerp(this.y, v.y, t);
    this.z = lerp(this.z, v.z, t);
    return this;
  }
  lerpVectors(a: Vec3, b: Vec3, t: number): this {
    this.x = lerp(a.x, b.x, t);
    this.y = lerp(a.y, b.y, t);
    this.z = lerp(a.z, b.z, t);
    return this;
  }
}
