import Keyv from "keyv";
import KeyvSqlite from "@keyv/sqlite";
import KeyvRedis from "@keyv/redis";
import { appEnv } from "./appEnv.js";

const DEFAULT_TTL = 1000 * 60 * 60 * 24 * 1; // 1

const cacheStore = <T>(namespace?: string) => {
  if (appEnv.DATABASE_TYPE === "redis") {
    return new KeyvRedis<T>(appEnv.REDIS_URL);
  }

  return new KeyvSqlite({
    uri: `sqlite://${appEnv.SQLITE_PATH}`,
    table: namespace,
  });
};

export const createCache = <T>(namespace: string, ttl = DEFAULT_TTL) => {
  console.info(`Using ${appEnv.DATABASE_TYPE} for caching (${namespace})`);

  return new Keyv<T>({
    store: cacheStore<T>(namespace),
    namespace,
    ttl,
  });
};
