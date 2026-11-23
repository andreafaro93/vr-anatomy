/**
 * Database medico-scientifico per l'applicazione di Anatomia 3D & VR
 * Contiene schede cliniche approfondite in lingua italiana.
 */

export const MEDICAL_DATA = {
  cuore: {
    id: 'cuore',
    name: 'Cuore',
    latinName: 'Cor',
    system: 'Apparato Cardiocircolatorio',
    category: 'Organo Muscolare Cavo',
    dimensions: 'Circa 12 x 9 x 6 cm (peso: ~250-350 g)',
    description: 'Il cuore è l\'organo propulsore centrale del sistema circolatorio, situato nel mediastino medio tra i due polmoni e poggiante sul diaframma. Funziona come una doppia pompa aspirante e premente: la sezione destra gestisce la circolazione polmonare (piccolo circolo) per l\'ossigenazione del sangue venoso, mentre la sezione sinistra spinge il sangue ossigenato nell\'aorta e in tutto l\'organismo (grande circolo).',
    physiology: [
      { label: 'Frequenza a riposo', value: '60 - 100 battiti al minuto (bpm)' },
      { label: 'Gittata cardiaca', value: '~5 litri di sangue al minuto a riposo' },
      { label: 'Vascolarizzazione', value: 'Arterie coronarie destra e sinistra' },
      { label: 'Innervazione', value: 'Plesso cardiaco (sistema simpatico e parasimpatico vagale)' }
    ],
    pathologies: 'Infarto miocardico, insufficienza cardiaca, fibrillazione atriale, cardiomiopatie, valvulopatie.',
    colorHex: 0xd32f2f,
    accentColor: '#ef5350'
  },

  polmone_destro: {
    id: 'polmone_destro',
    name: 'Polmone Destro',
    latinName: 'Pulmo Dexter',
    system: 'Apparato Respiratorio',
    category: 'Organo Parenchimatoso Spugnoso',
    dimensions: 'Volume maggiore del sinistro (circa 600-650 g)',
    description: 'Il polmone destro è il principale organo dell\'ematosi nell\'emitorace destro. È suddiviso da due scissure (orizzontale e obliqua) in tre lobi distinti: Superiore, Medio e Inferiore. Ha un volume e una capacità vitale superiori rispetto al polmone sinistro (circa il 55% della capacità respiratoria totale), mancando dell\'incisura occupata dalla massa cardiaca.',
    physiology: [
      { label: 'Lobi', value: '3 lobi (Superiore, Medio, Inferiore)' },
      { label: 'Scissure', value: 'Scissura orizzontale e scissura obliqua' },
      { label: 'Superficie alveolare', value: '~70-100 m² per gli scambi gassosi' },
      { label: 'Vascolarizzazione', value: 'Arteria polmonare destra e arterie bronchiali' }
    ],
    pathologies: 'Polmonite lobare, broncopneumopatia cronica ostruttiva (BPCO), enfisema, atelectasia, pleurite.',
    colorHex: 0x4fc3f7,
    accentColor: '#29b6f6'
  },

  polmone_sinistro: {
    id: 'polmone_sinistro',
    name: 'Polmone Sinistro',
    latinName: 'Pulmo Sinister',
    system: 'Apparato Respiratorio',
    category: 'Organo Parenchimatoso Spugnoso',
    dimensions: 'Volume inferiore del destro (circa 500-550 g)',
    description: 'Il polmone sinistro occupa l\'emitorace sinistro. È diviso da un\'unica scissura obliqua in due lobi: Superiore e Inferiore. La sua faccia mediale presenta la caratteristica "incisura cardiaca" (incisura cardiaca pulmonis sinistri) e la lingula, conformazioni anatomiche che accolgono l\'apice del cuore deviato a sinistra nel mediastino.',
    physiology: [
      { label: 'Lobi', value: '2 lobi (Superiore e Inferiore)' },
      { label: 'Caratteristica chiave', value: 'Incisura cardiaca e lingula polmonare' },
      { label: 'Capacità', value: '~45% del volume ventilatorio globale' },
      { label: 'Vascolarizzazione', value: 'Arteria polmonare sinistra e rami bronchiali aortici' }
    ],
    pathologies: 'Pneumotorace, polmonite interstiziale, embolia polmonare, bronchiectasie, asma bronchiale.',
    colorHex: 0x4fc3f7,
    accentColor: '#0288d1'
  },

  trachea: {
    id: 'trachea',
    name: 'Trachea e Albero Bronchiale',
    latinName: 'Trachea et Arbor Bronchialis',
    system: 'Apparato Respiratorio (Vie Aeree Inferiori)',
    category: 'Condotto Fibrocartilagineo Cavo',
    dimensions: 'Lunghezza: ~10-12 cm, diametro: ~2-2.5 cm',
    description: 'La trachea è un condotto elastico e resistente che fa seguito alla laringe e scende nel mediastino anteriore fino alla quarta-quinta vertebra toracica (T4-T5), dove si biforca nella carena tracheale dando origine ai due bronchi principali (destro e sinistro). È costituita da 15-20 anelli cartilaginei a forma di "C", chiusi posteriormente dal muscolo tracheale, che impediscono il collasso del lume durante gli atti respiratori.',
    physiology: [
      { label: 'Composizione', value: '16-20 anelli di cartilagine ialina aperti posteriormente' },
      { label: 'Epitelio', value: 'Pseudostratificato ciliato con cellule mucipare caliciformi' },
      { label: 'Funzione di difesa', value: 'Clearance mucociliare per l\'intrappolamento di particelle' },
      { label: 'Biforcazione', value: 'Carena tracheale -> Bronchi primari destro e sinistro' }
    ],
    pathologies: 'Tracheite, tracheomalacia, stenosi tracheale post-intubazione, corpo estraneo inalato.',
    colorHex: 0xe0e0e0,
    accentColor: '#b0bec5'
  }
};

/**
 * Restituisce i dati per una parte importata da GLB o non censita
 */
export function getGenericPartData(meshName, object3d) {
  const cleanName = meshName ? meshName.replace(/[_-]/g, ' ') : 'Componente 3D';
  let vertCount = 0;
  let triCount = 0;

  if (object3d && object3d.geometry) {
    vertCount = object3d.geometry.attributes.position ? object3d.geometry.attributes.position.count : 0;
    triCount = object3d.geometry.index ? object3d.geometry.index.count / 3 : vertCount / 3;
  }

  return {
    id: meshName || 'custom_part',
    name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
    latinName: 'Structura Anatomica 3D',
    system: 'Modello 3D Importato da File Locale',
    category: 'Mesh 3D Ispezionabile',
    dimensions: `Geometria: ${vertCount.toLocaleString()} vertici, ${Math.round(triCount).toLocaleString()} triangoli`,
    description: `Componente mesh ispezionato dall'archivio 3D caricato. Puoi analizzarne la posizione nello spazio, le dimensioni e isolare questa specifica porzione anatomica.`,
    physiology: [
      { label: 'Identificatore nodo', value: meshName || 'Senza nome' },
      { label: 'Tipo oggetto', value: object3d ? object3d.type : 'Mesh' },
      { label: 'Materiale', value: object3d && object3d.material ? (object3d.material.name || object3d.material.type) : 'Standard' },
      { label: 'Visibilità', value: 'Attiva' }
    ],
    pathologies: 'Seleziona altri componenti o carica nuovi modelli .GLB per approfondire l\'analisi morfologica.',
    colorHex: 0x00e5ff,
    accentColor: '#00e5ff'
  };
}
