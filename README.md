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
| File Upload | Local media storage (S3-ready structure) |
| Charts      | Recharts                                 |
| State       | TanStack Query (React Query)             |

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

| Role  | Email                              | Password   |
|-------|------------------------------------|------------|
| Admin | admin@fabconstruction.com          | admin      |
| User  | john.smith@fabconstruction.com     | User@123   |
| User  | sarah.jones@fabconstruction.com    | User@123   |
| User  | mike.wilson@fabconstruction.com    | User@123   |

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
│   │   └── routers/             # API route handlers
│   ├── alembic/                 # Database migrations
│   ├── media/                   # Uploaded product images
│   ├── seed_data.py             # Demo data seeder
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Routes + AuthProvider wrapper
│   │   ├── context/             # AuthContext (JWT + user state)
│   │   ├── services/api.ts      # Axios API client + interceptors
│   │   ├── types/index.ts       # TypeScript interfaces
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
├── docker-compose.yml
└── README.md
```

---

## API Endpoints

| Method | Path                        | Description                     |
|--------|-----------------------------|---------------------------------|
| POST   | /api/auth/login             | Login (returns JWT)             |
| GET    | /api/auth/me                | Current user                    |
| GET    | /api/products               | List products (paginated+filter)|
| POST   | /api/products               | Create product (multipart)      |
| GET    | /api/products/{id}          | Get product detail              |
| PUT    | /api/products/{id}          | Update product                  |
| DELETE | /api/products/{id}          | Delete product (admin only)     |
| GET    | /api/categories             | List categories                 |
| GET    | /api/locations              | List locations                  |
| GET    | /api/suppliers              | List suppliers                  |
| GET    | /api/stock-movements        | List movements (paginated)      |
| POST   | /api/stock-movements        | Record stock movement           |
| GET    | /api/work-processes         | List work processes             |
| POST   | /api/work-processes         | Create work process             |
| PUT    | /api/work-processes/{id}    | Update work process             |
| GET    | /api/users                  | List users (admin only)         |
| POST   | /api/users                  | Create user (admin only)        |
| GET    | /api/dashboard/stats        | Dashboard statistics            |

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
```

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

## Future Enhancements

- S3/Supabase Storage for product images
- Email notifications for low stock
- PDF/CSV export for reports
- Mobile PWA support
- Barcode/QR scanning
- Multi-currency pricing
