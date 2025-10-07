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

// Queue for non-rate-limited requests
interface QueuedRequest {
  userId: string;
  message: string;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timestamp: number;
}

const requestQueue: QueuedRequest[] = [];
let isProcessingQueue = false;

// Process queue sequentially with artificial delay
async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) {
    return;
  }

  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    if (!request) break;

    // Simulate processing delay (2-3 seconds)
    const delay = 2000 + Math.random() * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Check if request has timed out
    const elapsed = Date.now() - request.timestamp;
    if (elapsed >= config.request.timeoutMs) {
      request.reject({ timeout: true });
    } else {
      request.resolve({
        response: `${request.message} - AI generated response`
      });
    }
  }

  isProcessingQueue = false;
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

    // Process the request (instant response)
    const response = `${message} - AI generated response`;

    res.json({
      response,
      remainingRequests: rateLimitResult.remainingRequests,
      resetTime: rateLimitResult.resetTime
    });
  } catch (error) {
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

  // Create a promise that will be resolved when the request is processed
  const requestPromise = new Promise<any>((resolve, reject) => {
    requestQueue.push({
      userId,
      message,
      resolve,
      reject,
      timestamp: Date.now()
    });

    // Start processing the queue
    processQueue();
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