import Keyv from "keyv";
import KeyvSqlite from "@keyv/sqlite";

const DEFAULT_TTL = 1000 * 60 * 60 * 24 * 1; // 1

export const createCache = <T>(namespace: string, ttl = DEFAULT_TTL) => {
  return new Keyv<T>({
    store: new KeyvSqlite({
      uri: "sqlite://./cache.sqlite",
      table: namespace,
    }),
    namespace,
    ttl,
  });
};
