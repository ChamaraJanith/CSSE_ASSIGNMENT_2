<div align="center">

# 🌿 WildGuard – Smart Wildlife Conservation and Anti-Poaching Monitoring System

**Department of Wildlife Conservation (DWC) • Democratic Socialist Republic of Sri Lanka**  
*Integrated Tactical Platform for Risk-Based Ranger Dispatch, Evidence Forensic Review, Conflict Coordination & Monitoring Rules Engine*

[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-5.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://supabase.com/)
[![Leaflet](https://img.shields.io/badge/GIS-Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Jest Tests](https://img.shields.io/badge/Jest_Tests-593%20Passed%20(100%25)-brightgreen?style=for-the-badge&logo=jest&logoColor=white)](https://jestjs.io/)
[![Academic](https://img.shields.io/badge/SLIIT-SE3070%20Assignment%2002-orange?style=for-the-badge)]()

</div>

---

## 👥 Academic Context & Project Contributors

* **Institution:** Sri Lanka Institute of Information Technology (SLIIT)
* **Academic Year / Semester:** Year 3, Semester 2
* **Module Code & Name:** SE3070 – Case Studies in Software Engineering
* **Assignment:** Assignment 02 – Implementation of a software solution based on a case study design
* **Student Batch & Group:** Malabe Weekend Batch – **Group_041**
* **Case Study:** Case Study 1: Smart Wildlife Conservation and Anti-Poaching Monitoring System (Target: Udawalawe National Park & Wildlife Sanctuaries)

### Group Member Contributions and Use Case Allocation

| Student ID | Student Name | SLIIT Student Email | Contact Number | Implemented Substantial Business Use Case |
|---|---|---|---|---|
| **IT23720510** | **Dahanayaka G.S.S** | `IT23720510@my.sliit.lk` | 0766719014 | **UC01: Plan a Risk-Based Ranger Patrol** |
| **IT23541702** | **Wanasinghe W.A.K.I** | `IT23541702@my.sliit.lk` | 0718522318 | **UC02: Review and Escalate Camera-Trap Evidence** |
| **IT23616806** | **Abeyrathna T.M.C.J** | `IT23616806@my.sliit.lk` | 0767691846 | **UC03: Coordinate Human-Wildlife Conflict Response** |
| **IT23437470** | **Dissanayake D.M.S.S** | `IT23437470@my.sliit.lk` | 0714806554 | **UC04: Configure Park-Specific Wildlife Monitoring Rules** |

---

## 📌 Executive Summary

**WildGuard** is an integrated, tactical wildlife preservation and anti-poaching management software solution engineered for the Department of Wildlife Conservation (DWC), Sri Lanka. In national parks such as Udawalawe, Sinharaja, and Yala, rangers and park managers face challenges including vast geographical terrains, unmonitored blindspots, frequent human-elephant conflicts (HEC), poaching incursions, and intermittent telecommunication connectivity.

Following the design critique of Assignment 01, **Group_041** implemented all four core business use cases with enterprise-grade quality:
1. **Algorithmic Patrol Optimization** based on explainable multi-factor heuristic risk scoring.
2. **Forensic Evidence Review & Rapid Escalation** preserving chain-of-custody for acoustic sensors and camera traps.
3. **Community Conflict Coordination & Telemetry Tracking** with automated priority calculation and ranger dispatch.
4. **Park-Specific Monitoring Rule Configuration** with park/risk-zone ownership validation and duplicate/conflict detection.

The solution adheres strictly to **SOLID design principles**, clean **Layered Architecture (Routes ➔ Controllers ➔ Services ➔ Database)**, offline-aware design patterns, and exhaustive automated testing (**13 Test Suites, 593 Automated Tests, 100% Passing**).

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER (React 19 + Vite)                            │
│  ┌──────────────────────┬──────────────────────┬──────────────────────┬─────────────┐  │
│  │  Park Manager Portal │ Wildlife Officer UI  │     CLO Portal       │ Community UI│  │
│  │ (UC01 & UC04 Wizards)│ (UC02 Evidence Triage│(UC03 Conflict Queue) │ (Reporting) │  │
│  └──────────────────────┴──────────────────────┴──────────────────────┴─────────────┘  │
│           │ Interactive Leaflet GIS Maps • Dark Ops Glassmorphism UI • Lucide Icons     │
└───────────┼────────────────────────────────────────────────────────────────────────────┘
            │ RESTful JSON APIs (CORS Enabled)
            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          APPLICATION LAYER (Node.js & Express 5)                       │
│  ┌──────────────────────┬──────────────────────┬──────────────────────┬─────────────┐  │
│  │   Patrol Planning    │   Evidence Review    │  Conflict Response   │ Rules Engine│  │
│  │  Service (UC01)      │    Service (UC02)    │    Service (UC03)    │  Service    │  │
│  │ • Heuristics Engine  │ • Forensic Classifier│ • Priority Assessor  │  (UC04)     │  │
│  │ • Ranger Allocator   │ • Threat Escalator   │ • Location Validator │ • Rule Check│  │
│  │ • Conflict Validator │ • Metadata Validator │ • Closure Validator  │ • Validation│  │
│  └──────────────────────┴──────────────────────┴──────────────────────┴─────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │  Middleware & Infrastructure: Supabase Admin Auth • Notification Simulator Logs  │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└───────────┼────────────────────────────────────────────────────────────────────────────┘
            │ Connection Pooling & PostgreSQL Query Execution
            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER (Supabase PostgreSQL DB)                            │
│   • Relational Tables: patrol_plans, evidence_reviews, conflict_reports, rules         │
│   • Audit Logging: status_history, telemetry_logs, communication_logs                  │
│   • Security: Row Level Security (RLS) & Admin API Service Key Provisioning            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Detailed Use Case Implementations

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       WILDGUARD CORE MODULES                                      │
├─────────────────────────┬─────────────────────────┬─────────────────────────┬─────────────────────┤
│          UC01           │          UC02           │          UC03           │        UC04         │
│  Plan Risk-Based Patrol │ Evidence Review & Alert │ Conflict Response Coord │   Monitoring Rules  │
│  (Dahanayaka G.S.S)     │ (Wanasinghe W.A.K.I)    │ (Abeyrathna T.M.C.J)    │ (Dissanayake D.M.SS)│
└─────────────────────────┴─────────────────────────┴─────────────────────────┴─────────────────────┘
```

### 1. UC01: Plan a Risk-Based Ranger Patrol
* **Lead Contributor:** Dahanayaka G.S.S (`IT23720510`)
* **Primary Actor:** Park Manager | **Supporting Actor:** Field Ranger
* **Domain Objective:** Prevent unguided and arbitrary patrol deployments by automatically computing threat levels and recommending optimal sectors and personnel.
* **Core Technical Features & Innovations:**
  * **Explainable Heuristic Engine (`RoutePriorityScore` 0.0–10.0):** Dynamically weights unmonitored blindspot duration, high-risk buffer proximity, acoustic tripwire frequency spikes, and terrain difficulty.
  * **Ranger Allocation & Workload Governance:** Evaluates eligible rangers, ranking candidates by heuristic match, travel proximity/ETA (`~12.8 km, ETA ~57m`), workload capacity (`current_tasks < max_tasks`), and schedule-conflict prevention. Features a transparent *"Why this Ranger Candidate?"* explainability card.
  * **Pre-Flight Mission Authorization:** Mission parameter review, mandatory field equipment provisioning (Garmin InReach GPS, Encrypted Sat-Phone VHF Ch-04, Night Vision Goggles Mk4, Medical Kit A), and dispatcher tactical field directives logging. Supports saving deployments as `DRAFT` or dispatching immediately.
  * **Satellite Telemetry Pipeline & Interactive Field Simulator:** Simulates a 3-stage delivery pipeline (`Stage 1: Sent` ➔ `Stage 2: Delivered` ➔ `Stage 3: Pending Ranger Sync`). An interactive field simulator verifies ranger responses (`ACKNOWLEDGED` or `DECLINED`), with automatic fallback to `PENDING_ASSIGNMENT` under rule `BR-UC01-09`.
  * **Interactive GIS Map:** Leaflet-powered tactical map displaying sector corridors, checkpoints, and boundary fence buffers.
* **Business Rules Implemented:** `BR-UC01-01` through `BR-UC01-12` (Role authorization, route-priority scoring, override justification, workload caps, double-booking prevention, status lifecycle, data freshness warnings).
* **Code Implementation:**
  * **Backend:** `patrolPlanningRoutes.js`, `patrolPlanningController.js`, `patrolPlanningService.js`, `heuristicsEngine.js`, `rangerService.js`, `parkInfrastructureService.js`
  * **Frontend:** `patrolPlanning/PatrolPlanningDashboard.jsx`, `TacticalMap.jsx`, `RangerAllocationEngine.jsx`, `ConfirmPatrolPlanView.jsx`, `AssignmentConfirmationView.jsx`, `ActivePatrolsRoster.jsx`, `PatrolPlanningManager.jsx`
* **Test Verification:** **5 Test Suites, 65 Passed Tests** (100% pass rate, >90% coverage).

---

### 2. UC02: Review and Escalate Camera-Trap Evidence
* **Lead Contributor:** Wanasinghe W.A.K.I (`IT23541702`)
* **Primary Actor:** Wildlife Officer | **Supporting Actor:** Ranger Team
* **Domain Objective:** Enable rapid forensic triage of captured camera-trap photographs to differentiate benign wildlife movements from imminent poaching intrusions.
* **Core Technical Features & Innovations:**
  * **Forensic Evidence Review Queue:** Displays unreviewed camera-trap captures with timestamp, camera ID, location coordinates, and data status.
  * **Metadata Inspection & Incomplete Data Handling:** Inspects environmental and sensor metadata; triggers an explicit `Incomplete Metadata Warning` when telemetry is missing, while allowing the officer to proceed.
  * **Three-Way Forensic Classification:**
    * `Wildlife Species`: Finalized as `Reviewed`. No threat alert generated.
    * `Unknown`: Marked as `NEEDS_FURTHER_REVIEW` and retained in queue for secondary inspection without generating false alerts.
    * `Suspicious Person`: Treated as a provisional classification requiring explicit escalation confirmation.
  * **Atomic Threat Alert Escalation:** Requires mandatory escalation justification; atomically marks evidence as `REVIEWED_ESCALATED` and creates a persistent `ThreatAlert` record linked directly to the image.
  * **User Control & Reversible Flow:** Includes an explicit `Cancel Escalation` option that safely returns to the classification view without persisting incomplete alerts.
* **Business Rules Implemented:** `BR1` through `BR7` (Allowed classifications, escalation conditions, image-to-alert linking, non-alert handling for wildlife/unknown, mandatory justification text).
* **Code Implementation:**
  * **Backend:** `evidenceReviewRoutes.js`, `evidenceReviewController.js`, `evidenceReviewService.js`
  * **Frontend:** `evidenceReview/EvidenceReviewManager.jsx`, `EvidenceReviewQueue.jsx`, `ClassifyEvidenceView.jsx`, `EscalateEvidenceView.jsx`, `ReviewResultView.jsx`, `EvidenceImage.jsx`, `ReviewStatusBadge.jsx`, `evidenceReviewUtils.js`, `WildlifeOfficerDashboard.jsx`
* **Test Verification:** **3 Test Suites, 104 Passed Tests** (100% pass rate).

---

### 3. UC03: Coordinate Human-Wildlife Conflict Response
* **Lead Contributor:** Abeyrathna T.M.C.J (`IT23616806`)
* **Primary Actor:** Community Liaison Officer (CLO) | **Supporting Actors:** Community Member, Ranger, Park Manager
* **Domain Objective:** Triage community conflict reports (e.g., elephant crop-raiding, village perimeter breaches), dispatch rangers safely, and track response outcomes.
* **Core Technical Features & Innovations:**
  * **Conflict Report Queue & Visual Triage:** Real-time queue categorizing reports by urgency (`Critical`, `High`, `Medium`, `Low`), received timestamp, and current lifecycle state.
  * **Location Validation & Clarification Logging:** Validates map coordinates, village name, and nearest landmarks. For incomplete reports, sends simulated clarification requests and maintains reports in `PENDING_INFORMATION`.
  * **Explainable Priority Assessment:** Algorithmic calculation evaluating immediate human safety threats, proximity to schools/homes, crop damage severity, and repeated incidents. Supports CLO override with recorded justification.
  * **Ranger Recommendation & Dispatch:** Ranks available rangers by proximity, workload, and wildlife response experience. Enforces assignment deadlines and handles reassignment upon timeout or ranger decline (`HIGH_PRIORITY_PENDING`).
  * **Telemetry Tracking & Stale Data Awareness:** Simulated GPS progress tracking with `Last Known Location` labels when network connectivity is lost.
  * **Strict Closure Validation Checklist:** Requires verified outcome recording by the ranger, completion timestamp, and a mandatory CLO closure note before transitioning reports to `CLOSED`.
* **Business Rules Implemented:** `BR-UC03-01` through `BR-UC03-12` (Authorization, location validation, priority rules, monitoring states, ranger ranking, timeout handling, offline GPS labelling, closure checklist).
* **Code Implementation:**
  * **Backend:** `reportRoutes.js`, `reportController.js`, `reportService.js`, `incidentRoutes.js`, `incidentController.js`
  * **Frontend:** `CLODashboard.jsx`, `UserDashboard.jsx` (Community Intake Portal), `WildlifeOfficerDashboard.jsx`
* **Test Verification:** **2 Test Suites, 19 Passed Tests** (100% pass rate).

---

### 4. UC04: Configure Park-Specific Wildlife Monitoring Rules
* **Lead Contributor:** Dissanayake D.M.S.S (`IT23437470`)
* **Primary Actor:** Park Manager
* **Domain Objective:** Lets a Park Manager configure a monitoring rule for the selected park (wildlife hazard, one of the park's existing risk zones, alert priority, notification recipients and response behaviour), validate it, review it, and activate it or save it as a draft.
* **Core Technical Features & Innovations:**
  * **Multi-Step Rule Configuration Wizard:** Three-step wizard: Hazard & Risk Zone → Priority & Notifications (priority, recipients, response behaviour, notes) → Review. The park is taken from the dashboard park selector.
  * **Park/Zone and Conflict Validation:** Validates that the selected risk zone belongs to the selected park (`BR03`), and blocks duplicate rules (DC1) and conflicting ACTIVE rules (DC2) in the same park + hazard + risk-zone scope.
  * **Review & Verification Stage:** Pre-activation summary of all parameters. Edit returns to configuration; the rule must be resubmitted for validation before it can be reviewed again (`BR09`).
  * **Lifecycle Management:** Save as Draft stores `DRAFT`; Activate stores `ACTIVE`. `INACTIVE` is only reached by deactivating an `ACTIVE` rule and is final.
  * **Rule Management Actions:** Rule details dialog: edit or activate a `DRAFT`, deactivate an `ACTIVE` rule; `INACTIVE` rules are read-only.
  * **Configuration Only:** Response behaviour and notification recipients are stored as rule configuration only. UC04 does not match events, send notifications, create incidents or escalate.
* **Business Rules Implemented:** `BR01` through `BR10` (Role authorization, mandatory parameters, park-zone containment, duplicate rule prevention, review before activation, unique rule ID generation).
* **Code Implementation:**
  * **Backend:** `monitoringRuleRoutes.js`, `monitoringRuleController.js`, `monitoringRuleService.js`, `utils/monitoringRuleRules.js`, `utils/monitoringRuleConfig.js`, `middleware/requireParkManager.js`, `migrations/06_create_monitoring_rules_schema.sql`
  * **Frontend:** `monitoringRules/MonitoringRulesManager.jsx`, `RuleConfigurationForm.jsx`, `RiskZoneMap.jsx`, `MonitoringRuleList.jsx`, `RuleActivationDialog.jsx`, `RuleActionsMenu.jsx`, `RuleDetailsView.jsx`, `RuleReviewView.jsx`, `RuleResultView.jsx`, `RuleModal.jsx`, `RuleStatusBadge.jsx`, `RuleStepper.jsx`, `RuleValidationErrors.jsx`, `monitoringRuleUtils.js`, `useEscapeKey.js`, `ParkManagerDashboard.jsx`
* **Test Verification:** **3 backend Test Suites, 405 Passed Tests; 7 frontend test files, 144 Passed Tests** (100% pass rate).

---

## 🧪 Comprehensive Quality Assurance & Unit Testing

The backend contains a robust automated test suite built on **Jest** and **Supertest**, verifying all business rules, edge cases, negative flows, and API integrations across all four use cases.

### Test Execution Summary Table

| Use Case | Subsystem / Focus | Test Files | Total Tests | Status |
|---|---|---|:---:|:---:|
| **UC01** | Patrol Planning, Heuristics, Allocation & Staging | `patrolPlanningController.test.js`<br>`patrolPlanningService.test.js`<br>`heuristicsEngine.test.js`<br>`rangerService.test.js`<br>`parkInfrastructureService.test.js` | **65** | ✅ **PASSED** |
| **UC02** | Camera Trap Evidence Triage & Escalation | `evidenceReviewApi.test.js`<br>`evidenceReviewRules.test.js`<br>`evidenceReviewService.test.js` | **104** | ✅ **PASSED** |
| **UC03** | Conflict Reporting, Intake & Closure Auditing | `reportController.test.js`<br>`reportCreate.test.js` | **19** | ✅ **PASSED** |
| **UC04** | Monitoring Rules Validation, Conflicts & Lifecycle | `monitoringRuleApi.test.js`<br>`monitoringRuleRules.test.js`<br>`monitoringRuleService.test.js` | **405** | ✅ **PASSED** |
| **TOTAL** | **Full System Test Suite** | **13 Test Suites** | **593** | ✅ **100% PASS** |

### How to Run Tests
```bash
# Run all 593 tests across all 4 use cases
cd backend
npm test

# Run tests for a specific usecase:
# UC01 Tests
npx jest tests/patrolPlanningController.test.js tests/patrolPlanningService.test.js tests/heuristicsEngine.test.js tests/rangerService.test.js tests/parkInfrastructureService.test.js

# UC02 Tests
npx jest tests/evidenceReviewApi.test.js tests/evidenceReviewRules.test.js tests/evidenceReviewService.test.js

# UC03 Tests
npx jest tests/reportController.test.js tests/reportCreate.test.js

# UC04 Tests
npx jest tests/monitoringRuleApi.test.js tests/monitoringRuleRules.test.js tests/monitoringRuleService.test.js

# Run full coverage analysis
npm test -- --coverage
```

---

## 🛠️ Technology Stack Breakdown

| Technology Domain | Selected Tools & Libraries | Purpose & Architectural Justification |
|---|---|---|
| **Client Core** | React 19, Vite 8, JavaScript (ESM) | Ultra-responsive component hierarchy with Instant Hot Module Replacement (HMR). |
| **Client Routing** | React Router v7 | Declarative role-based routing protecting role portals (`/park-manager`, `/clo`, `/wildlife-officer`, `/admin`, `/user`). |
| **GIS Mapping** | Leaflet, React-Leaflet | Lightweight, responsive tactical mapping of park corridors, waypoints, and risk zones. |
| **Icons & Telemetry** | Lucide React | High-contrast tactical telemetry indicators, radar, radio, and sensory icons. |
| **Server Framework**| Node.js v18+, Express 5.x | High-throughput asynchronous RESTful API architecture. |
| **Database & Auth** | Supabase PostgreSQL, `@supabase/supabase-js`, `pg` | Cloud-hosted relational persistence, connection pooling, and secure Admin Auth provisioning. |
| **Quality Assurance**| Jest, Supertest, Vitest | Comprehensive unit testing framework covering positive, negative, and edge test scenarios. |
| **Development** | Concurrently, Nodemon, dotenv, cors | Synchronized full-stack development orchestration and environment isolation. |

---

## 📂 Repository File Structure

```plaintext
CSSE_ASSIGNMENT_2/
├── package.json                   # Root workspace launcher (Concurrently)
├── README.md                      # Comprehensive system documentation
│
├── backend/
│   ├── controllers/
│   │   ├── patrolPlanningController.js   # UC01: Route recommendations, patrol plans, outposts
│   │   ├── evidenceReviewController.js   # UC02: Evidence classification & threat alerts
│   │   ├── reportController.js           # UC03: Conflict intake, triage & closure
│   │   ├── incidentController.js         # UC03: Incident telemetry management
│   │   └── monitoringRuleController.js   # UC04: Monitoring rule creation & validation
│   ├── routes/
│   │   ├── patrolPlanningRoutes.js       # UC01 Endpoints (/api/patrol-planning)
│   │   ├── evidenceReviewRoutes.js       # UC02 Endpoints (/api/evidence-review)
│   │   ├── reportRoutes.js               # UC03 Endpoints (/api/reports)
│   │   ├── incidentRoutes.js             # UC03 Endpoints (/api/incidents)
│   │   └── monitoringRuleRoutes.js       # UC04 Endpoints (/api/monitoring-rules)
│   ├── services/
│   │   ├── patrolPlanningService.js      # UC01 Business logic & status transitions
│   │   ├── rangerService.js              # UC01 & UC03 Ranger workload & proximity engine
│   │   ├── parkInfrastructureService.js  # UC01 Park infrastructure & staging bases
│   │   ├── evidenceReviewService.js      # UC02 Evidence triage & threat escalation
│   │   ├── reportService.js              # UC03 Conflict response & closure verification
│   │   └── monitoringRuleService.js      # UC04 Rule conflict detection & validation
│   ├── utils/
│   │   └── heuristicsEngine.js           # UC01 Algorithmic RoutePriorityScore calculator
│   ├── tests/                            # 13 Jest Test Suites (593 Tests)
│   ├── .env.example                      # Template environment variable configurations
│   ├── index.js                          # Express server entry point
│   ├── supabaseClient.js                 # Database client and Admin SDK initialization
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── patrolPlanning/           # UC01 Components
    │   │   │   ├── PatrolPlanningDashboard.jsx
    │   │   │   ├── TacticalMap.jsx
    │   │   │   ├── RangerAllocationEngine.jsx
    │   │   │   ├── ConfirmPatrolPlanView.jsx
    │   │   │   ├── AssignmentConfirmationView.jsx
    │   │   │   ├── ActivePatrolsRoster.jsx
    │   │   │   └── PatrolPlanningManager.jsx
    │   │   ├── evidenceReview/           # UC02 Components
    │   │   │   ├── EvidenceReviewManager.jsx
    │   │   │   ├── EvidenceReviewQueue.jsx
    │   │   │   ├── ClassifyEvidenceView.jsx
    │   │   │   ├── EscalateEvidenceView.jsx
    │   │   │   ├── ReviewResultView.jsx
    │   │   │   ├── EvidenceImage.jsx
    │   │   │   └── evidenceReviewUtils.js
    │   │   └── monitoringRules/          # UC04 Components
    │   │       ├── MonitoringRulesManager.jsx
    │   │       ├── RuleConfigurationForm.jsx
    │   │       ├── RiskZoneMap.jsx
    │   │       ├── MonitoringRuleList.jsx
    │   │       ├── RuleActivationDialog.jsx
    │   │       ├── RuleReviewView.jsx
    │   │       ├── RuleResultView.jsx
    │   │       └── monitoringRuleUtils.js
    │   ├── pages/                        # Role-based Portals
    │   │   ├── ParkManagerDashboard.jsx  # Hosts UC01 & UC04
    │   │   ├── WildlifeOfficerDashboard.jsx # Hosts UC02
    │   │   ├── CLODashboard.jsx          # Hosts UC03
    │   │   ├── UserDashboard.jsx         # Community Reporting Portal
    │   │   ├── AdminDashboard.jsx        # System Management
    │   │   ├── Login.jsx                 # Secure Authentication Entry
    │   │   └── Register.jsx              # Community Registration
    │   ├── App.jsx                       # Routing declarations
    │   └── main.jsx
    ├── vite.config.js
    └── package.json
```

---

## ⚙️ Environment Configuration

Before running the backend, create a `.env` file in the `backend/` directory:

```bash
cd backend
cp .env.example .env
```

Ensure the following environment variables are set:

```ini
PORT=5000
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_KEY=[SUPABASE_ANON_PUBLIC_KEY]
SUPABASE_SERVICE_KEY=[SUPABASE_SERVICE_ROLE_KEY]
```

---

## 🚀 Installation & Getting Started

### Prerequisites
* **Node.js**: `v18.0.0` or higher
* **npm**: `v9.0.0` or higher
* **Git**: Installed and configured

### 1. Clone the Repository
```bash
git clone https://github.com/ChamaraJanith/CSSE_ASSIGNMENT_2.git
cd CSSE_ASSIGNMENT_2
```

### 2. Install Dependencies
```bash
# Install root orchestration packages
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

### 3. Launching the System

#### Simultaneous Launch (Recommended)
From the root directory, start both the backend server and frontend client concurrently:
```bash
npm run dev
```

#### Individual Launch
* **Start Backend (Port 5000):**
  ```bash
  cd backend
  npm run dev
  ```
* **Start Frontend (Port 5173):**
  ```bash
  cd frontend
  npm run dev
  ```

Once running, navigate to **`http://localhost:5173`** in your browser.

---

## 🔑 Portal Access & Role Navigation

| User Role | Default Entry Route | Accessible Use Cases | Key Actions |
|---|---|---|---|
| **Park Manager** | `/park-manager` | **UC01 & UC04** | Algorithmic Patrol Planning, Ranger Allocation, Equipment Provisioning, Monitoring Rule Wizard, Staging Posts |
| **Wildlife Officer** | `/wildlife-officer` | **UC02** | Camera-Trap Evidence Review Queue, Metadata Inspection, Three-Way Classification, Threat Alert Escalation |
| **Community Liaison Officer** | `/clo` | **UC03** | Conflict Report Triage, Location Validation, Clarification Requests, Ranger Dispatch, Resolution Closure |
| **Community Member** | `/user` | **UC03** | Submit conflict reports (elephant sightings, crop damage), receive status updates |
| **Administrator** | `/admin` | Infrastructure | System-wide officer management, database health, audit telemetry |

---

## 🌐 Complete API Endpoint Reference

### UC01: Patrol Planning Endpoints (`/api/patrol-planning`)
* `GET /telemetry` - Retrieves active park threat telemetry and sector statistics.
* `GET /recommended-routes` - Calculates heuristic `RoutePriorityScore` and returns ranked sectors.
* `GET /eligible-rangers` - Returns available rangers ranked by proximity, workload, and qualifications.
* `POST /plans` - Creates a new patrol plan in `DRAFT` or `ASSIGNED` status.
* `GET /plans` - Returns all active and historical patrol deployments.
* `PATCH /plans/:id/status` - Updates patrol status (`ACKNOWLEDGED`, `DECLINED`, `IN_PROGRESS`, etc.).
* `GET /staging-posts` - Lists communication outposts and staging bases.

### UC02: Evidence Review Endpoints (`/api/evidence-review`)
* `GET /images` - Fetches unreviewed camera trap evidence.
* `GET /images/:id` - Retrieves image metadata and sensor details.
* `POST /classify` - Submits evidence classification (`Wildlife Species`, `Unknown`, `Suspicious Person`).
* `POST /escalate` - Submits mandatory escalation justification and creates a `ThreatAlert`.
* `GET /alerts` - Lists escalated threat alerts.

### UC03: Conflict Response Endpoints (`/api/reports` & `/api/incidents`)
* `GET /api/reports` - Retrieves conflict reports for the CLO queue.
* `POST /api/reports` - Submits a new community conflict report.
* `PATCH /api/reports/:id/status` - Updates report status (`ASSIGNED`, `RESPONDING`, `RESOLVED`, `CLOSED`).
* `GET /api/reports/rangers` - Fetches eligible rangers for conflict dispatch.
* `POST /api/reports/:id/clarify` - Dispatches a clarification request for incomplete reports.

### UC04: Monitoring Rules Endpoints (`/api/monitoring-rules`)
All endpoints require an authenticated Park Manager.
* `GET /reference?parkId=` - Returns the selected park, its risk zones and the configured option lists.
* `GET /?parkId=` - Retrieves monitoring rules for the park.
* `POST /validate` - Dry-run validation (mandatory fields, park/zone ownership, duplicates/conflicts); never writes. An optional `ruleId` excludes a draft being edited from its own duplicate check.
* `POST /` - Revalidates and creates a rule; `action` `ACTIVATE` stores `ACTIVE`, `SAVE_DRAFT` stores `DRAFT`.
* `PUT /:id` - Saves changes to a `DRAFT` rule (same ID, stays `DRAFT`; revalidated).
* `POST /:id/activate` - `DRAFT` → `ACTIVE` (stored configuration revalidated).
* `POST /:id/deactivate` - `ACTIVE` → `INACTIVE` (final).

---

## 📄 Academic Integrity & Submission Statement

This project has been implemented for the fulfillment of **SE3070 – Case Studies in Software Engineering (Assignment 02)** at the **Sri Lanka Institute of Information Technology (SLIIT)**. All design improvements, software architecture implementations, and unit test suites have been developed collaboratively by **Group_041** in accordance with SLIIT's academic integrity policies.
