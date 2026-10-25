# ReviseLive ⚡

> **Real-Time AI Classroom Revision Quiz Platform with Diagnostic Blindspot Analytics & Signature Pedagogy**

ReviseLive turns lecture notes, syllabus excerpts, and raw educational materials into real-time interactive revision games in seconds. Designed for classroom projectors, teacher consoles, and student mobile devices, ReviseLive replaces trivia fluff with rigorous retrieval practice, 2-sentence **Concept Anchors**, **Peer Instruction (Discuss & Re-vote)**, **Confidence Calibration**, **Misconception-labeled Distractors**, **Retest Rounds**, and **Student Revision Receipts**.

---

## 🚀 Key Features

### Distinct Visual Identity (Part B)
- **Letters First**: Options are identified primarily by letters **A, B, C, D** with prominent chips.
- **New Distinct Symbols**: Inline SVG shapes — **Hexagon, Five-point Star, Plus/Cross, Crescent** (no Kahoot triangles/diamonds).
- **Okabe–Ito Colorblind Palette**: Verified WCAG AA contrast ($\ge 4.5:1$):
  - **A**: Vermillion (`#C04900`) + Hexagon (White text: 5.00:1)
  - **B**: Sky Blue (`#56B4E9`) + 5-Point Star (Dark text: 7.74:1)
  - **C**: Amber Orange (`#E69F00`) + Plus/Cross (Dark text: 7.93:1)
  - **D**: Bluish Green (`#007654`) + Crescent (White text: 5.65:1)
- **Exam Paper / Study Notebook Theme**: Vertical stack of wide answer cards on the projector, serif typography for questions, calm warm-neutral tones.

### Signature Pedagogy Features (Parts C & D)
- **Misconception-Labeled Distractors (C1)**: Each incorrect option names the specific misconception that makes it tempting. Shown in QuizEditor, on the host reveal screen ("41% chose B: confuses mass with weight"), and privately on student devices.
- **Confidence Calibration (C2)**: After submitting an answer, students select their confidence level (**Guessing / Fairly sure / Certain**). Generates a "Confident Misconceptions" report flagging topics where students were certain and wrong.
- **Discuss & Re-vote / Peer Instruction (C3)**: When accuracy falls within a configurable range (default 30%–70%), the teacher can trigger a Peer Instruction discussion ("Convince a neighbour!"). Unrevealed response distribution is shown, followed by a re-vote with a Recovered bonus (+500 pts) and shift metrics (wrong→right, right→wrong).
- **Retest Round (C4 & F3)**: After the final leaderboard, teachers can launch a diagnostic retest round on weak questions (<50% accuracy) with reshuffled options. Retest scores and improvement deltas are tracked separately and persisted.
- **Teacher Console & Projector Display Split (C5)**: `/host/:pin` provides full control and private telemetry (live response histogram, teacher preview of correct answer, and nudge lists). `/display/:pin` is a clean, read-only presentation screen with zero teacher controls.
- **Student Revision Receipt (C6)**: Each student receives a private take-home link (`/r/:token`, 128-bit SHA-256 hashed) with a summary of missed questions, misconception explanations, Concept Anchors, printable stylesheet, and local self-marking practice mode.
- **Class Mastery Meter & Presets (D7)**: Presets for **Revision** (accuracy + confidence + class meter + peer instruction + retest + receipts), **Quick Fun** (speed + competitive), and **Exam Prep**. Accuracy scoring awards a flat +1000 points per correct answer, removing connection latency bias.
- **Friendly Nicknames (D6)**: Curated adjective-plus-animal generator ("Pick one for me") and optional host `autoNicknames` mode.
- **Printable Quiz PDF Export (F6)**: Generate clean, un-leaked Question Paper PDFs and comprehensive Answer Key PDFs with Concept Anchors and Devanagari/Hindi font support.
- **Session & Student Progress PDF Reports (F7)**: Download class-wide diagnostic summaries (Blindspot Radar, KPIs, retest before/after) and individualized student revision packets.
- **PDF Source Ingestion for AI Quiz Generation (F5)**: Direct upload of worksheets, chapters, and past exams up to 10 MB with automated text extraction, page-range selection, scanned image detection, and prompt-injection hardening.

---

## 📡 Authoritative Real-Time Protocol

