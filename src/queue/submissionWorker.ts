import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { submissionQueue } from "./submissionQueue";

