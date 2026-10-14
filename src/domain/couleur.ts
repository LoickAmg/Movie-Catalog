/**
 * Couleurs de thème lisibles (lot 0, §6.5) : toute couleur venue d'une
 * source est corrigée jusqu'à respecter le contraste WCAG demandé.
 */

type Rvb = [number, number, number];

export function lireHex(hex: string): Rvb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function versHex([r, v, b]: Rvb): string {
  return `#${[r, v, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;
}

function luminance([r, v, b]: Rvb): number {
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(v) + 0.0722 * canal(b);
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
export function contraste(a: string, b: string): number {
  const ra = lireHex(a);
  const rb = lireHex(b);
  if (!ra || !rb) return 1;
  const [clair, sombre] = [luminance(ra), luminance(rb)].sort((x, y) => y - x) as [number, number];
  return (clair + 0.05) / (sombre + 0.05);
}

function melanger(a: Rvb, b: Rvb, t: number): Rvb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Rapproche `couleur` du blanc (fond sombre) ou du noir (fond clair) juste
 * assez pour atteindre le contraste `minimum` avec `fond`. Renvoie null si
 * la couleur est illisible.
 */
export function accentLisible(couleur: string, fond: string, minimum = 4.5): string | null {
  const c = lireHex(couleur);
  const f = lireHex(fond);
  if (!c || !f) return null;
  if (contraste(couleur, fond) >= minimum) return versHex(c);
  const cible: Rvb = luminance(f) < 0.5 ? [255, 255, 255] : [0, 0, 0];
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const essai = versHex(melanger(c, cible, t));
    if (contraste(essai, fond) >= minimum) return essai;
  }
  return null;
}

/** Texte noir ou blanc, celui qui se lit le mieux sur `fond`. */
export function encreSur(fond: string): "#000000" | "#ffffff" {
  return contraste(fond, "#000000") >= contraste(fond, "#ffffff") ? "#000000" : "#ffffff";
}
