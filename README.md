# Ciné Catalogue

**Que regarder ce soir, et pourquoi.** Un guide pour les films, séries, anime
(Japon, Chine, Corée) et dessins animés, pensé pour tout le monde : fans d'anime,
cinéphiles, et curieux qui veulent découvrir.

- **« Ce soir »** : temps disponible, film ou série, envie du moment → trois
  propositions, chacune avec sa raison (« Vous avez aimé X et Y : thriller et
  seinen »), dont une découverte hors de vos habitudes.
- **Suivi** sans compte : À voir, En cours, Vu, Abandonné…, avis, épisodes vus
  saison par saison, historique, sauvegarde.
- **Import** de votre historique depuis AniList, MyAnimeList ou Letterboxd.
- **Mes goûts** : le profil déduit de votre suivi, explicable et corrigeable.
- **Comprendre** : des fiches courtes (seinen, donghua, OVA, fantasy ou
  fantastique…) et des parcours d'initiation.
- Recherche dans tous les titres (français, original, romaji), quatre rubriques
  filtrables, une page par œuvre avec ses saisons et ses sources.

La vision, les choix de données et la feuille de route sont dans
[docs/LOT-0-FONDATIONS.md](docs/LOT-0-FONDATIONS.md).

## Démarrer

Node.js 22 ou plus.

```bash
npm install
```

```bash
npm run ingest
```

```bash
npm run dev
```

`npm run ingest` construit le catalogue (environ 17 000 œuvres) dans une base
PostgreSQL locale ; comptez quelques minutes la première fois, quelques secondes
ensuite grâce au cache. L'application est ensuite servie sur http://localhost:3000.

La base locale (PGlite) ne s'ouvre que dans un seul processus : **arrêtez
`npm run dev` avant de relancer `npm run ingest`**.

Pour les pages légales, copiez `.env.example` en `.env.local` et renseignez
l'éditeur, le contact et l'hébergeur. Une compilation de production
(`CHECK_LEGAL=1` ou Vercel en production) échoue s'ils manquent.

## Le catalogue

Trois sources ouvertes, **sans clé d'API** :

| Source | Apport | Licence |
|---|---|---|
| [AniList](https://anilist.co) | Anime, donghua, aeni : titres, saisons, studios, démographie, affiches | conditions d'AniList |
| [Wikidata](https://www.wikidata.org) | Films, séries, dessins animés ; lien entre les identifiants des sources | CC0 |
| [TVmaze](https://www.tvmaze.com) | Séries : synopsis, chaînes, affiches | CC BY-SA 4.0 |

Les fiches sont rapprochées en œuvres (identifiants partagés, puis titre et année,
puis saisons AniList successives), vérifiées, puis enregistrées. Si un seuil de
qualité n'est pas respecté (règles du modèle, doublons, couverture, chute du
nombre d'œuvres), **rien n'est écrit** et l'import échoue.

```bash
npm run ingest -- --essai
```

```bash
npm run ingest -- --sources anilist --anilist-max 200 --oeuvres-min 10
```

- `--essai` : rapport de qualité sans écrire en base.
- `--rafraichir` : ignore le cache des réponses brutes (24 h, dans `data/raw/`).
- Le rapport du dernier import est dans `data/rapports/dernier-import.json`.

TMDB (affiches et synopsis en français pour les films) sera branché comme
source facultative dès qu'une clé sera disponible.

## Vie privée

Le suivi, le profil de goûts et le classement des propositions restent dans le
navigateur (stockage local). Le serveur ne reçoit que des identifiants d'œuvres,
des genres et les contraintes du moment ; il ne conserve rien. Lors d'un import,
les fichiers sont lus dans le navigateur. Détails dans la page Confidentialité.

## Organisation

| Dossier | Rôle |
|---|---|
| `src/domain/` | Cœur pur, sans dépendance technique : modèle et classification, suivi (journal d'actions), imports, profil, moteur de décision, couleurs |
| `src/ingestion/` | Un adaptateur par source, rapprochement des fiches, rapport de qualité |
| `src/db/` | Schéma PostgreSQL et enregistrement du catalogue |
| `src/catalogue/` | Lectures pour l'interface : recherche, rubriques, fiches, correspondances, traits, candidats |
| `src/savoir/` | Chargement et validation des fiches « Comprendre » |
| `src/app/` | Pages et routes d'API Next.js |
| `src/web/` | Composants, suivi et décision côté navigateur, libellés, pages légales |
| `contenu/savoir/` | Les fiches « Comprendre », en Markdown |
| `scripts/` | Import du catalogue, contrôle des mentions légales |
| `tests/` | Tests Vitest (domaine, sources, base PGlite en mémoire, contenu) |

## Vérifier

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run build
```

La CI (GitHub Actions) lance ces trois étapes sur Node 22 et 24.

## Écrire une fiche « Comprendre »

Un fichier par fiche dans `contenu/savoir/`, nommé en minuscules avec des tirets.
L'en-tête YAML donne le titre, le type (`definition`, `difference`, `histoire`,
`coulisses`, `parcours`), l'accroche, les concepts expliqués, les œuvres
d'exemple par clé externe (`anilist:16498`, `wikidata:Q155653`), les fiches liées
et les sources. Le corps est coupé par `<!-- plus -->` : la carte (80 mots au plus)
puis « En savoir plus » (300 mots au plus). Les tests vérifient tout cela.

Les textes sont originaux (pas de copie de Wikipédia). Une fiche reste en
`statut: brouillon`, signalée comme telle sur le site, tant qu'elle n'a pas été relue.

## Licence

Code sous licence MIT (voir [LICENSE](LICENSE)). Les données des œuvres restent
soumises aux conditions de leurs sources.
