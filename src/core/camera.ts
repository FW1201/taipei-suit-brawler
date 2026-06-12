import * as THREE from 'three';

/** 第三人稱跟隨鏡頭：肩後視角 + 平滑插值 */
export class FollowCamera {
  private offset = new THREE.Vector3(0, 5.2, 7.5);
  private lookOffset = new THREE.Vector3(0, 1.4, 0);
  private current = new THREE.Vector3();
  private initialized = false;
  /** 震動 */
  private shakeTime = 0;
  private shakeStrength = 0;

  constructor(private camera: THREE.PerspectiveCamera) {}

  shake(strength = 0.25, duration = 0.18): void {
    this.shakeStrength = strength;
    this.shakeTime = duration;
  }

  update(targetPos: THREE.Vector3, dt: number): void {
    const desired = targetPos.clone().add(this.offset);
    if (!this.initialized) {
      this.current.copy(desired);
      this.initialized = true;
    }
    this.current.lerp(desired, 1 - Math.exp(-6 * dt));
    this.camera.position.copy(this.current);

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const s = this.shakeStrength * (this.shakeTime > 0 ? 1 : 0);
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }

    this.camera.lookAt(targetPos.clone().add(this.lookOffset));
  }
}
