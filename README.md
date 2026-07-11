# Adam Care — Clinic Appointment & EMR Management System

A full-stack clinic operations platform built on the MERN stack (MongoDB, Express, React, Node.js) with Redux Toolkit and Socket.IO. It covers staff/doctor management, appointment booking and scheduling, a doctor consultation worklist, patient records search, security audit logging, and self-service account/password management — for three roles: **Super Admin**, **Doctor**, and **Receptionist**.

---

## Table of Contents
- [Project Overview](#project-overview)
- [Folder Structure](#folder-structure)
- [Architecture Overview](#architecture-overview)
- [Database Design](#database-design)
- [API Documentation](#api-documentation)
- [Environment Variables](#environment-variables)
- [Installation Instructions](#installation-instructions)
- [Running the Project](#running-the-project)
- [Assumptions Made](#assumptions-made)
- [Known Limitations](#known-limitations)
- [Future Improvements](#future-improvements)

---

## Project Overview

Adam Care digitizes the day-to-day front-desk and clinical workflow of a clinic:

- **Super Admin** configures departments, doctors, staff accounts, and doctor schedules (including per-date overrides for holidays/half-days); reviews the security audit trail; and approves/rejects doctor qualification-change requests.
- **Receptionist** books appointments against a doctor's live slot availability, manages the daily planner, marks patients as arrived, and searches patient records.
- **Doctor** works from a real-time consultation worklist (arrived patients for the day), completes visits with clinical notes, and self-manages their own profile (name, photo, password, qualification).

Key product features implemented:
- Role-based access control (RBAC) across every route and UI surface.
- Dynamic slot generation per doctor per day, derived from their configured sessions, break timings, slot duration, and any date-specific override — with real-time booked/available/past-slot status.
- A compound partial-unique database index that makes double-booking a slot structurally impossible, independent of application logic.
- Real-time updates via Socket.IO: appointment changes, schedule changes, and staff/qualification changes are pushed to all connected clients and trigger local refetches — no manual refresh needed.
- **Temporary password / forced first-login password change**: Super Admin creates a staff account with a temp password; that user must set their own password on first login. Once they do, the Super Admin permanently loses the ability to view or edit that profile (only block/unblock remains) — the password becomes truly private.
- **Self-service "My Profile"**: every user can update their own name, photo, and password immediately. Doctors can also request a qualification change, which is held as `pending` until a Super Admin approves or rejects it via a side-by-side old/new value comparison. A navbar notification bell (Super Admin only) surfaces pending approvals in real time.
- **Forgot Password (email-based reset)**: a user who is locked out can request a reset link by email (via Gmail SMTP/nodemailer). The link is single-use, expires in 30 minutes, and — like the temp-password flow — resetting a password this way also makes it private from admin view.
- On-scroll (infinite-scroll) pagination across large data views: Manage Clinic Doctors, Manage Staff, and the Security Audit Trail.
- A full security audit log capturing logins/logouts, staff CRUD, schedule changes, password resets, and qualification approvals.

---

## Folder Structure

```
AdamCare/
├── backend/
│   ├── config/
│   │   └── db.js                    # Mongoose/MongoDB Atlas connection
│   ├── controllers/                 # Thin HTTP handlers — one per resource
│   │   ├── auth.controller.js       # Login/refresh/logout, staff CRUD, self-service profile,
│   │   │                            #   temp-password, qualification approval, forgot/reset password
│   │   ├── appointment.controller.js
│   │   ├── department.controller.js
│   │   ├── doctor.controller.js     # Doctors list + schedule/override CRUD
│   │   └── slot.controller.js       # Dynamic slot generation endpoint
│   ├── middlewares/
│   │   ├── auth.middleware.js       # `protect` — JWT verification + mustChangePassword lockout
│   │   ├── rbac.middleware.js       # `authorize(...roles)` — role gate
│   │   ├── validation.middleware.js # express-validator error formatter
│   │   └── error.middleware.js      # Central error handler (AppError → HTTP response)
│   ├── models/                      # Mongoose schemas
│   │   ├── User.js                  # Staff/doctor/admin accounts
│   │   ├── Patient.js               # Patient demographics, auto-generated patientId
│   │   ├── Appointment.js           # Bookings — links Patient + doctor (User) + Department
│   │   ├── Schedule.js              # Doctor's recurring weekly schedule
│   │   ├── ScheduleOverride.js      # Doctor's date-specific schedule override
│   │   └── AuditLog.js              # Immutable action trail
│   ├── routes/                      # Express routers — one per resource, mounted under /api/v1
│   │   ├── auth.routes.js
│   │   ├── appointment.routes.js
│   │   ├── department.routes.js
│   │   ├── doctor.routes.js
│   │   └── slot.routes.js
│   ├── services/                    # Business logic, framework-agnostic
│   │   ├── appointment.service.js   # Booking rules, filtering/pagination, cancel/complete logic
│   │   ├── slot.service.js          # Slot generation algorithm (sessions − breaks − booked ÷ duration)
│   │   ├── audit.service.js         # createAuditLog() helper
│   │   ├── socket.service.js        # Socket.IO init + notify* broadcast helpers
│   │   └── email.service.js         # nodemailer transport + sendPasswordResetEmail()
│   ├── validators/                  # express-validator rule sets per route group
│   │   ├── auth.validators.js
│   │   ├── appointment.validators.js
│   │   └── doctor.validators.js
│   ├── utils/
│   │   ├── appError.js              # Custom operational-error class
│   │   ├── asyncHandler.js          # try/catch wrapper for async route handlers
│   │   ├── token.js                 # JWT access/refresh token generation
│   │   └── dateUtils.js             # UTC date normalization helpers
│   ├── scripts/
│   │   └── db_inspect.js            # Manual/ad-hoc DB inspection (dev tool, not run by the app)
│   ├── .env / .env.example
│   ├── server.js                    # Express + HTTP + Socket.IO bootstrap
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── common/
    │   │   │   ├── ProtectedRoute.jsx     # Auth/mustChangePassword route guard
    │   │   │   └── NotificationBell.jsx   # Pending-qualification approvals dropdown (Super Admin)
    │   │   └── views/                     # One component per sidebar section
    │   │       ├── overview/OverviewView.jsx
    │   │       ├── admin/
    │   │       │   ├── StaffView.jsx          # Manage Staff (on-scroll pagination)
    │   │       │   ├── DoctorsView.jsx        # Manage Clinic Doctors (on-scroll pagination, qualification review)
    │   │       │   ├── DepartmentsView.jsx    # Manage Departments
    │   │       │   ├── SchedulesView.jsx      # Doctor default schedule + per-date overrides
    │   │       │   └── AuditLogsView.jsx      # Security Audit Trail (on-scroll pagination)
    │   │       ├── appointments/
    │   │       │   ├── BookAppointmentView.jsx  # New/existing patient booking form
    │   │       │   ├── PlannerView.jsx          # Daily planner / arrivals
    │   │       │   └── AllAppointmentsView.jsx  # Global appointment registry (Super Admin)
    │   │       ├── consultation/DoctorWorklistView.jsx  # Doctor's live consultation queue
    │   │       ├── patients/PatientRecordsView.jsx      # Patient search + visit history
    │   │       └── profile/MyProfileView.jsx            # Self-service profile (name/photo/password/qualification)
    │   ├── context/SocketContext.jsx    # Socket.IO client connection/provider
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── ForgotPassword.jsx       # Step 1 of email-based reset
    │   │   ├── ResetPassword.jsx        # Step 2 of email-based reset (:token from URL)
    │   │   ├── ChangeTempPassword.jsx   # Forced first-login password change
    │   │   ├── Dashboard.jsx            # App shell — sidebar, navbar, tab routing (NAV_ITEMS)
    │   │   └── NotFound.jsx
    │   ├── services/apiClient.js        # Axios instance, auth token injection, 401/423 interceptors
    │   ├── store/
    │   │   ├── index.js                 # Redux store setup
    │   │   └── slices/authSlice.js      # Auth state, login/logout thunks, localStorage sync
    │   ├── utils/date.js
    │   ├── App.jsx                      # Route definitions
    │   ├── main.jsx                     # React root render
    │   └── index.css                    # Tailwind v4 + design tokens
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Architecture Overview

**Backend — layered, service-oriented:**

```
Request → Route → Middleware chain → Controller → Service → Model → MongoDB Atlas
                   (protect → authorize → validate)
```

- **Routes** wire up URL + HTTP method + middleware chain + controller.
- **`protect`** verifies the JWT access token, loads `req.user`, and centrally enforces the `mustChangePassword` lockout (returns HTTP 423 for any route not on a small allowlist — change-temp-password, logout, refresh).
- **`authorize(...roles)`** rejects the request (403) if `req.user.role` isn't in the allowed list.
- **express-validator** rule sets run per-route, with a shared `validate` middleware that formats the first validation error into the app's standard error shape.
- **Controllers** stay thin: parse input, call a service, shape the JSON response, and fire any Socket.IO broadcast. They never contain business rules.
- **Services** hold all business logic (slot generation math, booking/double-booking rules, audit-log writes, email sending) and are plain Node modules with no Express dependency — straightforward to unit test in isolation.
- **`asyncHandler`** wraps every async controller so a rejected promise is forwarded to Express's error pipeline instead of crashing the process; **`error.middleware.js`** turns any `AppError` (or unexpected error) into a consistent JSON error response.

**Real-time layer:** `backend/services/socket.service.js` exposes `notifyAppointmentChange`, `notifyScheduleChange`, and `notifyStaffChange`, called by controllers after a successful write. The frontend's `SocketContext` listens for these on `Dashboard.jsx`, which re-broadcasts them as `window` `CustomEvent`s (`appointment_changed_ws`, `schedule_changed_ws`, `staff_changed_ws`). Individual views subscribe to whichever event is relevant to them and refetch — this keeps every open tab/session in sync without polling (a 20s safety-net poll exists only on the Doctor Worklist, as a fallback for missed socket events).

**Frontend — component + Redux + local fetch:**
- **Redux Toolkit** (`authSlice`) owns only authentication state (user, tokens, `mustChangePassword`). Its `initialState` is read synchronously from `localStorage` (not inside a `useEffect`) specifically so a hard page refresh doesn't momentarily appear logged-out and misroute the user.
- All other data (appointments, doctors, patients, audit logs, etc.) is fetched locally inside each view component via `apiClient.js` (an Axios instance) — there is no global cache/store for domain data.
- **`apiClient.js`** attaches the bearer token to every request, transparently refreshes an expired access token on a 401 and retries once, and dispatches a `password_change_required` window event on a 423 so `App.jsx` can react centrally.
- **Routing** (`react-router-dom` v7): every sidebar section is its own top-level URL (`/overview`, `/doctors`, `/staff`, ...) handled by a single catch-all `/:tab` route that renders the shared `Dashboard` shell and reads the active tab from the URL param — this makes every section independently bookmarkable and refresh-safe. `ProtectedRoute` gates authenticated routes and redirects to `/change-temp-password` when required.

---

## Database Design

### Collections

| Collection       | Model               | Purpose |
|-------------------|---------------------|---------|
| `users`           | `User.js`           | All staff accounts: super_admin, doctor, receptionist |
| `patients`        | `Patient.js`        | Patient demographics, auto-generated `PAT-XXXXXX` ID |
| `appointments`    | `Appointment.js`    | Bookings — links a patient, a doctor, a department, date/slot, status, notes |
| `schedules`       | `Schedule.js`       | Each doctor's recurring weekly schedule (one document per doctor) |
| `scheduleoverrides` | `ScheduleOverride.js` | Date-specific overrides of a doctor's schedule (holidays, half-days) |
| `auditlogs`       | `AuditLog.js`       | Append-only trail of security/administrative actions |
| `departments`      | `Department.js`     | Clinic departments, their working days, active/inactive flag |

### Key fields by model

**`User`** — `name`, `email` (unique), `password` (bcrypt-hashed, `select: false`), `role` (`super_admin`/`doctor`/`receptionist`), `department` (required for doctors), `qualification`, `pendingQualification` (awaiting admin approval), `avatar`, `status` (`active`/`blocked`), `readablePassword` (plaintext copy, only populated/visible while `mustChangePassword` is true), `mustChangePassword`, `refreshTokens[]` (supports multiple concurrent sessions and bulk invalidation), `resetPasswordToken` / `resetPasswordExpires` (SHA-256 hash + expiry for the forgot-password flow, both `select: false`).

**`Patient`** — `patientId` (auto-generated, unique, retried up to 10 times on collision), `name`, `mobileNumber` (indexed), `email`, `dob`, `gender`.

**`Appointment`** — `patient` (ref), `doctor` (ref User), `department` (denormalized String, not a ref — read-optimized), `date`, `slot` (`HH:MM`), `status` (`scheduled`/`arrived`/`completed`/`cancelled`), `purpose`, `notes`, `cancelledReason`.

**`Schedule`** — `doctor` (ref, unique — one schedule per doctor), `sessions[]` (start/end time windows), `slotDuration` (minutes, 5–120), `workingDays[]` (0=Sun..6=Sat; `undefined` by default so it can fall back to the department's working days when not explicitly configured), `breakTimings[]`.

**`ScheduleOverride`** — same shape as `Schedule` plus `date` (`YYYY-MM-DD` string); compound unique index on `{doctor, date}` so a doctor has at most one override per date.

**`AuditLog`** — `user` (ref), `role`, `action` (e.g. `LOGIN`, `STAFF_CREATED`, `SCHEDULE_CONFIGURED`, `PASSWORD_RESET_REQUESTED`, `QUALIFICATION_APPROVED`), `entity`, `entityId`, `details` (free-form `Mixed`), `timestamp`.

**`Department`** — `name` (unique), `workingDays[]` (default Mon–Fri), `isActive`.

### Relationships

```
User (doctor) ──1:1──► Schedule
User (doctor) ──1:N──► ScheduleOverride
User (doctor) ──1:N──► Appointment
Patient       ──1:N──► Appointment
Department    ──1:N──► Appointment   (denormalized as a String for query efficiency)
User          ──1:N──► AuditLog
```

### Indexes

| Collection          | Index                                        | Type                     | Purpose |
|----------------------|-----------------------------------------------|---------------------------|---------|
| `users`              | `email`                                       | Unique                   | Fast, unique login lookup |
| `patients`           | `patientId`                                   | Unique                   | Fast ID-based search |
| `patients`           | `mobileNumber`                                | Regular                  | Fast mobile-number search |
| `schedules`          | `doctor`                                      | Unique                   | Enforces one schedule per doctor |
| `scheduleoverrides`  | `{doctor, date}`                              | Compound Unique          | One override per doctor per date |
| `appointments`       | `{doctor, date, slot}` (partial: `status ≠ cancelled`) | Compound Partial Unique | **Prevents double-booking atomically at the DB layer**, while letting a cancelled slot be rebooked |
| `appointments`       | `date`                                        | Regular                  | Date-range filtering |
| `appointments`       | `status`                                      | Regular                  | Status filtering |
| `appointments`       | `department`                                  | Regular                  | Department filtering |
| `appointments`       | `patient`                                     | Regular                  | Patient → appointments lookup |
| `auditlogs`          | `timestamp`                                   | Regular                  | Reverse-chronological pagination |

---

## API Documentation

Base URL: `http://localhost:5000/api/v1` (configurable via `PORT`). All responses follow the shape `{ success, message, data, meta }`. Protected routes require `Authorization: Bearer <accessToken>`.

### Auth & Session — `/auth`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/auth/login` | Public | Authenticate; returns access + refresh token and user summary |
| POST | `/auth/refresh` | Public | Exchange a valid refresh token for a new access token |
| POST | `/auth/logout` | Public | Invalidate the given refresh token |
| POST | `/auth/change-temp-password` | Authenticated | One-time: replace an admin-issued temp password; invalidates all existing sessions |
| POST | `/auth/forgot-password` | Public | Request a password-reset email (always returns a generic success response, regardless of whether the email exists) |
| POST | `/auth/reset-password/:token` | Public | Set a new password using the emailed token (single-use, 30-minute expiry) |

### Self-Service Profile — `/auth`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/auth/me` | Authenticated | Get own profile |
| PUT | `/auth/me` | Authenticated | Update own name/avatar/password immediately; a qualification change (doctors only) is stored as `pendingQualification` awaiting admin approval |

### Staff Management — `/auth/staff` (Super Admin only)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Create a staff account (issues a temp password, `mustChangePassword: true`) |
| GET | `/auth/staff` | List staff; supports `role`, `excludeRole`, `department` filters and optional `page`/`limit` pagination (unpaginated by default for backward compatibility) |
| GET | `/auth/staff/pending-qualifications` | List all staff with a pending qualification change (powers the notification bell) |
| PUT | `/auth/staff/:id` | Update a staff member — **blocked entirely (403) once that user has set their own password**, except for `status` (block/unblock) |
| DELETE | `/auth/staff/:id` | Delete a staff member (requires the requesting admin's own password) |
| POST | `/auth/staff/:id/reveal-password` | Reveal a staff member's temp password (requires admin's own password; blocked once the user owns their password) |
| POST | `/auth/staff/:id/approve-qualification` | Approve a pending qualification change |
| POST | `/auth/staff/:id/reject-qualification` | Reject a pending qualification change |

### Doctors & Schedules — `/doctors`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/doctors` | Authenticated | List all doctors |
| GET | `/doctors/:id/schedule` | Authenticated | Get a doctor's recurring weekly schedule |
| PUT | `/doctors/:id/schedule` | Super Admin | Create/update a doctor's sessions, slot duration, working days, break timings |
| GET | `/doctors/:id/schedule/override?date=YYYY-MM-DD` | Authenticated | Get a date-specific override, if any |
| PUT | `/doctors/:id/schedule/override` | Super Admin | Create/update a date-specific override (upsert) |
| DELETE | `/doctors/:id/schedule/override?date=YYYY-MM-DD` | Super Admin | Remove an override, reverting that date to the default schedule |

### Dynamic Slots — `/slots`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/slots?doctorId=<id>&date=YYYY-MM-DD` | Authenticated | Generate that doctor's slot list for the date, each flagged `isBooked` / `inBreak` / `isPast` / `isAvailable` |

### Appointments — `/appointments`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/appointments` | Receptionist/Super Admin | Book a new appointment (new or existing patient) |
| GET | `/appointments` | Authenticated | List with pagination, sorting, and filters (`patientSearch`, `doctorSearch`, `department`, `status`, `startDate`, `endDate`, `doctorId`); doctors are always scoped to their own appointments |
| PUT | `/appointments/:id` | Authenticated | Edit purpose/notes |
| DELETE | `/appointments/:id` | Authenticated | Cancel (with a reason); frees the slot for rebooking |
| DELETE | `/appointments/:id/remove` | Super Admin | Permanently delete an appointment record |
| POST | `/appointments/:id/arrive` | Receptionist/Super Admin | Mark patient as arrived |
| POST | `/appointments/:id/complete` | Doctor | Complete the visit with clinical notes |
| GET | `/appointments/patients/search?q=&date=&department=` | Receptionist/Super Admin | Search patients by name/ID/mobile, with per-patient total/completed visit counts |
| GET | `/appointments/audit/logs?page=&limit=` | Super Admin | Paginated security audit trail |

### Departments — `/departments`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/departments` | Public | List active departments |
| POST | `/departments` | Super Admin | Create a department |
| PUT | `/departments/:id` | Super Admin | Update name/working days/active status |
| DELETE | `/departments/:id` | Super Admin | Delete a department |

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in real values.

| Variable | Required | Description | Example |
|---|---|---|---|
| `PORT` | No (default `5000`) | Port the Express server listens on | `5000` |
| `MONGO_URI` | **Yes** | MongoDB connection string (local or Atlas) | `mongodb+srv://user:pass@cluster0.mongodb.net/adamcare` |
| `JWT_SECRET` | **Yes** | Secret used to sign access tokens | *(strong random value)* |
| `JWT_REFRESH_SECRET` | **Yes** | Secret used to sign refresh tokens | *(strong random value, different from above)* |
| `NODE_ENV` | No | Runtime environment | `development` / `production` |
| `FRONTEND_URL` | No (default `http://localhost:5173`) | Allowed CORS origin; also used to build the password-reset link sent by email | `http://localhost:5173` |
| `EMAIL_HOST` | For Forgot Password | SMTP host | `smtp.gmail.com` |
| `EMAIL_PORT` | For Forgot Password | SMTP port | `587` |
| `EMAIL_USER` | For Forgot Password | Sending email address | `you@example.com` |
| `EMAIL_PASS` | For Forgot Password | SMTP password — **for Gmail this must be a 16-character App Password** (Google Account → Security → 2-Step Verification → App Passwords), not the regular account password | *(app password)* |

`PORT`, `MONGO_URI`, `JWT_SECRET`, and `JWT_REFRESH_SECRET` are validated on boot — `server.js` exits immediately with a clear error if any required variable is missing. The `EMAIL_*` variables are not required to boot the server; if unset, the app still runs and "Forgot Password" requests still return their generic success response, but no email is actually sent (the failure is logged server-side only, never surfaced to the client — see the enumeration-prevention note in `auth.controller.js`).

The frontend has no `.env` requirements — it talks to the backend via a hardcoded base URL in `apiClient.js` pointing at `http://localhost:5000/api/v1` in development.

---

## Installation Instructions

### Prerequisites
- Node.js v18 or higher
- A MongoDB instance — local (`mongodb://localhost:27017`) or a MongoDB Atlas cluster
- (Optional, for Forgot Password emails) A Gmail account with an App Password, or any SMTP provider

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
# then edit .env: set MONGO_URI, JWT_SECRET, JWT_REFRESH_SECRET,
# and optionally EMAIL_USER / EMAIL_PASS for the Forgot Password feature
```

### 2. Frontend
```bash
cd frontend
npm install
```

---

## Running the Project

Run backend and frontend in two separate terminals.

**Backend** (from `backend/`):
```bash
npm run dev      # nodemon — auto-restarts on file changes
# or
npm start        # plain node, for production
```
Runs on `http://localhost:5000`. On first boot, connect to your database and create a Super Admin manually (there is no seed script) — either insert a `User` document directly with a bcrypt-hashed password and `role: "super_admin"`, or temporarily relax the `authorize('super_admin')` guard on `POST /auth/register` to create the first admin, then re-enable it.

**Frontend** (from `frontend/`):
```bash
npm run dev
```
Runs on `http://localhost:5173`. Open this URL in a browser and log in.

**Other frontend scripts:** `npm run build` (production bundle via Vite), `npm run preview` (serve the production build locally), `npm run lint` (oxlint).

---

## Assumptions Made

1. **Timezone normalization**: appointment dates are stored/queried as UTC midnight (`YYYY-MM-DDT00:00:00.000Z`), avoiding client-timezone drift when comparing dates.
2. **Slot times are clinic-local wall-clock strings** (`HH:MM`, 24-hour), not timezone-aware — the whole clinic is assumed to operate in a single timezone.
3. **One schedule per doctor**: a doctor has exactly one recurring weekly schedule (`Schedule`), with `ScheduleOverride` documents layered on top for specific dates only.
4. **Department is denormalized onto `Appointment`** as a plain string (not a foreign key) for read performance on the very common "filter appointments by department" query, at the cost of not automatically reflecting a later department rename.
5. **A cancelled appointment immediately frees its slot** for rebooking — enforced by the partial unique index rather than application-level locking, so it's correct even under concurrent requests.
6. **Password ownership is permanent and one-directional**: once a user sets their own password (via temp-password change, self-service profile, or email reset), no admin action can restore visibility/edit access — this is treated as a deliberate privacy guarantee, not a bug to work around.
7. **The first Super Admin account must be created manually** — there's no seed script or setup wizard, since `POST /auth/register` itself requires an existing Super Admin.
8. **Single-clinic, single-tenant** deployment — there's no multi-tenancy/org boundary in the data model.

---

## Known Limitations

1. **No automated test suite** — all verification during development was done via manual/live API scripts and browser testing, not a committed Jest/Vitest/Supertest suite.
2. **Socket.IO runs in-memory, single-instance** — real-time sync works correctly on one server process, but horizontally scaling the backend (multiple instances) would need a shared adapter (e.g. `@socket.io/redis-adapter`) for broadcasts to reach clients connected to a different instance.
3. **No rate limiting** on any endpoint, including `/auth/login` and `/auth/forgot-password` — both are natural targets for brute-force/abuse in a production deployment.
4. **Refresh tokens are stored as plain strings** in `user.refreshTokens[]` rather than hashed — a database compromise would expose usable refresh tokens directly (this mirrors the tradeoff commonly made for simplicity, unlike the reset-password token which is deliberately hashed).
5. **No email verification on staff creation/registration** — an admin-entered email is trusted as-is; only the Forgot Password flow actually proves the user controls that inbox.
6. **No file storage integration for avatars** — `avatar` is stored as whatever string/data URI the client sends, with no server-side image processing, size limits, or validation.
7. **No automated seeding/migration tooling** — schema changes and the first admin account are both handled manually.
8. **Frontend has no `.env`-based API URL configuration** — the backend base URL is hardcoded in `apiClient.js`, so deploying frontend and backend to different domains requires a code change, not just a config change.

---

## Future Improvements

1. **SMS/Email appointment reminders** — notify patients ahead of a booked visit (e.g. via Twilio or the existing nodemailer setup).
2. **Rate limiting & brute-force protection** on `/auth/login`, `/auth/forgot-password`, and `/auth/reset-password/:token` (e.g. `express-rate-limit`).
3. **Automated test coverage** — unit tests for services (slot generation, booking rules) and integration tests for the auth/appointment routes.
4. **Redis-backed Socket.IO adapter** to support horizontal scaling of the backend.
5. **Refresh token hashing** at rest, matching the pattern already used for password-reset tokens.
6. **Admin-configurable audit log retention/export** (e.g. CSV export, retention window) for compliance needs.
7. **Insurance/billing module** — map patients to insurance details and calculate co-pays at check-in.
8. **Multi-clinic/tenant support**, if the product scope expands beyond a single clinic.
9. **Proper avatar upload pipeline** (object storage + resizing) instead of raw client-provided strings.
10. **Configurable frontend API base URL** via a build-time environment variable, to simplify multi-environment deployment.