| Event Name | Direction | Payload Summary | Purpose |
| :--- | :--- | :--- | :--- |
| `host:create-room` | Client → Server | `{ quizId, settings, classId }` | Host requests room creation with settings |
| `host:reconnect` | Client → Server | `{ pin, hostToken }` | Host reattaches to active session |
| `display:join` | Client → Server | `{ pin, displayToken }` | Classroom projector connects to read-only room |
| `host:start-question` | Client → Server | `{ pin }` | Host starts the next question |
| `host:end-question` | Client → Server | `{ pin }` | Host ends question timer early |
| `host:start-discussion` | Client → Server | `{ pin, seconds }` | Host triggers peer instruction discussion |
| `host:skip-discussion` | Client → Server | `{ pin }` | Host advances from discussion to re-vote |
| `host:show-leaderboard` | Client → Server | `{ pin }` | Host advances to leaderboard |
| `host:start-retest` | Client → Server | `{ pin, questionIndexes }` | Host initiates retest round on weak questions |
| `host:end-game` | Client → Server | `{ pin }` | Host finalizes session and persists report |
| `player:join` | Client → Server | `{ pin, name }` | Player joins room (supports friendly nicknames) |
| `player:rejoin` | Client → Server | `{ pin, playerId, reconnectToken }` | Player reconnects to existing seat |
| `player:submit-answer` | Client → Server | `{ pin, selectedIndex }` | Submits round-1 answer |
| `player:set-confidence` | Client → Server | `{ pin, level }` | Sets confidence level (1=Guessing, 2=Fairly sure, 3=Certain) |
| `player:submit-revote` | Client → Server | `{ pin, selectedIndex }` | Submits peer instruction revote answer |
| `game:question-start` | Server → Room | `{ questionIndex, totalQuestions, questionText, options, timeLimit, endsAt, serverNow }` | Starts question with strict protocol masking |
| `host:question-preview` | Server → Host | `{ questionIndex, correctIndex, explanation, distractorRationales }` | Private preview sent only to host socket |
| `game:discussion-start` | Server → Room | `{ questionIndex, questionText, options, distribution, endsAt, serverNow, seconds }` | Discussion round with unrevealed distribution |
| `game:revote-start` | Server → Room | `{ questionIndex, questionText, options, endsAt, serverNow, seconds }` | Re-vote phase with masked answer key |
| `game:question-reveal` | Server → Room | `{ correctIndex, explanation, topicTag, optionCounts, topDistractorRationale, confidentWrongCount, peerShift }` | Reveals answer, Concept Anchor, and analytics |
| `game:leaderboard-update` | Server → Room | `{ topPlayers, leaderboardMode, classMeter, you }` | Updates top 5 podium or Class Mastery Meter |
| `game:ended` | Server → Room | `{ sessionId, podium, finalLeaderboard, blindspotReport, receiptToken, receiptUrl }` | Game complete with receipts |

---

## ⚖️ Fairness & Timing Note

ReviseLive uses server-side monotonic timestamps (`process.hrtime.bigint()`) and an authoritative clock offset calculation on clients (`offset = serverNow - Date.now()`). While this prevents wall-clock tampering, physical network latency (ping) still affects arrival time by tens of milliseconds.

For high-stakes revision, teachers should use the **Accuracy Scoring Mode** (`scoringMode: "accuracy"`), which awards a flat 1,000 points per correct answer regardless of speed, entirely neutralizing network differences.

---

## ⚠️ Known Limitations

1. **In-Memory State**: Active rooms and socket mappings live in Node.js server memory. ReviseLive must run as a **single instance**. Horizontal multi-instance scaling requires sticky sessions and a Redis adapter (`@socket.io/redis-adapter`).
2. **Screen Wake Lock**: The Screen Wake Lock API requires an HTTPS origin or `localhost`. It does not activate over plain `http://<LAN-IP>` setups.
3. **Mobile Haptics**: `navigator.vibrate` is not supported on iOS Safari due to Apple WebKit platform constraints.
4. **No Password Reset**: ReviseLive does not currently include an automated email password reset workflow. If a teacher loses account credentials, they must contact an administrator or register a new account.

---

## 💻 Installation & Quickstart

1. **Clone & Install Dependencies**:
   ```bash
   git clone <repo-url> revise-live
   cd revise-live
   npm install
   ```

2. **Start MongoDB**:
   ```bash
   docker-compose up -d
   ```

3. **Seed Demo Account & Quiz**:
   ```bash
   npm run seed
   ```
   - **Teacher Email**: `teacher@reviselive.io`
   - **Password**: `password123`

