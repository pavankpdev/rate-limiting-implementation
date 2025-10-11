import dotenv from 'dotenv';
import { createClient } from 'redis';

dotenv.config();

const client = createClient({
  url: process.env.REDIS_URL
});

client.on('connect', () => {
  console.log('Connected to Redis');
});

client.on('error', (err) => {
  console.error('Redis error:', err);
});

client.connect();

export default client;