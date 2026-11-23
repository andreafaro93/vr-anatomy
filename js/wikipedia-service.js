/**
 * Servizio Wikipedia con priorità alla versione italiana.
 * Flusso: EN langlinks search → IT summary → fallback EN summary → fallback locale.
 */

const wikiCache = new Map();

/**
 * Pulisce il nome tecnico della mesh Z-Anatomy per la ricerca su Wikipedia.
 * Es. "Frontal bone 1" → "Frontal bone", "Femur.R" → "Femur"
 */
export function cleanAnatomyName(rawName) {
  if (!rawName) return 'Struttura Anatomica';

  let name = String(rawName);

  // Rimuovi percorsi, estensioni GLB/GLTF
  name = name.replace(/^.*\//, '');
  name = name.replace(/\.gl[bt]f?/gi, '');

  // Sostituisci trattini bassi e punti con spazi
  name = name.replace(/[_.]+/g, ' ');

  // Rimuovi numeri SOLO in coda (es. "Frontal bone 1" → "Frontal bone")
  name = name.replace(/\s*\b\d+\b\s*$/, '');

  // Rimuovi suffissi laterali (Left/Right/sn/dx ecc.)
  name = name.replace(/\b(left|right|sinistro|sinistra|destro|destra|sn|dx|ant|post|sup|inf)\b/gi, '');
  name = name.replace(/\b[LR]\b/g, '');

  // Pulisci spazi multipli e trailing
  name = name.replace(/\s+/g, ' ').trim();

  // Se rimasto troppo corto, usa il raw ripulito da soli numeri
  if (!name || name.length < 2) {
    name = String(rawName).replace(/\d+/g, '').replace(/[_.]+/g, ' ').trim();
  }

  // Maiuscola iniziale
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Recupera il riassunto Wikipedia con priorità alla versione italiana.
 * Restituisce un oggetto:
 *   { titleIT, titleEN, extract, wikiUrl, language }
 */
export async function fetchWikipediaIT(cleanedName) {
  if (!cleanedName) return _fallback(cleanedName || 'Struttura Anatomica');
  if (wikiCache.has(cleanedName)) return wikiCache.get(cleanedName);

  try {
    // Passo 1: Ricerca EN con langlinks → ottieni titolo italiano
    const searchUrl =
      `https://en.wikipedia.org/w/api.php?action=query` +
      `&generator=search&gsrsearch=${encodeURIComponent(cleanedName + ' anatomy')}` +
      `&gsrlimit=3&prop=langlinks&lllang=it&format=json&origin=*`;

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error('Wikipedia search failed');
    const searchData = await searchRes.json();

    const pages = searchData?.query?.pages;
    let itTitle = null;
    let enTitle = null;

    if (pages) {
      // Prendi la prima pagina con langlinks IT, o la prima in assoluto
      const pageList = Object.values(pages);
      for (const page of pageList) {
        const ll = page?.langlinks;
        if (ll && ll.length > 0) {
          itTitle = ll[0]['*'];
          enTitle = page.title;
          break;
        }
        if (!enTitle) enTitle = page.title;
      }
      // Se nessuna pagina aveva langlinks, usa il titolo EN comunque
      if (!enTitle && pageList.length > 0) enTitle = pageList[0].title;
    }

    // Passo 2a: Se trovato titolo italiano → carica riassunto IT
    if (itTitle) {
      const itSlug = encodeURIComponent(itTitle.replace(/ /g, '_'));
      const itRes = await fetch(
        `https://it.wikipedia.org/api/rest_v1/page/summary/${itSlug}`,
        { headers: { Accept: 'application/json' } }
      );
      if (itRes.ok) {
        const itData = await itRes.json();
        if (itData.extract && itData.extract.trim().length > 10) {
          const result = {
            titleIT: itData.title,
            titleEN: enTitle,
            extract: itData.extract,
            wikiUrl: `https://it.wikipedia.org/wiki/${itSlug}`,
            language: 'it'
          };
          wikiCache.set(cleanedName, result);
          return result;
        }
      }
    }

    // Passo 2b: Fallback a EN summary
    if (enTitle) {
      const enSlug = encodeURIComponent(enTitle.replace(/ /g, '_'));
      const enRes = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${enSlug}`,
        { headers: { Accept: 'application/json' } }
      );
      if (enRes.ok) {
        const enData = await enRes.json();
        if (enData.extract && enData.extract.trim().length > 10) {
          const result = {
            titleIT: null,
            titleEN: enData.title,
            extract: enData.extract,
            wikiUrl:
              enData.content_urls?.desktop?.page ||
              `https://en.wikipedia.org/wiki/${enSlug}`,
            language: 'en'
          };
          wikiCache.set(cleanedName, result);
          return result;
        }
      }
    }
  } catch (err) {
    console.warn(`Wikipedia IT fetch fallita per "${cleanedName}":`, err);
  }

  // Fallback locale finale
  const fb = _fallback(cleanedName);
  wikiCache.set(cleanedName, fb);
  return fb;
}

function _fallback(name) {
  return {
    titleIT: null,
    titleEN: name,
    extract: `${name}: struttura anatomica del corpo umano. Consulta la voce su Wikipedia per approfondimenti sulla funzione fisiologica e i rapporti topografici.`,
    wikiUrl: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(name)}`,
    language: 'fallback'
  };
}

// Re-esporta cleanAnatomyName come fetchWikipediaSummary per retrocompatibilità
// (non più usato da app.js, ma potrebbe essere importato altrove)
export { fetchWikipediaIT as fetchWikipediaSummary };
