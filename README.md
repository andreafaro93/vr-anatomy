#**Prototipo didattico in versione Alpha**
# Web App 3D e VR per l'Anatomia Umana (Z-Anatomy 9 Livelli)

Applicazione interattiva per l'esplorazione, la dissezione virtuale e la manipolazione 3D del corpo umano in **3D e Realtà Virtuale (WebXR)**, basata sui modelli anatomici open-source di **Z-Anatomy (CC BY 4.0)**, integrata con l'**API REST pubblica di Wikipedia**, sviluppata interamente con **Three.js (tramite CDN con `importmap`)** e WebXR, **senza alcuna dipendenza Node.js**.

---

## 🚀 Come Avviare l'Applicazione

### Metodo 1: Doppio Click (Windows) - Consigliato
Fai doppio click sul file:
👉 **`avvia-laboratorio.bat`**
Questo avvierà un server locale leggero nativo in PowerShell (zero installazioni) e aprirà automaticamente il browser su `http://localhost:8080/`.

### Metodo 2: Estensione "Live Server" (VS Code)
Se utilizzi Visual Studio Code, fai click con il tasto destro su `index.html` e seleziona **"Open with Live Server"**.

### Metodo 3: Qualsiasi server HTTP locale
Puoi avviare qualsiasi server statico nella cartella `vr-anatomy`:
- Con Python: `python -m http.server 8080`
- Con Node/npx: `npx serve .`

---

## 🎮 Funzionalità di Manipolazione 3D (VR e Mouse)

Ogni singola mesh anatomica visibile può essere afferrata, estratta, spostata e ruotata:

### 🖱️ Su Desktop (Mouse)
- **Click**: Seleziona ed evidenzia la parte.
- **Trascina Tasto Sinistro (LMB)** sopra la mesh selezionata: Ruota liberamente la parte sul proprio baricentro geometrico calcolato dinamicamente tramite `Box3`.
- **Trascina Tasto Destro (RMB)**: Sposta e trasla la parte nello spazio parallelamente alla visuale.
- **Rotellina (Scroll Wheel)**: Avvicina o allontana la parte lungo l'asse della camera.
- *OrbitControls viene temporaneamente disabilitato durante il drag per non muovere la visuale.*
- **Tasto `R` da tastiera**: Ripristina istantaneamente tutte le parti spostate alla loro posizione e rotazione anatomica originaria.

### 🥽 In Realtà Virtuale (WebXR)
- **Trigger o Grip del Controller**: Punta il laser su una parte e tieni premuto il grilletto o il tasto di presa laterale per afferrare il pezzo.
- **Rotazione del Polso**: Ruota il pezzo sul proprio baricentro (`Box3`) semplicemente ruotando la mano/polso.
- **Asse Y del Thumbstick**: Muovi la levetta analogica in avanti o indietro per allontanare o avvicinare il pezzo lungo il raggio laser.
- **Pulsante `B` (controller destro) o `Y` (controller sinistro)**: Ripristina istantaneamente tutte le parti al loro posto con feedback aptico.

---

## 🌐 Testi Descrittivi da Wikipedia REST API

- Quando viene selezionata una mesh, il suo nome viene ripulito da numeri e suffissi tecnici (es. *"Frontal bone 1"* -> *"Frontal bone"*, *"Biceps brachii.R"* -> *"Biceps brachii"*).
- Viene interrogata la **Wikipedia REST API** pubblica (`https://en.wikipedia.org/api/rest_v1/page/summary/`) con fallback di ricerca semantica.
- Nel pannello di destra (e nello schermo olografico 3D in-VR) appare il **testo riassuntivo pulito** della struttura.
- Pulsante **"🌐 Apri pagina Wikipedia"**: Apre la voce medica completa in una nuova scheda.
- Pulsante **"🔊 Ascolta Descrizione"**: Legge a voce alta il riassunto enciclopedico di Wikipedia.

---

## 🫀 I 9 Apparati Anatomici Gestiti (Z-Anatomy)

Tutti i 9 modelli vengono caricati rigorosamente nello **stesso punto d'origine `(0, 0, 0)` del piedistallo senza offset**:

| Apparato | File Esatto | Modalità di Caricamento | Correzione Materiale PBR |
|---|---|---|---|
| **1. Sistema Scheletrico** | `scheletrico.glb` | Immediato all'avvio | Avorio caldo (`#d8ccb4`, roughness `0.58`, opaque) |
| **2. Giunture e Legamenti** | `giunture.glb` | On-demand (Lazy loading) | Azzurro cartilagine (`#b5c9d6`, roughness `0.40`) |
| **3. Inserzioni Muscolari** | `inserzioni_muscolari.glb` | On-demand (Lazy loading) | Tendineo neutro (`#d5c4b1`, roughness `0.50`) |
| **4. Sistema Muscolare** | `muscolare.glb` | Immediato all'avvio | Preservazione tinte e texture originali (metalness `0.0`) |
| **5. Organi e Visceri** | `visceri.glb` | Immediato all'avvio | Rosa-organico (`#c96a5b`, roughness `0.45`) |
| **6. Sistema Circolatorio** | `sistema_circolatorio.glb` | On-demand (Lazy loading) | Preservazione colori vasi arteriosi e venosi (metalness `0.0`) |
| **7. Sistema Linfatico** | `sistema_linfatico.glb` | On-demand (Lazy loading) | Verde linfatico (`#7ec850`, roughness `0.45`) |
| **8. Sistema Nervoso** | `sistema_nervoso.glb` | On-demand (Lazy loading) | Giallo ocra (`#e6c229`, roughness `0.45`) |
| **9. Pelle e Corpo Esterno** | `pelle_e_corpo_esterno.glb` | On-demand (Lazy loading) | Incarnato semitrasparente (**opacità default 0.25**, depthWrite false) |
