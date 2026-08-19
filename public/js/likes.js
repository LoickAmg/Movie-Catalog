/**
 * Persistance des "likes" (ids de films) dans un stockage clé-valeur
 * injecté — en pratique `window.localStorage` dans le navigateur, ou un
 * faux stockage en mémoire dans les tests (aucune dépendance à jsdom).
 */

const STORAGE_KEY = "movie-catalog:likes";

export function createLikesStore(storage) {
  function readIds() {
    let raw;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch {
      return new Set();
    }
    if (!raw) return new Set();
    try {
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  function writeIds(ids) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
    } catch {
      // Stockage indisponible (navigation privée, quota dépassé...) : les
      // likes restent utilisables pour la session en cours, simplement pas
      // persistés d'une visite à l'autre.
    }
  }

  return {
    getAll() {
      return readIds();
    },
    isLiked(id) {
      return readIds().has(id);
    },
    /** Bascule l'état liké/non-liké et renvoie le nouvel état (booléen). */
    toggle(id) {
      const ids = readIds();
      const willBeLiked = !ids.has(id);
      if (willBeLiked) {
        ids.add(id);
      } else {
        ids.delete(id);
      }
      writeIds(ids);
      return willBeLiked;
    },
    clear() {
      writeIds(new Set());
    },
  };
}

/** Faux stockage en mémoire, utilisé par les tests et comme repli si
 * `localStorage` est indisponible. */
export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}
