# Quiz Platform - Docker Compose Setup Guide

## Prerequisites
- Docker Desktop (includes Docker and Docker Compose)
- Node.js 20+ (for local development if not using Docker)
- Git

## Quick Start (3 commands)

```bash
# 1. Clone the repo and navigate to it
cd quiz-platform

# 2. Copy environment template and customize if needed
cp .env.example .env

# 3. Start all services (MongoDB, Redis, Node app)
docker-compose up -d

# 4. Verify services are healthy
docker-compose ps
```

**Expected output:**
```
NAME                COMMAND             STATUS
quiz-mongodb        mongod --auth       Up (healthy)
quiz-redis          redis-server        Up (healthy)
quiz-app            npm run dev         Up
```

### 5. Start Frontend

```bash
docker-compose exec app sh
cd frontend
npm run dev
```

## Service URLs & Connection Strings

| Service | URL | Details |
|---------|-----|---------|
| **Node App** | http://localhost:3000 | Backend API |
| **MongoDB** | mongodb://root:rootpassword@localhost:27017 | Direct connection (external) |
| **Redis** | redis://localhost:6379 | Direct connection (external) |
| **Mongo Express** | (optional) Port 8081 | MongoDB admin UI |

## Common Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f mongodb
docker-compose logs -f redis
docker-compose logs -f app
```

### Stop Everything
```bash
docker-compose down

# Keep volumes (data persists)
docker-compose down --volumes
```

### Restart a Service
```bash
docker-compose restart mongodb
docker-compose restart redis
docker-compose restart app
```

### Access MongoDB Shell Inside Container
```bash
docker-compose exec mongodb mongosh -u root -p rootpassword --authenticationDatabase admin quiz_platform
```

### Access Redis CLI
```bash
docker-compose exec redis redis-cli
```

### Rebuild App After Dependencies Change
```bash
docker-compose up --build
```

## What's Running

### MongoDB (Port 27017)
- **Collections:** questions, quizzes, quiz_attempts
- **Schemas:** JSON schema validation enabled
- **Indexes:** Optimal indexes for queries and aggregations
- **Data:** Persisted in `mongodb_data` volume

### Redis (Port 6379)
- **Session Keys:** `session:<quizId>:<studentId>`
- **Leaderboard:** Sorted Set `leaderboard:<quizId>`
- **Spam Prevention:** SET `answer:<quizId>:<studentId>:<questionNo>`
- **Data:** Persisted with AOF (Append-Only File)

### Node App (Port 3000)
- **Auto-reload:** On file changes (nodemon in dev mode)
- **Hot reload:** Frontend at Port 5173 (if using Vite)
- **Logs:** Stream to console

## Database Access from Your Code

### MongoDB (using Mongoose or native driver)
```javascript
const mongoUri = process.env.MONGO_URI 
  || 'mongodb://root:rootpassword@mongodb:27017/quiz_platform?authSource=admin';
const client = new MongoClient(mongoUri);
```

### Redis (using redis client)
```javascript
const redis = require('redis');
const client = redis.createClient({
  host: process.env.REDIS_HOST || 'redis',
  port: process.env.REDIS_PORT || 6379
});
```

## Troubleshooting

### Services won't start
```bash
# Check if ports are already in use
lsof -i :27017  # MongoDB
lsof -i :6379   # Redis
lsof -i :3000   # App

# Kill existing process
kill -9 <PID>
```

### MongoDB won't connect
```bash
# Check MongoDB health
docker-compose exec mongodb mongosh -u root -p rootpassword --authenticationDatabase admin

# If it fails, restart
docker-compose restart mongodb
```

### Redis issues
```bash
# Test Redis connection
docker-compose exec redis redis-cli ping
# Should return: PONG
```

### App crashes on startup
```bash
# View full logs
docker-compose logs app

# Rebuild and restart
docker-compose down
docker-compose up --build
```

## Development Workflow (for both developers)

1. **Pull latest code**
   ```bash
   git pull origin main
   ```

2. **Install/update dependencies** (if package.json changed)
   ```bash
   npm install
   # OR inside container
   docker-compose exec app npm install
   ```

3. **Start services**
   ```bash
   docker-compose up -d
   ```

4. **Code and test**
   - Your edits auto-reload in the container
   - Check logs: `docker-compose logs -f app`

5. **Commit and push**
   ```bash
   git add .
   git commit -m "feature: your message"
   git push origin feature-branch
   ```

## Shutting Down

```bash
# Stop all containers (data persists)
docker-compose down

# Full cleanup (removes all data)
docker-compose down -v
```

## Next Steps

1. **Create `/src` folder structure** with your backend code
2. **Implement MongoDB schemas** (Person A focus)
3. **Implement Redis session logic** (Person B focus)
4. **Create API endpoints** (both collaborate)
5. **Test with Postman/curl** before frontend

## Need Help?

Check logs first:
```bash
docker-compose logs -f
```

Verify health:
```bash
docker-compose ps
```

Restart everything:
```bash
docker-compose down
docker-compose up -d
```

