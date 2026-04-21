# Quiz Platform 🎯

A timed online quiz platform with real-time leaderboards, built for faculty to create question banks and students to take quizzes with countdown timers. Live leaderboard updates as participants answer questions.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React/Vue)                     │
│              Timer | Question Nav | Leaderboard             │
└────────────────────────┬────────────────────────────────────┘
                         │ (HTTP)
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
| **Frontend**         | React/Vue (TBD)      | Quiz UI with countdown timer                          |
| **Containerization** | Docker Compose       | Local development environment                         |

<!--
## Directory Structure

```
quiz-platform/
├── docker-compose.yml         # Services: MongoDB, Redis, Node app
├── Dockerfile                 # Node.js container
├── package.json               # Dependencies
├── .env.example               # Environment template
├── SETUP.md                   # Setup instructions
├── src/
│   ├── index.js              # Express server entry point
│   ├── routes/               # API endpoints (TODO)
│   │   ├── quiz.js           # Quiz logic
│   │   ├── answer.js         # Answer submission
│   │   └── leaderboard.js    # Leaderboard API
│   ├── models/               # MongoDB schemas (TODO)
│   │   ├── Question.js
│   │   ├── Quiz.js
│   │   └── QuizAttempt.js
│   ├── redis/                # Redis helpers (TODO)
│   │   ├── session.js        # Session management
│   │   └── leaderboard.js    # Leaderboard logic
│   ├── db/                   # Database connections (TODO)
│   │   ├── mongo.js
│   │   └── redis.js
│   └── utils/                # Utilities (TODO)
├── scripts/
│   ├── mongo-init.js         # MongoDB initialization
│   ├── test-connections.js   # Connection tests
│   └── seed-questions.js     # Load 30+ test questions (TODO)
├── frontend/                 # React/Vue app (TODO)
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── QuizStart.jsx
│   │   │   ├── QuestionView.jsx
│   │   │   ├── Timer.jsx
│   │   │   └── Leaderboard.jsx
│   │   ├── pages/
│   │   │   ├── QuizPage.jsx
│   │   │   └── ResultsPage.jsx
│   │   └── App.jsx
│   └── vite.config.js
└── tests/                    # Unit/integration tests (TODO)
```
 -->

## Getting Started

### 1. **Clone & Setup** (5 min)

```bash
git clone <repo-url> quiz-platform
cd quiz-platform
cp .env.example .env
```

### 2. **Start Services** (1 min)

```bash
docker-compose up -d
```

### 3. **Test Connections** (1 min)

```bash
npm run test:connections
```

✅ Should see: `All connections successful!`

### 4. **View Health** (1 min)

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

**See [SETUP.md](./SETUP.md) for detailed instructions.**

## Work Division (3 Days)

### **Day 1: Shared Foundation**

- [ ] Both: Project setup, Docker, environment
- [ ] Both: Create API route skeletons
- [ ] Both: Seed 30 test questions to MongoDB

### **Days 1–2: Parallel Development**

- **Person A (MongoDB + Analytics)**
  - [ ] MongoDB aggregations (avg score, top 5 students, difficulty analysis)
  - [ ] Quiz results endpoint with score breakdown
  - [ ] Ranking and leaderboard persistence
  - [ ] `explain()` output for index optimization

- **Person B (Redis + Real-time)**
  - [ ] Redis session management with TTL
  - [ ] Live leaderboard Sorted Set (ZADD, ZREVRANGE)
  - [ ] Spam prevention (SET NX for one answer per question)
  - [ ] Answer submission endpoint (Redis + MongoDB sync)

### **Days 2–3: UI & Integration**

- **Person A**: Results page, analytics dashboard
- **Person B**: Quiz UI, timer sync, auto-submit on TTL expiry

## API Endpoints (Contracts)

### Quiz Session

```
POST /quiz/:id/start
Response: { sessionId, duration, questions: [...] }

POST /quiz/:id/answer
Body: { question_index, answer }
Response: { correct, score, leaderboard_rank }

POST /quiz/:id/submit
Response: { final_score, passed, rank }
```

### Leaderboard

```
GET /quiz/:id/leaderboard?student_id=...
Response: { top_10: [...], your_rank: N, your_score: X }
```

### Results

```
GET /quiz/:id/results?attempt_id=...
Response: {
  score, percentage, passed,
  answers: [{ q, your_answer, correct_answer, is_correct }, ...],
  rank, total_attempts
}
```

## Development Notes

### MongoDB Attribute Pattern

Questions use **Attribute Pattern** for flexible schema:

- **MCQ**: `options`, `correct_option`
- **TRUE_FALSE**: `is_true`
- **CODING**: `test_cases`, `language`

All share: `quiz_id`, `question_text`, `type`, `difficulty`

### Redis Keys

- **Session**: `session:<quizId>:<studentId>` (Hash, expires at quiz end)
- **Leaderboard**: `leaderboard:<quizId>` (Sorted Set, scored by correct answers)
- **Spam Prevention**: `answer:<quizId>:<studentId>:<questionNo>` (SET, NX only)

### MongoDB Indexes

```javascript
db.quiz_attempts.createIndex({ quiz_id: 1, score: -1 }); // Leaderboard
db.quiz_attempts.createIndex({ student_id: 1, quiz_id: 1 }); // Student history
```

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

## Next Steps

1. **Initialize git** and push to GitHub
2. **Create feature branches** for Person A & B
3. **Run test-connections.js** to verify setup
4. **Start implementing** (see Work Division above)
5. **Daily sync** (5 min) on what's blocking

## Questions?

- Check [SETUP.md](./SETUP.md) for troubleshooting
- Review Docker logs: `docker-compose logs -f`
- Test connections: `npm run test:connections`
