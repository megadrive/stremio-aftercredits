import type { Manifest } from "stremio-addon-sdk";

export const manifest: Manifest = {
  id: "com.almosteffective.aftercredits",
  version: "1.0.0",
  name: "AfterCredits",
  description: "Are there mid-credits or after credits scenes?",
  resources: ["stream"],
  types: ["movie"],
  catalogs: [],
  idPrefixes: ["tt"],
};
