import * as THREE from 'three';
import { input } from './input';
import { timeCtl } from './time';

export type UpdateFn = (dt: number, elapsed: number) => void;

/** 渲染迴圈核心：scene/camera/renderer + update 訂閱 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  private updates = new Set<UpdateFn>();
  private clock = new THREE.Clock();
  private running = false;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1117);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);
    this.camera.position.set(0, 6, 10);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  onUpdate(fn: UpdateFn): () => void {
    this.updates.add(fn);
    return () => this.updates.delete(fn);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const dt = timeCtl.scale(Math.min(this.clock.getDelta(), 0.05)); // 鎖死最大步長 + hitstop
      const elapsed = this.clock.getElapsedTime();
      this.updates.forEach((fn) => fn(dt, elapsed));
      input.endFrame();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  stop(): void {
    this.running = false;
  }

  /** 清空場景（換關用），保留 renderer */
  clearScene(): void {
    this.updates.clear();
    while (this.scene.children.length) {
      const child = this.scene.children[0];
      this.scene.remove(child);
    }
  }
}
