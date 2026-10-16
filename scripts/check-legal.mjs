// Bloque une compilation de production dont les mentions légales seraient vides.
const requises = ["PUBLISHER_NAME", "CONTACT_EMAIL", "HOSTING_PROVIDER"];
const manquantes = requises.filter((nom) => !process.env[nom]?.trim());
const production = process.env.VERCEL_ENV === "production" || process.env.CHECK_LEGAL === "1";

if (manquantes.length === 0) process.exit(0);

const message = `Mentions légales incomplètes : variable(s) d'environnement manquante(s) : ${manquantes.join(", ")}.`;
if (production) {
  console.error(message);
  process.exit(1);
}
console.warn(`${message} (ignoré hors production)`);
