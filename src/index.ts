import express from "express";
import { env } from "./config/env";

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(env.PORT, () => {
  console.log(`RCE engine listening on port ${env.PORT}`);
});
