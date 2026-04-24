# Quiz Platform

A high-performance, real-time online quiz platform. Built with a focus on low-latency updates and scalable architecture, it allows faculty to create dynamic assessments and students to compete on live leaderboards.

## Features

- **Real-Time Leaderboards:** Live ranking updates utilizing Redis Sorted Sets.
- **Dynamic Question Types:** Support for Multiple Choice, True/False, and Coding questions using the MongoDB Attribute Pattern.
- **Session Management:** Secure, time-bound quiz sessions powered by Redis TTL.
- **Analytics & Reporting:** Comprehensive insights into quiz performance using MongoDB aggregations.
- **Concurrency & Spam Prevention:** Distributed locking and request throttling to ensure fairness.

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React/Vue)                     │
│              Timer | Question Nav | Leaderboard             │
└────────────────────────┬────────────────────────────────────┘
                         │ (HTTP / SSE)
┌────────────────────────▼────────────────────────────────────┐
│                   Express API (Node.js)                     │
│    Routes: /quiz/:id/start, /answer, /leaderboard           │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
    ┌─────▼─────┐              ┌───────▼────────┐
    │  MongoDB  │              │     Redis      │
    │ Permanent │              │   Real-time    │
    │  Storage  │              │   Ephemeral    │
    └───────────┘              └────────────────┘

    Collections:          Keys:
    - questions           - session:<quizId>:<studentId>
    - quizzes             - leaderboard:<quizId>
    - quiz_attempts       - answer:<quizId>:<studentId>:<qNo>
```

## Tech Stack

| Component            | Technology           | Role                                                  |
| -------------------- | -------------------- | ----------------------------------------------------- |
| **Backend**          | Node.js 20 + Express | API server                                            |
| **Database**         | MongoDB 7.0          | Permanent storage (questions, quizzes, attempts)      |
| **Cache**            | Redis 7              | Session management, live leaderboard, spam prevention |
| **Frontend**         | React + Vite         | Quiz UI with countdown timer                          |
| **Containerization** | Docker Compose       | Local development environment                         |

## Getting Started

### 1. Clone & Setup

```bash
git clone <repo-url> quiz-platform
cd quiz-platform
cp .env.example .env
```

### 2. Start Services

```bash
docker-compose up -d
```

### 3. Test Connections

```bash
npm run test:connections
```

Expected output: `All connections successful!`

### 4. View Health

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "services": {
    "mongodb": "connected",
    "redis": "connected"
  }
}
```

### 5. Start Frontend

```bash
docker-compose exec app sh
cd frontend
npm run dev
```

**See [SETUP.md](./SETUP.md) for detailed instructions.**

## System Design

### MongoDB Schema Design

Questions utilize the **Attribute Pattern** for a flexible schema:

- **MCQ**: `options`, `correct_option`
- **TRUE_FALSE**: `is_true`
- **CODING**: `test_cases`, `language`

All questions share common attributes: `quiz_id`, `question_text`, `type`, `difficulty`.

**Indexes:**

```javascript
db.quiz_attempts.createIndex({ quiz_id: 1, score: -1 }); // Leaderboard query optimization
db.quiz_attempts.createIndex({ student_id: 1, quiz_id: 1 }); // Student history lookups
```

### Redis Implementation

- **Session**: `session:<quizId>:<studentId>` (Hash, expires at quiz end)
- **Leaderboard**: `leaderboard:<quizId>` (Sorted Set, scored by correct answers)
- **Spam Prevention**: `answer:<quizId>:<studentId>:<questionNo>` (SET, NX only)

## API Endpoints

### Quiz Session

- `POST /quiz/:id/start`: Initialize a quiz session
  - **Response:** `{ sessionId, duration, questions: [...] }`
- `POST /quiz/:id/answer`: Submit an answer
  - **Body:** `{ question_index, answer }`
  - **Response:** `{ correct, score, leaderboard_rank }`
- `POST /quiz/:id/submit`: Finalize and submit quiz
  - **Response:** `{ final_score, passed, rank }`

### Leaderboard & Analytics

- `GET /quiz/:id/leaderboard`: Retrieve live leaderboard rankings
  - **Query:** `?student_id=...`
  - **Response:** `{ top_10: [...], your_rank: N, your_score: X }`
- `GET /quiz/:id/results`: Fetch detailed attempt analytics
  - **Query:** `?attempt_id=...`
  - **Response:** `{ score, percentage, passed, answers: [...], rank, total_attempts }`

## Helpful Commands

```bash
# View all services
docker-compose ps

# Follow logs
docker-compose logs -f app

# Access MongoDB
docker-compose exec mongodb mongosh -u root -p rootpassword --authenticationDatabase admin

# Access Redis
docker-compose exec redis redis-cli

# Restart a service
docker-compose restart app

# Full cleanup
docker-compose down -v
```
