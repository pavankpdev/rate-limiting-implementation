# Rate Limiting Demo

A minimal demonstration project showcasing Redis-based rate limiting with a TypeScript Express server and interactive frontend chat interface.

## Features

- Token bucket rate limiting algorithm with automatic refill
- Redis-backed state persistence
- Multiple user tiers with different rate limits
- Real-time rate limit status display
- Interactive chat interface for testing
- Toggle rate limiting on/off for comparison
- RESTful API with proper HTTP headers

## Tech Stack

- **Backend**: TypeScript, Express.js, Redis
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Package Manager**: pnpm
- **Development**: ts-node-dev for hot reloading

## Prerequisites

- Node.js (v18 or higher)
- Redis server (local or cloud-hosted)
- pnpm (recommended) or npm

## Installation

Clone the repository and install dependencies:

```bash
pnpm install
```

Or using npm:

```bash
npm install
```

## Environment Setup

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Configure the following variables in `.env`:

```
PORT=3000
REDIS_URL=your_redis_connection_url
```

For local Redis, use:
```
REDIS_URL=redis://localhost:6379
```

For cloud Redis (e.g., Upstash), use the provided connection URL.

## Running the Project

### Development Mode

Start the server with hot reloading:

```bash
pnpm dev
```

### Production Mode

Build and run the compiled JavaScript:

```bash
pnpm build
pnpm start
```

The application will be available at `http://localhost:3000`

## Project Structure

```
rate-limiting-demo/
├── src/
│   ├── server.ts          Main Express server with API endpoints
│   ├── redisClient.ts     Redis client configuration
│   └── tiers.ts           User tier definitions and rate limits
├── public/
│   ├── index.html         Frontend chat interface
│   ├── script.js          Client-side logic and API calls
│   └── style.css          Styling and animations
├── package.json           Project dependencies and scripts
├── tsconfig.json          TypeScript configuration
├── .env.example           Environment variables template
└── .gitignore             Git ignore rules
```

## API Endpoints

### GET /users

Returns the list of available users with their tiers.

**Response:**
```json
[
  { "id": 1, "name": "Alice", "tier": "Free" },
  { "id": 2, "name": "Bob", "tier": "Silver" },
  { "id": 3, "name": "Charlie", "tier": "Gold" },
  { "id": 4, "name": "David", "tier": "Platinum" }
]
```

### GET /status

Returns the current rate limiting status and Redis connection state.

**Response:**
```json
{
  "rateLimitingEnabled": true,
  "redis": "connected"
}
```

### POST /toggle-rate-limit

Toggles rate limiting on or off.

**Request Body:**
```json
{
  "enabled": true
}
```

**Response:**
```json
{
  "rateLimitingEnabled": true
}
```

### POST /chat

Sends a chat message with rate limiting applied.

**Request Body:**
```json
{
  "userId": 1,
  "message": "Hello, world!"
}
```

**Success Response (200):**
```json
{
  "user": "Alice",
  "message": "Hello, world!",
  "response": "Simulated AI reply: Hello, world!"
}
```

**Rate Limit Exceeded (429):**
```json
{
  "error": "Rate limit exceeded",
  "limit": 2,
  "remaining": 0,
  "retryAfter": 30
}
```

**Response Headers:**
- `X-RateLimit-Limit`: Maximum requests per minute
- `X-RateLimit-Remaining`: Remaining requests available
- `Retry-After`: Seconds until next request allowed (on 429 only)

## User Tiers and Rate Limits

| Tier     | Requests per Minute | Example User |
|----------|---------------------|--------------|
| Free     | 2                   | Alice        |
| Silver   | 5                   | Bob          |
| Gold     | 10                  | Charlie      |
| Platinum | 15                  | David        |

## Testing Instructions

1. Start the server and open `http://localhost:3000` in your browser
2. Select a user from the dropdown menu
3. Type a message and click "Send Message"
4. Observe the rate limit counter decreasing with each request
5. Try sending messages rapidly to trigger rate limiting
6. Watch the automatic token refill over time
7. Toggle rate limiting off to see unlimited requests
8. Switch between users to test different tier limits

## How Rate Limiting Works

This project implements a **token bucket algorithm** with the following characteristics:

**Token Bucket Algorithm:**
- Each user has a bucket with a maximum capacity based on their tier
- Tokens refill continuously at a rate of `limit / 60` tokens per second
- Each request consumes 1 token
- Requests are blocked when no tokens are available
- Partial tokens accumulate for smooth refilling

**Implementation Details:**
- State is stored in Redis with keys formatted as `rate:{userId}`
- Each entry contains current token count and last refill timestamp
- Tokens refill based on elapsed time since last request
- Maximum tokens never exceed the tier limit
- When rate limited, the response includes `Retry-After` header

**Example:**
- Free tier user (2 requests/minute) gets 0.033 tokens per second
- After 30 seconds of inactivity, they have 1 full token available
- Tokens accumulate up to the maximum of 2

This approach provides smooth, predictable rate limiting without sudden resets.