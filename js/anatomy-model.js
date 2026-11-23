import * as THREE from 'three';
import { MEDICAL_DATA } from './medical-data.js';

/**
 * Generatore del modello anatomico 3D procedurale dimostrativo
 * Comprende: Cuore, Polmone Destro, Polmone Sinistro, Trachea e Bronchi
 */
export class AnatomyModel {
  constructor(scene, basePosition = new THREE.Vector3(0, 1.07, 0)) {
    this.scene = scene;
    this.basePosition = basePosition;
    this.rootGroup = new THREE.Group();
    this.rootGroup.position.copy(basePosition);
    this.scene.add(this.rootGroup);

    this.parts = {};
    this.originalTransforms = {};
    this.explodeFactor = 0;
    this.isXRay = false;
    this.heartBeatEnabled = true;

    this.createModel();
  }

  createModel() {
    this.createTracheaAndBronchi();
    this.createHeart();
    this.createRightLung();
    this.createLeftLung();

    // Salva le posizioni originarie per l'esplosione / animazione
    for (const [partId, mesh] of Object.entries(this.parts)) {
      this.originalTransforms[partId] = {
        position: mesh.position.clone(),
        rotation: mesh.rotation.clone(),
        scale: mesh.scale.clone()
      };
    }
  }

  /**
   * 1. Trachea e Albero Bronchiale con anelli cartilaginei e biforcazione carenale
   */
  createTracheaAndBronchi() {
    const tracheaGroup = new THREE.Group();
    tracheaGroup.name = 'Trachea e Albero Bronchiale';
    tracheaGroup.userData = { partId: 'trachea', ...MEDICAL_DATA.trachea };

    const cartMat = new THREE.MeshStandardMaterial({
      color: 0xf5f5f0,
      roughness: 0.5,
      metalness: 0.05
    });

    const lumenMat = new THREE.MeshStandardMaterial({
      color: 0xcc7a7a,
      roughness: 0.7,
      metalness: 0.05
    });

    // Tubo tracheale principale
    const tracheaLength = 0.28;
    const tracheaRadius = 0.032;
    const tracheaCenterY = 0.38;

    const tubeGeo = new THREE.CylinderGeometry(tracheaRadius, tracheaRadius * 0.95, tracheaLength, 24);
    const tubeMesh = new THREE.Mesh(tubeGeo, lumenMat);
    tubeMesh.position.y = tracheaCenterY;
    tubeMesh.castShadow = true;
    tracheaGroup.add(tubeMesh);

    // Anelli cartilaginei sovrapposti
    const ringCount = 14;
    for (let i = 0; i < ringCount; i++) {
      const yPos = tracheaCenterY - (tracheaLength / 2) + 0.02 + (i * (tracheaLength - 0.04) / (ringCount - 1));
      const ringGeo = new THREE.TorusGeometry(tracheaRadius * 1.04, 0.0045, 12, 28, Math.PI * 1.7);
      const ringMesh = new THREE.Mesh(ringGeo, cartMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.rotation.z = Math.PI * 0.15; // Apertura posteriore a C
      ringMesh.position.y = yPos;
      ringMesh.castShadow = true;
      tracheaGroup.add(ringMesh);
    }

    // Carena e Bronchi primari (destro e sinistro)
    const carinaY = tracheaCenterY - (tracheaLength / 2);

    // Bronco destro: più corto, più largo e più verticale
    const rightBronchusCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, carinaY, 0),
      new THREE.Vector3(-0.04, carinaY - 0.04, 0.01),
      new THREE.Vector3(-0.09, carinaY - 0.09, 0.02)
    ]);
    const rightBronchusGeo = new THREE.TubeGeometry(rightBronchusCurve, 20, 0.022, 16, false);
    const rightBronchus = new THREE.Mesh(rightBronchusGeo, cartMat);
    rightBronchus.castShadow = true;
    tracheaGroup.add(rightBronchus);

    // Bronco sinistro: più lungo, più sottile e più obliquo (supera l'arco aortico)
    const leftBronchusCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, carinaY, 0),
      new THREE.Vector3(0.05, carinaY - 0.035, -0.01),
      new THREE.Vector3(0.12, carinaY - 0.075, 0.02)
    ]);
    const leftBronchusGeo = new THREE.TubeGeometry(leftBronchusCurve, 20, 0.018, 16, false);
    const leftBronchus = new THREE.Mesh(leftBronchusGeo, cartMat);
    leftBronchus.castShadow = true;
    tracheaGroup.add(leftBronchus);

    // Registra come parte cliccabile
    this.registerClickablePart('trachea', tracheaGroup);
    this.rootGroup.add(tracheaGroup);
  }

  /**
   * 2. Cuore con ventricoli, atri, arco aortico e tronco polmonare
   */
  createHeart() {
    const heartGroup = new THREE.Group();
    heartGroup.name = 'Cuore';
    heartGroup.userData = { partId: 'cuore', ...MEDICAL_DATA.cuore };

    // Posizionamento anatomico: mediastino antero-inferiore, apice inclinato a sinistra
    heartGroup.position.set(0.02, 0.17, 0.05);
    heartGroup.rotation.set(0.1, -0.15, -0.22); // Inclinazione cardiaca anatomica

    // Materiale miocardico biologico lucido con clearcoat
    const muscleMat = new THREE.MeshPhysicalMaterial({
      color: 0xb71c1c,
      roughness: 0.35,
      metalness: 0.1,
      clearcoat: 0.4,
      clearcoatRoughness: 0.2
    });

    const atriaMat = new THREE.MeshStandardMaterial({
      color: 0x8e0000,
      roughness: 0.45,
      metalness: 0.1
    });

    const aortaMat = new THREE.MeshStandardMaterial({
      color: 0xef5350,
      roughness: 0.3,
      metalness: 0.1
    });

    const veinMat = new THREE.MeshStandardMaterial({
      color: 0x1976d2,
      roughness: 0.3,
      metalness: 0.1
    });

    // Massa ventricolare (apice rivolto in basso e a sinistra)
    const ventricleGeo = new THREE.SphereGeometry(0.09, 32, 32);
    // Deforma la sfera per dare la tipica forma a cono obliquo del cuore umano
    const pos = ventricleGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      if (y < 0) {
        // Rastrema verso l'apice
        const taper = 1.0 + (y / 0.09) * 0.45;
        x *= taper;
        z *= taper;
        x += (y / 0.09) * 0.02; // Inclinazione apice verso sinistra
      } else {
        // Allarga alla base atrio-ventricolare
        x *= 1.08;
        z *= 0.95;
      }
      pos.setXYZ(i, x, y, z);
    }
    ventricleGeo.computeVertexNormals();

    const ventricles = new THREE.Mesh(ventricleGeo, muscleMat);
    ventricles.castShadow = true;
    ventricles.receiveShadow = true;
    heartGroup.add(ventricles);

    // Atrio Destro e Auricola
    const rightAtriumGeo = new THREE.SphereGeometry(0.045, 20, 20);
    const rightAtrium = new THREE.Mesh(rightAtriumGeo, atriaMat);
    rightAtrium.position.set(-0.065, 0.065, 0.02);
    rightAtrium.scale.set(1.1, 0.9, 0.85);
    rightAtrium.castShadow = true;
    heartGroup.add(rightAtrium);

    // Atrio Sinistro e Auricola
    const leftAtriumGeo = new THREE.SphereGeometry(0.042, 20, 20);
    const leftAtrium = new THREE.Mesh(leftAtriumGeo, atriaMat);
    leftAtrium.position.set(0.055, 0.07, -0.02);
    leftAtrium.scale.set(1.0, 0.9, 0.85);
    leftAtrium.castShadow = true;
    heartGroup.add(leftAtrium);

    // Arco Aortico emergente dal ventricolo sinistro che curva all'indietro
    const aortaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.01, 0.06, 0.03),
      new THREE.Vector3(0.0, 0.15, 0.03),
      new THREE.Vector3(-0.02, 0.18, 0.0),
      new THREE.Vector3(-0.025, 0.14, -0.04),
      new THREE.Vector3(-0.025, 0.04, -0.06)
    ]);
    const aortaGeo = new THREE.TubeGeometry(aortaCurve, 32, 0.023, 16, false);
    const aortaMesh = new THREE.Mesh(aortaGeo, aortaMat);
    aortaMesh.castShadow = true;
    heartGroup.add(aortaMesh);

    // Rami sovra-aortici (Tronco brachiocefalico, Carotide comune sn, Succlavia sn)
    const branches = [
      { pos: new THREE.Vector3(-0.005, 0.175, 0.02), dir: new THREE.Vector3(0.01, 0.05, 0.01) },
      { pos: new THREE.Vector3(-0.018, 0.178, 0.005), dir: new THREE.Vector3(-0.005, 0.055, 0.0) },
      { pos: new THREE.Vector3(-0.023, 0.170, -0.015), dir: new THREE.Vector3(-0.015, 0.05, -0.01) }
    ];
    branches.forEach(b => {
      const brGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.045, 12);
      const brMesh = new THREE.Mesh(brGeo, aortaMat);
      brMesh.position.copy(b.pos).add(new THREE.Vector3(0, 0.02, 0));
      brMesh.castShadow = true;
      heartGroup.add(brMesh);
    });

    // Tronco Polmonare (Vena/Arteria polmonare che incrocia l'aorta)
    const pulmCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.02, 0.06, 0.05),
      new THREE.Vector3(-0.005, 0.12, 0.045),
      new THREE.Vector3(0.03, 0.13, 0.01)
    ]);
    const pulmGeo = new THREE.TubeGeometry(pulmCurve, 24, 0.02, 16, false);
    const pulmMesh = new THREE.Mesh(pulmGeo, veinMat);
    pulmMesh.castShadow = true;
    heartGroup.add(pulmMesh);

    this.heartMesh = heartGroup;
    this.registerClickablePart('cuore', heartGroup);
    this.rootGroup.add(heartGroup);
  }

  /**
   * 3. Polmone Destro: 3 lobi (Superiore, Medio, Inferiore), convesso
   */
  createRightLung() {
    const rightLungGroup = new THREE.Group();
    rightLungGroup.name = 'Polmone Destro';
    rightLungGroup.userData = { partId: 'polmone_destro', ...MEDICAL_DATA.polmone_destro };

    // Posizionamento anatomico nell'emitorace destro (lato anatomico destro = x negativo visto di fronte)
    rightLungGroup.position.set(-0.16, 0.22, 0.01);

    const lungMat = new THREE.MeshStandardMaterial({
      color: 0x4fc3f7,
      roughness: 0.65,
      metalness: 0.05,
      bumpScale: 0.01
    });

    // Lobo Superiore
    const supGeo = new THREE.SphereGeometry(0.095, 24, 24);
    supGeo.scale(0.85, 1.25, 0.95);
    const supMesh = new THREE.Mesh(supGeo, lungMat);
    supMesh.position.set(-0.01, 0.11, 0.01);
    supMesh.castShadow = true;
    supMesh.receiveShadow = true;
    rightLungGroup.add(supMesh);

    // Lobo Medio (cuneiforme, antero-inferiore)
    const midGeo = new THREE.SphereGeometry(0.075, 24, 24);
    midGeo.scale(0.95, 0.75, 1.1);
    const midMesh = new THREE.Mesh(midGeo, lungMat);
    midMesh.position.set(-0.02, -0.02, 0.04);
    midMesh.castShadow = true;
    midMesh.receiveShadow = true;
    rightLungGroup.add(midMesh);

    // Lobo Inferiore (il più voluminoso, poggia sulla cupola diaframmatica)
    const infGeo = new THREE.SphereGeometry(0.11, 28, 28);
    infGeo.scale(0.9, 1.15, 0.95);
    const infMesh = new THREE.Mesh(infGeo, lungMat);
    infMesh.position.set(0.0, -0.11, -0.02);
    infMesh.castShadow = true;
    infMesh.receiveShadow = true;
    rightLungGroup.add(infMesh);

    this.registerClickablePart('polmone_destro', rightLungGroup);
    this.rootGroup.add(rightLungGroup);
  }

  /**
   * 4. Polmone Sinistro: 2 lobi con incisura cardiaca
   */
  createLeftLung() {
    const leftLungGroup = new THREE.Group();
    leftLungGroup.name = 'Polmone Sinistro';
    leftLungGroup.userData = { partId: 'polmone_sinistro', ...MEDICAL_DATA.polmone_sinistro };

    // Posizionamento anatomico nell'emitorace sinistro (x positivo visto di fronte)
    leftLungGroup.position.set(0.17, 0.22, 0.01);

    const lungMat = new THREE.MeshStandardMaterial({
      color: 0x4fc3f7,
      roughness: 0.65,
      metalness: 0.05
    });

    // Lobo Superiore con incisura cardiaca antero-mediale
    const supGeo = new THREE.SphereGeometry(0.092, 28, 28);
    supGeo.scale(0.82, 1.3, 0.9);
    // Incavatura cardiaca (cardiac notch) scolpita sui vertici mediali
    const pos = supGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      // Zona mediale-inferiore rivolta verso il cuore (x negativo locale, z positivo, y intermedio)
      if (x < 0 && y < 0.05 && z > -0.02) {
        x *= 0.65; // Ritira la parete creando la rientranza per il cuore
        z *= 0.85;
      }
      pos.setXYZ(i, x, y, z);
    }
    supGeo.computeVertexNormals();

    const supMesh = new THREE.Mesh(supGeo, lungMat);
    supMesh.position.set(0.01, 0.1, 0.01);
    supMesh.castShadow = true;
    supMesh.receiveShadow = true;
    leftLungGroup.add(supMesh);

    // Lobo Inferiore sinistro
    const infGeo = new THREE.SphereGeometry(0.105, 28, 28);
    infGeo.scale(0.85, 1.2, 0.95);
    const infMesh = new THREE.Mesh(infGeo, lungMat);
    infMesh.position.set(0.02, -0.1, -0.02);
    infMesh.castShadow = true;
    infMesh.receiveShadow = true;
    leftLungGroup.add(infMesh);

    this.registerClickablePart('polmone_sinistro', leftLungGroup);
    this.rootGroup.add(leftLungGroup);
  }

  registerClickablePart(partId, objectGroup) {
    this.parts[partId] = objectGroup;

    // Assegna metadata a tutti i figli mesh per raycasting affidabile
    objectGroup.traverse(child => {
      if (child.isMesh) {
        child.userData.partId = partId;
        child.userData.rootPart = objectGroup;
        // Salva materiale originale per il ripristino post-highlight
        child.userData.originalMaterial = child.material;
      }
    });
  }

  /**
   * Ritorna tutte le mesh intercettabili per il raycasting
   */
  getIntersectableObjects() {
    const objects = [];
    for (const group of Object.values(this.parts)) {
      group.traverse(child => {
        if (child.isMesh) objects.push(child);
      });
    }
    return objects;
  }

  /**
   * Evidenziazione visiva dell'organo puntato (hover o selezione)
   */
  highlightPart(partId, isSelected = false) {
    this.clearHighlight();

    if (!partId || !this.parts[partId]) return;

    const group = this.parts[partId];
    group.traverse(child => {
      if (child.isMesh && child.material) {
        if (!child.userData.highlightMaterial) {
          child.userData.highlightMaterial = child.material.clone();
        }
        child.material = child.userData.highlightMaterial;
        child.material.emissive = new THREE.Color(isSelected ? 0x00e5ff : 0x2962ff);
        child.material.emissiveIntensity = isSelected ? 0.6 : 0.35;
      }
    });
  }

  clearHighlight() {
    for (const group of Object.values(this.parts)) {
      group.traverse(child => {
        if (child.isMesh && child.userData.originalMaterial) {
          child.material = child.userData.originalMaterial;
        }
      });
    }
  }

  /**
   * Vista Esplosa: allontana gli organi dal centro con fattore 0.0 .. 1.0
   */
  setExplodeFactor(factor) {
    this.explodeFactor = THREE.MathUtils.clamp(factor, 0, 1);

    const offsets = {
      cuore: new THREE.Vector3(0, -0.05, 0.22),
      polmone_destro: new THREE.Vector3(-0.25, 0.05, 0.05),
      polmone_sinistro: new THREE.Vector3(0.25, 0.05, 0.05),
      trachea: new THREE.Vector3(0, 0.18, -0.08)
    };

    for (const [partId, group] of Object.entries(this.parts)) {
      const orig = this.originalTransforms[partId];
      if (orig && offsets[partId]) {
        const targetOffset = offsets[partId].clone().multiplyScalar(this.explodeFactor);
        group.position.copy(orig.position).add(targetOffset);
      }
    }
  }

  /**
   * Modalità Raggi X: rende i tessuti trasparenti
   */
  setXRay(enabled) {
    this.isXRay = enabled;
    for (const group of Object.values(this.parts)) {
      group.traverse(child => {
        if (child.isMesh && child.material) {
          child.material.transparent = enabled;
          child.material.opacity = enabled ? 0.38 : 1.0;
          child.material.depthWrite = !enabled;
          child.material.needsUpdate = true;
        }
      });
    }
  }

  /**
   * Animazione continua: battito cardiaco e rotazione/floating lieve
   */
  update(time) {
    if (this.heartBeatEnabled && this.heartMesh) {
      // Simulazione sistole/diastole con ciclo asimmetrico
      const beat = Math.sin(time * 5.2);
      const pulse = beat > 0.6 ? 1.0 + (beat - 0.6) * 0.12 : 1.0;
      this.heartMesh.scale.set(pulse, pulse, pulse);
    }
  }

  dispose() {
    this.scene.remove(this.rootGroup);
    this.rootGroup.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
  }
}
