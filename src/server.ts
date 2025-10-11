import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import redisClient from './redisClient';
import { TIERS } from './tiers';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const USERS = [
  { id: 1, name: 'Alice', tier: 'Free' },
  { id: 2, name: 'Bob', tier: 'Silver' },
  { id: 3, name: 'Charlie', tier: 'Gold' },
  { id: 4, name: 'David', tier: 'Platinum' }
];

let rateLimitingEnabled = true;

app.get('/users', (req, res) => {
  res.json(USERS);
});

app.get('/status', async (req, res) => {
  const redisStatus = redisClient.isOpen ? 'connected' : 'disconnected';
  res.json({ rateLimitingEnabled, redis: redisStatus });
});

app.post('/toggle-rate-limit', (req, res) => {
  const { enabled } = req.body;
  rateLimitingEnabled = enabled;
  res.json({ rateLimitingEnabled });
});

app.post('/chat', async (req, res) => {
  const { userId, message } = req.body;

  const user = USERS.find(u => u.id === Number(userId));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const limit = TIERS[user.tier as keyof typeof TIERS];

  if (!rateLimitingEnabled) {
    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', limit.toString());
    
    setTimeout(() => {
      res.json({
        user: user.name,
        message,
        response: `Simulated AI reply: ${message}`
      });
    }, 1000);
    return;
  }

  try {
    const key = `rate:${userId}`;
    const now = Date.now();
    const refillRate = limit / 60;

    let data = await redisClient.get(key);
    let tokens: number;
    let lastRefill: number;

    if (!data) {
      tokens = limit;
      lastRefill = now;
    } else {
      const parsed = JSON.parse(data);
      tokens = parsed.tokens;
      lastRefill = parsed.lastRefill;

      const elapsed = (now - lastRefill) / 1000;
      const refillAmount = elapsed * refillRate;
      tokens = Math.min(limit, tokens + refillAmount);
      lastRefill = now;
    }

    if (tokens >= 1) {
      tokens -= 1;
      await redisClient.set(key, JSON.stringify({ tokens, lastRefill }));

      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', Math.floor(tokens).toString());

      setTimeout(() => {
        res.json({
          user: user.name,
          message,
          response: `Simulated AI reply: ${message}`
        });
      }, 1000);
    } else {
      await redisClient.set(key, JSON.stringify({ tokens, lastRefill }));

      const retryAfter = Math.ceil((1 - tokens) / refillRate);
      
      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('Retry-After', retryAfter.toString());

      res.status(429).json({
        error: 'Rate limit exceeded',
        limit,
        remaining: 0,
        retryAfter
      });
    }
  } catch (error) {
    console.error('Redis error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});