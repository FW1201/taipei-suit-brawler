// 《西裝正義》入口 — Phase 1 placeholder：低多邊形台北街景轉場
// 後續 phase 會替換為完整 game state machine（title/map/level/result/shop）

import * as THREE from 'three';

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1117);
scene.fog = new THREE.Fog(0x0d1117, 20, 60);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 6, 18);

// 燈光：夜色 + 霓虹
scene.add(new THREE.AmbientLight(0x404060, 1.2));
const moon = new THREE.DirectionalLight(0x8899ff, 0.8);
moon.position.set(10, 20, 10);
scene.add(moon);

// 地面
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.9 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// 程式化街屋 + 霓虹招牌（placeholder）
const city = new THREE.Group();
const neonColors = [0x00d4ff, 0x7b2fff, 0xff6b35, 0xff2f7b];
for (let i = 0; i < 40; i++) {
  const w = 2 + Math.random() * 3;
  const h = 3 + Math.random() * 12;
  const d = 2 + Math.random() * 3;
  const building = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.6, 0.2, 0.1 + Math.random() * 0.15) }),
  );
  const angle = (i / 40) * Math.PI * 2;
  const radius = 12 + Math.random() * 18;
  building.position.set(Math.cos(angle) * radius, h / 2, Math.sin(angle) * radius);
  city.add(building);

  // 霓虹招牌
  if (Math.random() > 0.4) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 1 + Math.random() * 2, 0.8),
      new THREE.MeshStandardMaterial({
        color: 0x111111,
        emissive: neonColors[i % neonColors.length],
        emissiveIntensity: 2,
      }),
    );
    sign.position.copy(building.position);
    sign.position.y = h * 0.6;
    sign.position.x += w / 2 + 0.3;
    city.add(sign);
  }
}
scene.add(city);

// 台北 101 剪影（程式化八節斗型）
const tower = new THREE.Group();
const towerMat = new THREE.MeshStandardMaterial({
  color: 0x16324a,
  emissive: 0x00d4ff,
  emissiveIntensity: 0.15,
});
const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 8, 4), towerMat);
base.position.y = 4;
tower.add(base);
for (let s = 0; s < 8; s++) {
  const seg = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 1.8, 3.4, 4), towerMat);
  seg.position.y = 8 + 3.4 * s + 1.7;
  tower.add(seg);
}
const spire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 6, 4), towerMat);
spire.position.y = 8 + 3.4 * 8 + 3;
tower.add(spire);
tower.position.set(0, 0, -30);
scene.add(tower);

// 標題 overlay（之後由 ui/title.ts 取代）
const ui = document.getElementById('ui-root')!;
ui.innerHTML = `
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;">
    <h1 style="color:#00D4FF;font-size:56px;font-weight:900;margin:0;text-shadow:0 0 24px #00D4FF66;">西裝正義</h1>
    <p style="color:#E6EDF3;font-size:18px;margin:0;">Taipei Suit Brawler — 開發中</p>
    <p style="color:#7B2FFF;font-size:14px;margin:0;">雙拳主持正義・台北五大戰場</p>
  </div>`;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  camera.position.x = Math.sin(t * 0.15) * 20;
  camera.position.z = Math.cos(t * 0.15) * 20;
  camera.lookAt(0, 6, -10);
  renderer.render(scene, camera);
}
animate();
