import type { Manifest } from "stremio-addon-sdk";
import { appEnv } from "./appEnv.js";

export const manifest: Manifest = {
  id: `${appEnv.isDev ? "dev." : ""}com.almosteffective.aftercredits`,
  version: "1.0.0",
  name: `AfterCredits${appEnv.isDev ? " (dev)" : ""}`,
  description: "Are there mid-credits or after credits scenes?",
  resources: ["stream"],
  types: ["movie"],
  catalogs: [],
  idPrefixes: ["tt"],
};
