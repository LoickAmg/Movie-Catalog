# Lot 0 — Fondations

> Document de décision. Rien n'est codé tant que la section « Décisions à valider » n'est pas cochée.
> Rédigé le 2026-10-14. Les points marqués *(à vérifier)* concernent des conditions d'utilisation de tiers qui doivent être relues à la source avant tout lancement public.

## 1. Vision en une page

**Promesse : « Dis-moi quoi regarder ce soir, et pourquoi. »**

Un guide personnel pour tous les médias audiovisuels — films, séries, anime (japonais, chinois, coréen) et dessins animés — qui :

1. **se souvient** de ce que tu as vu, aimé, abandonné, mis de côté ;
2. **comprend** tes goûts et te les montre (profil visible, corrigeable) ;
3. **propose** quoi regarder selon ton envie du moment, toujours avec la raison ;
4. **fait découvrir** : passer d'un univers à l'autre (cinéphile → anime, fan d'anime → cinéma coréen…) ;
5. **explique** : des fiches courtes pour comprendre un terme, un genre, un mouvement, une histoire.

**Public : tout le monde.** Fans d'anime, cinéphiles, curieux, néophytes complets. Conséquences de design :

- aucun jargon imposé — tout terme spécialisé est cliquable vers une fiche Savoir ;
- l'entrée se fait par les envies (« frissonner, rire, pleurer, réfléchir ») avant les catégories ;
- les parcours d'initiation sont une fonctionnalité de premier plan, pas un bonus.

**Ce qui nous distingue** : Letterboxd sert les cinéphiles, AniList/MyAnimeList les fans d'anime. Personne ne fait le pont entre les deux ni n'accompagne le débutant.

## 2. Classification des œuvres

« Anime » et « dessin animé » ne sont pas des formats comme « film » ou « série ». On décrit chaque œuvre sur des **axes indépendants**, puis on **dérive** les rubriques de navigation.

### 2.1 Axes

| Axe | Valeurs | Remarques |
|---|---|---|
| **Format** | `film`, `serie`, `ova`, `ona`, `special`, `court` | OVA = sortie vidéo directe ; ONA = diffusion web d'origine |
| **Technique** | `prises_de_vue_reelles`, `animation`, `mixte` | Sous-technique optionnelle plus tard : 2D, 3D, stop-motion |
| **Origine** | liste de pays ISO 3166 (`JP`, `CN`, `KR`, `FR`, `US`…) | Plusieurs pays possibles (coproductions) ; le premier est le pays principal |
| **Public** | `enfants`, `famille`, `ado`, `adulte` + classification d'âge si connue | Contenu marqué adulte par la source → exclu par défaut |
| **Démographie** *(anime uniquement)* | `kodomo`, `shonen`, `shojo`, `seinen`, `josei` | **Ce n'est pas un genre** : c'est le lectorat visé par le magazine d'origine. Fiche Savoir dédiée |
| **Genres** | vocabulaire français unique, mappé depuis chaque source | Ex. « Science-fiction », « Comédie », « Tranche de vie » |
| **Thèmes / tags** | vocabulaire ouvert (voyage temporel, sport, deuil…) | Séparés des genres ; servent à l'explication et à la découverte |

### 2.2 Rubriques dérivées

| Rubrique | Règle | Badge |
|---|---|---|
| **Film** | technique = prises de vue réelles, format = film | — |
| **Série** | technique = prises de vue réelles, format ≠ film | — |
| **Anime** | technique = animation, origine principale ∈ {JP, CN, KR} | Japon · Donghua (CN) · Aeni (KR) |
| **Dessin animé** | technique = animation, autre origine | pays |

- Les rubriques sont **exclusives** (une œuvre apparaît dans une seule) ; un filtre **Format** transversal permet « tous les films, anime compris ».
- **Cas limites** : technique `mixte` (*Qui veut la peau de Roger Rabbit*) → rangée selon la technique dominante, avec correction manuelle possible. Coproduction franco-japonaise → pays principal. Toute correction manuelle est tracée (source = `editorial`).

## 3. Sources de données et droits

Principe : **chaque source est un adaptateur interchangeable.** Si une source change ses conditions, on la remplace sans toucher au reste.

| Source | Rôle proposé | Usage non commercial | Usage commercial |
|---|---|---|---|
| **TMDB** | Films, séries, dessins animés : titres FR, synopsis FR, affiches, durée, casting, plateformes FR | Gratuit avec mention de la source *(à vérifier)* | Licence à négocier *(à vérifier)* |
| **AniList** | Anime / donghua / aeni : titres (romaji, natif, anglais, synonymes), format, épisodes, durée, studios, pays, genres, tags (dont démographie), relations entre œuvres, contenu adulte | Gratuit *(à vérifier)* | Autorisation à demander *(à vérifier)* |
| **Wikidata** | Pivot des identifiants (IMDb, TMDB, AniList, MyAnimeList), dates, studios, relations | CC0 | CC0 |
| **TVmaze** | Complément séries (programmes, épisodes) | CC BY-SA, mention obligatoire | idem *(à vérifier)* |
| **Jeux de données IMDb** | **Retiré** pour le produit public | Personnel et non commercial uniquement | Interdit sans licence payante |
| **Instantané Wikipédia** (`movies.json`) | **Retiré** (figé à 2023, schéma différent) | CC BY-SA | — |

Les identifiants IMDb restent conservés **comme simples identifiants** (liens vers la fiche IMDb, récupérés via TMDB ou Wikidata), sans réutiliser les jeux de données IMDb.

Les affiches appartiennent aux studios : on les affiche uniquement dans le cadre de la licence du fournisseur qui les sert.

## 4. Modèle de données minimal (pour le lot 1)

Volontairement réduit : uniquement ce dont la boucle « chercher → ouvrir → marquer → profil → proposition expliquée » a besoin, plus ce qu'impose l'anime.

| Entité | Rôle | Points clés |
|---|---|---|
| **Œuvre** | Ce que l'utilisateur pense comme « une œuvre » (*L'Attaque des Titans*, *Parasite*) | Identifiant interne stable ; porte les axes de classification |
| **Partie** | Une saison, un « cour », un film d'une série d'œuvres | Une œuvre a 1 à n parties. Un film a une seule partie. Nécessaire car AniList découpe chaque saison d'anime en fiche séparée, alors que TMDB regroupe |
| **Titre** | Un titre de l'œuvre dans une langue | `langue`, `type` (`original`, `romaji`, `officiel`, `alternatif`) ; la recherche porte sur tous |
| **Identifiant externe** | Lien vers une source (TMDB, AniList, IMDb, Wikidata…) | `source`, `valeur`, `confiance` du rapprochement |
| **Relation** | Lien entre œuvres | `suite`, `prequelle`, `adaptation`, `remake`, `derive`, `meme_univers` |
| **Concept** | Un genre, une démographie, un thème, un mouvement, un studio | Relie les œuvres aux fiches Savoir |
| **Crédit** | Personne ou studio ayant participé | Minimal : réalisation, création, studio, têtes d'affiche |

