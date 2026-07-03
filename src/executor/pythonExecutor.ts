import Docker from 'dockerode';
import fs from 'fs-extra';
import path from 'path';
import { randomUUID } from 'crypto';
import { Stream } from 'node:stream/iter';
import { Writable } from 'stream';

const docker = new Docker();

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('TIMEOUT')), ms);
  });
}

export async function runPython(code: string, stdin?: string , timeoutMs = 5000): Promise<ExecutionResult> {
  const runId = randomUUID();
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

  const stream = await container.attach({ stream: true, stdout: true, stderr: true }) as NodeJS.ReadableStream;

  let stdout = '';
  let stderr = '';

  const stdoutStream = new Writable({
    write(chunk, _encoding, callback) {
      stdout += chunk.toString();
      callback();
    }
  });

  const stderrStream = new Writable({
    write(chunk, _encoding, callback) {
      stderr += chunk.toString();
      callback();
    }
  });


  docker.modem.demuxStream(stream, stdoutStream, stderrStream);

  let exitCode: number | null;
  let timedOut = false;

  try {
    const result = await Promise.race([
      container.wait(),
      timeoutPromise(timeoutMs),
    ]);
    exitCode = result.StatusCode;
  } catch (err) {
    //timeout promise won the race
    timedOut = true;
    exitCode = null;
    try {
      await container.kill();
    
    } catch (killErr) {
    
    }
  }

 
  await container.remove();

  await fs.remove(hostDir);

  return {
    stdout,
    stderr : timedOut ? stderr + '\n[Execution time out]' : stderr,
    exitCode
  };
}


