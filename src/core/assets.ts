import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder); // 素材皆經 meshopt 壓縮
const cache = new Map<string, Promise<GLTF>>();

/** 載入 GLB（快取）；失敗回傳 null，呼叫端走程式化 fallback */
export async function loadGLB(url: string): Promise<GLTF | null> {
  try {
    let p = cache.get(url);
    if (!p) {
      p = loader.loadAsync(url);
      cache.set(url, p);
    }
    return await p;
  } catch {
    cache.delete(url);
    return null;
  }
}

/** 複製 GLB 場景樹供多次擺放（非 skinned；skinned 用 SkeletonUtils） */
export function cloneScene(gltf: GLTF): THREE.Group {
  const clone = gltf.scene.clone(true);
  clone.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return clone;
}
