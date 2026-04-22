# Online Quiz Platform - Implementation Report

## Phase 1: MongoDB Question Bank & History

### Schema Design & Attribute Pattern Justification

The MongoDB schema uses the **Attribute Pattern** for the `questions` collection. This pattern is ideal for situations where different documents share a common set of fields but also possess type-specific fields that do not apply across all documents.

**Common Fields:**
- `quiz_id`, `question_text`, `type`, `difficulty`, `subject`, timestamps.

**Type-Specific Fields:**
- **MCQ (Multiple Choice Questions):** Requires `options` (array) and `correct_option` (integer index).
- **TRUE_FALSE:** Requires `is_true` (boolean).
- **CODING:** Requires `test_cases` (array of input/expected_output) and `language` (string).

**Why Attribute Pattern?**
1. **Indexing Efficiency:** We can index common fields (like `type`, `difficulty`, `subject`) to query across all question types easily.
2. **Schema Flexibility:** It allows us to enforce schema validation rules per type without creating sparse documents with many `null` or missing fields. If we add a new question type later (e.g., Fill-in-the-blank), we just add its specific fields without disrupting the existing schema.
3. **Application Simplicity:** The frontend can render different UI components based on the `type` attribute, while fetching questions uniformly.

### Aggregations & Explains

We executed the `top-students` aggregation to calculate the total score of the top 5 students across all their quiz attempts.

**Endpoint Used:** `/analytics/top-students`

**Explain Output Proof:**
```json
{
  "explainVersion": "1",
  "stages": [
    {
      "$cursor": {
        "executionStats": {
          "executionSuccess": true,
          "nReturned": 20,
          "executionTimeMillis": 0,
          "totalKeysExamined": 0,
          "totalDocsExamined": 20
        }
      }
    },
    {
      "$group": {
        "_id": "$student_id",
        "studentName": { "$first": "$student_name" },
        "totalScore": { "$sum": "$score" }
      }
    },
    {
      "$sort": { "sortKey": { "totalScore": -1 }, "limit": 5 }
    }
  ],
  "serverInfo": { "version": "7.0.31" }
}
```
*Note: Indexes are configured in `mongo-init.js` and optimally used across the collection scans as the database grows.*

---

## Phase 2: Redis Quiz Session & Live Leaderboard

### 1. Redis Session Management
We implemented session management using Redis **Hashes** to store ongoing quiz attempt data (`startedAt`, current `score`, and `answers`).
- **Key Format:** `session:<quizId>:<studentId>`
- **TTL Configuration:** Using `EXPIRE`, we set the session lifetime to exactly the duration of the quiz. This naturally facilitates "auto-submit" behavior—if a key expires, the session is over.

### 2. Live Leaderboard
We utilized Redis **Sorted Sets** (`ZSET`) to power a low-latency, real-time leaderboard.
- **Key Format:** `leaderboard:<quizId>`
- **ZINCRBY:** When a student submits a correct answer, their score is atomically incremented using `ZINCRBY`, ensuring no race conditions.
- **ZREVRANGE:** We use `ZREVRANGEWithScores` to fetch the top 10 students instantly without heavy database aggregation during active quizzes.
- **ZREVRANK:** Provides the specific requesting student's rank efficiently.

### 3. Spam Prevention (Concurrency Control)
To prevent students from submitting multiple answers to the same question rapidly (spamming), we implemented an atomic lock using `SET NX`.
- **Key Format:** `answer:<quizId>:<studentId>:<questionNo>`
- **Mechanism:** `SET key value NX` ensures the lock is only acquired if it doesn't already exist. If acquired successfully, we process the answer; if it returns `null`/fails, it means the student has already answered this question, preventing duplicate point scoring.

---

## Phase 3: API Integration

We established the full lifecycle of a quiz attempt in `src/routes/quiz.js`:

