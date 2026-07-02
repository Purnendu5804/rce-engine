import Docker from 'dockerode';
import fs from 'fs-extra';
import path from 'path';
import { randomUUID } from 'crypto';
import { Stream } from 'node:stream/iter';

const docker = new Docker();

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export async function runPython(code: string, stdin?: string): Promise<ExecutionResult> {
  const runId = randomUUID;
  const hostDir = path.join('/tmp/submissions', runId as any);
  await fs.ensureDir(hostDir);
  await fs.writeFile(path.join(hostDir, 'main.py'), code);

  const container = await docker.createContainer({
    Image: 'rce-python:latest',
    Cmd: ['python', '/code/main.py'],
    HostConfig: {
      Binds: [`${hostDir}:/code`],
      Memory: 128 * 1024 * 1024,
      NetworkMode: 'none',
      PidsLimit: 64,
    },
    Tty: false,
  });

  await container.start();

  const steam = await container.attach({ stream: true, stdout: true, stderr: true }) as NodeJS.ReadableStream;

  let stdout = '';
  let stderr = '';

  docker.modem.demuxStream(
    stream,
    { write: (chunk: Buffer) => { stdout += chunk.toString(); } },
    { write: (chunk: Buffer) => { stderr += chunk.toString(); } }
  );

  const result = await container.wait();
  await container.remove();

  await fs.remove(hostDir);

  return {
    stdout,
    stderr,
    exitCode: result.StatusCode,
  };
}

}
