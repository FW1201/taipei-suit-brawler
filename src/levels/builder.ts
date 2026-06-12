// 五個台北場景建造器：程式化 low-poly 為主，MANIFEST 有 Kenney 件時混搭擺放。
import * as THREE from 'three';
import { MANIFEST } from '../core/manifest';
import { loadGLB, cloneScene } from '../core/assets';

export interface Environment {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** protect 任務目標物（香爐/錢箱），無則 null */
  protectTarget: THREE.Object3D | null;
  update(dt: number, elapsed: number): void;
}

type Theme = 'neon' | 'nightmarket' | 'temple' | 'skybridge' | 'rooftop';

const NEON_COLORS = [0x00d4ff, 0x7b2fff, 0xff6b35, 0xff2f7b, 0x2fff7b];

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts });
}

function box(w: number, h: number, d: number, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** 霓虹招牌（直式，發光） */
function neonSign(h: number, color: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(0.25, h, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x101010, emissive: color, emissiveIntensity: 2.2 }),
  );
}

/** 街屋：樓體 + 屋頂水塔 + 招牌 */
function shopHouse(width: number, height: number, hue: number): THREE.Group {
  const g = new THREE.Group();
  const body = box(width, height, 4, mat(new THREE.Color().setHSL(hue, 0.18, 0.16).getHex()));
  body.position.y = height / 2;
  g.add(body);
  // 一樓亮燈騎樓
  const storefront = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.85, 1.6, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x332211, emissive: 0xffcc77, emissiveIntensity: 0.9 }),
  );
  storefront.position.set(0, 1.1, 2.0);
  g.add(storefront);
  if (Math.random() > 0.35) {
    const sign = neonSign(1.2 + Math.random() * 2.2, NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)]);
    sign.position.set((Math.random() - 0.5) * width * 0.6, height * (0.45 + Math.random() * 0.3), 2.2);
    g.add(sign);
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 8), mat(0x8899aa));
  tank.position.set(width * 0.25, height + 0.45, -0.5);
  g.add(tank);
  return g;
}

/** 紅燈籠串 */
function lanternString(length: number, count: number): THREE.Group {
  const g = new THREE.Group();
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0xff4422, emissiveIntensity: 1.4 });
  for (let i = 0; i < count; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), lanternMat);
    l.scale.y = 1.25;
    l.position.set((i / (count - 1) - 0.5) * length, Math.sin((i / (count - 1)) * Math.PI) * -0.4, 0);
    g.add(l);
  }
  return g;
}

/** 台北 101：先放程式化版本，GLB（CC-BY, Elaine Wijaya Oey）載到後原地替換 */
function placeTaipei101(scene: THREE.Scene, pos: THREE.Vector3, targetHeight: number): void {
  const procedural = taipei101(targetHeight / 40);
  procedural.position.copy(pos);
  scene.add(procedural);
  const url = MANIFEST.landmarks.taipei101;
  if (!url) return;
  void loadGLB(url).then((gltf) => {
    if (!gltf) return;
    const model = cloneScene(gltf);
    const bbox = new THREE.Box3().setFromObject(model);
    const h = Math.max(0.001, bbox.max.y - bbox.min.y);
    model.scale.setScalar(targetHeight / h);
    model.position.copy(pos);
    model.position.y = pos.y - bbox.min.y * (targetHeight / h);
    scene.remove(procedural);
    scene.add(model);
  });
}

/** 程式化台北 101 */
export function taipei101(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({
    color: 0x1d3a52, roughness: 0.3, metalness: 0.6,
    emissive: 0x00d4ff, emissiveIntensity: 0.18,
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.4, 9, 4), m);
  base.position.y = 4.5;
  g.add(base);
  for (let s = 0; s < 8; s++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.0, 3.6, 4), m);
    seg.position.y = 9 + s * 3.6 + 1.8;
    g.add(seg);
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.55, 7, 4), m);
  spire.position.y = 9 + 8 * 3.6 + 3.5;
  g.add(spire);
  g.scale.setScalar(scale);
  return g;
}

