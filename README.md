# Rate Limiting Demo - Chat Application

A comprehensive demonstration of rate limiting implementation using Redis, Express.js, and a modern web interface. This project showcases the difference between rate-limited and non-rate-limited endpoints, highlighting the importance of rate limiting in preventing server overload.

## 🌟 Features

- **Dual Authentication System**
  - Authenticated users (8 requests/minute)
  - Guest users (2 requests/minute)
  
- **Two Chat Endpoints**
  - **With Rate Limiting**: Fast, instant responses with request limits
  - **Without Rate Limiting**: Queued processing with potential timeouts
  
- **Real-time Rate Limit Tracking**
  - Visual remaining request counter
  - Cooldown timer when limit exceeded
  - Automatic reset after window expires
  
- **Modern UI**
  - Clean, responsive design with Tailwind CSS
  - Real-time status updates
  - Message history with timestamps

## 📋 Prerequisites

Before running this application, ensure you have:

- **Node.js** (v16 or higher)
- **Redis** (v6 or higher)
- **pnpm** (v8 or higher) - or npm/yarn

## 🚀 Installation

1. **Clone the repository** (or navigate to the project directory)
   ```bash
   cd rate-limiting
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Ensure Redis is installed**
   
   **macOS (using Homebrew):**
   ```bash
   brew install redis
   ```
   
   **Ubuntu/Debian:**
   ```bash
   sudo apt-get install redis-server
   ```
   
   **Windows:**
   - Download from [Redis Windows](https://github.com/microsoftarchive/redis/releases)
   - Or use WSL with the Ubuntu instructions

## 🏃 Running the Application

### Step 1: Start Redis Server

**macOS/Linux:**
```bash
redis-server
```

**Windows:**
```bash
redis-server.exe
```

You should see output indicating Redis is running on port 6379.

### Step 2: Start the Application Server

In a new terminal window:

```bash
pnpm dev
```

The server will start on `http://localhost:3000`

### Step 3: Open the Application

Open your browser and navigate to:
```
http://localhost:3000
```

## 🎮 How to Use

### Authentication

1. **Login as Authenticated User**
   - Use one of these test credentials:
     - `user1` / `pass1`
     - `user2` / `pass2`
     - `admin` / `admin123`
   - Authenticated users get **8 requests per minute**

2. **Continue as Guest**
   - Click "Continue as Guest" button
   - Guest users get **2 requests per minute**

### Testing Rate Limiting

#### Scenario 1: Rate Limiting in Action (Recommended First Test)

1. Login or continue as guest
2. Ensure "Use Rate Limiter" toggle is **ON** (blue)
3. Send multiple messages quickly:
   - **Guest users**: Send 3+ messages rapidly
   - **Authenticated users**: Send 9+ messages rapidly
4. Observe:
   - First 2 (guest) or 8 (authenticated) messages get instant responses
   - Additional messages show "Rate limit exceeded" error
   - Cooldown timer appears showing seconds until reset
   - Send button is disabled during cooldown
   - After cooldown expires, you can send messages again

#### Scenario 2: Without Rate Limiting (Timeout Behavior)

1. Toggle "Use Rate Limiter" to **OFF** (gray)
2. Send multiple messages quickly (5-10 messages)
3. Observe:
   - Messages are queued for processing
   - Each message takes 2-3 seconds to process
   - If queue is too long, requests timeout after 20 seconds
   - Error message: "Request timeout - server could not process in time"
   - This demonstrates why rate limiting is important!

#### Scenario 3: Comparing User Types

1. Login as authenticated user
2. Send 8 messages quickly with rate limiter ON
3. Logout and continue as guest
4. Send 2 messages quickly with rate limiter ON
5. Compare the different rate limits

### Toggle Between Endpoints

- **Rate Limiter ON** (Blue Toggle)
  - Uses `/chat/with-rate-limit` endpoint
  - Instant responses
  - Protected by rate limits
  - Shows remaining requests
  - Cooldown timer when limit exceeded

- **Rate Limiter OFF** (Gray Toggle)
  - Uses `/chat/without-rate-limit` endpoint
  - Queued processing (2-3 seconds per message)
  - No rate limits
  - Can timeout under heavy load (20 second timeout)
  - Demonstrates server overload scenario

## 📡 API Endpoints

### Authentication

#### POST `/auth/login`
Login with username and password.

**Request:**
```json
{
  "username": "user1",
  "password": "pass1"
}
```

**Response:**
```json
{
  "success": true,
  "userId": "user1",
  "isAuthenticated": true
}
```

#### POST `/auth/guest`
Generate a guest user ID.

**Response:**
```json
{
  "success": true,
  "userId": "guest_1234567890_5678",
  "isAuthenticated": false
}
```

### Chat

#### POST `/chat/with-rate-limit`
Send a message with rate limiting protection.

**Request:**
```json
{
  "userId": "user1",
  "isAuthenticated": true,
  "message": "Hello!"
}
```

**Success Response (200):**
```json
{
  "response": "Hello! - AI generated response",
  "remainingRequests": 7,
  "resetTime": 1234567890000
}
```

**Rate Limit Exceeded (429):**
```json
{
  "error": "Rate limit exceeded",
  "remainingRequests": 0,
  "resetTime": 1234567890000,
  "cooldownSeconds": 45
}
```

