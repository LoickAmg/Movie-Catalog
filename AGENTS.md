# AGENTS.md — Ciné Catalogue

Repères pour un agent qui travaille sur ce dépôt. Le produit, les choix de
données et la feuille de route sont dans `docs/LOT-0-FONDATIONS.md` : le lire avant
de proposer une évolution.

## Commandes

- `npm run ingest` — construit le catalogue dans `data/db` (PGlite). `--essai` pour un rapport sans écriture.
- `npm run dev` — application Next.js. **PGlite n'accepte qu'un processus** : arrêter le serveur avant un import.
- `npm run typecheck`, `npm test`, `npm run build` — ce que lance la CI (Node 22 et 24).

## Architecture

- `src/domain/` est pur : aucune dépendance à Next.js, au navigateur, à la base ou à une source. Le garder ainsi.
- Les sources (AniList, Wikidata, TVmaze) sont des adaptateurs interchangeables dans `src/ingestion/`. Aucune ne demande de clé ; TMDB viendra en option.
- Le suivi utilisateur est un **journal d'actions** (`src/domain/suivi.ts`) stocké dans le navigateur (`cine:journal:v1`) ; l'état en est déduit. Ne jamais stocker un état modifiable à la place.
- Le profil de goûts et le classement « Ce soir » sont calculés **dans le navigateur**. Le serveur ne reçoit que des identifiants, des genres et des contraintes ; il ne conserve rien.
- Toute couleur, police ou texture passe par les variables CSS de `src/app/globals.css` (contrat de thème).

## Pièges

- Imports relatifs avec extension explicite (`./types.ts`), résolution `bundler`.
- Wikidata range souvent les noms sous la langue `mul` (multilingue) : toujours la demander avec `fr` et `en`.
- AniList découpe chaque saison en fiche : les saisons sont regroupées en parties d'une même œuvre seulement si leurs titres commencent pareil, et jamais au point de réunir deux éléments Wikidata ou TVmaze distincts.
- Les fiches `contenu/savoir/*.md` sont validées par les tests (longueurs, sources, liens, concepts). Une accroche qui contient « : » doit être entre guillemets (YAML).
- Mentions légales : `PUBLISHER_NAME`, `CONTACT_EMAIL`, `HOSTING_PROVIDER` (voir `.env.example`) ; rien en dur dans le code.
- Les textes destinés aux utilisateurs sont en français.
