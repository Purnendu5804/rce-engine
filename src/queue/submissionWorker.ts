import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { SUBMISSION_QUEUE_NAME } from "./submissionQueue";
import { runPython } from "../executor/pythonExecutor";

export const submissionWorker = new Worker(
  SUBMISSION_QUEUE_NAME,
  async (job: Job) => {
    console.log('Processing job', job.id, job.data);

    //dockerode sambhalega yaha pe
    const { language, code, stdin } = job.data;

    if (language != 'python') {
      throw new Error(`Unsupported language: ${language}`);
    }

    const result = await runPython(code, stdin);
    //console.log(result)
    return result;

    
  },
  {
    connection: redisConnection as any
  }
);

submissionWorker.on('completed', (job) => {
  //console.log(job.returnvalue)
  console.log(`Job ${job.id} completed`);
});

submissionWorker.on('failed', (job, err) => {
  console.error(`Job %{job?.id} failed :`, err.message);
})