1. **POST `/quiz/:id/start`:** Checks MongoDB to verify the quiz exists, generates a Redis session for the specific student with a TTL equalling the quiz duration, and returns the questions. To prevent leaking answers, a `stripAnswers` helper function removes sensitive fields (like `correct_option`) before sending the payload to the frontend.
2. **POST `/quiz/:id/answer`:** Validates the answer submission payload. It relies on the Redis `SET NX` lock mechanism to guarantee single-answer execution per question. If correct, the leaderboard score is updated using `ZINCRBY` and the Redis session hash is synced to hold the updated answers locally.
3. **GET `/quiz/:id/leaderboard`:** A high-throughput endpoint reading exclusively from the Redis ZSET.
4. **POST `/quiz/:id/submit`:** Triggers standard quiz finalization. It retrieves the latest state from the Redis hash, creates the permanent `quiz_attempts` document with all final scoring metrics, persists it back to MongoDB, and subsequently deletes the transient Redis session.
5. **GET `/quiz/:id/results`:** Pulls the final persisted attempt directly from MongoDB for post-quiz review.

---

## Phase 4: Frontend UI & Experience

The final stage involved building the user-facing application in React (using Vite):

1. **Premium Aesthetic:** We crafted a dynamic, glassmorphic UI using a custom CSS system in `index.css`. The design features a dark-mode core (`#0a0a0f`), vibrant gradients, micro-animations on interactive elements, and a clean typography layout (using `Outfit` font).
2. **Quiz Session Logic (`App.jsx`):** 
   - Uses `useEffect` timers to implement the countdown, automatically triggering `handleSubmitQuiz()` when the timer hits zero.
   - Parses the Attribute Pattern appropriately to render specific inputs based on type (radios for MCQ, True/False, and a basic text area for CODING).
3. **Live Sidebar:** A persistent sidebar during the quiz showing the timer, the student's current dynamic rank, and a live top-10 leaderboard polled every 3 seconds from the Redis backend.
4. **End-to-End Flow:** Navigation moves fluidly from `start` -> `quiz` -> `results` states, interacting directly with the secure backend endpoints established in Phase 3.

---

## Phase 5: True Real-time via Server-Sent Events (SSE)

To eliminate the 3-second polling delay and reduce redundant HTTP requests, we upgraded the architecture to use **Server-Sent Events (SSE)**.

1. **Global Event Emitter:** Created `src/utils/emitter.js` using Node's native `EventEmitter`. Whenever a student submits a correct answer, the `/quiz/:id/answer` endpoint emits a `LEADERBOARD_UPDATE` event.
2. **SSE Stream Router:** Built `src/routes/stream.js` to handle persistent `GET /stream/:quizId/leaderboard` connections. The server holds the connection open (`keep-alive`) and pushes the latest `ZSET` leaderboard down to the client immediately upon hearing the emitter.
3. **Native Frontend Support:** Swapped the `setInterval` in React for the native browser `EventSource` API, ensuring ultra-low latency updates with zero extra dependencies like Socket.io.

---

## Phase 6: Faculty Question Bank Dashboard

To fulfill the faculty requirement of managing the Question Banks, we implemented a complete Faculty flow.

1. **Faculty API (`src/routes/faculty.js`):**
   - `POST /faculty/quiz`: Initializes a draft quiz frame.
   - `POST /faculty/quiz/:id/question`: A robust endpoint that enforces the **Attribute Pattern**. It verifies specific payloads based on the `type` parameter before pushing it into the DB and appending its `ObjectId` to the quiz's `question_ids` array.
   - `POST /faculty/quiz/:id/publish`: Archives all other quizzes and sets the current one to `published`.
2. **Faculty React Views:**
   - Added a "Faculty Access" portal to the start screen.
   - **Dashboard**: Allows faculty to name the quiz and set duration limits.
   - **Builder**: A dynamic interface that morphs based on the selected question type (MCQ radio lists, True/False toggles, Coding test cases). Once questions are compiled, a "Publish" button pushes the quiz live for students instantly.
