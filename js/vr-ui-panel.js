import * as THREE from 'three';
import { SYSTEM_CONFIGS, OPACITY_STEPS } from './glb-loader.js';

/**
 * Pannelli 3D immersivi per WebXR:
 * 1. VRLayersPanel (a sinistra): Controllo interattivo con toggle + step opacità + credits
 * 2. VRMedicalPanel (a destra): Scheda anatomica della struttura selezionata (Wikipedia IT)
 */

const STEP_LABELS = ['Off', '25%', '50%', '75%', '100%'];

export class VRLayersPanel {
  constructor(scene, glbLoader) {
    this.scene = scene;
    this.glbLoader = glbLoader;

    this.canvasWidth = 1024;
    this.canvasHeight = 1024;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    this.group = new THREE.Group();
    this.group.position.set(-0.95, 1.25, 0.25);
    this.group.rotation.set(0, Math.PI / 4.8, 0);

    this.buttonHitRegions = [];

    this.initMesh();
    this.render();
    this.scene.add(this.group);

    if (this.glbLoader) {
      this.glbLoader.setStateChangeCallback(() => this.render());
    }
  }

  initMesh() {
    const panelGeo = new THREE.PlaneGeometry(0.78, 0.78);
    const panelMat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.96,
      side: THREE.DoubleSide
    });
    this.panelMesh = new THREE.Mesh(panelGeo, panelMat);
    this.panelMesh.name = 'VRLayersPanelMesh';
    this.panelMesh.userData.isVRInteractiveUI = true;
    this.panelMesh.userData.panelInstance = this;
    this.group.add(this.panelMesh);

    const frameGeo = new THREE.PlaneGeometry(0.80, 0.80);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x070e1b, metalness: 0.7, roughness: 0.3 });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.z = -0.005;
    this.group.add(frameMesh);
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvasWidth;
    const h = this.canvasHeight;

    ctx.clearRect(0, 0, w, h);
    this.buttonHitRegions = [];

    // Sfondo
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#091322');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.roundRect(10, 10, w - 20, h - 20, 24);
    ctx.fill();

    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 4;
    ctx.roundRect(10, 10, w - 20, h - 20, 24);
    ctx.stroke();

    // Titolo
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText('🫀 APPARATI ANATOMICI (9 STRATI)', 36, 56);

    // Pulsante Tutorial VR in alto a destra
    const tutX = 770, tutY = 32, tutW = 210, tutH = 50;
    ctx.fillStyle = '#0f172a';
    ctx.roundRect(tutX, tutY, tutW, tutH, 10);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('📘 GUIDA VR', tutX + 38, tutY + 33);

    this.buttonHitRegions.push({
      type: 'tutorial',
      x: tutX,
      y: tutY,
      w: tutW,
      h: tutH
    });

    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Punta il laser VR — premi il grilletto per attivare/regolare', 36, 84);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(36, 100);
    ctx.lineTo(w - 36, 100);
    ctx.stroke();

    const states = this.glbLoader ? this.glbLoader.getSystemsState() : {};
    let startY = 118;
    // 9 apparati + credits: calcola altezza riga
    // Scheletrico: solo toggle = riga più corta (60px), altri con step = 76px
    const rowHeightSkel = 60;
    const rowHeightStep = 76;

    SYSTEM_CONFIGS.forEach((conf, idx) => {
      const state = states[conf.id] || {
        visible: conf.defaultVisible,
        opacity: conf.defaultOpacity,
        step: conf.defaultVisible ? (conf.id === 'pelle_corpo_esterno' ? 1 : 4) : 0,
        loaded: conf.initialLoad,
        loading: false,
        skeletonOnly: conf.skeletonOnly || false
      };

      const rowH = conf.id === 'scheletrico' ? rowHeightSkel : rowHeightStep;
      const y = startY;
      startY += rowH;

      // Sfondo riga
      ctx.fillStyle = state.visible ? 'rgba(0, 229, 255, 0.07)' : 'rgba(255,255,255,0.02)';
      ctx.roundRect(30, y - 4, w - 60, rowH - 6, 10);
      ctx.fill();

      // Pallino colore
      ctx.fillStyle = `#${conf.pbrColor ? conf.pbrColor.toString(16).padStart(6, '0') : '00e5ff'}`;
      ctx.beginPath();
      ctx.arc(56, y + 22, 9, 0, Math.PI * 2);
      ctx.fill();

      // Nome apparato
      ctx.fillStyle = state.visible ? '#ffffff' : '#94a3b8';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillText(conf.name, 78, y + 27);

      // Toggle ON/OFF
      const tX = 530, tY = y + 2, tW = 130, tH = 40;
      if (state.loading) {
        ctx.fillStyle = '#f59e0b';
        ctx.roundRect(tX, tY, tW, tH, 7);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillText('CARICAMENTO...', tX + 8, tY + 27);
      } else if (state.loaded && state.visible) {
        ctx.fillStyle = '#10b981';
        ctx.roundRect(tX, tY, tW, tH, 7);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 17px system-ui, sans-serif';
        ctx.fillText('✓ ATTIVO', tX + 22, tY + 27);
      } else if (state.loaded && !state.visible) {
        ctx.fillStyle = '#334155';
        ctx.roundRect(tX, tY, tW, tH, 7);
        ctx.fill();
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.fillText('NASCOSTO', tX + 18, tY + 26);
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.roundRect(tX, tY, tW, tH, 7);
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.fillText('PRONTO', tX + 28, tY + 26);
      }

      this.buttonHitRegions.push({ type: 'toggle', systemId: conf.id, x: tX, y: tY, w: tW, h: tH });

      // Controlli step (tutti tranne scheletrico)
      if (conf.id !== 'scheletrico') {
        const stepY = y + rowH - 42;
        const minusX = 680, plusX = 850, btnSz = 38;

        // Tasto −
        ctx.fillStyle = '#1e293b';
        ctx.roundRect(minusX, stepY, btnSz, btnSz, 19);
        ctx.fill();
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#00e5ff';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.fillText('−', minusX + 11, stepY + 28);

        this.buttonHitRegions.push({ type: 'step_minus', systemId: conf.id, x: minusX, y: stepY, w: btnSz, h: btnSz });

        // Label step centrale
        const curStep = Math.max(0, Math.min(4, state.step !== undefined ? state.step : 4));
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 17px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(STEP_LABELS[curStep], minusX + btnSz + 44, stepY + 26);
        ctx.textAlign = 'left';

        // Tasto +
        ctx.fillStyle = '#1e293b';
        ctx.roundRect(plusX, stepY, btnSz, btnSz, 19);
        ctx.fill();
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#00e5ff';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.fillText('+', plusX + 10, stepY + 28);

        this.buttonHitRegions.push({ type: 'step_plus', systemId: conf.id, x: plusX, y: stepY, w: btnSz, h: btnSz });
      }
    });

    // Credits
    const credY = startY + 4;
    ctx.fillStyle = '#0f172a';
    ctx.roundRect(30, credY, w - 60, h - credY - 20, 12);
    ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('MODELLI 3D (CC BY 4.0):', 50, credY + 28);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('Z-Anatomy — Creative Commons Attribution 4.0', 50, credY + 56);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Atlante anatomico libero. z-anatomy.net', 50, credY + 82);

    this.texture.needsUpdate = true;
  }

  handleLaserClick(uv) {
    if (!uv) return false;
    const px = uv.x * this.canvasWidth;
    const py = (1 - uv.y) * this.canvasHeight;

    for (const btn of this.buttonHitRegions) {
      if (px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h) {
        if (btn.type === 'tutorial') {
          if (this.medicalPanel && typeof this.medicalPanel.showVRTutorial === 'function') {
            this.medicalPanel.showVRTutorial();
          }
          return true;
        } else if (btn.type === 'toggle') {
          const sys = this.glbLoader.systems[btn.systemId];
          if (sys) {
            if (btn.systemId === 'scheletrico') {
              this.glbLoader.setSystemVisibility(btn.systemId, !sys.visible);
            } else {
              this.glbLoader.setSystemStep(btn.systemId, sys.visible ? 0 : 4);
            }
          }
        } else if (btn.type === 'step_minus') {
          const sys = this.glbLoader.systems[btn.systemId];
          if (sys) this.glbLoader.setSystemStep(btn.systemId, (sys.step || 0) - 1);
        } else if (btn.type === 'step_plus') {
          const sys = this.glbLoader.systems[btn.systemId];
          if (sys) this.glbLoader.setSystemStep(btn.systemId, (sys.step || 0) + 1);
        }
        this.render();
        return true;
      }
    }
    return false;
  }
}

