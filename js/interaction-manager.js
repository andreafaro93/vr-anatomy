import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { cleanAnatomyName } from './wikipedia-service.js';

/**
 * Gestore avanzato delle interazioni:
 * - Desktop (Mouse): Clicca per selezionare; trascina tasto sinistro per ruotare sul baricentro (Box3);
 *   trascina tasto destro per spostare; rotellina per avvicinare/allontanare; OrbitControls disabilitato durante il drag.
 * - WebXR VR: Punta con il laser e tieni premuto Trigger o Grip per afferrare e spostare; ruota il polso per ruotare sul baricentro;
 *   muovi l'asse Y del thumbstick per allontanare/avvicinare lungo il raggio laser; tasto B/Y per ripristinare le posizioni.
 */
export class InteractionManager {
  constructor(renderer, scene, camera, controls, onSelectCallback, onResetTransformsCallback) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.onSelect = onSelectCallback;
    this.onResetTransforms = onResetTransformsCallback;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);
    this.prevMousePos = new THREE.Vector2();
    this.intersectableProviders = [];
    this.uiInteractables = [];

    this.hoveredObject = null;
    this.selectedMesh = null;

    // Stati di manipolazione Desktop
    this.isDraggingMesh = false;
    this.dragMode = null; // 'rotate' (LMB) o 'translate' (RMB)
    this.dragBaricenter = new THREE.Vector3();
    this.startMeshPos = new THREE.Vector3();
    this.startMeshQuat = new THREE.Quaternion();
    this.dragPlane = new THREE.Plane();
    this.startPlaneIntersection = new THREE.Vector3();

    // Supporto WebXR Controllers
    this.controllerFactory = new XRControllerModelFactory();
    this.controllers = [];
    this.controllerGrips = [];

    this.initDesktopEvents();
    this.initVREvents();
    this.initKeyboardEvents();
  }

  addIntersectableProvider(provider) {
    this.intersectableProviders.push(provider);
  }

  addUIInteractable(mesh) {
    if (mesh) {
      this.uiInteractables.push(mesh);
    }
  }

  getAllIntersectableObjects() {
    let list = [];
    for (const p of this.intersectableProviders) {
      if (typeof p.getIntersectableObjects === 'function') {
        list = list.concat(p.getIntersectableObjects());
      }
    }
    // Aggiungi elementi UI 3D interattivi esclusivamente durante la sessione VR
    if (this.renderer.xr.isPresenting && this.uiInteractables.length > 0) {
      list = list.concat(this.uiInteractables);
    }
    return list;
  }

  initKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
      // Tasto 'R' per ripristinare tutte le posizioni originali
      if (e.key === 'r' || e.key === 'R') {
        if (typeof this.onResetTransforms === 'function') {
          this.onResetTransforms();
        }
      }
    });
  }

  initDesktopEvents() {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointermove', (e) => {
      if (this.renderer.xr.isPresenting) return;
      const rect = dom.getBoundingClientRect();
      const currentMouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      this.mouse.copy(currentMouse);

      if (this.isDraggingMesh && this.selectedMesh) {
        this.handleDesktopDrag(e, currentMouse);
      } else {
        this.updateDesktopHover();
      }

      this.prevMousePos.set(e.clientX, e.clientY);
    });

    dom.addEventListener('pointerdown', (e) => {
      if (this.renderer.xr.isPresenting) return;
      this.prevMousePos.set(e.clientX, e.clientY);

      const targets = this.getAllIntersectableObjects();
      if (targets.length === 0) return;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(targets, true);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const hitMesh = hit.object;

        // Seleziona la mesh
        this.selectObject(hitMesh);

        // Prepara manipolazione (Tasto sinistro = rotazione, Tasto destro = traslazione)
        if (e.button === 0 || e.button === 2) {
          this.isDraggingMesh = true;
          this.dragMode = (e.button === 0) ? 'rotate' : 'translate';

          // Disabilita OrbitControls durante il drag per non muovere la camera
          if (this.controls) this.controls.enabled = false;

          // Calcola il baricentro geometrico tramite Box3
          const box = new THREE.Box3().setFromObject(hitMesh);
          box.getCenter(this.dragBaricenter);

          this.startMeshPos.copy(hitMesh.position);
          this.startMeshQuat.copy(hitMesh.quaternion);

          // Piano di traslazione ortogonale alla camera passante per il baricentro
          const camDir = new THREE.Vector3();
          this.camera.getWorldDirection(camDir);
          this.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), this.dragBaricenter);

          this.raycaster.ray.intersectPlane(this.dragPlane, this.startPlaneIntersection);
        }
      }
    });

    const endDrag = () => {
      if (this.isDraggingMesh) {
        this.isDraggingMesh = false;
        this.dragMode = null;
        if (this.controls) this.controls.enabled = true;
      }
    };

    dom.addEventListener('pointerup', endDrag);
    dom.addEventListener('pointerleave', () => {
      endDrag();
      this.mouse.set(-999, -999);
      this.clearHover();
    });

    // Disabilita menu contestuale per consentire il trascinamento col tasto destro
    dom.addEventListener('contextmenu', (e) => {
      if (this.selectedMesh) {
        e.preventDefault();
      }
    });

    // Rotellina del mouse: avvicina/allontana la mesh selezionata
    dom.addEventListener('wheel', (e) => {
      if (this.renderer.xr.isPresenting) return;
      if (this.selectedMesh) {
        // Se il cursore è sopra la mesh selezionata o la si sta trascinando
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.selectedMesh, true);
        if (intersects.length > 0 || this.isDraggingMesh) {
          e.preventDefault();
          const dollyDir = new THREE.Vector3().subVectors(this.selectedMesh.position, this.camera.position).normalize();
          const delta = -Math.sign(e.deltaY) * 0.04;
          this.selectedMesh.position.addScaledVector(dollyDir, delta);
        }
      }
    }, { passive: false });
  }

  handleDesktopDrag(e, currentMouse) {
    if (!this.selectedMesh) return;

    const deltaPixelX = e.clientX - this.prevMousePos.x;
    const deltaPixelY = e.clientY - this.prevMousePos.y;

    if (this.dragMode === 'rotate') {
      // Rotazione sul proprio baricentro (Box3)
      const rotSpeed = 0.008;

      // Rotazione yaw (asse orizzontale) e pitch (asse verticale della camera)
      const camUp = this.camera.up.clone().normalize();
      const camRight = new THREE.Vector3().crossVectors(this.camera.getWorldDirection(new THREE.Vector3()), camUp).normalize();

      const qYaw = new THREE.Quaternion().setFromAxisAngle(camUp, deltaPixelX * rotSpeed);
      const qPitch = new THREE.Quaternion().setFromAxisAngle(camRight, deltaPixelY * rotSpeed);

      const deltaQuat = new THREE.Quaternion().multiplyQuaternions(qYaw, qPitch);

      // Applica la rotazione alla posizione del mesh rispetto al baricentro
      const offset = new THREE.Vector3().subVectors(this.selectedMesh.position, this.dragBaricenter);
      offset.applyQuaternion(deltaQuat);
      this.selectedMesh.position.copy(this.dragBaricenter).add(offset);

      // Applica la rotazione all'orientamento del mesh
      this.selectedMesh.quaternion.premultiply(deltaQuat);

    } else if (this.dragMode === 'translate') {
      // Traslazione nello spazio parallela al piano della camera
      this.raycaster.setFromCamera(currentMouse, this.camera);
      const currentPlaneIntersection = new THREE.Vector3();

      if (this.raycaster.ray.intersectPlane(this.dragPlane, currentPlaneIntersection)) {
        const deltaMove = new THREE.Vector3().subVectors(currentPlaneIntersection, this.startPlaneIntersection);
        this.selectedMesh.position.copy(this.startMeshPos).add(deltaMove);
      }
    }
  }

  initVREvents() {
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      controller.userData.id = i;
      controller.userData.grabbedMesh = null;
      controller.userData.grabBaricenter = new THREE.Vector3();
      controller.userData.grabDistance = 1.0;
      controller.userData.startMeshPos = new THREE.Vector3();
      controller.userData.startMeshQuat = new THREE.Quaternion();
      controller.userData.startControllerPos = new THREE.Vector3();
      controller.userData.startControllerQuat = new THREE.Quaternion();
      controller.userData.lastBState = false;

      // Eventi presa VR: Trigger e Grip
      controller.addEventListener('selectstart', (e) => this.handleVRGrabStart(e.target));
      controller.addEventListener('selectend', (e) => this.handleVRGrabEnd(e.target));
      controller.addEventListener('squeezestart', (e) => this.handleVRGrabStart(e.target));
      controller.addEventListener('squeezeend', (e) => this.handleVRGrabEnd(e.target));

      this.scene.add(controller);

      // Raggio laser visivo
      const laser = this.createLaserPointer();
      controller.add(laser);
      controller.userData.laser = laser;

      // Reticolo d'impatto
      const reticle = this.createReticle();
      this.scene.add(reticle);
      controller.userData.reticle = reticle;

      this.controllers.push(controller);

      // Modello fisico 3D controller
      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(this.controllerFactory.createControllerModel(grip));
      this.scene.add(grip);
      this.controllerGrips.push(grip);
    }
  }

  createLaserPointer() {
    const length = 5;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -length)
    ]);
    const material = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      linewidth: 3,
      transparent: true,
      opacity: 0.8
    });
    const line = new THREE.Line(geometry, material);
    line.name = 'laserPointer';
    return line;
  }

  createReticle() {
    const ringGeo = new THREE.RingGeometry(0.012, 0.022, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const reticle = new THREE.Mesh(ringGeo, ringMat);
    reticle.visible = false;
    return reticle;
  }

  handleVRGrabStart(controller) {
    const targets = this.getAllIntersectableObjects();
    if (targets.length === 0) return;

    const tempMatrix = new THREE.Matrix4().identity().extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const intersects = this.raycaster.intersectObjects(targets, true);

    if (intersects.length > 0) {
      const hit = intersects[0];

      // Se ha colpito il pannello UI 3D dei 9 livelli
      if (hit.object.userData.isVRInteractiveUI) {
        const panel = hit.object.userData.panelInstance;
        if (panel && typeof panel.handleLaserClick === 'function') {
          panel.handleLaserClick(hit.uv);
          this.triggerHaptic(controller, 0.8, 60);
        }
        return;
      }

      // Altrimenti ha afferrato una parte anatomica
      const mesh = hit.object;
      this.selectObject(mesh);
      this.triggerHaptic(controller, 0.7, 70);

      controller.userData.grabbedMesh = mesh;

      // Baricentro calcolato tramite Box3
      const box = new THREE.Box3().setFromObject(mesh);
      box.getCenter(controller.userData.grabBaricenter);

      const ctrlWorldPos = new THREE.Vector3();
      controller.getWorldPosition(ctrlWorldPos);
      const ctrlWorldQuat = new THREE.Quaternion();
      controller.getWorldQuaternion(ctrlWorldQuat);

      controller.userData.startControllerPos.copy(ctrlWorldPos);
      controller.userData.startControllerQuat.copy(ctrlWorldQuat);
      controller.userData.startMeshPos.copy(mesh.position);
      controller.userData.startMeshQuat.copy(mesh.quaternion);

      // Distanza iniziale dal controller al baricentro della parte
      controller.userData.grabDistance = ctrlWorldPos.distanceTo(controller.userData.grabBaricenter);
    }
  }

  handleVRGrabEnd(controller) {
    if (controller.userData.grabbedMesh) {
      controller.userData.grabbedMesh = null;
      this.triggerHaptic(controller, 0.4, 40);
    }
  }

  triggerHaptic(controller, intensity = 0.6, durationMs = 60) {
    const session = this.renderer.xr.getSession();
    if (session && session.inputSources) {
      const inputSource = session.inputSources[controller.userData.id];
      if (inputSource && inputSource.gamepad && inputSource.gamepad.hapticActuators) {
        const actuator = inputSource.gamepad.hapticActuators[0];
        if (actuator && actuator.pulse) {
          actuator.pulse(intensity, durationMs);
        }
      }
    }
  }

  selectObject(mesh) {
    if (!mesh) return;

    this.selectedMesh = mesh;

    // Estrai e pulisci il nome anatomico
    const rawName = mesh.name || mesh.parent?.name || 'Struttura Anatomica';
    const cleanName = cleanAnatomyName(rawName);

    const data = {
      id: rawName,
      name: cleanName,
      rawName: rawName,
      system: mesh.userData.systemName || 'Z-Anatomy',
      mesh: mesh
    };

    if (typeof this.onSelect === 'function') {
      this.onSelect(data, mesh);
    }
  }

  update(time) {
    const isPresenting = this.renderer.xr.isPresenting;

    if (!isPresenting) {
      if (!this.isDraggingMesh) {
        this.updateDesktopHover();
      }
    } else {
      this.updateVRControllers();
    }
  }

  updateDesktopHover() {
    if (this.mouse.x === -999) return;

    const targets = this.getAllIntersectableObjects();
    if (targets.length === 0) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(targets, true);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      if (this.hoveredObject !== hit) {
        this.clearHover();
        this.hoveredObject = hit;
        this.applyHoverEffect(hit, true);
        document.body.style.cursor = 'pointer';
      }
    } else {
      if (this.hoveredObject) {
        this.clearHover();
        document.body.style.cursor = 'default';
      }
    }
  }

  updateVRControllers() {
    const targets = this.getAllIntersectableObjects();
    const tempMatrix = new THREE.Matrix4();
    const session = this.renderer.xr.getSession();

    for (const controller of this.controllers) {
      const laser = controller.userData.laser;
      const reticle = controller.userData.reticle;

      const ctrlWorldPos = new THREE.Vector3();
      controller.getWorldPosition(ctrlWorldPos);
      const ctrlWorldQuat = new THREE.Quaternion();
      controller.getWorldQuaternion(ctrlWorldQuat);

      // 1. Controllo pulsante B/Y per "Ripristina Posizioni" dal controller VR
      if (session && session.inputSources) {
        const inputSource = session.inputSources[controller.userData.id];
        const gp = inputSource?.gamepad;

        if (gp) {
          // B (controller dx) o Y (controller sx) tipicamente su buttons[4] o buttons[5]
          const isBPressed = (gp.buttons[4]?.pressed || gp.buttons[5]?.pressed || false);
          if (isBPressed && !controller.userData.lastBState) {
            if (typeof this.onResetTransforms === 'function') {
              this.onResetTransforms();
              this.triggerHaptic(controller, 0.9, 100);
            }
          }
          controller.userData.lastBState = isBPressed;

          // Asse Y del Thumbstick per avvicinare/allontanare il pezzo afferrato
          if (controller.userData.grabbedMesh) {
            const stickY = (gp.axes.length >= 4) ? gp.axes[3] : (gp.axes[1] || 0);
            if (Math.abs(stickY) > 0.15) {
              controller.userData.grabDistance += -stickY * 0.02;
              controller.userData.grabDistance = THREE.MathUtils.clamp(controller.userData.grabDistance, 0.15, 4.5);
            }
          }
        }
      }

      // 2. Manipolazione della mesh afferrata (spostamento nello spazio e rotazione sul baricentro)
      if (controller.userData.grabbedMesh) {
        const mesh = controller.userData.grabbedMesh;

        // Vettore direzione in avanti del controller
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(ctrlWorldQuat);
        const targetBaricenter = ctrlWorldPos.clone().addScaledVector(forward, controller.userData.grabDistance);

        // Delta rotazione del polso dal momento della presa
        const invStartCtrlQuat = controller.userData.startControllerQuat.clone().invert();
        const deltaQuat = ctrlWorldQuat.clone().multiply(invStartCtrlQuat);

        // Nuova rotazione della mesh
        mesh.quaternion.copy(deltaQuat).multiply(controller.userData.startMeshQuat);

        // Calcola la posizione della mesh attorno al baricentro ruotato
        const origOffset = new THREE.Vector3().subVectors(controller.userData.startMeshPos, controller.userData.grabBaricenter);
        const rotatedOffset = origOffset.applyQuaternion(deltaQuat);
        mesh.position.copy(targetBaricenter).add(rotatedOffset);

        laser.scale.z = controller.userData.grabDistance / 5;
        reticle.visible = true;
        reticle.position.copy(targetBaricenter);
        reticle.quaternion.copy(this.camera.quaternion);

        continue;
      }

      // 3. Puntamento laser standard se non sta afferrando nulla
      tempMatrix.identity().extractRotation(controller.matrixWorld);
      this.raycaster.ray.origin.copy(ctrlWorldPos);
      this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

      const intersects = this.raycaster.intersectObjects(targets, true);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const distance = hit.distance;

        laser.scale.z = distance / 5;
        reticle.visible = true;
        reticle.position.copy(hit.point);
        reticle.quaternion.copy(this.camera.quaternion);

        this.applyHoverEffect(hit.object, true);
      } else {
        laser.scale.z = 1;
        reticle.visible = false;
        this.clearHover();
      }
    }
  }

  applyHoverEffect(object, isHovered) {
    if (!object || !object.material || object.userData.isVRInteractiveUI) return;

    for (const p of this.intersectableProviders) {
      if (typeof p.highlightPart === 'function') {
        p.highlightPart(object, object === this.selectedMesh);
        return;
      }
    }

    if (isHovered && object.material.emissive) {
      object.material.emissive.setHex(object === this.selectedMesh ? 0x38bdf8 : 0x00e5ff);
      object.material.emissiveIntensity = object === this.selectedMesh ? 0.12 : 0.05;
      object.material.needsUpdate = true;
    }
  }

  clearHover() {
    if (this.hoveredObject) {
      if (this.hoveredObject.material && this.hoveredObject !== this.selectedMesh) {
        const mats = Array.isArray(this.hoveredObject.material)
          ? this.hoveredObject.material
          : [this.hoveredObject.material];
        mats.forEach(mat => {
          if (mat && mat.emissive) {
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0.0;
            mat.needsUpdate = true;
          }
        });
      }
      this.hoveredObject = null;
    }

    for (const p of this.intersectableProviders) {
      if (typeof p.clearHighlight === 'function') {
        p.clearHighlight();
        if (this.selectedMesh && typeof p.highlightPart === 'function') {
          p.highlightPart(this.selectedMesh, true);
        }
      }
    }
  }
}
