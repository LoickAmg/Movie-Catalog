import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Un package-lock.json existe plus haut dans l'arborescence : on fixe la racine du projet.
  turbopack: { root: path.resolve(import.meta.dirname) },
  // PGlite charge son moteur WebAssembly depuis node_modules : on ne l'empaquette pas.
  serverExternalPackages: ["@electric-sql/pglite"],
  poweredByHeader: false,
};

export default config;
