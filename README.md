# ProofStack 🛡️
> **"Don't trust the claim. Verify the build."**

ProofStack is an AI-powered project verification platform that checks whether software projects and hackathon submissions actually implement the features claimed in their presentations, pitch decks, and README files.

---

## 🚀 The Core Workflow

```
PPT / README 
    └── Extract Claims (AI)
          └── Analyze GitHub Repository (Codebase & AST)
                └── Generate Verification Checks
                      └── Collect Evidence (Files, Commits, Runtime Traces)
                            └── Produce Project Reality Report 📊
```

---

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Backend:** Node.js, Express, TypeScript, tsx, CORS, dotenv
- **Planned for Future Phases:**
  - AI Engine: Gemini API (Claim extraction & heuristic generation)
  - Codebase Analysis: GitHub REST API & Octokit
  - Database: Supabase (PostgreSQL + Auth)
  - Runtime Verification: Playwright (Browser automation & API monitoring)

---

## 📁 Project Structure

```text
proofstack/
├── backend/                    # Express + TypeScript API server
│   ├── src/
│   │   ├── routes/
│   │   │   └── health.ts       # Health check endpoint (/api/health)
│   │   └── index.ts            # Server entrypoint, middleware, and CORS
│   ├── .env.example            # Backend environment variables template
│   ├── .env                    # Local environment variables
│   ├── package.json            # Backend dependencies & scripts
│   └── tsconfig.json           # Backend TypeScript configuration
│
├── frontend/                   # React + TypeScript + Vite client
│   ├── src/
│   │   ├── api/
│   │   │   └── health.ts       # Health check client with Vite proxy
│   │   ├── components/
│   │   │   ├── Navbar.tsx      # Top bar with live backend health badge
│   │   │   ├── Hero.tsx        # Hero section with tagline and CTA
│   │   │   ├── WorkflowSection.tsx # Core 6-step verification flow
│   │   │   ├── DashboardPlaceholder.tsx # Verification input scaffold
│   │   │   └── Footer.tsx      # Footer with architecture tags
│   │   ├── App.tsx             # Root component with view routing
│   │   ├── index.css           # Tailwind CSS directives & theme setup
│   │   └── main.tsx            # React application entrypoint
│   ├── index.html              # HTML template with dark theme
│   ├── package.json            # Frontend dependencies & scripts
│   ├── tailwind.config.js      # Custom theme colors (teal/cyan accents)
│   ├── postcss.config.js       # PostCSS plugins
│   ├── tsconfig.json           # Frontend TypeScript configuration
│   └── vite.config.ts          # Vite configuration with /api reverse proxy
│
├── .gitignore                  # Git ignore rules (node_modules, dist, .env)
├── .env.example                # Root environment template
├── package.json                # Root package for running both services
└── README.md                   # Project documentation
```

---

## ⚡ Quick Start & Installation

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher

### Step 1: Install Dependencies

From the root directory, install dependencies for both frontend and backend:

```bash
# Option A: Run the one-command installer
npm run install:all

# Option B: Or install individually
npm install
npm install --prefix backend
npm install --prefix frontend
```

---

## 🏃 Running the Application

### Option A: Run Both Frontend & Backend Concurrently (Recommended)

From the project root directory:

```bash
npm run dev
```

This will concurrently start:
- 🚀 **Backend Server** on: [http://localhost:5000](http://localhost:5000)
- 💻 **Frontend Web App** on: [http://localhost:5173](http://localhost:5173)

### Option B: Run Individually

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

---

## 🩺 Backend Health Check Endpoint

ProofStack includes a dedicated health check endpoint at:
`GET /api/health`

### Example Response:
```json
{
  "status": "ok",
  "message": "ProofStack API is operational",
  "timestamp": "2026-10-31T17:15:00.000Z",
  "service": "proofstack-backend",
  "version": "1.0.0",
  "uptimeSeconds": 42,
  "environment": "development"
}
```

The frontend includes a real-time polling badge in the header that displays:
- 🟢 **`API: 200 OK`** (pulsing teal dot when backend is running)
- 🟠 **`API: offline`** (amber indicator if backend is stopped)

---

## 🌐 Opening the Application

1. Ensure both development servers are running (`npm run dev`).
2. Open your web browser and navigate to:
   ```
   http://localhost:5173
   ```
3. You will see:
   - The dark-themed landing page with teal/cyan accents.
   - The project tagline: *"Don't trust the claim. Verify the build."*
   - Live backend API connectivity indicator in the top navbar.
   - The 6-step core verification workflow.
   - Clicking **"Start Verification"** opens the Verification Studio dashboard placeholder.

---

## 🗺️ Roadmap & Phases

- [x] **Phase 1 (Completed):**
  - Full-stack repository structure (React + Vite + Tailwind frontend, Express + TypeScript backend).
  - Health check endpoint and frontend API communication with Vite reverse proxy.
  - Dark-themed responsive landing page with teal/cyan branding.
  - Modular dashboard placeholder and clean setup.
- [ ] **Phase 2:**
  - Ingest pitch decks / PDF / PPT / README files.
  - Connect Gemini API to extract atomic claims and hypotheses.
- [ ] **Phase 3:**
  - GitHub REST API / Octokit integration to clone and parse target repositories.
  - AST symbol extraction and static analysis.
- [ ] **Phase 4:**
  - Automated Playwright browser tests and API health probes.
- [ ] **Phase 5:**
  - Project Reality Report synthesis and Supabase persistence.

