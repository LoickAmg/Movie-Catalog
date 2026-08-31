# Ciné Catalogue

Interface web de catalogue de films : recherche, filtre par genre, likes
persistés, et recommandations basées sur les genres aimés — 100% statique,
sans backend, **sans clé API**, prête à déployer sur GitHub Pages.

## Fonctionnalités

- **Catalogue** de ~4000 films (2008–2023) : recherche par titre ou acteur,
  filtre par genre, pagination
- **Likes** : clique sur 🤍 pour aimer un film ; persisté en `localStorage`,
  donc conservé d'une visite à l'autre sur le même navigateur
- **Recommandations** : un profil de genres est construit à partir de tes
  films likés, puis chaque film non-liké est noté selon le recouvrement avec
  ce profil — pas de machine learning, juste un score simple et explicable
  (`src/js/recommend.js`)
- **Fiche détaillée** au clic sur un film : synopsis, casting, lien
  Wikipedia
- **Responsive** : grille en `auto-fill`, contrôles qui s'empilent en
  dessous de 560px de large, testé à la fois en desktop et en mobile
- Aucune dépendance runtime, aucun framework, aucun build : `public/` est le
  site tel quel, servi directement par GitHub Pages

## Source des données

Pas de clé API ni de service tiers à configurer : le catalogue
(`public/data/movies.json`) est un instantané statique — titres, années,
genres, casting, synopsis et affiches — construit à partir du jeu de données
public [prust/wikipedia-movie-data](https://github.com/prust/wikipedia-movie-data)
(MIT), lui-même issu de Wikipédia (CC BY-SA pour les textes). Les affiches
sont hébergées sur `upload.wikimedia.org` ; si une image ne charge pas (lien
mort, connexion coupée...), l'interface bascule automatiquement sur une
vignette colorée + emoji de genre au lieu de casser l'affichage.

## Structure du projet

```
movie-catalog-web/
├── public/                    # le site déployé tel quel sur GitHub Pages
│   ├── index.html
│   ├── css/styles.css
│   ├── js/
│   │   ├── app.js               # câblage DOM (le seul fichier non testé unitairement)
│   │   ├── catalog.js             # recherche, filtre, pagination, couleurs (pur)
│   │   ├── recommend.js             # profil de genres + score de recommandation (pur)
│   │   └── likes.js                   # persistance des likes (stockage injectable)
│   └── data/movies.json
├── tests/                      # vitest, aucun DOM ni réseau requis
├── .github/workflows/
│   ├── ci.yml                    # lint (eslint) + tests (vitest) sur push/PR
│   └── deploy.yml                  # déploiement automatique de public/ sur GitHub Pages
└── package.json
```

## Lancer en local

Comme l'app charge `data/movies.json` via `fetch()`, elle a besoin d'être
servie en HTTP (pas juste ouverte en double-cliquant sur le fichier — les
navigateurs bloquent `fetch()` sur `file://`) :

```bash
npm install
npm run serve
# puis ouvrir l'URL affichée (http://localhost:3000 en général)
```

## Lancer les tests

```bash
npm test
```

Toute la logique métier (`catalog.js`, `recommend.js`, `likes.js`) est pure
ou reçoit ses dépendances externes en paramètre (le stockage de `likes.js`
est injectable — les tests utilisent un faux stockage en mémoire, pas
`localStorage`) : aucun DOM, aucun réseau, aucun navigateur requis pour
lancer la suite de tests.

## Lint

```bash
npm run lint
```

## Déploiement sur GitHub Pages

Le workflow `.github/workflows/deploy.yml` déploie automatiquement le
contenu de `public/` à chaque push sur `main`. Il suffit d'activer Pages une
fois sur le repo :

1. Pousse ce repo sur GitHub
2. **Settings → Pages → Source : "GitHub Actions"**
3. Le prochain push sur `main` (ou un lancement manuel de l'action) déploie
   le site ; l'URL apparaît dans l'onglet **Actions** du run, et sur la page
   Settings → Pages une fois le premier déploiement terminé

## Prochaines étapes possibles

- Recommandations pondérées par la récence des likes (les genres likés
  récemment comptent plus que les anciens)
- Mode "films similaires à celui-ci" directement depuis la fiche détaillée
- Conteneuriser avec Docker pour un usage local (voir le projet transversal
  #25 de la roadmap) — optionnel ici puisque le site est déjà 100% statique


## Version films, séries et catalogue actualisable

Le site sert maintenant `public/data/catalog.json`, un format commun aux médias `movie` et `tv`. Les séries peuvent contenir une affiche, un synopsis, une note, une date de première diffusion, un diffuseur et des informations de saisons ou d’épisodes. Le catalogue historique de films reste un filet local pour que le site conserve un mode de démonstration sans réseau.

Le script `scripts/refresh_catalog.py` peut construire un catalogue étendu. TVmaze fournit un index large de séries sans clé ; TMDB fournit les films et séries populaires les plus récents lorsque `TMDB_BEARER_TOKEN` est présent. La clé n’est jamais placée dans `public/` ni exposée au navigateur.

Pour générer localement un catalogue avec le catalogue historique et une première sélection de séries :

```powershell
py -3 scripts\refresh_catalog.py --movie-pages 0 --tv-pages 0 --tvmaze-pages 8 --allow-no-tmdb
```

Pour un catalogue régulièrement actualisé, le workflow `.github/workflows/refresh-catalog.yml` utilise le secret GitHub `TMDB_BEARER_TOKEN`, puis commit uniquement `public/data/catalog.json` quand le contenu a changé. Il suffit de créer ce secret dans `Settings > Secrets and variables > Actions`, de pousser le workflow et de lancer une première synchronisation avec `workflow_dispatch`. Le workflow de publication Pages se relance alors sur le commit généré.

L’interface propose désormais une recherche dans les titres, le synopsis, le casting et les diffuseurs, un filtre Films / Séries, des filtres par genre et année, un tri par récence, note ou titre, des fiches enrichies et des recommandations locales basées sur les genres des titres de votre liste. Les recommandations sont explicables et privées dans le navigateur ; elles ne prétendent pas remplacer un profil serveur ou un moteur éditorial.

Le pied de page affiche les sources utilisées. Vérifiez les conditions d’utilisation et d’attribution de [TMDB](https://developer.themoviedb.org/docs/getting-started) et [TVmaze](https://www.tvmaze.com/api) avant une mise en production publique.
