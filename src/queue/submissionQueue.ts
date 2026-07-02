import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

export const SUBMISSION_QUEUE_NAME = 'submission-queue';

export const submissionQueue = new Queue(SUBMISSION_QUEUE_NAME, {
  connection : redisConnection as any,
})