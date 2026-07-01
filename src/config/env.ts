import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: process.env.PORT || 3000,
  REDIS_HOST: process.env.PORT || "localhost",
  REDIS_PORT: Number(process.env.REDIS_PORT || 6379),
};
