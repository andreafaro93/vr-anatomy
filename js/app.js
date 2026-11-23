import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

import { LabScene } from './lab-scene.js';
import { GLBModelLoader, SYSTEM_CONFIGS, OPACITY_STEPS } from './glb-loader.js';
import { VRLayersPanel, VRMedicalPanel } from './vr-ui-panel.js';
import { InteractionManager } from './interaction-manager.js';
import { cleanAnatomyName, fetchWikipediaIT } from './wikipedia-service.js';

/**
 * Controller Principale dell'Applicazione Anatomica Z-Anatomy 3D & WebXR
 */
class AnatomyVRApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.currentData = null;

    this.initThree();
    this.initModules();
    this.initUI();
    this.initSpeechSynthesis();
    this.initTutorial();

    // Avvia il caricamento dei 3 modelli prioritari
    this.startInitialLoad();

    // Loop di rendering compatibile con WebXR
    this.renderer.setAnimationLoop((time, frame) => this.renderLoop(time, frame));
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060b14);
    this.scene.fog = new THREE.FogExp2(0x060b14, 0.07);

    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 50);
    this.camera.position.set(0, 1.15, 2.15);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.xr.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    const vrBtn = VRButton.createButton(this.renderer);
    document.body.appendChild(vrBtn);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 0.90, 0);
    this.controls.minDistance = 0.35;
    this.controls.maxDistance = 5.5;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.08;
    this.controls.update();

    this.renderer.xr.addEventListener('sessionstart', () => {
      this.controls.enabled = false;
      document.body.classList.add('in-vr');
      if (this.vrLayersPanel) this.vrLayersPanel.group.visible = true;
      if (this.vrMedicalPanel) this.vrMedicalPanel.group.visible = true;
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      this.controls.enabled = true;
      document.body.classList.remove('in-vr');
      if (this.vrLayersPanel) this.vrLayersPanel.group.visible = false;
      if (this.vrMedicalPanel) this.vrMedicalPanel.group.visible = false;
    });

    window.addEventListener('resize', () => this.onWindowResize());
  }

  initModules() {
    this.lab = new LabScene(this.scene);
    const originPos = this.lab.getPedestalTopPosition();

    this.glbLoader = new GLBModelLoader(this.scene, originPos);

    this.vrLayersPanel = new VRLayersPanel(this.scene, this.glbLoader);
    this.vrMedicalPanel = new VRMedicalPanel(this.scene);
    this.vrLayersPanel.medicalPanel = this.vrMedicalPanel;

    // Nascondi pannelli VR 3D su desktop
    this.vrLayersPanel.group.visible = false;
    this.vrMedicalPanel.group.visible = false;

    this.interaction = new InteractionManager(
      this.renderer,
      this.scene,
      this.camera,
      this.controls,
      (data, mesh) => this.selectPart(data, mesh),
      () => this.resetTransforms()
    );

    this.interaction.addIntersectableProvider(this.glbLoader);
    this.interaction.addUIInteractable(this.vrLayersPanel.panelMesh);
    this.interaction.addUIInteractable(this.vrMedicalPanel.panelMesh);

    this.glbLoader.setStateChangeCallback(() => {
      this.updateUIFromState();
    });
  }

  startInitialLoad() {
    const loaderElem = document.getElementById('initial-loader');
    const subtitleElem = document.getElementById('loader-subtitle');
    const progressBar = document.getElementById('loader-progress-bar');

    this.glbLoader.initInitialLayers(
      (systemId, percent, currentIdx, totalCount, systemName) => {
        if (subtitleElem) {
          subtitleElem.textContent = `Caricamento ${systemName || systemId} (${currentIdx}/${totalCount}): ${Math.round(percent)}%...`;
        }
        if (progressBar) {
          const overallProgress = ((currentIdx - 1) / totalCount) * 100 + (percent / totalCount);
          progressBar.style.width = `${Math.min(100, Math.round(overallProgress))}%`;
        }
      },
      () => {
        if (subtitleElem) subtitleElem.textContent = 'Ottimizzazione texture e compilazione shader 3D...';
        if (progressBar) progressBar.style.width = '100%';

        // Pre-compila gli shader e le texture nella GPU per eliminare ogni scatto
        if (this.renderer && this.scene && this.camera) {
          try {
            this.renderer.compile(this.scene, this.camera);
          } catch (e) {
            console.warn('Compilazione GPU:', e);
          }
        }

        setTimeout(() => {
          if (loaderElem) loaderElem.classList.add('hidden');
          this.updateUIFromState();
        }, 350);
      }
    );
  }

  initUI() {
    const listContainer = document.getElementById('layers-list');
    listContainer.innerHTML = '';

    const STEP_LABELS = ['Off', '25%', '50%', '75%', '100%'];

    SYSTEM_CONFIGS.forEach((conf) => {
      const item = document.createElement('div');
      item.className = 'layer-item';
      item.id = `layer-item-${conf.id}`;

      const hexColor = `#${conf.pbrColor ? conf.pbrColor.toString(16).padStart(6, '0') : '00e5ff'}`;
      const initStep = conf.defaultVisible
        ? (conf.id === 'pelle_corpo_esterno' ? 1 : 4)
        : 0;
      const initLabel = STEP_LABELS[initStep];

      // Controllo step per tutti tranne scheletrico
      const stepControlHTML = conf.id === 'scheletrico' ? '' : `
        <div class="step-control">
          <button class="step-btn step-minus" data-system="${conf.id}" title="Riduci opacità">−</button>
          <span class="step-label" id="step-label-${conf.id}">${initLabel}</span>
          <button class="step-btn step-plus" data-system="${conf.id}" title="Aumenta opacità">+</button>
        </div>`;

      item.innerHTML = `
        <div class="layer-item-top">
          <label class="layer-label" for="toggle-${conf.id}">
            <span class="color-dot" style="background-color: ${hexColor}; color: ${hexColor};"></span>
            <span>${conf.name}</span>
          </label>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="layer-status ${conf.defaultVisible ? 'status-loaded' : 'status-ready'}" id="status-${conf.id}">
              ${conf.defaultVisible ? 'Attivo' : 'Pronto'}
            </span>
            <label class="switch">
              <input type="checkbox" id="toggle-${conf.id}" ${conf.defaultVisible ? 'checked' : ''} data-system="${conf.id}">
              <span class="slider-switch"></span>
            </label>
          </div>
        </div>
        ${stepControlHTML}
      `;

      listContainer.appendChild(item);

      // Toggle listener: all'attivazione mostra subito l'apparato precaricato
      const toggleInput = item.querySelector(`#toggle-${conf.id}`);
      toggleInput.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        if (conf.id === 'scheletrico') {
          this.glbLoader.setSystemVisibility(conf.id, isChecked);
        } else {
          // Toggle: se ON → imposta a 100% (o 25% per pelle), se OFF → step 0 (Off)
          const onStep = conf.id === 'pelle_corpo_esterno' ? 1 : 4;
          this.glbLoader.setSystemStep(conf.id, isChecked ? onStep : 0);
        }
      });

      // Step buttons (non scheletrico)
      if (conf.id !== 'scheletrico') {
        const minusBtn = item.querySelector(`.step-minus[data-system="${conf.id}"]`);
        const plusBtn = item.querySelector(`.step-plus[data-system="${conf.id}"]`);

        minusBtn.addEventListener('click', () => {
          const sys = this.glbLoader.systems[conf.id];
          if (sys) this.glbLoader.setSystemStep(conf.id, (sys.step || 0) - 1);
        });

        plusBtn.addEventListener('click', () => {
          const sys = this.glbLoader.systems[conf.id];
          if (sys) this.glbLoader.setSystemStep(conf.id, (sys.step || 0) + 1);
        });
      }
    });

    // "Ripristina (R)" nel pannello sinistro
    const resetPosBtn = document.getElementById('btn-quick-reset-pos');
    if (resetPosBtn) {
      resetPosBtn.addEventListener('click', () => this.resetTransforms());
    }

    // "Tutti ON"
    document.getElementById('btn-quick-all').addEventListener('click', () => {
      SYSTEM_CONFIGS.forEach(c => {
        if (c.id === 'scheletrico') {
          this.glbLoader.setSystemVisibility(c.id, true);
        } else {
          this.glbLoader.setSystemStep(c.id, 4);
        }
      });
    });

    // "Reset" configurazione iniziale
    document.getElementById('btn-quick-reset').addEventListener('click', () => {
      SYSTEM_CONFIGS.forEach(c => {
        if (c.id === 'scheletrico') {
          this.glbLoader.setSystemVisibility(c.id, c.defaultVisible);
        } else {
          const initStep = c.defaultVisible
            ? (c.id === 'pelle_corpo_esterno' ? 1 : 4)
            : 0;
          this.glbLoader.setSystemStep(c.id, initStep);
        }
      });
    });

    // Tasto R da tastiera → ripristina posizioni
    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') {
        this.resetTransforms();
      }
    });
  }

  updateUIFromState() {
    const states = this.glbLoader.getSystemsState();
    const STEP_LABELS = ['Off', '25%', '50%', '75%', '100%'];

    for (const [id, s] of Object.entries(states)) {
      const toggle = document.getElementById(`toggle-${id}`);
      const statusElem = document.getElementById(`status-${id}`);
      const stepLabel = document.getElementById(`step-label-${id}`);
      const itemRow = document.getElementById(`layer-item-${id}`);

      if (toggle) toggle.checked = s.visible;
      if (itemRow) itemRow.classList.toggle('active', s.visible);

      if (statusElem) {
        if (s.loading) {
          statusElem.textContent = 'Caricamento...';
          statusElem.className = 'layer-status status-loading';
        } else if (s.loaded) {
          if (s.visible) {
            statusElem.textContent = 'Attivo';
            statusElem.className = 'layer-status status-loaded';
          } else {
            statusElem.textContent = 'Pronto';
            statusElem.className = 'layer-status status-ready';
          }
        } else {
          statusElem.textContent = 'Pronto';
          statusElem.className = 'layer-status status-ready';
        }
      }

      // Aggiorna label step (non scheletrico)
      if (stepLabel && s.step !== undefined) {
        stepLabel.textContent = STEP_LABELS[Math.max(0, Math.min(4, s.step))];
      }
    }
  }

  resetTransforms() {
    this.glbLoader.resetAllTransforms();
    // Feedback visivo sul pulsante Ripristina (R)
    const btn = document.getElementById('btn-quick-reset-pos');
    if (btn) {
      const origText = btn.textContent;
      btn.textContent = '✓ Ripristinato!';
      setTimeout(() => { btn.textContent = origText; }, 1600);
    }
  }

  async selectPart(data, mesh = null) {
    if (!data) return;
    this.currentData = data;

    // 1. Aggiorna HUD con stato iniziale
    document.getElementById('panel-system').textContent = (data.system || 'Z-ANATOMY').toUpperCase();
    document.getElementById('panel-name').textContent = data.name || 'Componente';
    document.getElementById('panel-wiki-desc').textContent = 'Ricerca su Wikipedia in italiano...';
    document.getElementById('panel-description').textContent = 'Caricamento riassunto da Wikipedia...';

    const wikiBtn = document.getElementById('btn-open-wikipedia');
    if (wikiBtn) wikiBtn.style.display = 'none';

    // 2. Evidenzia la mesh
    if (this.glbLoader) {
      this.glbLoader.highlightPart(mesh || data.id, true);
    }

    // 3. Pulisce il nome e interroga Wikipedia IT
    const cleanedName = cleanAnatomyName(data.name);
    const wikiData = await fetchWikipediaIT(cleanedName);

    if (wikiData && this.currentData === data) {
      this.currentData.description = wikiData.extract;
      this.currentData.wikiUrl = wikiData.wikiUrl;

      // Titolo principale: italiano se disponibile, altrimenti inglese
      const mainTitle = wikiData.titleIT || wikiData.titleEN || cleanedName;
      // Sottotitolo: nome EN tra parentesi se titolo IT presente
      const subTitle = wikiData.titleIT && wikiData.titleEN
        ? `(${wikiData.titleEN})`
        : (data.name !== mainTitle ? data.name : '');

      document.getElementById('panel-name').textContent = mainTitle;
      document.getElementById('panel-wiki-desc').textContent = subTitle;
      document.getElementById('panel-description').textContent = wikiData.extract;

      if (wikiBtn) {
        wikiBtn.style.display = 'flex';
        wikiBtn.onclick = () => window.open(wikiData.wikiUrl, '_blank');
      }

      // Aggiorna pannello 3D VR
      if (this.vrMedicalPanel) {
        this.vrMedicalPanel.updatePanel({
          name: mainTitle,
          titleEN: wikiData.titleIT ? wikiData.titleEN : null,
          system: data.system,
          extract: wikiData.extract,
          wikiUrl: wikiData.wikiUrl,
          language: wikiData.language
        });
      }
    }
  }

  initSpeechSynthesis() {
    const ttsBtn = document.getElementById('btn-tts');
    if (!('speechSynthesis' in window)) {
      ttsBtn.style.display = 'none';
      return;
    }

    ttsBtn.addEventListener('click', () => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        ttsBtn.innerHTML = '<span>🔊</span> Ascolta Descrizione';
        return;
      }

      if (!this.currentData) return;

      const title = document.getElementById('panel-name').textContent;
      const desc = document.getElementById('panel-description').textContent;
      const textToSpeak = `${title}. ${desc}`;

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'it-IT';
      utterance.rate = 1.0;

      ttsBtn.innerHTML = '<span>⏹️</span> Ferma Lettura';

      utterance.onend = () => { ttsBtn.innerHTML = '<span>🔊</span> Ascolta Descrizione'; };
      utterance.onerror = () => { ttsBtn.innerHTML = '<span>🔊</span> Ascolta Descrizione'; };

      window.speechSynthesis.speak(utterance);
    });
  }

  detectDevice() {
    // 1. Visore VR WebXR attivo
    if (this.renderer && this.renderer.xr && this.renderer.xr.isPresenting) {
      return 'vr';
    }
    // 2. Dispositivo Touchscreen (smartphone, tablet o display touch)
    const isTouch = ('ontouchstart' in window) ||
                    (navigator.maxTouchPoints > 0) ||
                    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (isTouch && window.innerWidth <= 1024) {
      return 'touch';
    }
    // 3. Mouse & Tastiera (PC Desktop)
    return 'mouse';
  }

  initTutorial() {
    const btnTutorial = document.getElementById('btn-tutorial');
    const modal = document.getElementById('tutorial-modal');
    const closeBtn = document.getElementById('tutorial-close-btn');
    const okBtn = document.getElementById('tutorial-ok-btn');
    const backdrop = document.getElementById('tutorial-backdrop');
    const tabs = document.querySelectorAll('.tutorial-tab');

    if (!btnTutorial || !modal) return;

    const openTutorial = (preferredDevice = null) => {
      const detected = preferredDevice || this.detectDevice();

      // Mostra il badge 'Rilevato' sul tab corrispondente al dispositivo rilevato
      document.querySelectorAll('.detected-badge').forEach(b => b.classList.remove('visible'));
      const activeBadge = document.getElementById(`badge-detected-${detected}`);
      if (activeBadge) activeBadge.classList.add('visible');

      // Seleziona il tab e il relativo pannello
      this.switchTutorialTab(detected);

      // Mostra il modal animato
      modal.classList.remove('hidden');
    };

    const closeTutorial = () => {
      modal.classList.add('hidden');
    };

    btnTutorial.addEventListener('click', () => openTutorial());
    if (closeBtn) closeBtn.addEventListener('click', closeTutorial);
    if (okBtn) okBtn.addEventListener('click', closeTutorial);
    if (backdrop) backdrop.addEventListener('click', closeTutorial);

    // Navigazione manuale tra le schede (Mouse, Touch, Visore VR)
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-target');
        this.switchTutorialTab(target);
      });
    });

    // Scorciatoie: Tasto Escape chiude, tasto H o ? apre/chiude
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeTutorial();
      } else if ((e.key === 'h' || e.key === 'H' || e.key === '?') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
        if (modal.classList.contains('hidden')) {
          openTutorial();
        } else {
          closeTutorial();
        }
      }
    });
  }

  switchTutorialTab(device) {
    const tabs = document.querySelectorAll('.tutorial-tab');
    const panes = document.querySelectorAll('.tutorial-pane');

    tabs.forEach(tab => {
      const isTarget = tab.getAttribute('data-target') === device;
      tab.classList.toggle('active', isTarget);
    });

    panes.forEach(pane => {
      const isTarget = pane.id === `pane-${device}`;
      pane.classList.toggle('hidden', !isTarget);
    });
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  renderLoop(time, frame) {
    const timeSec = time * 0.001;
    this.lab.update(timeSec);
    this.interaction.update(timeSec);

    if (!this.renderer.xr.isPresenting) {
      if (this.controls.enabled) this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new AnatomyVRApp();
});