#### POST `/chat/without-rate-limit`
Send a message without rate limiting (queued processing).

**Request:**
```json
{
  "userId": "user1",
  "message": "Hello!"
}
```

**Success Response (200):**
```json
{
  "response": "Hello! - AI generated response"
}
```

**Timeout Response (408):**
```json
{
  "error": "Request timeout - server could not process in time"
}
```

### Health Check

#### GET `/health`
Check server and Redis connection status.

**Response:**
```json
{
  "status": "ok",
  "redis": "connected",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## ⚙️ Configuration

Configuration is managed in [`src/config.ts`](src/config.ts):

```typescript
export const config = {
  rateLimit: {
    guest: {
      maxRequests: 2,        // Max requests per window
      windowMs: 60000,       // 1 minute window
    },
    authenticated: {
      maxRequests: 8,        // Max requests per window
      windowMs: 60000,       // 1 minute window
    },
  },
  request: {
    timeoutMs: 20000,        // 20 second timeout for non-rate-limited requests
  },
  redis: {
    host: 'localhost',
    port: 6379,
  },
  server: {
    port: 3000,
  },
};
```

### Customization Options

- **Rate Limits**: Adjust `maxRequests` and `windowMs` for different user types
- **Timeout**: Change `timeoutMs` for non-rate-limited endpoint behavior
- **Redis**: Configure connection settings if using remote Redis
- **Server Port**: Change the port if 3000 is already in use

## 📁 Project Structure

```
rate-limiting/
├── src/
│   ├── server.ts          # Express server setup and endpoints
│   ├── rateLimiter.ts     # Redis-based rate limiting logic
│   ├── auth.ts            # Authentication and user management
│   └── config.ts          # Application configuration
├── public/
│   └── index.html         # Frontend UI (Tailwind CSS)
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── README.md             # This file
```

### Key Components

- **[`src/server.ts`](src/server.ts:1)**: Main Express server with chat endpoints
- **[`src/rateLimiter.ts`](src/rateLimiter.ts:1)**: Sliding window rate limiter using Redis sorted sets
- **[`src/auth.ts`](src/auth.ts:1)**: Simple authentication with in-memory user store
- **[`src/config.ts`](src/config.ts:1)**: Centralized configuration
- **[`public/index.html`](public/index.html:1)**: Interactive chat UI with real-time updates

## 🔧 Development Scripts

```bash
# Start development server with auto-reload
pnpm dev

# Build TypeScript to JavaScript
pnpm build

# Run production server (after build)
pnpm start
```

## 🧪 Testing Scenarios

### Test 1: Basic Rate Limiting
1. Login as guest (2 req/min limit)
2. Send 3 messages quickly
3. Verify: First 2 succeed, 3rd shows rate limit error

### Test 2: Cooldown Timer
1. Trigger rate limit (send too many messages)
2. Observe cooldown timer counting down
3. Wait for timer to reach 0
4. Verify: Can send messages again

### Test 3: Authenticated vs Guest
1. Login as authenticated user
2. Send 8 messages (should all succeed)
3. Logout and continue as guest
4. Send 8 messages (only 2 should succeed)

### Test 4: Timeout Without Rate Limiting
1. Toggle rate limiter OFF
2. Send 10 messages rapidly
3. Observe: Some messages timeout after 20 seconds
4. Toggle rate limiter ON
5. Send 10 messages rapidly
6. Observe: Instant responses until rate limit hit

### Test 5: Multiple Users
1. Open app in two browser windows
2. Login as different users in each
3. Send messages from both
4. Verify: Each user has independent rate limits

## 🛠️ Troubleshooting

### Redis Connection Error
**Error:** `Redis connection error: ECONNREFUSED`

**Solution:**
1. Ensure Redis is running: `redis-server`
2. Check Redis is on port 6379: `redis-cli ping` (should return "PONG")
3. Verify config in [`src/config.ts`](src/config.ts:15)

### Port Already in Use
**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:**
1. Change port in [`src/config.ts`](src/config.ts:20)
2. Or kill process using port 3000:
   ```bash
   # macOS/Linux
   lsof -ti:3000 | xargs kill -9
   
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

### TypeScript Errors
**Error:** Module not found or type errors

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Rebuild TypeScript
pnpm build
```

## 📚 Learning Points

This demo illustrates:

1. **Rate Limiting Benefits**
   - Prevents server overload
   - Ensures fair resource distribution
   - Protects against abuse

2. **Sliding Window Algorithm**
   - More accurate than fixed windows
   - Uses Redis sorted sets for efficiency
   - Automatic cleanup of old entries

3. **User Tier Management**
   - Different limits for different user types
   - Easy to extend for more tiers (premium, enterprise, etc.)

4. **Graceful Degradation**
   - Clear error messages when limits exceeded
   - Cooldown timers for better UX
   - Fallback behavior on Redis errors

## 🤝 Contributing

Feel free to experiment with:
- Different rate limiting strategies
- Additional user tiers
- Enhanced UI features
- Performance optimizations

## 📝 License

ISC

---

**Quick Start Summary:**
1. Start Redis: `redis-server`
2. Install deps: `pnpm install`
3. Start server: `pnpm dev`
4. Open browser: `http://localhost:3000`
5. Test with guest (2 req/min) or login (8 req/min)
6. Toggle rate limiter ON/OFF to see the difference!