import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getGenericPartData } from './medical-data.js';

/**
 * Configurazione esatta dei 9 apparati anatomici da Z-Anatomy.
 * Tutti i 9 apparati vengono caricati completamente all'avvio (initialLoad: true)
 * garantendo che quando l'utente spunta o attiva un apparato, texture, materiali e mesh
 * siano già caricati e compilati nella GPU per una visualizzazione istantanea.
 */
export const SYSTEM_CONFIGS = [
  {
    id: 'scheletrico',
    name: 'Sistema Scheletrico',
    fileName: 'scheletrico.glb',
    pbrColor: 0xd8ccb4, // Avorio caldo per le ossa
    roughness: 0.58,
    metalness: 0.0,
    defaultVisible: true,
    initialLoad: true,
    defaultOpacity: 1.0,
    skeletonOnly: true, // Solo toggle ON/OFF
    credit: 'Z-Anatomy (CC BY 4.0)',
    description: 'Struttura ossea di sostegno del corpo umano, protezione degli organi vitali e riserva di minerali.'
  },
  {
    id: 'giunture',
    name: 'Giunture e Legamenti',
    fileName: 'giunture.glb',
    pbrColor: 0xb5c9d6, // Azzurro cartilagine
    roughness: 0.40,
    metalness: 0.0,
    defaultVisible: false,
    initialLoad: true,
    defaultOpacity: 1.0,
    credit: 'Z-Anatomy (CC BY 4.0)',
    description: 'Articolazioni, cartilagini articolari e complessi legamentosi di stabilizzazione scheletrica.'
  },
  {
    id: 'inserzioni_muscolari',
    name: 'Inserzioni Muscolari',
    fileName: 'inserzioni_muscolari.glb',
    pbrColor: 0xd5c4b1,
    roughness: 0.50,
    metalness: 0.0,
    defaultVisible: false,
    initialLoad: true,
    defaultOpacity: 1.0,
    credit: 'Z-Anatomy (CC BY 4.0)',
    description: 'Punti di ancoraggio scheletrico dei tendini e delle aponeurosi muscolari.'
  },
  {
    id: 'muscolare',
    name: 'Sistema Muscolare',
    fileName: 'muscolare.glb',
    preserveColors: true, // Colori muscolari anatomici originali
    roughness: 0.50,
    metalness: 0.0,
    defaultVisible: true,
    initialLoad: true,
    defaultOpacity: 1.0,
    credit: 'Z-Anatomy (CC BY 4.0)',
    description: 'Massa muscolare striata scheletrica per la locomozione, la postura e la termogenesi.'
  },
  {
    id: 'visceri',
    name: 'Organi e Visceri',
    fileName: 'visceri.glb',
    preserveColors: true, // Preserva colori realistici degli organi interni (polmoni, fegato, intestino)
    pbrColor: 0xc96a5b, // Rosa-organico fallback
    roughness: 0.45,
    metalness: 0.0,
    defaultVisible: true,
    initialLoad: true,
    defaultOpacity: 1.0,
    credit: 'Z-Anatomy (CC BY 4.0)',
    description: 'Organi interni toraco-addominali, apparato digerente, respiratorio e urogenitale.'
  },
  {
    id: 'sistema_circolatorio',
    name: 'Sistema Circolatorio',
    fileName: 'sistema_circolatorio.glb',
    preserveColors: true, // Arterie rosse, vene blu, cavità cardiache
    roughness: 0.35,
    metalness: 0.0,
    defaultVisible: false,
    initialLoad: true,
    defaultOpacity: 1.0,
    credit: 'Z-Anatomy (CC BY 4.0)',
    description: 'Rete vascolare cardiovascolare sistemica: cuore, arterie ematiche e vene.'
  },
  {
    id: 'sistema_linfatico',
    name: 'Sistema Linfatico',
    fileName: 'sistema_linfatico.glb',
    pbrColor: 0x22c55e, // Verde smeraldo linfatico
    roughness: 0.40,
    metalness: 0.0,
    defaultVisible: false,
    initialLoad: true,
    defaultOpacity: 1.0,
    credit: 'Z-Anatomy (CC BY 4.0)',
    description: 'Vasi linfatici, dotti e linfonodi per il drenaggio interstiziale e le difese immunitarie.'
  },
  {
    id: 'sistema_nervoso',
    name: 'Sistema Nervoso',
    fileName: 'sistema_nervoso.glb',
    pbrColor: 0xfacc15, // Giallo anatomico per i tronchi nervosi
    roughness: 0.40,
    metalness: 0.0,
    defaultVisible: false,
    initialLoad: true,
    defaultOpacity: 1.0,
    credit: 'Z-Anatomy (CC BY 4.0)',
    description: 'Sistema nervoso centrale e periferico: encefalo, midollo spinale e tronchi nervosi.'
  },
  {
    id: 'pelle_corpo_esterno',
    name: 'Pelle e Corpo Esterno',
    fileName: 'pelle_e_corpo_esterno.glb',
    pbrColor: 0xd29b7a, // Incarnato realistico
    hasVertexColors: true, // Texture di colore del vertice Z-Anatomy per occhi, capelli e sfumature
    roughness: 0.50,
    metalness: 0.0,
    defaultVisible: false,
    initialLoad: true,
    defaultOpacity: 0.25, // Opacità semitrasparente default 25%
    credit: 'Z-Anatomy (CC BY 4.0)',
    description: 'Superficie cutanea somatica esterna dell\'organismo (opacità predefinita al 25%).'
  }
];

