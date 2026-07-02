import { Router } from 'express';
import { randomUUID } from 'crypto';
import { SubmissionRequest, SubmissionResponse } from '../types/submission';
import { submissionQueue } from '../queue/submissionQueue';


export const submitRouter = Router();

submitRouter.post('/submit', async (req, res) => {
  const body: SubmissionRequest = req.body;
  if (!body.language || !body.code) {
    return res.status(400).json({ error: 'language and code are required' });
  }

  const id = randomUUID();
  await submissionQueue.add('run-submission', {
    id,
    language: body.language,
    code: body.code,
    stdin: body.stdin,
  });

  const response: SubmissionResponse = { id, status: 'queued' };
  res.status(202).json(response)
})