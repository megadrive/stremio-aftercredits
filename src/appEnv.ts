import { cleanEnv, num, str } from "envalid";
import "dotenv/config";

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

export const appEnv = cleanEnv(process.env, {
  PORT: num({ default: 3000 }),
  DATABASE_TYPE: str({ default: "sqlite", choices: ["sqlite", "redis"] }),
  REDIS_URL: str({ default: "" }),
  SQLITE_PATH: str({ default: "./cache.sqlite" }),
  CACHE_TTL: num({ default: ONE_DAY_MS * 7, devDefault: 0 }),
  TMDB_APIKEY: str({ default: "" }),
});