/**
 * VRMedicalPanel: Scheda clinica con Wikipedia IT
 */
export class VRMedicalPanel {
  constructor(scene) {
    this.scene = scene;
    this.canvasWidth = 1024;
    this.canvasHeight = 800;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    this.group = new THREE.Group();
    this.group.position.set(0.95, 1.25, 0.25);
    this.group.rotation.set(0, -Math.PI / 4.8, 0);

    this.initMesh();
    this.renderDefaultMessage();
    this.scene.add(this.group);
  }

  initMesh() {
    const panelGeo = new THREE.PlaneGeometry(0.78, 0.61);
    const panelMat = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, opacity: 0.96, side: THREE.DoubleSide });
    this.panelMesh = new THREE.Mesh(panelGeo, panelMat);
    this.group.add(this.panelMesh);

    const frameGeo = new THREE.PlaneGeometry(0.80, 0.63);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x070e1b, metalness: 0.7, roughness: 0.3 });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.z = -0.005;
    this.group.add(frameMesh);
  }

  showVRTutorial() {
    this.renderDefaultMessage();
  }

  renderDefaultMessage() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    const bg = ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
    bg.addColorStop(0, '#091322');
    bg.addColorStop(1, '#020617');
    ctx.fillStyle = bg;
    ctx.roundRect(10, 10, this.canvasWidth - 20, this.canvasHeight - 20, 24);
    ctx.fill();

    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 4;
    ctx.roundRect(10, 10, this.canvasWidth - 20, this.canvasHeight - 20, 24);
    ctx.stroke();

    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText('📘 GUIDA COMANDI REALTÀ VIRTUALE (WebXR)', 40, 65);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 90);
    ctx.lineTo(this.canvasWidth - 40, 90);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.fillText('Come Muoversi e Interagire in VR', 40, 145);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('Punta il controller VR per interagire con il corpo umano:', 40, 185);

    ctx.fillStyle = '#1e293b';
    ctx.roundRect(40, 215, this.canvasWidth - 80, 480, 14);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const guideItems = [
      { key: '🔦 Puntatore Laser', desc: 'Punta su qualsiasi elemento anatomico o pulsante UI 3D' },
      { key: '✊ Trigger / Grip', desc: 'Tieni premuto per afferrare, staccare e muovere i pezzi' },
      { key: '💫 Rotazione Polso', desc: 'Mentre afferri una parte, ruota la mano per orientarla' },
      { key: '🕹️ Thumbstick', desc: 'Muovi avanti/indietro per avvicinare o allontanare il pezzo' },
      { key: '🔴 Tasto B o Y', desc: 'Premi per ripristinare all\'istante la posizione originale' },
      { key: '📖 Dati Wikipedia', desc: 'Un click seleziona la parte e ne mostra la scheda clinica' }
    ];

    let startY = 245;
    guideItems.forEach(item => {
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.fillText(item.key, 65, startY + 22);

      ctx.fillStyle = '#f1f5f9';
      ctx.font = '21px system-ui, sans-serif';
      ctx.fillText(item.desc, 65, startY + 50);

      startY += 72;
    });

    ctx.fillStyle = '#64748b';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Modelli Z-Anatomy — CC BY 4.0 International', 40, 755);

    this.texture.needsUpdate = true;
  }

  updatePanel(data) {
    if (!data) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    const bg = ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
    bg.addColorStop(0, '#091322');
    bg.addColorStop(1, '#020617');
    ctx.fillStyle = bg;
    ctx.roundRect(10, 10, this.canvasWidth - 20, this.canvasHeight - 20, 24);
    ctx.fill();

    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 5;
    ctx.roundRect(10, 10, this.canvasWidth - 20, this.canvasHeight - 20, 24);
    ctx.stroke();

    // Sistema
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(data.system ? data.system.toUpperCase() : 'Z-ANATOMY', 40, 60);

    // Titolo principale (IT se disponibile)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px system-ui, sans-serif';
    this.drawWrappedText(ctx, data.name || 'Componente', 40, 110, this.canvasWidth - 80, 48, 2);

    // Sottotitolo EN
    if (data.titleEN) {
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'italic 22px system-ui, sans-serif';
      ctx.fillText(`(${data.titleEN})`, 40, 165);
    }

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 185);
    ctx.lineTo(this.canvasWidth - 40, 185);
    ctx.stroke();

    // Box riassunto
    ctx.fillStyle = '#0f172a';
    ctx.roundRect(40, 200, this.canvasWidth - 80, 490, 12);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Badge lingua
    const langBadge = data.language === 'it'
      ? 'DESCRIZIONE ANATOMICA (WIKIPEDIA IT):'
      : 'DESCRIZIONE ANATOMICA (WIKIPEDIA EN):';
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(langBadge, 58, 240);

    // Testo estratto
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '23px system-ui, sans-serif';
    const summaryText = data.extract || 'Caricamento da Wikipedia...';
    this.drawWrappedText(ctx, summaryText, 58, 278, this.canvasWidth - 116, 34, 11);

    // Footer
    ctx.fillStyle = '#64748b';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Fonte: Wikipedia • B/Y per ripristinare le posizioni', 40, 745);

    this.texture.needsUpdate = true;
  }

  drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 8) {
    const words = text.split(' ');
    let line = '';
    let lineCount = 0;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      if (ctx.measureText(testLine).width > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
        lineCount++;
        if (lineCount >= maxLines - 1 && n < words.length - 1) {
          ctx.fillText(line + '...', x, y);
          return;
        }
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }
}
