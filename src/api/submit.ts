import { Router } from 'express';
import { randomUUID } from 'crypto';
import { SubmissionRequest, SubmissionResponse } from '../types/submission';
import { submissionQueue } from '../queue/submissionQueue';
import { prisma } from '../lib/prisma';


export const submitRouter = Router();

submitRouter.post('/submit', async (req, res) => {
  const body: SubmissionRequest = req.body;
  if (!body.language || !body.code) {
    return res.status(400).json({ error: 'language and code are required' });
  }

  const id = randomUUID();

  await prisma.submission.create({
    data: {
      id,
      language: body.language,
      code: body.code,
      stdin: body.stdin,
      status: 'queued'
    },
  })
  
  await submissionQueue.add('run-submission', {
    id,
    language: body.language,
    code: body.code,
    stdin: body.stdin,
  });

  const response: SubmissionResponse = { id, status: 'queued' };
  res.status(202).json(response)
})


submitRouter.get('/submit/:id', async (req, res) => {
  const { id } = req.params;

  const submission = await prisma.submission.findUnique({
    where: { id },
  });

  if (!submission) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  res.status(200).json(submission);
})