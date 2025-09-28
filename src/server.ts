import express, { Request, Response } from 'express';
import cors from 'cors';
import crypto from "node:crypto";

const app = express();
app.use(cors());

function burnCpu(durationMs: number) {
  const end = performance.now() + durationMs;

  // Each pbkdf2Sync call ~1–3ms depending on machine
  const iterationsPerChunk = 5_000;
  while (performance.now() < end) {
    crypto.pbkdf2Sync("demo", "salt", iterationsPerChunk, 32, "sha256");
  }
}

app.get('/', async (req: Request, res: Response) => {

    const cpuMs = 1000

    const t0 = performance.now();

    burnCpu(cpuMs);

    const duration = Math.round(performance.now() - t0);

    res.json({
        message: "Hello, World!",
        durationMs: duration,
        at: new Date().toISOString(),
    });
    return
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});