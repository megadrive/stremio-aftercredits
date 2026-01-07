import Keyv from "keyv";
import KeyvSqlite from "@keyv/sqlite";
import KeyvRedis from "@keyv/redis";
import { appEnv } from "./appEnv.js";

const cacheStore = <T>(namespace?: string) => {
  if (appEnv.DATABASE_TYPE === "redis") {
    return new KeyvRedis<T>(appEnv.REDIS_URL);
  }

  return new KeyvSqlite({
    uri: `sqlite://${appEnv.SQLITE_PATH}`,
    table: namespace,
  });
};

export const createCache = <T>(namespace: string, ttl = appEnv.CACHE_TTL) => {
  console.info(
    `Using ${appEnv.DATABASE_TYPE} for caching (${namespace}) (TTL: ${ttl} ms)`,
  );

  return new Keyv<T>({
    store: cacheStore<T>(namespace),
    namespace,
    ttl,
  });
};
