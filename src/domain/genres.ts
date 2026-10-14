/**
 * Vocabulaire unique des genres, en français, et correspondances depuis
 * chaque source. Un genre inconnu n'est jamais inventé : il est ignoré et
 * compté dans le rapport de qualité.
 */

export const GENRES = {
  action: "Action",
  arts_martiaux: "Arts martiaux",
  aventure: "Aventure",
  biographie: "Biographie",
  catastrophe: "Catastrophe",
  comedie: "Comédie",
  comedie_musicale: "Comédie musicale",
  crime: "Crime",
  documentaire: "Documentaire",
  drame: "Drame",
  ecchi: "Ecchi",
  espionnage: "Espionnage",
  famille: "Famille",
  fantasy: "Fantasy",
  film_noir: "Film noir",
  guerre: "Guerre",
  histoire: "Historique",
  horreur: "Horreur",
  magical_girl: "Magical girl",
  mecha: "Mecha",
  musique: "Musique",
  mystere: "Mystère",
  psychologique: "Psychologique",
  romance: "Romance",
  science_fiction: "Science-fiction",
  sport: "Sport",
  super_heros: "Super-héros",
  surnaturel: "Surnaturel",
  thriller: "Thriller",
  tranche_de_vie: "Tranche de vie",
  western: "Western",
} as const;

export type Genre = keyof typeof GENRES;

const ANILIST: Record<string, Genre> = {
  Action: "action",
  Adventure: "aventure",
  Comedy: "comedie",
  Drama: "drame",
  Ecchi: "ecchi",
  Fantasy: "fantasy",
  Horror: "horreur",
  "Mahou Shoujo": "magical_girl",
  Mecha: "mecha",
  Music: "musique",
  Mystery: "mystere",
  Psychological: "psychologique",
  Romance: "romance",
  "Sci-Fi": "science_fiction",
  "Slice of Life": "tranche_de_vie",
  Sports: "sport",
  Supernatural: "surnaturel",
  Thriller: "thriller",
};

const TVMAZE: Record<string, Genre> = {
  Action: "action",
  Adventure: "aventure",
  Comedy: "comedie",
  Crime: "crime",
  Drama: "drame",
  Espionage: "espionnage",
  Family: "famille",
  Fantasy: "fantasy",
  History: "histoire",
  Horror: "horreur",
  Music: "musique",
  Mystery: "mystere",
  Romance: "romance",
  "Science-Fiction": "science_fiction",
  Sports: "sport",
  Supernatural: "surnaturel",
  Thriller: "thriller",
  War: "guerre",
  Western: "western",
};

/**
 * Wikidata nomme ses genres en anglais (« romantic comedy film »,
 * « science fiction television series »…). On les reconnaît par mots-clés,
 * dans l'ordre : le premier motif qui correspond l'emporte pour sa liste.
 */
const WIKIDATA_MOTIFS: Array<[RegExp, Genre[]]> = [
  [/\bromantic comedy\b/, ["romance", "comedie"]],
  [/\bcomedy[- ]drama\b/, ["comedie", "drame"]],
  [/\bscience[- ]fiction\b|\bsci-fi\b/, ["science_fiction"]],
  [/\bsuperhero\b/, ["super_heros"]],
  [/\bmartial arts\b|\bwuxia\b|\bkung fu\b/, ["arts_martiaux"]],
  [/\b(neo-)?noir\b/, ["film_noir"]],
  [/\bspy\b|\bespionage\b/, ["espionnage"]],
  [/\bdisaster\b/, ["catastrophe"]],
  [/\bmusical\b/, ["comedie_musicale"]],
  [/\bslice of life\b/, ["tranche_de_vie"]],
  [/\bmagical girl\b/, ["magical_girl"]],
  [/\bmecha\b/, ["mecha"]],
  [/\bdocumentary\b/, ["documentaire"]],
  [/\bbiographical\b|\bbiopic\b/, ["biographie"]],
  [/\bhistorical\b|\bperiod\b/, ["histoire"]],
  [/\bwar\b/, ["guerre"]],
  [/\bwestern\b/, ["western"]],
  [/\bhorror\b|\bslasher\b/, ["horreur"]],
  [/\bthriller\b/, ["thriller"]],
  [/\bcrime\b|\bdetective\b|\bpolice procedural\b|\bgangster\b|\bheist\b/, ["crime"]],
  [/\bmystery\b/, ["mystere"]],
  [/\bpsychological\b/, ["psychologique"]],
  [/\bsupernatural\b/, ["surnaturel"]],
  [/\bfantasy\b/, ["fantasy"]],
  [/\bromance\b|\bromantic\b/, ["romance"]],
  [/\bcomedy\b|\bsitcom\b|\bparody\b|\bsatir/, ["comedie"]],
  [/\bdrama\b|\bmelodrama\b/, ["drame"]],
  [/\baction\b/, ["action"]],
  [/\badventure\b/, ["aventure"]],
  [/\bfamily\b|\bchildren'?s\b/, ["famille"]],
  [/\bsports?\b/, ["sport"]],
  [/\bmusic\b/, ["musique"]],
];

export function genresAnilist(noms: readonly string[]): Genre[] {
  return dedoublonner(noms.map((n) => ANILIST[n]).filter((g): g is Genre => Boolean(g)));
}

export function genresTvmaze(noms: readonly string[]): Genre[] {
  return dedoublonner(noms.map((n) => TVMAZE[n]).filter((g): g is Genre => Boolean(g)));
}

/** Genres reconnus dans un libellé anglais de genre Wikidata. */
export function genresWikidata(libelleEn: string): Genre[] {
  const texte = libelleEn.toLowerCase();
  for (const [motif, genres] of WIKIDATA_MOTIFS) {
    if (motif.test(texte)) return genres;
  }
  return [];
}

function dedoublonner<T>(valeurs: T[]): T[] {
  return Array.from(new Set(valeurs));
}
