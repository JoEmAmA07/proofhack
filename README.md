# ProofStack 🛡️

> **Don't trust the claim. Verify the build.**

**ProofStack** is a project-verification MVP that helps reviewers compare technical claims in presentations, documentation, and GitHub READMEs with evidence found in a public repository's source code. It produces an explainable, claim-by-claim **Reality Report** with linked code references and explicit limitations.

Built for hackathon project review, student demos, and developer self-audits.

> **Current scope:** Static repository analysis. ProofStack does **not** execute browser workflows, API tests, or the submitted application's runtime behavior. A code match is evidence of a possible implementation, **not proof that a feature works**.

## What ProofStack Does

- **Document upload and parsing:** Accepts Markdown (`.md`, `.markdown`), text (`.txt`), PDF (`.pdf`), and PowerPoint (`.pptx`) files up to 10 MB. PDF and PPTX extraction preserve page and slide markers where available.
- **Technical claim suggestions:** Extracts candidate feature claims from uploaded documents. Uses Gemini when configured and available, with offline heuristic suggestions as a fallback. Suggestions require human review.
- **GitHub documentation discovery:** Reads relevant Markdown documentation from a public GitHub repository and suggests claims from project descriptions and feature statements.
- **Repository analysis:** Inspects repository metadata, file structure, selected source files, and dependency manifests. Source scan coverage depends on repository size and configured limits.
- **Static evidence matching:** Compares selected claims with code symbols, routes, parser functions, dependencies, and other source-level indicators, providing relevant file and line references.
- **Explainable verdicts:** Distinguishes `Code Evidence Found`, `Limited Evidence`, `No Evidence Found`, and `Inconclusive`. Runtime status remains `NOT TESTED` for static-only checks.
- **Reality Report PDF:** Generates a downloadable report with an executive summary, scan coverage, claim-by-claim rationale, implementation trails where available, and clickable GitHub evidence links.

## End-to-End Workflow

```text
Upload PPTX / PDF / README       OR       Discover claims from GitHub docs
                \                         /
                 Candidate technical claims
                            |
                    Review and select
                            |
                  Analyze GitHub repository
                            |
                Match claims to static code
                            |
                  Inspect evidence & limits
                            |
                  Download Reality Report
```

## Technology Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, Lucide React |
| Backend | Node.js, Express, TypeScript |
| Document processing | PDF and PPTX parsers, Markdown/plain-text handling |
| AI-assisted extraction | Gemini API (optional; subject to API availability and quota) |
| Offline extraction | Rule-based technical claim suggestion service |
| GitHub analysis | GitHub API, source-code inspection, dependency-manifest analysis |
| PDF reports | jsPDF and jsPDF-AutoTable |

The current MVP does not require Supabase or Playwright to run its static verification workflow.

## Project Structure

```text
proofhack/
├── backend/
│   └── src/
│       ├── routes/           # Document claims and repository endpoints
│       ├── services/         # Parsing, extraction, GitHub analysis, matching
│       └── types/            # Shared backend types
├── frontend/
│   └── src/
│       ├── api/              # Backend API clients
│       └── components/       # Upload, claim review, repository analysis UI
├── package.json             # Root development scripts
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18 or later (Node.js 20+ recommended)
- npm
- Internet access to analyze public GitHub repositories

### 1. Clone the repository

```bash
git clone https://github.com/JoEmAmA07/proofhack.git
cd proofhack
```

### 2. Install dependencies

From the project root:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

### 3. Configure the backend (optional Gemini integration)

Create `backend/.env` using the project's example environment file, if present. Configure the backend port and Gemini API credentials as appropriate:

```dotenv
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

**Never commit `.env` or an actual API key.** Gemini is optional for offline claim suggestions. If the configured model is unavailable or its quota is exhausted, the application can fall back to offline extraction.

### 4. Start the application

```bash
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## How to Use

1. **Get claims:** Upload a supported project document, or use **Discover Claims from GitHub** with a public repository URL.
2. **Review suggestions:** Read and select the technical claims you want to assess. Documentation can describe planned features, so don't assume every suggestion is already implemented.
3. **Analyze repository:** Provide the public GitHub URL and click **Analyze Repository** to scan source files and dependencies.
4. **Verify selected claims:** Click **Verify Selected Claims** to locate candidate implementation evidence.
5. **Inspect results:** Review the rationale, implementation references, and GitHub source links. Static matches do not establish runtime correctness.
6. **Export:** Click **Download Reality Report** for a PDF summary of the assessment.

### Example verification targets

For this repository, ProofStack can assess claims such as:

- `POST /api/claims/extract` is declared in the Express API.
- The document parser extracts text from PPTX slides and preserves slide markers.
- The document parser extracts text from PDF pages and preserves page markers.
- The frontend and backend declare their respective framework and tooling dependencies.

These are **candidate claims to investigate**, not automatically certified behaviors.

## API Overview

The backend includes endpoints for:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/claims/extract` | Upload a document and extract suggested technical claims |
| `POST` | `/api/claims/preview` | Preview extracted document text and offline suggestions |
| `POST` | `/api/claims/discover-repository` | Discover claims from a public repository's Markdown documentation |
| `POST` | `/api/repository/analyze` | Analyze repository structure, source files, and dependencies |
| `POST` | `/api/repository/match-claims` | Compare selected claims with static repository evidence |

API requests and responses are intended for the ProofStack frontend; the application is not presented as a production-hardened public API.

## How to Interpret the Results

| Assessment | Meaning |
| --- | --- |
| **Code Evidence Found** | The matcher identifies stronger relevant static code indicators; functionality is still not runtime-verified. |
| **Limited Evidence** | Some related code or configuration was found, but it does not fully establish the claim. |
| **No Evidence Found** | The scan did not identify relevant evidence; this does **not** prove the feature is absent. |
| **Inconclusive** | Available information is insufficient or ambiguous. |

**Runtime verification status: `NOT TESTED`.** The Reality Report documents static evidence only.

## Current Limitations

- Only public repositories supported by the current GitHub integration can be analyzed.
- GitHub API limits, file sizes, repository structure, and scan budgets may restrict coverage.
- Offline claim extraction is heuristic and can miss valid claims or suggest descriptions of planned features.
- Dependency declarations and code-symbol matches do not establish that a feature executes correctly.
- The tool does not run end-to-end browser tests, exercise APIs, or certify security, correctness, or deployment readiness.
- A human reviewer should inspect source references and interpret verdicts before making decisions.

## Roadmap

The following are **future improvements, not current MVP capabilities**:

- Safe, permissioned runtime API checks and browser workflow verification.
- More detailed per-technology dependency coverage and stronger evidence scoring.
- Improved claim ranking, deduplication, and handling of proposed versus implemented features.
- Optional persistence and project history.
- More polished report pagination and export options.

## Team

**Team Chipmunk** — BIOHACK 1.0, Jaypee Institute of Information Technology.

## Responsible Use

ProofStack is a reviewer-assistance tool, not an automated judge. Its results should be interpreted alongside demos, tests, documentation, and human technical review.

---

**ProofStack — Don't trust the claim. Verify the build.**
