import { cleanEnv, num, str } from "envalid";

export const appEnv = cleanEnv(process.env, {
  PORT: num({ default: 3000 }),
  DATABASE_TYPE: str({ default: "sqlite", choices: ["sqlite", "redis"] }),
  REDIS_URL: str({ default: "" }),
  SQLITE_PATH: str({ default: "./cache.sqlite" }),
});
