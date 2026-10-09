<div align="center">

# 🌿 WildGuard – Smart Wildlife Protection & Anti-Poaching System

**Department of Wildlife Conservation (DWC) • Democratic Socialist Republic of Sri Lanka**  
*Next-Generation Tactical Wildlife Conservation, Acoustic Tripwire Surveillance & Risk-Based Patrol Dispatch Platform*

[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-5.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://supabase.com/)
[![Leaflet](https://img.shields.io/badge/GIS-Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Jest Tests](https://img.shields.io/badge/Jest_Tests-585%20Passed%20(100%25)-brightgreen?style=for-the-badge&logo=jest&logoColor=white)](https://jestjs.io/)
[![License](https://img.shields.io/badge/Academic-SLIIT%20SE3070-orange?style=for-the-badge)]()

</div>

---

## 📌 Executive Summary

**WildGuard** is an enterprise-grade tactical operations and wildlife protection management system engineered for national park authorities (deployed with specific jurisdiction configurations for **Udawalawe National Park** and bordering forest corridors). The platform bridges sensor telemetry, satellite communications, and algorithmic dispatching to combat illegal wildlife poaching, monitor perimeter electric fence breaches, and coordinate real-time ranger field deployments.

Developed as part of **SE3070 – Case Studies in Software Engineering (Assignment 02)** by **Group_041**, this implementation translates an evaluated and enhanced software design into a resilient, maintainable, and high-performance software system following strict industry standards, SOLID design principles, and comprehensive unit test coverage (>80% across critical business domains).

---

## 🚀 Key Business Use Cases (System Scope)

The system covers four core, substantial business use cases:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                  WILDGUARD PLATFORM                                    │
└────────────────────────────────────────────────────────────────────────────────────────┘
          │                              │                          │
          ▼                              ▼                          ▼
┌──────────────────┐           ┌──────────────────┐       ┌──────────────────┐
│      UC01        │           │      UC02        │       │      UC03        │
│ Plan Risk-Based  │           │ Evidence Review  │       │ Incident Report  │
│  Ranger Patrol   │           │   & Escalation   │       │  & Investigation │
└──────────────────┘           └──────────────────┘       └──────────────────┘
          │                                                         │
          └──────────────────────────────┬──────────────────────────┘
                                         ▼
                               ┌──────────────────┐
                               │      UC04        │
                               │ Park Monitoring  │
                               │  Rules Engine    │
                               └──────────────────┘
```

### 1. UC01: Plan a Risk-Based Ranger Patrol (Lead: Dahanayaka G S S / IT23720510)
* **Algorithmic Heuristics Engine:** Dynamically calculates an explainable `RoutePriorityScore` (0.0 to 10.0) based on unpatrolled blindspot duration, high-risk buffer proximity, acoustic tripwire frequency spikes, and terrain difficulty.
* **Tactical Ranger Allocation & Workload Governance:** Evaluates eligible field officers, ranking candidates via proximity ETA, real-time workload capacity caps (`current_tasks < max_tasks`), and strict schedule-conflict prevention. Includes an explainable *"Why this Ranger Candidate?"* justification panel.
* **Pre-Flight Mission Authorization:** Full mission parameter review, mandatory equipment checklist verification (Garmin InReach GPS, Encrypted Sat-Phone VHF Ch-04, Night Vision Goggles Mk4, Medical Kit A), and tactical field instructions logging. Supports saving deployments as `DRAFT` or dispatching immediately.
* **Satellite Telemetry Pipeline & Ranger Simulation:** Simulates multi-stage packet transmission (Stage 1: Sent ➔ Stage 2: Delivered ➔ Stage 3: Pending Ranger Sync) with an integrated Field Ranger Terminal simulator supporting real-time `ACKNOWLEDGED` and `DECLINED` transitions with automated status rollback under rule `BR-UC01-09`.
* **Tactical GIS Geospatial Mapping:** Interactive Leaflet-powered satellite map visualizing sector boundary corridors, waypoints, outposts, and real-time threat zones.

### 2. UC02: Review and Escalate Acoustic & Camera Trap Evidence
* **Forensic Evidence Queue:** High-velocity triage of camera trap photographs and acoustic spectrogram alerts captured by perimeter IoT sensors.
* **Multi-Stage Classification:** Formal forensic categorisation into Poaching Threat, Human Intrusion, Wildlife Movement, or False Positive.
* **Chain-of-Custody Escalation:** Direct tactical escalation triggering rapid law enforcement response with preserved sensor audit metadata.

### 3. UC03: Incident Reporting and Investigation Logging
* **Geocoded Incident Recording:** Comprehensive logging of field poaching discoveries, boundary fence vandalism, and animal distress incidents.
* **Lifecycle Audit Trail:** Incident tracking through `OPEN`, `INVESTIGATING`, and `RESOLVED` states with role-based access control and investigator assignments.

### 4. UC04: Configure Park-Specific Wildlife Monitoring Rules
* **Spatial & Sensor Rule Definition:** Dynamic configuration of polygon risk zones, acoustic sensor decibel thresholds, and camera trap sensitivity.
* **Rule Lifecycle Management:** Rule versioning with state transitions (`Staging`, `Active`, `Inactive`, `Deprecated`) and automated validation preventing overlapping contradictory triggers.

---

## 🏛️ System Architecture & Technology Stack

The WildGuard platform is engineered using a decoupled, modern multi-tier architecture adhering to **Separation of Concerns (SoC)**, **DRY**, and **SOLID** design principles.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER (React 19 + Vite)                       │
│  Tactical Dark-Ops UI • Leaflet Geospatial Maps • Telemetry Simulator   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ REST API (JSON)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER (Express 5.x)                       │
│  Routes ──► Controllers ──► Services / Heuristic Engines ──► Middleware │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Query & Auth Protocols
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    DATA LAYER (Supabase PostgreSQL)                     │
│    Relational DB • Row Level Security (RLS) • Auth & Admin API          │
└─────────────────────────────────────────────────────────────────────────┘
```

| Layer | Technologies | Key Highlights |
|---|---|---|
| **Frontend** | React 19, Vite 8, React Router v7, Leaflet, Lucide Icons | Tactical Glassmorphism UI, Geospatial Mapping, Zero-Lag Hot Module Replacement |
| **Backend** | Node.js v18+, Express 5.x, dotenv, cors | Service-Controller-Repository Architecture, Explainable Heuristic Algorithms |
| **Database & Auth** | Supabase PostgreSQL, `@supabase/supabase-js`, `pg` Pool | Relational tables, transaction safety, Supabase Admin Auth API |
| **Testing & QA** | Jest, Supertest, Vitest | **585 Automated Tests**, Unit & Integration test coverage >80% |

---

## 📂 Repository Directory Structure

```plaintext
CSSE_ASSIGNMENT_2/
├── backend/
│   ├── controllers/               # HTTP Request handlers & response formatting
│   │   ├── evidenceReviewController.js
│   │   ├── incidentController.js
│   │   ├── monitoringRuleController.js
│   │   ├── patrolPlanningController.js   # UC01 Controller
│   │   └── reportController.js
│   ├── middleware/                # Express middleware (Auth, Validation)
│   ├── migrations/                # Database DDL scripts
│   ├── routes/                    # API route declarations
│   │   ├── evidenceReviewRoutes.js
│   │   ├── incidentRoutes.js
│   │   ├── monitoringRuleRoutes.js
│   │   ├── patrolPlanningRoutes.js       # UC01 Endpoints
│   │   └── reportRoutes.js
│   ├── services/                  # Core domain & business logic
│   │   ├── evidenceReviewService.js
│   │   ├── monitoringRuleService.js
│   │   ├── parkInfrastructureService.js
│   │   ├── patrolPlanningService.js      # UC01 Business service
│   │   ├── rangerService.js              # Ranger workload & proximity engine
│   │   └── reportService.js
│   ├── tests/                     # Comprehensive Jest test suite
│   │   ├── heuristicsEngine.test.js      # UC01 Heuristics unit tests
│   │   ├── patrolPlanningController.test.js
│   │   ├── patrolPlanningService.test.js # UC01 Full lifecycle unit tests
│   │   ├── rangerService.test.js
│   │   ├── evidenceReviewApi.test.js
│   │   ├── monitoringRuleApi.test.js
│   │   └── reportController.test.js
│   ├── utils/                     # Algorithmic calculation engines
│   │   └── heuristicsEngine.js           # RoutePriorityScore calculation
│   ├── index.js                   # Express server entry point
│   ├── supabaseClient.js          # Supabase client & Admin initialization
│   ├── .env.example               # Sanitized environment variable template
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── assets/                # Static graphics and icons
│   │   ├── components/
│   │   │   ├── evidenceReview/    # UC02 UI Components
│   │   │   ├── monitoringRules/   # UC04 UI Components
│   │   │   └── patrolPlanning/    # UC01 UI Components
│   │   │       ├── ActivePatrolsRoster.jsx
│   │   │       ├── AssignmentConfirmationView.jsx # Wireframe 5 & Telemetry Simulator
│   │   │       ├── ConfirmPatrolPlanView.jsx      # Pre-flight authorization
│   │   │       ├── PatrolPlanningDashboard.jsx    # Step 1 Heuristic Dashboard
│   │   │       ├── PatrolPlanningManager.jsx      # Multi-step state orchestrator
│   │   │       ├── RangerAllocationEngine.jsx     # Candidate selection & workload caps
│   │   │       └── TacticalMap.jsx                # Interactive Leaflet GIS map
│   │   ├── pages/                 # Role-based Portal Views
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── CLODashboard.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── ParkManagerDashboard.jsx
│   │   │   ├── Register.jsx
│   │   │   └── WildlifeOfficerDashboard.jsx
│   │   ├── services/              # API communication layer
│   │   ├── App.jsx                # Route definitions & guards
│   │   └── main.jsx               # Application root
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── package.json                   # Root orchestrator (concurrently)
└── README.md                      # System documentation
```

---

## ⚙️ Environment Configuration

Before running the application, configure the environment variables for the backend service.

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Populate the required keys:
   ```ini
   PORT=5000
   DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
   SUPABASE_URL=https://[PROJECT_REF].supabase.co
   SUPABASE_KEY=[SUPABASE_ANON_PUBLIC_KEY]
   SUPABASE_SERVICE_KEY=[SUPABASE_SERVICE_ROLE_KEY]
   ```

---

## 🛠️ Installation & Setup Guide

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
* **Git**: Installed and configured

### 1. Clone the Repository
```bash
git clone https://github.com/ChamaraJanith/CSSE_ASSIGNMENT_2.git
cd CSSE_ASSIGNMENT_2
```

### 2. Install Dependencies

You can install all dependencies across root, backend, and frontend:

```bash
# Install root orchestration tools
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

---

## 🖥️ Running the Application

### Option A: Simultaneous Launch (Recommended)
From the root project directory, launch both backend and frontend concurrently with a single command:
```bash
npm run dev
```

### Option B: Individual Launch
Run services in separate terminal windows:

* **Backend Service (Port 5000):**
  ```bash
  cd backend
  npm run dev
  ```
  *Server starts at `http://localhost:5000`*

* **Frontend Application (Port 5173):**
  ```bash
  cd frontend
  npm run dev
  ```
  *Client application starts at `http://localhost:5173`*

---

## 🧪 Testing & Quality Assurance

The system maintains an extensive, enterprise-grade test suite covering domain services, heuristic algorithms, edge-case validations, and API route controllers.

### Test Execution Results
```plaintext
Test Suites: 13 passed, 13 total
Tests:       585 passed, 585 total
Snapshots:   0 total
Time:        12.513 s
Ran all test suites.
```

### Running Backend Tests
```bash
cd backend
npm test
```

### Running Unit Test Coverage Report
To run all test suites with full coverage reporting:
```bash
cd backend
npm test -- --coverage
```

### UC01 Test Coverage Highlights
* `patrolPlanningController.js`: **100% Statements, 100% Lines, 100% Functions**
* `patrolPlanningService.js`: **91.9% Statements, 98.5% Lines, 100% Functions**
* `heuristicsEngine.js`: **94.6% Statements, 100% Lines, 100% Functions**
* `rangerService.js`: **89.7% Statements, 97.2% Lines, 100% Functions**

All critical business rules (`BR-UC01-01` through `BR-UC01-10`) are covered by automated positive, negative, and edge-case unit tests.

---

## 🌐 API Reference (Core Endpoints)

### UC01: Patrol Planning & Ranger Dispatch (`/api/patrol-planning`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/telemetry` | Retrieves live park telemetry, unmonitored sectors, and fleet status |
| `GET` | `/recommended-routes` | Computes and returns sectors ranked by `RoutePriorityScore` |
| `GET` | `/eligible-rangers` | Returns available rangers ranked by proximity, skills, and workload |
| `POST` | `/plans` | Creates a new patrol plan in `DRAFT` or `ASSIGNED` status |
| `GET` | `/plans` | Fetches active patrol plans and operational roster |
| `PATCH` | `/plans/:id/status` | Updates plan status (`ACKNOWLEDGED`, `DECLINED`, `IN_PROGRESS`, etc.) |
| `GET` | `/staging-posts` | Lists park operational staging bases and communication outposts |

### Additional Operational Endpoints
| Service | Endpoint Prefix | Primary Functions |
|---|---|---|
| **Authentication** | `/api/auth` | User registration, role assignments, and session auth |
| **Wildlife Officers** | `/api/wildlife-officers` | Officer registration via Supabase Admin API |
| **Evidence Review** | `/api/evidence-review` | Multi-spectral evidence queue, classification, escalation |
| **Monitoring Rules** | `/api/monitoring-rules` | Spatial risk zone thresholds, sensor trigger rules |
| **Incident Reports** | `/api/reports` / `/api/incidents` | Incident logging, investigation auditing, dispatch handoff |

---

## 👥 Project Team & Contributors

* **Academic Institution:** Sri Lanka Institute of Information Technology (SLIIT)
* **Degree Programme:** B.Sc. (Hons) in Information Technology / Software Engineering
* **Module:** SE3070 – Case Studies in Software Engineering (Assignment 02)
* **Group:** Group_041 (Malabe Weekend Batch)

| Student Name | Student ID | Implemented Use Case Focus |
|---|---|---|
| **Dahanayaka G. S. S.** | **IT23720510** | **UC01: Plan a Risk-Based Ranger Patrol** |
| Group Member 2 | ITxxxxxxx | UC02: Review and Escalate Acoustic & Camera Trap Evidence |
| Group Member 3 | ITxxxxxxx | UC03: Incident Reporting and Investigation Logging |
| Group Member 4 | ITxxxxxxx | UC04: Configure Park-Specific Wildlife Monitoring Rules |

---

## 📄 License & Academic Integrity

This software is developed strictly for educational and academic evaluation purposes under the **SE3070 Case Studies in Software Engineering** curriculum at **SLIIT**. Unauthorized commercial reproduction or plagiarism is strictly prohibited.
