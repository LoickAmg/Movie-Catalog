-- Schéma du catalogue (lot 0, §4). PostgreSQL ; idempotent.

CREATE TABLE IF NOT EXISTS oeuvre (
  id              text PRIMARY KEY,
  titre_principal text NOT NULL,
  rubrique        text NOT NULL CHECK (rubrique IN ('film', 'serie', 'anime', 'dessin_anime')),
  format          text NOT NULL CHECK (format IN ('film', 'serie', 'ova', 'ona', 'special', 'court')),
  technique       text NOT NULL CHECK (technique IN ('prises_de_vue_reelles', 'animation', 'mixte')),
  origines        text[] NOT NULL DEFAULT '{}',
  public          text CHECK (public IN ('enfants', 'famille', 'ado', 'adulte')),
  demographie     text CHECK (demographie IN ('kodomo', 'shonen', 'shojo', 'seinen', 'josei')),
  adulte          boolean NOT NULL DEFAULT false,
  annee           integer,
  duree_min       integer,
  popularite      jsonb NOT NULL DEFAULT '{}',
  score           real NOT NULL DEFAULT 0,
  provenance      jsonb NOT NULL DEFAULT '{}',
  maj_le          timestamptz NOT NULL DEFAULT now()
);
-- Base créée avant l'ajout du score.
ALTER TABLE oeuvre ADD COLUMN IF NOT EXISTS score real NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS oeuvre_rubrique_score ON oeuvre (rubrique, score DESC);

CREATE TABLE IF NOT EXISTS titre (
  oeuvre_id  text NOT NULL REFERENCES oeuvre (id) ON DELETE CASCADE,
  valeur     text NOT NULL,
  normalise  text NOT NULL,
  langue     text,
  type       text NOT NULL CHECK (type IN ('original', 'romaji', 'officiel', 'alternatif')),
  source     text NOT NULL
);
CREATE INDEX IF NOT EXISTS titre_oeuvre ON titre (oeuvre_id);
CREATE INDEX IF NOT EXISTS titre_normalise ON titre (normalise);

CREATE TABLE IF NOT EXISTS partie (
  cle        text PRIMARY KEY,
  oeuvre_id  text NOT NULL REFERENCES oeuvre (id) ON DELETE CASCADE,
  ordre      integer NOT NULL,
  titre      text NOT NULL,
  format     text NOT NULL,
  annee      integer,
  episodes   integer,
  duree_min  integer,
  source     text NOT NULL
);
CREATE INDEX IF NOT EXISTS partie_oeuvre ON partie (oeuvre_id);

CREATE TABLE IF NOT EXISTS identifiant_externe (
  espace     text NOT NULL,
  valeur     text NOT NULL,
  oeuvre_id  text NOT NULL REFERENCES oeuvre (id) ON DELETE CASCADE,
  confiance  real NOT NULL,
  PRIMARY KEY (espace, valeur)
);
CREATE INDEX IF NOT EXISTS identifiant_oeuvre ON identifiant_externe (oeuvre_id);

CREATE TABLE IF NOT EXISTS concept (
  slug        text PRIMARY KEY,
  type        text NOT NULL CHECK (type IN ('genre', 'theme', 'demographie')),
  libelle_fr  text,
  libelle_en  text
);

CREATE TABLE IF NOT EXISTS oeuvre_concept (
  oeuvre_id     text NOT NULL REFERENCES oeuvre (id) ON DELETE CASCADE,
  concept_slug  text NOT NULL REFERENCES concept (slug),
  PRIMARY KEY (oeuvre_id, concept_slug)
);

CREATE TABLE IF NOT EXISTS credit (
  oeuvre_id  text NOT NULL REFERENCES oeuvre (id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('realisation', 'creation', 'studio')),
  nom        text NOT NULL,
  source     text NOT NULL,
  ordre      integer NOT NULL
);
CREATE INDEX IF NOT EXISTS credit_oeuvre ON credit (oeuvre_id);

CREATE TABLE IF NOT EXISTS relation (
  de      text NOT NULL REFERENCES oeuvre (id) ON DELETE CASCADE,
  vers    text NOT NULL REFERENCES oeuvre (id) ON DELETE CASCADE,
  type    text NOT NULL CHECK (type IN ('suite', 'prequelle', 'adaptation', 'remake', 'derive', 'meme_univers')),
  source  text NOT NULL,
  PRIMARY KEY (de, vers, type)
);

CREATE TABLE IF NOT EXISTS synopsis (
  oeuvre_id  text NOT NULL REFERENCES oeuvre (id) ON DELETE CASCADE,
  langue     text NOT NULL,
  texte      text NOT NULL,
  source     text NOT NULL,
  PRIMARY KEY (oeuvre_id, langue, source)
);

CREATE TABLE IF NOT EXISTS image (
  oeuvre_id  text NOT NULL REFERENCES oeuvre (id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('affiche', 'banniere')),
  url        text NOT NULL,
  couleur    text,
  source     text NOT NULL,
  PRIMARY KEY (oeuvre_id, type, source)
);

CREATE TABLE IF NOT EXISTS import_catalogue (
  id       serial PRIMARY KEY,
  debut    timestamptz NOT NULL,
  fin      timestamptz NOT NULL,
  total    integer NOT NULL,
  rapport  jsonb NOT NULL
);