// Step discreti di opacità: 0=Off, 1=25%, 2=50%, 3=75%, 4=100%
export const OPACITY_STEPS = [0, 0.25, 0.5, 0.75, 1.0];

/**
 * Converti opacità floating-point nello step discreto più vicino
 */
function opacityToStep(opacity) {
  let best = 0;
  let bestDist = Infinity;
  OPACITY_STEPS.forEach((s, i) => {
    const d = Math.abs(s - opacity);
    if (d < bestDist) { bestDist = d; best = i; }
  });
  return best;
}

export class GLBModelLoader {
  constructor(scene, basePosition = new THREE.Vector3(0, 0, 0)) {
    this.scene = scene;
    this.basePosition = basePosition;
    this.loader = new GLTFLoader();

    this.rootGroup = new THREE.Group();
    this.rootGroup.position.copy(this.basePosition);
    this.scene.add(this.rootGroup);

    this.systems = {};
    for (const conf of SYSTEM_CONFIGS) {
      // Step iniziale: visibili all'avvio → 4 (o 1 per pelle); non visibili → 0
      const initStep = conf.defaultVisible
        ? (conf.id === 'pelle_corpo_esterno' ? 1 : 4)
        : 0;

      this.systems[conf.id] = {
        config: conf,
        loaded: false,
        loading: false,
        visible: conf.defaultVisible,
        opacity: conf.defaultOpacity,
        step: initStep,
        group: null,
        meshParts: []
      };
    }

    this.selectedMesh = null;
    this.onStateChangeCallback = null;
  }

  setStateChangeCallback(cb) {
    this.onStateChangeCallback = cb;
  }

  notifyStateChange() {
    if (typeof this.onStateChangeCallback === 'function') {
      this.onStateChangeCallback(this.getSystemsState());
    }
  }

  getSystemsState() {
    const state = {};
    for (const [id, s] of Object.entries(this.systems)) {
      state[id] = {
        id,
        name: s.config.name,
        fileName: s.config.fileName,
        loaded: s.loaded,
        loading: s.loading,
        visible: s.visible,
        opacity: s.opacity,
        step: s.step,
        pbrColor: s.config.pbrColor,
        credit: s.config.credit,
        skeletonOnly: s.config.skeletonOnly || false
      };
    }
    return state;
  }

  /**
   * Carica tutti i modelli configurati all'avvio in sequenza ordinata,
   * garantendo che tutte le texture e materiali siano compilati nella GPU.
   */
  async initInitialLayers(onProgressAll, onCompleteAll) {
    const initialConfigs = SYSTEM_CONFIGS.filter(c => c.initialLoad);
    const total = initialConfigs.length;

    for (let i = 0; i < total; i++) {
      const conf = initialConfigs[i];
      await new Promise((resolve) => {
        this.loadSystem(
          conf.id,
          (percent) => {
            if (onProgressAll) onProgressAll(conf.id, percent, i + 1, total, conf.name);
          },
          () => {
            if (onProgressAll) onProgressAll(conf.id, 100, i + 1, total, conf.name);
            resolve();
          },
          (err) => {
            console.error(`Errore nel caricamento di ${conf.fileName}:`, err);
            resolve();
          }
        );
      });
    }

    if (onCompleteAll) onCompleteAll();
  }