/** 夜市攤車 */
function stall(color: number): THREE.Group {
  const g = new THREE.Group();
  const counter = box(2.4, 1.0, 1.2, mat(0x6b4a2b));
  counter.position.y = 0.5;
  g.add(counter);
  const poleM = mat(0x444444);
  for (const sx of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), poleM);
    pole.position.set(sx * 1.05, 1.6, 0);
    g.add(pole);
  }
  const awning = box(2.6, 0.1, 1.5, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25 }));
  awning.position.y = 2.4;
  awning.rotation.x = -0.12;
  g.add(awning);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0xffee99, emissive: 0xffdd66, emissiveIntensity: 2.5 }),
  );
  bulb.position.set(0, 1.9, 0.5);
  g.add(bulb);
  return g;
}

/** 廟宇正面（多層翹簷屋頂） */
function templeFacade(): THREE.Group {
  const g = new THREE.Group();
  const wall = box(14, 5, 3, mat(0x7a2e1d));
  wall.position.y = 2.5;
  g.add(wall);
  const roofM = mat(0xb8651f, { emissive: 0x331a00, emissiveIntensity: 0.3 });
  for (let tier = 0; tier < 2; tier++) {
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 8.5 - tier * 2.5, 1.6, 4), roofM);
    roof.position.y = 5.8 + tier * 1.7;
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.45;
    g.add(roof);
  }
  // 門洞燈光
  for (const sx of [-4, 0, 4]) {
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 2.6, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x1a0d00, emissive: 0xff8833, emissiveIntensity: 0.8 }),
    );
    door.position.set(sx, 1.3, 1.6);
    g.add(door);
  }
  return g;
}

/** 香爐（protect 目標） */
function incenseBurner(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 1.1, 10), mat(0x886622, { metalness: 0.7, roughness: 0.35 }));
  body.position.y = 0.85;
  g.add(body);
  for (const sx of [-0.9, 0.9]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.6, 6), mat(0x665511));
    leg.position.set(sx, 0.3, 0);
    g.add(leg);
  }
  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.75, 0.12, 10),
    new THREE.MeshStandardMaterial({ color: 0xff5500, emissive: 0xff6622, emissiveIntensity: 1.8 }),
  );
  glow.position.y = 1.45;
  g.add(glow);
  return g;
}

/** 共用：地面 + 邊界 + 基礎燈光 */
function baseSetup(scene: THREE.Scene, w: number, d: number, groundColor: number, fogColor: number, fogFar: number): void {
  scene.fog = new THREE.Fog(fogColor, fogFar * 0.45, fogFar);
  scene.background = new THREE.Color(fogColor);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.4, d * 2.4), mat(groundColor, { roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  scene.add(new THREE.AmbientLight(0x66708a, 1.45));
  const hemi = new THREE.HemisphereLight(0x33415e, 0x1a1410, 0.7);
  scene.add(hemi);
  // 戰鬥區中央柔光，確保角色清晰可讀
  const center = new THREE.PointLight(0xbfd4ff, 30, Math.max(w, d) * 2.2, 1.6);
  center.position.set(0, 9, 0);
  scene.add(center);
  const key = new THREE.DirectionalLight(0xaabbff, 1.25);
  key.position.set(8, 18, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -w; key.shadow.camera.right = w;
  key.shadow.camera.top = d; key.shadow.camera.bottom = -d;
  scene.add(key);
}

/** 放置單件 Kenney GLB（非同步 fire-and-forget，載入失敗就靜默跳過） */
function placeGLB(scene: THREE.Scene, key: string, x: number, z: number, ry = 0, scale = 1): void {
  const url = MANIFEST.city[key];
  if (!url) return;
  void loadGLB(url).then((gltf) => {
    if (!gltf) return;
    const inst = cloneScene(gltf);
    inst.scale.setScalar(scale);
    inst.position.set(x, 0, z);
    inst.rotation.y = ry;
    scene.add(inst);
  });
}

/** 散布 Kenney 建築（非同步，載到就放） */
async function scatterCityGLBs(scene: THREE.Scene, positions: [number, number, number][]): Promise<void> {
  const keys = Object.keys(MANIFEST.city).filter((k) => k.toLowerCase().includes('building'));
  if (keys.length === 0) return;
  const gltfs = await Promise.all(keys.slice(0, 8).map((k) => loadGLB(MANIFEST.city[k])));
  const valid = gltfs.filter((g): g is NonNullable<typeof g> => !!g);
  if (valid.length === 0) return;
  positions.forEach(([x, ry, z], i) => {
    const inst = cloneScene(valid[i % valid.length]);
    // Kenney 城市件約 1 單位寬，放大至街屋尺度
    inst.scale.setScalar(4);
    inst.position.set(x, 0, z);
    inst.rotation.y = ry;
    scene.add(inst);
  });
}

/** 路燈一排（Kenney streetLight + 自帶光暈球） */
function streetLights(scene: THREE.Scene, spots: [number, number, number][]): void {
  for (const [x, z, ry] of spots) {
    placeGLB(scene, 'streetLight', x, z, ry, 3);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffd870, emissiveIntensity: 2.4 }),
    );
    glow.position.set(x, 3.2, z);
    scene.add(glow);
  }
}

