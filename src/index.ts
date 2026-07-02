import express from "express";
import { env } from "./config/env";
import { submitRouter } from "./api/submit";
import "./queue/submissionWorker";

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/", submitRouter);

app.listen(env.PORT, () => {
  console.log(`RCE engine listening on port ${env.PORT}`);
});