4. **Start Development Environment**:
   ```bash
   npm run dev
   ```
   - Express Server: [http://localhost:5000](http://localhost:5000)
   - Vite Client: [http://localhost:5173](http://localhost:5173)

---

## 🎮 Classroom Workflow & Guide

### 🧑‍🏫 How to Host a Quiz (Teacher)

1. **Log In to Teacher Console**:
   - Navigate to [http://localhost:5173/login](http://localhost:5173/login) (or click **Teacher Login** from the home page).
   - Sign in with demo credentials (`teacher@reviselive.io` / `password123`) or register a new teacher account.

2. **Select or Create a Quiz**:
   - In your **Teacher Dashboard** (`/host`):
     - **Use Existing Quiz**: Choose any prepared quiz card (such as the seeded demo quiz) and click **Play Live**.
     - **Generate with AI**: Click **AI Quiz Generator**, paste lecture notes or curriculum text (up to 30,000 characters), select question count and difficulty, and generate questions with 2-sentence Concept Anchors and misconception rationales.
     - **Create Manually**: Click **New Quiz** to author custom questions, distractor rationales, and time limits (10–120s).

3. **Configure Session & Launch Room**:
   - Choose a game preset or customize settings:
     - **Revision Preset (Recommended)**: Enables flat accuracy scoring (+1000 pts without speed bias), Confidence Calibration, Class Mastery Meter, Peer Instruction triggers (30%–70% accuracy), and student Revision Receipts.
     - **Quick Fun**: Speed decay scoring with competitive streak bonuses.
   - Click **Start Game Session** to create the room and generate a unique **6-Digit Game PIN** (e.g., `582914`).

4. **Classroom Lobby & Projector Display**:
   - **Teacher Console**: Keep the `/host/room/:id` window on your laptop to monitor live response counters, question previews, and host controls.
   - **Projector View (Optional)**: Open `/display/:pin` in a separate window or tab and drag it onto the classroom projector. It displays a clean presentation screen with the game PIN, live player roster, and countdown timer without exposing teacher telemetry.
   - In the lobby, you can lock the room, kick unwanted players, or enable automatic friendly nicknames.

5. **Conduct the Live Game**:
   - **Start Question**: Click **Start Game** to trigger Question 1. The projector shows the timer and question cards; the teacher console shows live answering velocity.
   - **Peer Instruction (Discuss & Re-vote)**: If accuracy falls between 30% and 70%, click **Discuss** to initiate peer discussion. Students see only the response distribution without the correct answer. Click **Re-vote** so students can revise answers for a +500 "Recovered" bonus.
   - **Reveal & Discussion**: Advance to reveal the correct answer, the 2-sentence Concept Anchor, and distractor misconception explanations.
   - **Leaderboard & Retest**: View the Top 5 podium and Class Mastery Meter. At the final question, review the **Blindspot Preview** and launch an immediate **Retest Round** on weak questions (<50% accuracy) with reshuffled options.
   - **End Session & Analytics**: Finalizing the session saves the report in MongoDB and generates the **Classroom Blindspot Radar**.

---

### 📱 How to Join a Quiz (Student)

1. **Open the Join Page**:
   - On a smartphone, tablet, or laptop, go to [http://localhost:5173/join](http://localhost:5173/join) (or click **Join Game** from the home page).

2. **Enter Room PIN & Nickname**:
   - Type the **6-Digit PIN** displayed on the classroom screen.
   - Enter your nickname, or click **"Pick one for me"** to generate a friendly adjective-animal combination (e.g., `CuriousOtter`, `CleverFalcon`).
   - Click **Join Room**.

3. **Answering Questions on Mobile Gamepad**:
   - Once the host starts a question, your screen transforms into a 4-tile touch gamepad with high-contrast Okabe-Ito colors and symbols:
     - **[A] Vermillion + Hexagon**
     - **[B] Sky Blue + 5-Point Star**
     - **[C] Amber Orange + Plus/Cross**
     - **[D] Bluish Green + Crescent**
   - **Accessibility**: If you cannot clearly see the projector, toggle **"Show text on device"** to read the full question text and answer choices directly on your screen.
   - Tap your answer choice. Supported mobile devices provide haptic vibration feedback on touch.

4. **Rate Confidence**:
   - Right after selecting an answer, select your confidence level: **Guessing (1)**, **Fairly Sure (2)**, or **Certain (3)**.

5. **Participate in Peer Instruction**:
   - If the teacher triggers discussion, turn to a classmate to explain your answer.
   - When the re-vote opens, submit your revised answer to earn a +500 "Recovered" bonus.

6. **Review Results & Revision Receipt**:
   - On question reveal, see whether you were correct, along with an explanation of why your chosen distractor was incorrect.
   - At the end of the game, view your final rank, points, and tap **View Revision Receipt** (`/r/:token`) to access your personal study guide, missed topics, and self-test practice mode.

---

## 🧪 Testing & Validation

ReviseLive includes 20 comprehensive test suites covering masking invariants, contrast ratios, scoring modes, sanitize logic, and socket lifecycles:

```bash
# Run all tests (Server: 80 tests across 17 suites, Client: 12 tests across 3 suites = 92 total)
npm test

# Run ESLint across entire codebase (0 warnings, 0 errors)
npm run lint

# Compile production Vite bundle
npm run build
```

---

## 🐳 Single-Instance Deployment

Build and run the production container:

```bash
# 1. Generate production environment file once (persists JWT_SECRET across restarts)
cat << 'EOF' > .env.prod
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://host.docker.internal:27017/revise_live
CLIENT_URL=http://localhost:5000
EOF
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env.prod

# 2. Build Docker image
docker build -t revise-live:latest .

# 3. Run single container referencing the environment file
docker run -d \
  -p 5000:5000 \
  --add-host=host.docker.internal:host-gateway \
  --env-file .env.prod \
  revise-live:latest

# Or launch complete stack (app + MongoDB) via Docker Compose with persistent env file
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

---

## 📄 License

MIT License. Designed with cognitive science for real classrooms.