**Provenance** : chaque champ important garde `source` et `récupéré_le`. Une correction éditoriale a la source `editorial`.

**Reporté** : épisodes individuels (lot 3), offres et langues (lot 6, voir §7), personnes détaillées, franchises.

## 5. Fiches Savoir

Des cartes courtes qui expliquent un terme, un genre, une différence, une histoire. Elles servent surtout au public néophyte, mais aussi aux curieux qui veulent approfondir.

### 5.1 Types de fiches

| Type | Exemples |
|---|---|
| **Définition** | Qu'est-ce qu'un seinen ? Un isekai ? Une OVA ? Le mecha ? |
| **Différence** | Thriller ou polar ? Shōnen ou seinen ? Anime ou dessin animé ? Donghua ou anime ? |
| **Histoire** | La Nouvelle Vague française ; l'âge d'or de Disney ; la naissance du donghua ; le cinéma coréen depuis 2000 |
| **Coulisses** | Ghibli, Madhouse, MAPPA ; qu'est-ce que le « sakuga » ; pourquoi les saisons d'anime sont courtes |
| **Parcours** | « Débuter l'anime en 5 œuvres », « Le donghua pour les curieux », « Entrer dans le cinéma d'auteur » |

### 5.2 Format d'une fiche

- **Accroche** : 1 phrase.
- **Carte** : 80 mots maximum, compréhensible sans aucune connaissance préalable.
- **« En savoir plus »** : 300 mots maximum.
- **3 œuvres pour comprendre**, liées au catalogue (et donc cliquables).
- **Fiches liées** (ex. seinen → shōnen, josei).
- **Sources** citées.
- **Niveau** : `découverte` ou `approfondi`.

