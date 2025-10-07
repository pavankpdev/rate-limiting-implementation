import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import { config } from './config';
import { authenticateUser, generateGuestId } from './auth';
import { checkRateLimit } from './rateLimiter';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

const redisClient = createClient({
  url: process.env.REDIS_URL as string,
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

// Serve index.html at root
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/health', (req: Request, res: Response) => {
  const redisStatus = redisClient.isOpen ? 'connected' : 'disconnected';
  res.json({
    status: 'ok',
    redis: redisStatus,
    timestamp: new Date().toISOString(),
  });
});

// Authentication endpoints
app.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      userId: null,
      isAuthenticated: false,
      error: 'Username and password are required',
    });
  }
  
  const result = authenticateUser(username, password);
  
  if (result.success) {
    res.json({
      success: true,
      userId: result.userId,
      isAuthenticated: true,
    });
  } else {
    res.status(401).json({
      success: false,
      userId: null,
      isAuthenticated: false,
      error: 'Invalid credentials',
    });
  }
});

app.post('/auth/guest', (req: Request, res: Response) => {
  const guestId = generateGuestId();
  
  res.json({
    success: true,
    userId: guestId,
    isAuthenticated: false,
  });
});

// Worker-pool + queue for demo (limited concurrency)
interface QueuedRequest {
  userId: string;
  message: string;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timestamp: number;
}

const requestQueue: QueuedRequest[] = [];
// Active worker count and simple stats for /metrics
let activeWorkers = 0;
let totalProcessed = 0;
let totalProcessingTime = 0;

const concurrency = config.workerPool?.concurrency ?? 4;
const maxQueueSize = config.workerPool?.maxQueueSize ?? 200;

// Simulate processing delay (2-3 seconds) and return AI-like response
function simulateProcessing(message: string): Promise<{ response: string }> {
  const delay = 2000 + Math.random() * 1000;
  return new Promise((resolve) =>
    setTimeout(() => resolve({ response: `${message} - AI generated response` }), delay)
  );
}

// Try to process as many queued requests as possible up to concurrency
function processNext() {
  while (activeWorkers < concurrency && requestQueue.length > 0) {
    const req = requestQueue.shift()!;
    activeWorkers++;

    (async () => {
      const start = Date.now();
      try {
        const result = await simulateProcessing(req.message);
        const elapsed = Date.now() - req.timestamp;

        if (elapsed >= config.request.timeoutMs) {
          req.reject({ timeout: true });
        } else {
          req.resolve(result);
        }
      } catch (err) {
        req.reject(err);
      } finally {
        totalProcessed++;
        totalProcessingTime += Date.now() - start;
        activeWorkers--;
        // Continue processing next queued requests
        processNext();
      }
    })();
  }
}

// Attempt to process immediately (bypass queue). Returns a promise if started, or null if capacity full.
function processImmediate(message: string, timestamp: number): Promise<{ response: string }> | null {
  if (activeWorkers >= concurrency) {
    return null;
  }

  activeWorkers++;
  const start = Date.now();

  const p = (async () => {
    try {
      const result = await simulateProcessing(message);
      const elapsed = Date.now() - timestamp;
      if (elapsed >= config.request.timeoutMs) {
        throw { timeout: true };
      }
      return result;
    } finally {
      totalProcessed++;
      totalProcessingTime += Date.now() - start;
      activeWorkers--;
    }
  })();

  // After finishing, kick off processing of queued items (if any)
  p.finally(() => processNext());
  return p;
}

// Chat endpoint WITH rate limiting
app.post('/chat/with-rate-limit', async (req: Request, res: Response) => {
  const { userId, isAuthenticated, message } = req.body;

  if (!userId || typeof isAuthenticated !== 'boolean' || !message) {
    return res.status(400).json({
      error: 'userId, isAuthenticated, and message are required'
    });
  }

  try {
    // Check rate limit
    const rateLimitResult = await checkRateLimit(redisClient, userId, isAuthenticated);

    if (!rateLimitResult.allowed) {
      // Calculate cooldown in seconds
      const cooldownSeconds = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);

      return res.status(429).json({
        error: 'Rate limit exceeded',
        remainingRequests: 0,
        resetTime: rateLimitResult.resetTime,
        cooldownSeconds: Math.max(0, cooldownSeconds)
      });
    }

    // For demo: protected endpoint attempts to process immediately.
    // If server capacity is exhausted, reject early to avoid queueing (demonstrates protection).
    const immediate = processImmediate(message, Date.now());
    if (!immediate) {
      return res.status(429).json({
        error: 'Server overloaded - try again shortly',
        queueLength: requestQueue.length,
        concurrency,
      });
    }

    const result = await immediate;

    res.json({
      response: result.response,
      remainingRequests: rateLimitResult.remainingRequests,
      resetTime: rateLimitResult.resetTime
    });
  } catch (error) {
    if ((error as any)?.timeout) {
      return res.status(408).json({
        error: 'Request timeout - server could not process in time'
      });
    }
    console.error('Error in rate-limited chat:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Chat endpoint WITHOUT rate limiting (with queue and timeout)
app.post('/chat/without-rate-limit', async (req: Request, res: Response) => {
  const { userId, message } = req.body;

  if (!userId || !message) {
    return res.status(400).json({
      error: 'userId and message are required'
    });
  }

  // If queue is too large, reject early
  if (requestQueue.length >= maxQueueSize) {
    return res.status(503).json({
      error: 'Server queue is full - try again later',
    });
  }

  // Create a promise that will be resolved when the request is processed
  const requestPromise = new Promise<any>((resolve, reject) => {
    requestQueue.push({
      userId,
      message,
      resolve,
      reject,
      timestamp: Date.now()
    });

    // Try to process queued items
    processNext();
  });

  // Set up timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject({ timeout: true });
    }, config.request.timeoutMs);
  });

  try {
    // Race between processing and timeout
    const result = await Promise.race([requestPromise, timeoutPromise]);
    res.json(result);
  } catch (error: any) {
    if (error.timeout) {
      res.status(408).json({
        error: 'Request timeout - server could not process in time'
      });
    } else {
      console.error('Error in non-rate-limited chat:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }
});

/**
 * Metrics endpoint for demo UI
 * Returns active worker count, queue length, average processing latency, and some counters.
 */
app.get('/metrics', (req: Request, res: Response) => {
  const avgLatencyMs = totalProcessed > 0 ? Math.round(totalProcessingTime / totalProcessed) : 0;
  res.json({
    activeWorkers,
    queueLength: requestQueue.length,
    avgLatencyMs,
    totalProcessed,
    concurrency,
    maxQueueSize,
  });
});

const startServer = async () => {
  try {
    await redisClient.connect();
    app.listen(config.server.port, () => {
      console.log(`Server running on port ${config.server.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();