export function buildEnvironment(scene: THREE.Scene, theme: Theme): Environment {
  const animated: ((dt: number, t: number) => void)[] = [];
  let protectTarget: THREE.Object3D | null = null;
  let bounds = { minX: -16, maxX: 16, minZ: -12, maxZ: 12 };

  switch (theme) {
    case 'neon': { // 西門町徒步區
      bounds = { minX: -17, maxX: 17, minZ: -13, maxZ: 13 };
      baseSetup(scene, 20, 16, 0x23262e, 0x0d1117, 70);
      // 環繞街屋
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2;
        const r = 21 + Math.random() * 4;
        const h = shopHouse(4 + Math.random() * 3, 6 + Math.random() * 8, 0.6 + Math.random() * 0.15);
        h.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        h.lookAt(0, 0, 0);
        scene.add(h);
      }
      // 紅樓剪影（八角樓）
      const redHouse = new THREE.Group();
      const oct = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 7, 8), mat(0x8c2f24));
      oct.position.y = 3.5;
      redHouse.add(oct);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.4, 8), mat(0x4a1812));
      roof.position.y = 8.2;
      redHouse.add(roof);
      redHouse.position.set(0, 0, -24);
      scene.add(redHouse);
      // 行人地磚格
      const grid = new THREE.GridHelper(34, 17, 0x333a45, 0x262c36);
      grid.position.y = 0.01;
      scene.add(grid);
      void scatterCityGLBs(scene, [[-26, 0.4, 8], [26, -0.4, -6], [-24, 1.2, -14], [25, 2.2, 12]]);
      // 路燈圍繞廣場四角 + 施工區小景
      streetLights(scene, [[-14, -10, 0.8], [14, -10, -0.8], [-14, 10, 2.4], [14, 10, -2.4]]);
      placeGLB(scene, 'constructionCone', -8, 6, 0, 2.2);
      placeGLB(scene, 'constructionCone', -7.2, 6.8, 0.5, 2.2);
      placeGLB(scene, 'constructionBarrier', -9, 7.5, 0.3, 2.6);
      break;
    }

    case 'nightmarket': { // 士林夜市窄巷
      bounds = { minX: -28, maxX: 28, minZ: -6, maxZ: 6 };
      baseSetup(scene, 32, 10, 0x1d1a14, 0x0e0a08, 55);
      // 兩排攤車 + 街屋牆
      for (let x = -26; x <= 26; x += 5.5) {
        for (const side of [-1, 1]) {
          const s = stall(NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)]);
          s.position.set(x + (Math.random() - 0.5) * 1.2, 0, side * 7.4);
          s.rotation.y = side > 0 ? Math.PI : 0;
          scene.add(s);
          const wall = shopHouse(5.5, 5 + Math.random() * 4, 0.08 + Math.random() * 0.06);
          wall.position.set(x, 0, side * 12);
          if (side > 0) wall.rotation.y = Math.PI;
          scene.add(wall);
        }
        // 燈籠串橫跨巷子
        if ((x / 5.5) % 2 === 0) {
          const ls = lanternString(13, 6);
          ls.position.set(x, 4.2, 0);
          ls.rotation.y = Math.PI / 2;
          scene.add(ls);
        }
      }
      // 夜市雜物（陽傘縮小放攤位間隙）
      placeGLB(scene, 'parasolA', -14.8, 8.8, 0.4, 1.2);
      placeGLB(scene, 'parasolB', 11.2, -8.8, 2.1, 1.2);
      placeGLB(scene, 'constructionCone', -26, -4.8, 0, 1.6);
      placeGLB(scene, 'constructionCone', 26, 4.8, 0, 1.6);
      // 巷內暖色補光
      for (const lx of [-18, 0, 18]) {
        const warm = new THREE.PointLight(0xffbb66, 18, 22, 1.8);
        warm.position.set(lx, 4.5, 0);
        scene.add(warm);
      }
      break;
    }

    case 'temple': { // 龍山寺廟埕
      bounds = { minX: -15, maxX: 15, minZ: -13, maxZ: 15 };
      baseSetup(scene, 18, 18, 0x2a241c, 0x0c0a10, 60);
      const facade = templeFacade();
      facade.position.set(0, 0, -16);
      scene.add(facade);
      // 香爐（protect 目標）置中偏後
      const burner = incenseBurner();
      burner.position.set(0, 0, -8);
      scene.add(burner);
      protectTarget = burner;
      // 圍牆與燈籠
      for (const sx of [-17, 17]) {
        const wall = box(1, 2.4, 32, mat(0x6e3a28));
        wall.position.set(sx, 1.2, 0);
        scene.add(wall);
      }
      for (let i = 0; i < 6; i++) {
        const ls = lanternString(8, 4);
        ls.position.set(-12 + i * 5, 3.4, -14.5);
        scene.add(ls);
      }
      streetLights(scene, [[-13, 12, 2.4], [13, 12, -2.4]]);
      // 香爐煙（粒子感：上升小方塊）
      const smokeM = new THREE.MeshBasicMaterial({ color: 0x99aabb, transparent: true, opacity: 0.25 });
      const puffs: THREE.Mesh[] = [];
      for (let i = 0; i < 5; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), smokeM);
        p.position.set(0, 1.6 + i * 0.5, -8);
        scene.add(p);
        puffs.push(p);
      }
      animated.push((dt, t) => {
        puffs.forEach((p, i) => {
          p.position.y = 1.6 + ((t * 0.5 + i * 0.5) % 2.8);
          p.position.x = Math.sin(t + i) * 0.2;
        });
      });
      break;
    }

    case 'skybridge': { // 信義商圈空橋
      bounds = { minX: -32, maxX: 32, minZ: -4.5, maxZ: 4.5 };
      baseSetup(scene, 36, 8, 0x2c3140, 0x0a0d16, 80);
      // 橋面玻璃欄杆
      const railM = new THREE.MeshStandardMaterial({ color: 0x88ccee, transparent: true, opacity: 0.25, metalness: 0.8 });
      for (const side of [-1, 1]) {
        const rail = box(66, 1.2, 0.12, railM);
        rail.position.set(0, 0.6, side * 5.2);
        scene.add(rail);
      }
      // 周圍玻璃帷幕大樓（下方城市感：橋是高架的）
      for (let i = 0; i < 16; i++) {
        const h = 14 + Math.random() * 22;
        const tower = box(6 + Math.random() * 4, h, 6 + Math.random() * 4,
          mat(0x223349, { metalness: 0.6, roughness: 0.3, emissive: 0x14405c, emissiveIntensity: 0.85 }));
        const x = -36 + Math.random() * 72;
        const z = (10 + Math.random() * 16) * (i % 2 === 0 ? 1 : -1);
        tower.position.set(x, h / 2 - 9, z); // 樓體下沉營造高架感
        scene.add(tower);
        // 窗格光點
        const lights = new THREE.Mesh(
          new THREE.PlaneGeometry(4, h * 0.8),
          new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.28 }),
        );
        lights.position.set(x, h / 2 - 9, z - (z > 0 ? 3.5 : -3.5));
        if (z < 0) lights.rotation.y = Math.PI;
        scene.add(lights);
      }
      // 101 遠景
      placeTaipei101(scene, new THREE.Vector3(38, -9, -20), 60);
      // 橋上路燈與告示
      streetLights(scene, [[-22, -4.6, 0], [0, 4.6, Math.PI], [22, -4.6, 0]]);
      placeGLB(scene, 'signHighway', -30, -4.2, 0.4, 2.5);
      break;
    }

    case 'rooftop': { // 台北 101 頂樓直升機坪
      bounds = { minX: -13, maxX: 13, minZ: -13, maxZ: 13 };
      baseSetup(scene, 16, 16, 0x252a33, 0x06080e, 90);
      // 直升機坪圓環 + H 字
      const pad = new THREE.Mesh(new THREE.RingGeometry(8, 8.8, 48), new THREE.MeshBasicMaterial({ color: 0xffcc00, side: THREE.DoubleSide }));
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.02;
      scene.add(pad);
      const hBar = (w: number, d: number, x: number, z: number) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: 0xffcc00, side: THREE.DoubleSide }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, 0.02, z);
        scene.add(m);
      };
      hBar(1, 6, -2, 0); hBar(1, 6, 2, 0); hBar(3, 1, 0, 0);
      // 塔身在旁（頂樓平台視角）
      placeTaipei101(scene, new THREE.Vector3(-26, -40, -22), 48);
      // 樓下城市光海
      const cityGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(300, 300),
        new THREE.MeshBasicMaterial({ color: 0x16202e }),
      );
      cityGlow.rotation.x = -Math.PI / 2;
      cityGlow.position.y = -30;
      scene.add(cityGlow);
      for (let i = 0; i < 80; i++) {
        const dot = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.8, 0.8),
          new THREE.MeshBasicMaterial({ color: NEON_COLORS[i % NEON_COLORS.length], transparent: true, opacity: 0.7 }),
        );
        dot.position.set((Math.random() - 0.5) * 200, -29, (Math.random() - 0.5) * 200);
        scene.add(dot);
      }
      // 頂樓設備與護欄
      placeGLB(scene, 'constructionBarrier', -11, -8, 1.57, 2.4);
      placeGLB(scene, 'constructionBarrier', 11, 8, 1.57, 2.4);
      // 強風感：旗幟/天線搖晃
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 4, 6), mat(0xaa2222));
      antenna.position.set(11, 2, -11);
      scene.add(antenna);
      animated.push((_dt, t) => {
        antenna.rotation.z = Math.sin(t * 3) * 0.06;
      });
      // 邊緣警示燈
      for (const [cx, cz] of [[-13, -13], [13, -13], [-13, 13], [13, 13]] as const) {
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff2222, emissiveIntensity: 2 }),
        );
        beacon.position.set(cx, 0.8, cz);
        scene.add(beacon);
        const beaconMat = beacon.material as THREE.MeshStandardMaterial;
        animated.push((_dt, t) => {
          beaconMat.emissiveIntensity = 1.2 + Math.sin(t * 4) * 1.1;
        });
      }
      break;
    }
  }

  return {
    bounds,
    protectTarget,
    update(dt, elapsed) {
      for (const fn of animated) fn(dt, elapsed);
    },
  };
}