### 5.3 Où elles apparaissent

1. **Au contact d'un terme** : sur une page d'œuvre, l'étiquette « Seinen » ouvre la mini-carte.
2. **Dans les explications de recommandation** : « Nouveau pour toi : c'est un seinen. »
3. **À l'arrivée d'un néophyte** : 2 ou 3 cartes proposées, jamais imposées.
4. **Une section « Comprendre »** qui rassemble toutes les fiches et les parcours.
5. **Des sessions** : une suite de 4 à 8 cartes à faire défiler (« Comprendre l'anime en 5 minutes »).

Une fiche déjà lue n'est plus mise en avant. Aucune fiche ne bloque l'accès à quoi que ce soit.

### 5.4 Contenu : règles

- **Textes originaux.** On ne recopie pas Wikipédia : son contenu est sous CC BY-SA, ce qui obligerait à republier nos textes sous la même licence et à les attribuer.
- **Exactitude avant tout** : chaque affirmation historique ou factuelle a une source. Les opinions sont présentées comme telles.
- **Brouillons assistés par IA autorisés, mais relecture humaine obligatoire** avant publication.
- **Stockage** : fichiers Markdown versionnés dans le dépôt (un fichier par fiche, métadonnées en en-tête : identifiant, type, niveau, concepts liés, œuvres liées, sources). Relisibles, corrigeables, historisés par git.
- **Démarrage** : une vingtaine de fiches couvrant les termes les plus fréquents du catalogue (démographies, formats d'anime, 8 à 10 genres, 3 parcours).

## 6. Design et personnalisation par œuvre

Ambition : un design haut de gamme, avec des jaquettes originales et une identité visuelle propre à chaque œuvre. **La réalisation complète vient après le cœur fonctionnel (lot 7)**, mais deux choix doivent être faits dès le lot 2 pour que ce soit possible sans refonte.

### 6.1 À poser dès le lot 2 : le contrat de thème

Tous les composants lisent leur apparence **uniquement** dans des variables de thème, jamais dans des valeurs codées en dur :

| Variable | Rôle |
|---|---|
| `--surface`, `--surface-raised` | Fonds |
| `--ink`, `--ink-muted` | Textes |
| `--accent`, `--accent-ink` | Couleur d'accent et texte posé dessus |
| `--font-display`, `--font-text` | Police de titre, police de lecture |
| `--texture` | Motif de fond (grain, trame, aplat…) |
| `--radius`, `--motion` | Arrondis, style d'animation |

Le site a un thème par défaut. Une page d'œuvre peut **redéfinir ces variables** pour elle seule : la personnalisation par œuvre devient une question de données, pas de code.

### 6.2 Trois niveaux de personnalisation (lot 7)

1. **Automatique, pour toutes les œuvres.**
   - Palette extraite de l'affiche côté serveur, puis **corrigée automatiquement pour respecter les contrastes d'accessibilité** (WCAG AA).
   - Préréglage typographique et texture choisis selon la rubrique, le genre et l'époque : grain argentique pour un film noir, trame façon manga pour un seinen, aplats nets pour un dessin animé…
2. **Éditorial, pour les œuvres vedettes.** Un fichier de thème par œuvre (même principe que les fiches Savoir) : polices, couleurs, motif, mise en page de l'en-tête, animation d'entrée.
3. **Utilisateur (à confirmer).** Choisir un style de jaquette pour sa propre bibliothèque.

### 6.3 Jaquettes originales

- **Jaquettes générées** pour chaque œuvre : composition typographique (titre dans la police d'affichage du thème), palette et texture de l'œuvre. Elles servent aussi d'image de partage sur les réseaux sociaux.
- Intérêt double : un rendu cohérent même quand l'affiche officielle manque, et **des visuels qui nous appartiennent**, contrairement aux affiches des studios.
- Limite : ne pas imiter les logos officiels ni les marques déposées.

### 6.4 Polices

- Uniquement des polices dont la licence autorise l'usage public et commercial : Google Fonts (licence OFL), Fontshare (licence ITF Free Font) *(à vérifier police par police)*.
- Une sélection restreinte de quelques familles, préchargées et réduites aux caractères utiles, pour ne pas dégrader le temps de chargement.
- Vérifier que chaque police d'affichage gère les accents français et, pour les titres originaux, les caractères japonais, chinois et coréens (sinon, police de secours dédiée).

### 6.5 Garde-fous

- Contraste vérifié automatiquement pour chaque thème généré.
- Respect du réglage « réduire les animations » du système.
- Mode clair et mode sombre pour le thème par défaut.
- Budget de performance : la personnalisation ne doit pas ralentir l'affichage d'une page d'œuvre.

## 7. Où regarder, et dans quelle langue

L'utilisateur doit savoir **où** trouver une œuvre et **dans quelle langue** : « la VO n'est disponible que sur X et Y », « la VF est sur Z », « sous-titres français disponibles sur X uniquement », « aucune offre en VF en France ».

### 7.1 La difficulté, sans détour

| Information | Disponibilité des données |
|---|---|
| Sur quelle plateforme, dans quel pays, à quel prix (abonnement, location, achat, gratuit avec pub) | **Assez facile** : TMDB fournit les plateformes par pays (données JustWatch, mention obligatoire) *(à vérifier)* |
| Quelles **pistes audio** (VO, VF…) et quels **sous-titres** sur chaque plateforme | **Difficile** : TMDB ne le fournit pas. Il faut une API commerciale qui détaille audio et sous-titres par offre (ex. Streaming Availability API) *(couverture France et prix à vérifier)* |
| Si une **version doublée existe** tout court (indépendamment des plateformes) | Partiel : Wikidata, saisie éditoriale |

On **ne récupère pas** ces informations en aspirant les sites des plateformes : c'est en général interdit par leurs conditions et fragile techniquement.

### 7.2 Trois sources combinées

1. **Fournisseur de données** : plateformes par pays (TMDB), puis langues audio et sous-titres par offre (API commerciale, quand le projet le justifie).
2. **Contributions des utilisateurs** : « Signaler : la VF est disponible sur X ». Une contribution devient visible après confirmation par d'autres utilisateurs ou par la modération, et porte toujours sa date.
3. **Saisie éditoriale** pour les cas importants (plateformes d'anime comme Crunchyroll ou ADN, sorties en simultané avec le Japon).

### 7.3 Modèle de données

**Offre** — une possibilité concrète de regarder une partie d'œuvre :

| Champ | Contenu |
|---|---|
| `partie` | La saison ou le film concerné (les offres diffèrent souvent d'une saison à l'autre) |
| `plateforme`, `pays` | Ex. Netflix, FR |
| `type` | `abonnement`, `location`, `achat`, `gratuit`, `gratuit_avec_pub` |
| `audio[]` | Langues des pistes audio (codes BCP 47 : `ja`, `fr`, `fr-CA`, `ko`…) ; drapeau `originale` |
| `sous_titres[]` | Langues + type : standard, sourds et malentendants |
| `audiodescription` | Oui / non / inconnu |
| `lien` | Lien direct vers la plateforme |
| `debut`, `fin` | Dates de disponibilité si connues (« quitte Netflix le 30 novembre ») |
| `source`, `verifie_le`, `confiance` | Provenance, fraîcheur et fiabilité |

**Version** — une version linguistique qui existe, indépendamment des plateformes (« un doublage français existe, studio X ») : elle permet de dire « la VF existe, mais n'est disponible sur aucune plateforme en France ».

### 7.4 Ce que voit l'utilisateur

- **Ses préférences**, réglées une fois : pays, plateformes auxquelles il est abonné, façon de regarder (« VO sous-titrée français », « VF de préférence », « VO sans sous-titres »).
- **Bloc « Où regarder »** sur chaque page d'œuvre, trié selon ces préférences, avec des badges clairs : **VO** · **VF** · **VOSTFR** · **SME** (sous-titres pour sourds et malentendants) · **AD** (audiodescription).
- **Résumés en une ligne** : « VO uniquement sur Crunchyroll et ADN », « VF sur Netflix, VOSTFR sur Crunchyroll », « Toutes les langues sur Prime Video ».
- **Fraîcheur affichée** : « vérifié il y a 3 jours ».
- **Honnêteté** : si une langue n'est pas connue, on l'affiche comme **inconnue**. On ne devine jamais.
- **Dans « Ce soir »** : contrainte possible « disponible sur mes abonnements, dans ma langue ».
- **Alertes** : « La VF de cette saison vient d'arriver sur X », « Cette œuvre quitte X dans 7 jours ».

## 8. Feuille de route

| Lot | Contenu | Résultat observable |
|---|---|---|
| **0** | Ce document validé | Décisions figées |
| **1** | Modèle de données §4 ; acquisition TMDB + AniList + Wikidata vers PostgreSQL ; rapprochement des identités ; contrôles de qualité en CI | Une base qui contient films, séries, anime et dessins animés, sans doublons, avec la provenance |
| **2** | Application Next.js + TypeScript : recherche côté serveur (titres multilingues), une page par œuvre, rubriques §2.2, mode invité ; premières fiches Savoir et mini-cartes ; **contrat de thème** (§6.1) et thème par défaut soigné | On cherche « L'Attaque des Titans » et on tombe sur *Shingeki no Kyojin*, on clique sur « Seinen » et on comprend |
| **3** | Statuts (En cours, Terminé, En pause, Abandonné, Prévu, Revisionnage, J'aime, Pas pour moi), progression par épisode, historique d'actions, imports AniList / MyAnimeList / Letterboxd | On retrouve son historique en 2 minutes |
| **4** | « Ce soir », profil visible et corrigeable, explications qui citent des œuvres, découverte entre univers, parcours d'initiation | Trois propositions expliquées, dont une qui fait sortir de ses habitudes |
| **5** | Comptes, fusion de l'historique invité, export et suppression (RGPD) | Même historique sur le téléphone et l'ordinateur |
| **6** | « Où regarder » (§7) : plateformes par pays, préférences de langue, badges VO/VF/VOSTFR, puis langues par offre et contributions des utilisateurs ; radar des sorties | On sait sur quelle plateforme lancer l'œuvre, et dans quelle langue |
| **7** | Design haut de gamme : personnalisation par œuvre (automatique puis éditoriale), jaquettes générées, polices (§6) | Chaque page d'œuvre a sa propre identité visuelle |
| **Avant ouverture publique** | Performance, accessibilité, suivi des erreurs, sauvegardes, relecture des conditions des sources | — |

**Migration** : la nouvelle application est construite dans ce dépôt à côté de l'actuelle ; le site actuel reste en ligne jusqu'à ce que la nouvelle version fasse au moins tout ce qu'il fait. Les fonctions pures déjà testées (recherche, score, explication) sont portées en TypeScript. `scripts/refresh_catalog.py` devient le point de départ du module d'acquisition.

**Monétisation** : volontairement hors sujet pour l'instant. Seule contrainte retenue dès maintenant : les sources sont interchangeables (§3), pour ne pas se fermer de porte plus tard.

## 9. Décisions à valider

- [ ] **Vision** (§1) : la promesse et le public conviennent.
- [ ] **Classification** (§2) : axes indépendants + 4 rubriques dérivées exclusives ; anime = animation d'origine JP, CN ou KR.
- [ ] **Sources** (§3) : TMDB + AniList + Wikidata (+ TVmaze en complément) ; retrait des jeux de données IMDb et de l'instantané Wikipédia.
- [ ] **Modèle** (§4) : Œuvre / Partie / Titre / Identifiant externe / Relation / Concept / Crédit, avec provenance par champ.
- [ ] **Fiches Savoir** (§5) : format, emplacements, règles de contenu, stockage en Markdown dans le dépôt.
- [ ] **Où regarder** (§7) : offres par plateforme et par langue, trois sources (fournisseur, contributions, éditorial), « inconnu » plutôt que deviner.
- [ ] **Design** (§6) : contrat de thème dès le lot 2, personnalisation par œuvre et jaquettes au lot 7.
- [ ] **Stack** : Next.js + TypeScript + PostgreSQL managé. Hébergement proposé : Vercel + Neon ou Supabase (comme KOMA).
- [ ] **Nom du produit** : à trouver. « Ciné Catalogue » décrit ce qu'on quitte.

## 10. Questions encore ouvertes (n'empêchent pas de démarrer le lot 1)

- Langues de l'interface : français seul au lancement, ou français + anglais ?
- Hébergeur exact de PostgreSQL (Neon ou Supabase) : à trancher au début du lot 1, selon le besoin ou non d'une authentification intégrée au lot 5.
- Clés d'API TMDB et AniList : à créer par toi sur leurs sites (je ne crée pas de comptes).