  /**
   * Carica un modello .glb on-demand (o all'avvio)
   */
  loadSystem(systemId, onProgress, onSuccess, onError) {
    const sys = this.systems[systemId];
    if (!sys) return;

    if (sys.loaded) {
      sys.visible = true;
      if (sys.group) sys.group.visible = true;
      this.applySystemOpacity(sys);
      this.notifyStateChange();
      if (onSuccess) onSuccess(sys.group);
      return;
    }

    if (sys.loading) return;

    sys.loading = true;
    this.notifyStateChange();

    const fileName = sys.config.fileName;
    const primaryPath = `./gib/${fileName}`;
    const fallbackPath = `./glb/${fileName}`;

    const handleModelLoaded = (gltf) => {
      const model = gltf.scene;
      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);
      model.scale.set(1, 1, 1);

      sys.meshParts = [];
      this.processModelMeshes(model, sys);
      this.applySystemOpacity(sys);

      this.rootGroup.add(model);
      model.visible = sys.visible;

      sys.group = model;
      sys.loaded = true;
      sys.loading = false;

      this.notifyStateChange();
      if (onSuccess) onSuccess(model);
    };

    this.loader.load(
      primaryPath,
      handleModelLoaded,
      (xhr) => { if (onProgress && xhr.total > 0) onProgress((xhr.loaded / xhr.total) * 100); },
      () => {
        this.loader.load(
          fallbackPath,
          handleModelLoaded,
          (xhr) => { if (onProgress && xhr.total > 0) onProgress((xhr.loaded / xhr.total) * 100); },
          (err2) => {
            console.error(`Impossibile caricare ${fileName}:`, err2);
            sys.loading = false;
            sys.visible = false;
            this.notifyStateChange();
            if (onError) onError(err2);
          }
        );
      }
    );
  }

  /**
   * Filtro di pertinenza anatomica:
   * I file Z-Anatomy contengono mesh cumulative di altri apparati.
   * Questo metodo esclude i duplicati alieni, mantenendo solo le strutture proprie di ciascun apparato.
   */
  isMeshPertinentToSystem(child, config) {
    const matName = (Array.isArray(child.material)
      ? child.material[0]?.name
      : child.material?.name) || '';
    const meshName = child.name || '';
    const mLow = matName.toLowerCase();
    const nLow = meshName.toLowerCase();

    switch (config.id) {
      case 'scheletrico':
        return true;

      case 'giunture':
        if (mLow.includes('bone') || mLow.includes('suture') || mLow.includes('teeth') || mLow.includes('dentine')) {
          return false;
        }
        return mLow.includes('cartilage') || mLow.includes('ligament') ||
               mLow.includes('articular capsule') || mLow.includes('fat') ||
               nLow.includes('ligament') || nLow.includes('cartilage') || nLow.includes('capsule');

      case 'inserzioni_muscolari':
        if (mLow.includes('bone') || mLow.includes('suture') || mLow.includes('teeth') ||
            mLow.includes('dentine') || mLow.includes('cartilage') || mLow.includes('ligament')) {
          return false;
        }
        return mLow.includes('origin') || mLow.includes('end-') ||
               mLow.includes('muscular') || mLow.includes('mastication') ||
               nLow.includes('origin') || nLow.includes('insertion');

      case 'muscolare':
        if (mLow.includes('bone') || mLow.includes('teeth')) return false;
        return true;

      case 'visceri':
        if (mLow.includes('bone') || mLow.includes('teeth')) return false;
        return true;

      case 'sistema_circolatorio':
        if (mLow.includes('bone') || mLow.includes('suture') || mLow.includes('teeth') ||
            mLow.includes('origin') || mLow.includes('end-') || mLow.includes('ligament') ||
            mLow.includes('cartilage') || mLow.includes('trapezius') || mLow.includes('fat')) {
          return false;
        }
        return mLow.includes('artery') || mLow.includes('vein') || mLow.includes('pulmonary') ||
               nLow.includes('artery') || nLow.includes('vein') || nLow.includes('aorta') ||
               nLow.includes('atrium') || nLow.includes('ventricle') || nLow.includes('valv') ||
               nLow.includes('septum') || nLow.includes('heart') || nLow.includes('papillary');

      case 'sistema_linfatico':
        if (mLow.includes('artery') || mLow.includes('vein') || mLow.includes('pulmonary') ||
            mLow.includes('bone') || mLow.includes('suture') || mLow.includes('teeth') ||
            mLow.includes('origin') || mLow.includes('end-') || mLow.includes('ligament') ||
            mLow.includes('cartilage') || mLow.includes('trapezius')) {
          return false;
        }
        return mLow.includes('lymph') || mLow.includes('gland') ||
               nLow.includes('lymph') || nLow.includes('node') || nLow.includes('duct') ||
               nLow.includes('spleen') || nLow.includes('thymus') || nLow.includes('cisterna');

      case 'sistema_nervoso':
        if (mLow.includes('artery') || mLow.includes('vein') || mLow.includes('pulmonary') ||
            mLow.includes('lymph') || mLow.includes('bone') || mLow.includes('suture') ||
            mLow.includes('teeth') || mLow.includes('origin') || mLow.includes('end-') ||
            mLow.includes('ligament') || mLow.includes('cartilage') || mLow.includes('trapezius')) {
          return false;
        }
        return mLow.includes('nerve') || mLow.includes('brain') || mLow.includes('cerebell') ||
               mLow.includes('white matter') || mLow.includes('frontal') || mLow.includes('insula') ||
               mLow.includes('limbic') || mLow.includes('occipital') || mLow.includes('parietal') ||
               mLow.includes('temporal') || mLow.includes('nucleus') || mLow.includes('lcr') ||
               mLow.includes('eye') || mLow.includes('iris') || mLow.includes('cornea') ||
               nLow.includes('nerve') || nLow.includes('brain') || nLow.includes('cerebell') ||
               nLow.includes('cord') || nLow.includes('cortex') || nLow.includes('ganglion') ||
               nLow.includes('plexus') || nLow.includes('optic') || nLow.includes('thalamus') ||
               nLow.includes('tract') || nLow.includes('gyrus') || nLow.includes('sulcus') ||
               nLow.includes('lobe');

      case 'pelle_corpo_esterno':
        if (mLow.includes('bronchi') || mLow.includes('lung') || mLow.includes('intestine') ||
            mLow.includes('peritoneum') || mLow.includes('gallbladder') || mLow.includes('organ') ||
            mLow.includes('mucosa') || mLow.includes('ductus') || mLow.includes('nucleus') ||
            mLow.includes('ligament') || mLow.includes('cartilage') || mLow.includes('fascia')) {
          return false;
        }
        return mLow.includes('skin') || mLow.includes('black') || mLow.includes('nail') ||
               nLow.includes('hair') || nLow.includes('eyelash') || nLow.includes('eyebrow') ||
               nLow.includes('nail') || nLow.includes('head') || nLow.includes('region') ||
               nLow.includes('umbilicus');

      default:
        return true;
    }
  }

  processModelMeshes(model, sys) {
    const config = sys.config;
    let partIdx = 1;

    model.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;

      if (!child.name || child.name.trim() === '') {
        child.name = `${config.name} ${partIdx++}`;
      }

      // Filtra le mesh non pertinenti / duplicate
      const isPertinent = this.isMeshPertinentToSystem(child, config);
      if (!isPertinent) {
        child.visible = false;
        child.userData.excludeFromRaycast = true;
        return; // non registrare in meshParts
      }

      // Clona i materiali per isolarli e configurare texture/PBR
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map(m => {
            const c = m.clone();
            this.applyPBRCorrectionToMaterial(c, config, child);
            c.needsUpdate = true;
            return c;
          });
        } else {
          child.material = child.material.clone();
          this.applyPBRCorrectionToMaterial(child.material, config, child);
          child.material.needsUpdate = true;
        }
        child.userData.originalMaterial = child.material;
      }

      child.userData.systemId = config.id;
      child.userData.systemName = config.name;
      child.userData.meshData = getGenericPartData(child.name, child);
      child.userData.excludeFromRaycast = false;

      // Salva trasformazione iniziale per Reset (Tasto R)
      child.userData.initialTransform = {
        position: child.position.clone(),
        rotation: child.rotation.clone(),
        quaternion: child.quaternion.clone(),
        scale: child.scale.clone()
      };

      sys.meshParts.push(child);
    });
  }

  applyPBRCorrectionToMaterial(mat, config, mesh = null) {
    if (!mat) return;

    // Disattiva l'emissive bianco di default di Blender (1, 1, 1) per mostrare subito il colore reale PBR
    if (mat.emissive) {
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0.0;
    }

    const hasVertexColor = !!(mesh && mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes.color);
    const isPureWhite = !mat.map && mat.color &&
      mat.color.r >= 0.90 && mat.color.g >= 0.90 && mat.color.b >= 0.90;

    const matName = (mat.name || '').toLowerCase();

    // 1. Supporto Vertex Colors (es. Pelle Z-Anatomy con dettagli anatomici sfumati)
    if (hasVertexColor) {
      mat.vertexColors = true;
      mat.color.setHex(0xffffff); // Il bianco neutro preserva i colori del vertice senza scurirli
      mat.roughness = config.roughness || 0.50;
      mat.metalness = 0.0;
    } else if (config.id === 'pelle_corpo_esterno') {
      if (matName.includes('black') || matName.includes('hair')) {
        mat.color.setHex(0x221814); // Capelli, ciglia e sopracciglia scure
      } else if (matName.includes('nail')) {
        mat.color.setHex(0xe5b8a8); // Unghie
      } else {
        mat.color.setHex(config.pbrColor); // Incarnato realistico
      }
      mat.roughness = config.roughness;
      mat.metalness = 0.0;
    } else if (config.id === 'sistema_circolatorio') {
      if (matName.includes('artery') || matName.includes('pulmonary artery')) {
        mat.color.setHex(0xe11d48); // Rosso vivo arterioso
      } else if (matName.includes('vein') || matName.includes('pulmonary vein')) {
        mat.color.setHex(0x2563eb); // Blu vivo venoso
      } else {
        mat.color.setHex(0xb91c1c); // Cavità o tessuto cardiaco
      }
      mat.roughness = config.roughness || 0.35;
      mat.metalness = 0.0;
    } else if (config.id === 'sistema_linfatico') {
      mat.color.setHex(config.pbrColor); // Verde brillante linfatico
      mat.roughness = config.roughness || 0.40;
      mat.metalness = 0.0;
    } else if (config.id === 'sistema_nervoso') {
      if (matName.includes('nerve')) {
        mat.color.setHex(config.pbrColor); // Giallo anatomico per i nervi
      } else if (matName.includes('brain') || matName.includes('frontal') || matName.includes('cerebell') || matName.includes('lobe')) {
        mat.color.setHex(0xdfba9e); // Tessuto cerebrale e corteccia
      } else if (matName.includes('white matter')) {
        mat.color.setHex(0xf3ede2); // Sostanza bianca
      } else if (matName.includes('eye') || matName.includes('iris')) {
        mat.color.setHex(0x38bdf8); // Occhi
      } else {
        mat.color.setHex(config.pbrColor);
      }
      mat.roughness = config.roughness || 0.40;
      mat.metalness = 0.0;
    } else if (config.id === 'inserzioni_muscolari') {
      if (matName.includes('origin')) {
        mat.color.setHex(0xd93838); // Origini muscolari rosse
      } else if (matName.includes('end')) {
        mat.color.setHex(0x2563eb); // Inserzioni terminali blu
      } else {
        mat.color.setHex(config.pbrColor);
      }
      mat.roughness = config.roughness;
      mat.metalness = 0.0;
    } else if (config.preserveColors) {
      // Sistema muscolare e organi: preserva colori e texture originali Z-Anatomy
      mat.metalness = 0.0;
      mat.roughness = Math.max(mat.roughness || 0, 0.45);
      if (isPureWhite && config.pbrColor) {
        mat.color.setHex(config.pbrColor);
      }
    } else {
      // Scheletrico e giunture
      if (isPureWhite || mat.color.getHex() === 0xffffff || config.id === 'scheletrico' || config.id === 'giunture') {
        if (matName.includes('cartilage')) {
          mat.color.setHex(0xb5c9d6); // Azzurro cartilagine
        } else if (matName.includes('teeth')) {
          mat.color.setHex(0xf0ede6); // Denti
        } else {
          mat.color.setHex(config.pbrColor); // Avorio caldo per le ossa
        }
        mat.roughness = config.roughness;
        mat.metalness = config.metalness || 0.0;
      } else {
        mat.metalness = 0.0;
        mat.roughness = Math.max(mat.roughness || 0, 0.40);
      }
    }

    // Configurazione trasparenza e buffer di profondità
    if (config.id === 'pelle_corpo_esterno') {
      mat.transparent = true;
      mat.opacity = config.defaultOpacity;
      mat.depthWrite = false;
    } else {
      mat.transparent = false;
      mat.opacity = 1.0;
      mat.depthWrite = true;
    }

    if (mat.map) mat.map.needsUpdate = true;
    mat.needsUpdate = true;
  }

  /**
   * Imposta lo step discreto di visibilità/opacità di un apparato (non scheletrico).
   * step: 0=Off, 1=25%, 2=50%, 3=75%, 4=100%
   */
  setSystemStep(systemId, step) {
    const sys = this.systems[systemId];
    if (!sys || sys.config.skeletonOnly) return;

    const clampedStep = Math.max(0, Math.min(4, step));
    sys.step = clampedStep;
    const opacity = OPACITY_STEPS[clampedStep];
    sys.visible = (clampedStep > 0);
    sys.opacity = opacity;

    if (sys.visible && !sys.loaded && !sys.loading) {
      this.loadSystem(systemId);
      return;
    }

    if (sys.group) sys.group.visible = sys.visible;
    this.applySystemOpacity(sys);
    this.notifyStateChange();
  }

  setSystemVisibility(systemId, visible) {
    const sys = this.systems[systemId];
    if (!sys) return;

    sys.visible = visible;

    if (visible && !sys.loaded) {
      this.loadSystem(systemId);
    } else if (sys.group) {
      sys.group.visible = visible;
      this.notifyStateChange();
    } else {
      this.notifyStateChange();
    }
  }

  setSystemOpacity(systemId, opacity) {
    const sys = this.systems[systemId];
    if (!sys) return;
    sys.opacity = THREE.MathUtils.clamp(opacity, 0.0, 1.0);
    sys.step = opacityToStep(sys.opacity);
    this.applySystemOpacity(sys);
    this.notifyStateChange();
  }

  applySystemOpacity(sys) {
    if (!sys || !sys.meshParts) return;
    const op = sys.opacity;
    const isFullOpaque = (op >= 0.999);

    sys.meshParts.forEach(mesh => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach(mat => {
        if (!mat) return;
        if (isFullOpaque) {
          mat.transparent = false;
          mat.opacity = 1.0;
          mat.depthWrite = true;
        } else {
          mat.transparent = true;
          mat.opacity = op;
          mat.depthWrite = false;
        }
        mat.needsUpdate = true;
      });
    });
  }

  getIntersectableObjects() {
    const list = [];
    for (const sys of Object.values(this.systems)) {
      if (sys.loaded && sys.visible && sys.group && sys.opacity > 0.05) {
        list.push(...sys.meshParts.filter(m => !m.userData.excludeFromRaycast));
      }
    }
    return list;
  }

  highlightPart(partIdOrMesh, isSelected = false) {
    this.clearHighlight();

    let targetMesh = null;
    if (typeof partIdOrMesh === 'string') {
      for (const sys of Object.values(this.systems)) {
        const found = sys.meshParts.find(m =>
          m.name === partIdOrMesh || m.userData.meshData?.id === partIdOrMesh
        );
        if (found) { targetMesh = found; break; }
      }
    } else if (partIdOrMesh && partIdOrMesh.isMesh) {
      targetMesh = partIdOrMesh;
    }

    if (targetMesh && targetMesh.material) {
      this.selectedMesh = targetMesh;
      const mats = Array.isArray(targetMesh.material) ? targetMesh.material : [targetMesh.material];
      mats.forEach(mat => {
        if (mat && mat.emissive) {
          // Evidenziazione delicata, appena accennata (senza coprire il colore naturale del pezzo)
          // Selezione (click): azzurro cielo soffuso a intensità 0.12
          // Hover (passaggio mouse): chiarore leggerissimo a intensità 0.05
          mat.emissive.setHex(isSelected ? 0x38bdf8 : 0x00e5ff);
          mat.emissiveIntensity = isSelected ? 0.12 : 0.05;
          mat.needsUpdate = true;
        }
      });
    }
  }

  clearHighlight() {
    if (this.selectedMesh && this.selectedMesh.material) {
      const mats = Array.isArray(this.selectedMesh.material)
        ? this.selectedMesh.material
        : [this.selectedMesh.material];
      mats.forEach(mat => {
        if (mat && mat.emissive) {
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0.0;
          mat.needsUpdate = true;
        }
      });
    }
    this.selectedMesh = null;
  }

  resetAllTransforms() {
    let count = 0;
    for (const sys of Object.values(this.systems)) {
      if (sys.meshParts) {
        sys.meshParts.forEach(mesh => {
          if (mesh.userData.initialTransform) {
            mesh.position.copy(mesh.userData.initialTransform.position);
            mesh.rotation.copy(mesh.userData.initialTransform.rotation);
            mesh.quaternion.copy(mesh.userData.initialTransform.quaternion);
            mesh.scale.copy(mesh.userData.initialTransform.scale);
            count++;
          }
        });
      }
    }
    return count;
  }
}
