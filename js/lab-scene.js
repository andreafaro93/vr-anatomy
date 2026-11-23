import * as THREE from 'three';

/**
 * Gestore dell'ambiente laboratorio scientifico 3D
 * Include stanza, pedana medica bilanciata, luci cliniche morbide senza riflessi bruciati.
 */
export class LabScene {
  constructor(scene) {
    this.scene = scene;
    // Origine (0, 0, 0) per i modelli Z-Anatomy
    this.pedestalPosition = new THREE.Vector3(0, 0, 0);

    this.initLighting();
    this.initRoom();
    this.initPedestal();
    this.initAtmosphere();
  }

  initLighting() {
    // 1. Luce emisferica bilanciata e morbida per illuminazione naturale clinica
    const hemiLight = new THREE.HemisphereLight(0xe2edf8, 0x0f172a, 0.85);
    hemiLight.position.set(0, 20, 0);
    this.scene.add(hemiLight);

    // 2. Luce direzionale principale morbida (intensità moderata per evitare riflessi bruciati)
    const mainDirLight = new THREE.DirectionalLight(0xffffff, 1.15);
    mainDirLight.position.set(2.5, 5.5, 3.5);
    mainDirLight.castShadow = true;
    mainDirLight.shadow.mapSize.width = 2048;
    mainDirLight.shadow.mapSize.height = 2048;
    mainDirLight.shadow.camera.near = 0.5;
    mainDirLight.shadow.camera.far = 18;
    mainDirLight.shadow.camera.left = -2.5;
    mainDirLight.shadow.camera.right = 2.5;
    mainDirLight.shadow.camera.top = 2.8;
    mainDirLight.shadow.camera.bottom = -1.2;
    mainDirLight.shadow.bias = -0.0003;
    this.scene.add(mainDirLight);

    // 3. Luce di riempimento posteriore/laterale per schiarire le ombre anatomiche
    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.5);
    fillLight.position.set(-3, 4, -2.5);
    this.scene.add(fillLight);

    // 4. Rim light sottile posteriore per definire la silhouette del corpo
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.35);
    rimLight.position.set(0, 3, -3.5);
    this.scene.add(rimLight);

    // 5. Faretto zenitale diffuso (luce bianca morbida, penombra ampia anti-bruciatura)
    const spotLight = new THREE.SpotLight(0xf1f5f9, 0.85, 10, Math.PI / 3, 0.85, 1.2);
    spotLight.position.set(0, 4.2, 0.8);
    spotLight.target.position.set(0, 0.9, 0);
    this.scene.add(spotLight);
    this.scene.add(spotLight.target);

    // 6. Luce d'accento soffusa della pedana (blu ciano clinico)
    const pedestalGlow = new THREE.PointLight(0x00e5ff, 0.45, 2.5);
    pedestalGlow.position.set(0, 0.05, 0);
    this.scene.add(pedestalGlow);
  }

  initRoom() {
    // Pavimento opaco/satinato (roughness alta per scongiurare speculari bruciati)
    const floorGeo = new THREE.PlaneGeometry(24, 24);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a101d,
      roughness: 0.55,
      metalness: 0.25
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Griglia geometrica elegante per orientamento spaziale
    const grid = new THREE.GridHelper(24, 48, 0x0284c7, 0x1e293b);
    grid.position.y = 0.001;
    this.scene.add(grid);

    // Cerchio di sicurezza perimetrale per la postazione VR
    const safeZoneGeo = new THREE.RingGeometry(1.8, 1.84, 64);
    const safeZoneMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25
    });
    const safeZone = new THREE.Mesh(safeZoneGeo, safeZoneMat);
    safeZone.rotation.x = -Math.PI / 2;
    safeZone.position.y = 0.002;
    this.scene.add(safeZone);

    // Pareti cilindriche scure
    const wallGeo = new THREE.CylinderGeometry(12, 12, 10, 48, 1, true);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x050912,
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.BackSide
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 5;
    this.scene.add(wall);
  }

  initPedestal() {
    const pedestalGroup = new THREE.Group();

    // Pedana di esame a terra (bassa ed ergonomica per la figura umana intera)
    const baseGeo = new THREE.CylinderGeometry(0.95, 1.05, 0.04, 64);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.4,
      roughness: 0.5
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.02;
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    pedestalGroup.add(baseMesh);

    // Anello luminoso emissivo ciano sul bordo della pedana
    const ringGeo = new THREE.TorusGeometry(0.96, 0.012, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.038;
    pedestalGroup.add(ringMesh);

    // Disco centrale satinato antiscivolo (punto d'appoggio per i piedi all'origine)
    const padGeo = new THREE.CylinderGeometry(0.88, 0.88, 0.005, 48);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.65,
      metalness: 0.2
    });
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.position.y = 0.041;
    padMesh.receiveShadow = true;
    pedestalGroup.add(padMesh);

    this.scene.add(pedestalGroup);
    this.pedestalGroup = pedestalGroup;
  }

  initAtmosphere() {
    // Sottile campo particellare per dare profondità e senso di spazio 3D/VR
    const particleCount = 180;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 12;
      positions[i + 1] = Math.random() * 4 + 0.2;
      positions[i + 2] = (Math.random() - 0.5) * 12;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.025,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  update(time) {
    if (this.particles) {
      this.particles.rotation.y = time * 0.015;
    }
  }

  getPedestalTopPosition() {
    // Origine esatta (0, 0, 0)
    return new THREE.Vector3(0, 0, 0);
  }
}
