import dotenv from "dotenv";
import { DatabaseError } from "pg";
dotenv.config();

export const env = {
  PORT: process.env.PORT || 3000,
  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: Number(process.env.REDIS_PORT || 6379),
  DATABASE_URL: process.env.DATABASE_URL || "",
};
