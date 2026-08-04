# Fab Construction — Inventory Management System

A full-stack, production-quality Inventory Management System built for **Fab Construction**. Tracks products, locations, suppliers, stock movements, and work processes.

**Case study:** [denxhinjo-labs.vercel.app/projects/fab-inventory-system](https://denxhinjo-labs.vercel.app/projects/fab-inventory-system)

## Tech Stack

| Layer       | Technology                               |
|-------------|------------------------------------------|
| Frontend    | React 18 + TypeScript + Tailwind CSS + Vite |
| Backend     | FastAPI (Python 3.12)                    |
| Database    | PostgreSQL 16                            |
| ORM         | SQLAlchemy 2 + Alembic                  |
| Auth        | JWT (python-jose) + bcrypt               |
| File Upload | Cloudinary, via a backend-owned upload endpoint (see [Security Notes](#security-notes)) |
| Charts      | Recharts                                 |
| State       | TanStack Query (React Query)             |
| Mobile      | Native Android companion app (Kotlin + Jetpack Compose, separate `FabInventoryMobile` repo) |

---

## Features

- **Role-based auth** (Admin / User) with JWT tokens
- **Inventory CRUD** — products with images, SKU, category, location, supplier, stock levels
- **Stock movement tracking** — Stock In / Stock Out / Adjustment with full history
- **Work process management** — task statuses, priorities, assignments, timelines
- **Multi-location support** — scalable location model with manager/contact info
- **Supplier management** — track vendors per product
- **Dashboard** — live stats, low-stock alerts, recent activity
- **Reports** — bar charts, pie charts, date-filtered movement history
- **User management** (Admin only) — create, update, deactivate users
- **Responsive design** — mobile, tablet, and desktop

---

## Quick Start (Local Development)

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 16 running locally

### 1. Database

```bash
psql -U postgres -c "CREATE DATABASE fab_construction_ims;"
```

### 2. Backend

```bash
cd backend

# Copy env and configure
cp .env.example .env
# Edit .env if needed (DATABASE_URL, SECRET_KEY)

# Create virtual environment and install
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Seed demo data
python seed_data.py

# Start the API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/api/docs

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

---

## Docker (Full Stack)

```bash
# Start everything with Docker Compose
docker-compose up --build

# App at:   http://localhost:3000
# API at:   http://localhost:8000/api/docs
```

---

## Demo Accounts

The login form takes a **username**, not an email. After running `python seed_data.py` locally:

| Role  | Username  | Password   |
|-------|-----------|------------|
| Admin | admin     | Admin@123  |
| User  | jsmith    | User@123   |
| User  | sjones    | User@123   |
| User  | mwilson   | User@123   |

The login screen shows the admin/jsmith pair automatically in dev builds (`import.meta.env.DEV`) — it's stripped out of production bundles.

---

## Project Structure

```
fab-construction-ims/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Settings (pydantic-settings)
│   │   ├── database.py          # SQLAlchemy engine + session
│   │   ├── dependencies.py      # Auth dependency injection
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── services/            # permissions.py (location-access helpers), storage.py (Cloudinary)
│   │   └── routers/             # API route handlers (incl. uploads.py)
│   ├── alembic/                 # Database migrations
│   ├── tests/                   # pytest suite (auth, products, stock movements, dashboard, work processes)
│   ├── media/                   # Legacy local media (uploads now go to Cloudinary)
│   ├── seed_data.py             # Demo data seeder — manual/local only, never run on deploy
│   ├── requirements.txt
│   ├── requirements-dev.txt     # requirements.txt + pytest
│   ├── pytest.ini
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Routes + AuthProvider wrapper (route-level code-split)
│   │   ├── context/             # AuthContext (JWT + user state)
│   │   ├── services/api.ts      # Axios API client + interceptors
│   │   ├── i18n/                # en/sq translations
│   │   ├── types/index.ts       # TypeScript interfaces
│   │   ├── test/setup.ts        # Vitest + Testing Library setup
│   │   ├── components/
│   │   │   ├── layout/          # Sidebar, Header, Layout
│   │   │   └── ui/              # Badge, Modal, Spinner, EmptyState...
│   │   └── pages/
│   │       ├── Login.tsx
│   │       ├── Dashboard.tsx
│   │       ├── Inventory/       # List, AddEdit, Detail
│   │       ├── Locations/
│   │       ├── WorkProcesses/
│   │       ├── Users/
│   │       └── Reports/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── .github/workflows/ci.yml     # Backend pytest + frontend lint/build/test
├── docker-compose.yml
└── README.md
```

---

## API Endpoints

| Method | Path                        | Description                     |
|--------|-----------------------------|---------------------------------|
| POST   | /api/auth/login             | Login (returns JWT)              |
| GET    | /api/auth/me                | Current user                     |
| POST   | /api/auth/change-password   | Change own password              |
| GET    | /api/products                | List products (paginated+filter, location-scoped) |
| POST   | /api/products                | Create product (multipart, sets initial quantity) |
| GET    | /api/products/{id}          | Get product detail               |
| PUT    | /api/products/{id}          | Update product (quantity not settable — use stock-movements) |
| DELETE | /api/products/{id}          | Archive product (admin only, soft delete) |
| GET    | /api/categories             | List categories                  |
| GET    | /api/locations               | List locations                   |
| GET    | /api/suppliers               | List suppliers                   |
| GET    | /api/stock-movements         | List movements (paginated, location-scoped) |
| POST   | /api/stock-movements         | Record Stock In/Out/Adjustment (updates product quantity + audit trail) |
| GET    | /api/work-processes          | List work processes (location-scoped) |
| POST   | /api/work-processes          | Create work process              |
| PUT    | /api/work-processes/{id}    | Update work process              |
| DELETE | /api/work-processes/{id}    | Delete work process (admin only) |
| GET    | /api/users                   | List users (admin only)          |
| POST   | /api/users                   | Create user (admin only)         |
| POST   | /api/uploads/image           | Upload a product/work-process image to Cloudinary (authenticated, both web and Android use this — see [Security Notes](#security-notes)) |
| GET    | /api/dashboard/stats         | Dashboard statistics (location-scoped for non-admins) |

Full interactive docs: http://localhost:8000/api/docs

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/fab_construction_ims
SECRET_KEY=your-super-secret-key-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
MEDIA_DIR=media
ALLOWED_ORIGINS=http://localhost:5173
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

`SECRET_KEY` has no default — the app fails to start without it, on purpose, rather than silently signing JWTs with a value anyone could read from source.

---

## Database Migrations

```bash
# Create a new migration after changing models
cd backend
alembic revision --autogenerate -m "describe your change"

# Apply all migrations
alembic upgrade head

# Roll back one migration
alembic downgrade -1
```

---

## Testing

```bash
# Backend — pytest against an in-memory SQLite DB, no running Postgres needed
cd backend
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
pytest -q

# Frontend — Vitest + React Testing Library
cd frontend
npm run lint
npm run build
npm test
```

CI (`.github/workflows/ci.yml`) runs all of the above on every push/PR. The Android companion app has its own JVM unit test suite and CI workflow in the `FabInventoryMobile` repo.

---

## Security Notes

- **JWT storage**: the access token is kept in `localStorage`, not an httpOnly cookie. This is a deliberate MVP tradeoff — it's simple and works identically for the web app and the Android client (which sends the same bearer token via Retrofit) — but it means a successful XSS could exfiltrate the token. Revisit this (httpOnly cookie + CSRF token for the web client) before this app handles real customer/financial data rather than an internal company tool.
- **Uploads**: neither client talks to Cloudinary directly or embeds an unsigned upload preset. Every image goes through `POST /api/uploads/image`, which is behind normal JWT auth and holds the Cloudinary credentials server-side only.
- **`SECRET_KEY`**: required at startup with no fallback — set it via `.env` locally and via your host's secret/env-var manager in production.
- **Seeding**: `seed_data.py` is a manual, local/dev-only script (idempotent — skips if any user already exists) and is never invoked automatically by the Docker or Railway startup commands.

---

## Future Enhancements

- Email notifications for low stock
- PDF/CSV export for reports
- Mobile PWA support
- Barcode/QR scanning
- Multi-currency pricing
- ERP-direction roadmap (procurement, warehouse transfers, approvals, inventory valuation) — see the Android companion app's README for the mobile side of this direction
