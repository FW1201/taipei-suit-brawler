// GLB 骨架角色視覺：Quaternius Universal Base Character + Universal Animation Library（同 rig）。
// 載入失敗或尚未載入時，工廠回傳程式化 CharacterVisual fallback。

import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGLB } from '../core/assets';
import { MANIFEST, ANIMATION_CLIPS } from '../core/manifest';
import { CharacterVisual, type CharacterVisualOptions, type ICharacterVisual, type VisualState } from './visual';

let heroScene: THREE.Group | null = null;
let clips: Map<string, THREE.AnimationClip> | null = null;
let ready = false;

/** 啟動時呼叫一次；失敗則全程用程式化角色 */
export async function preloadCharacterAssets(): Promise<boolean> {
  const heroUrl = MANIFEST.characters.hero;
  const animUrl = MANIFEST.animations.library;
  if (!heroUrl || !animUrl) return false;
  const [heroGltf, animGltf] = await Promise.all([loadGLB(heroUrl), loadGLB(animUrl)]);
  if (!heroGltf || !animGltf || animGltf.animations.length === 0) return false;
  heroScene = heroGltf.scene;
  clips = new Map(animGltf.animations.map((c) => [c.name, c]));
  ready = true;
  return true;
}

export function glbCharactersReady(): boolean {
  return ready;
}

/** 工廠：目前一律使用程式化西裝角色。
 *  GLB 素體模型（Quaternius UBC）沒有西裝外觀、與遊戲主題不符，
 *  GlbCharacterVisual 保留供日後有合適服裝模型時切換。 */
export function createCharacterVisual(opts: CharacterVisualOptions): ICharacterVisual {
  return new CharacterVisual(opts);
}

/** 日後切換 GLB 角色用 */
export function createGlbCharacterVisual(opts: CharacterVisualOptions): ICharacterVisual | null {
  if (ready && heroScene && clips) {
    try {
      return new GlbCharacterVisual(heroScene, clips, opts);
    } catch {
      return null;
    }
  }
  return null;
}

interface StateAnim {
  clipKey: keyof typeof ANIMATION_CLIPS | string;
  loop: boolean;
  /** 強制播放總時長（秒），用於對齊戰鬥判定的時間軸 */
  duration?: number;
  clamp?: boolean;
}

function stateAnimFor(state: VisualState, isHero: boolean): StateAnim {
  switch (state) {
    case 'idle': return { clipKey: 'idle', loop: true };
    case 'walk': return { clipKey: isHero ? 'walkFormal' : 'walk', loop: true };
    case 'run': return { clipKey: 'run', loop: true };
    case 'punch1': return { clipKey: 'punchJab', loop: false, duration: 0.28 };
    case 'punch2': return { clipKey: 'punchCross', loop: false, duration: 0.28 };
    case 'punch3': return { clipKey: 'punchCross', loop: false, duration: 0.34 };
    case 'heavy': return { clipKey: 'heavyAttack', loop: false, duration: 0.42 };
    case 'dodge': return { clipKey: 'dodgeRoll', loop: false, duration: 0.42 };
    case 'hit': return { clipKey: Math.random() > 0.5 ? 'hitChest' : 'hitHead', loop: false, duration: 0.3 };
    case 'down': return { clipKey: 'knockedDown', loop: false, clamp: true };
    case 'block': return { clipKey: 'combatEnter', loop: false, clamp: true, duration: 0.35 };
    case 'throw': return { clipKey: 'punchCross', loop: false, duration: 0.5 };
    case 'rage': return { clipKey: 'combatEnter', loop: false, duration: 0.6 };
  }
}

class GlbCharacterVisual implements ICharacterVisual {
  readonly root = new THREE.Group();
  private model: THREE.Group;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private state: VisualState = 'idle';
  private materials: THREE.MeshStandardMaterial[] = [];
  private isHero: boolean;

  constructor(template: THREE.Group, clipMap: Map<string, THREE.AnimationClip>, opts: CharacterVisualOptions) {
    this.isHero = opts.isHero ?? false;
    this.model = skeletonClone(template) as THREE.Group;

    // 量測原始高度，正規化到 1.85m 人形
    const bbox = new THREE.Box3().setFromObject(this.model);
    const height = Math.max(0.001, bbox.max.y - bbox.min.y);
    const norm = 1.85 / height;
    this.model.scale.setScalar(norm * (opts.scale ?? 1));
    this.model.position.y = -bbox.min.y * norm * (opts.scale ?? 1);

    // 材質複製 + 西裝色 tint（同一模型靠顏色/體型區分敵種）
    const tint = new THREE.Color(opts.suitColor);
    this.model.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.SkinnedMesh) {
        o.castShadow = true;
        o.frustumCulled = false; // skinned mesh 骨架位移會錯誤剔除
        const src = o.material as THREE.MeshStandardMaterial;
        const m = src.clone();
        m.color = src.color.clone().lerp(tint, this.isHero ? 0.35 : 0.55);
        this.materials.push(m);
        o.material = m;
      }
    });

    this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    for (const [name, clip] of clipMap) {
      this.actions.set(name, this.mixer.clipAction(clip));
    }
    this.applyState('idle');
  }

  setState(s: VisualState): void {
    if (this.state === s) return;
    this.state = s;
    this.applyState(s);
  }

  getState(): VisualState {
    return this.state;
  }

  private applyState(s: VisualState): void {
    const def = stateAnimFor(s, this.isHero);
    const clipName = ANIMATION_CLIPS[def.clipKey as string] ?? def.clipKey;
    const action = this.actions.get(clipName) ?? this.actions.get(ANIMATION_CLIPS.idle);
    if (!action) return;
    if (this.current === action && def.loop) return;

    action.reset();
    action.setLoop(def.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = def.clamp ?? !def.loop;
    if (def.duration) {
      action.setDuration(def.duration * 1.15); // 比邏輯時長略長，避免收招瞬間 T-pose
    } else {
      action.timeScale = 1;
    }
    if (this.current && this.current !== action) {
      action.crossFadeFrom(this.current, def.loop ? 0.18 : 0.06, false);
    }
    action.play();
    this.current = action;
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }

  flashTint(color: number, durationMs = 120): void {
    for (const m of this.materials) {
      m.emissive.setHex(color);
      m.emissiveIntensity = 0.6;
    }
    setTimeout(() => {
      for (const m of this.materials) {
        if (m.userData.rageGlow) continue;
        m.emissive.setHex(0x000000);
        m.emissiveIntensity = 0;
      }
    }, durationMs);
  }

  setRageGlow(on: boolean): void {
    for (const m of this.materials) {
      m.userData.rageGlow = on;
      m.emissive.setHex(on ? 0xff2200 : 0x000000);
      m.emissiveIntensity = on ? 0.35 : 0;
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    this.mixer.stopAllAction();
    for (const m of this.materials) m.dispose();
  }
}
