import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { SUBMISSION_QUEUE_NAME } from "./submissionQueue";

export const submissionWorker = new Worker(
  SUBMISSION_QUEUE_NAME,
  async (job: Job) => {
    console.log('Processing job', job.id, job.data);

    //dockerode sambhalega yaha pe

    return { output: 'placeholder result' };
  },
  {
    connection: redisConnection as any
  }
);

submissionWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

submissionWorker.on('failed', (job, err) => {
  console.error(`Job %{job?.id} failed :`, err.message);
})