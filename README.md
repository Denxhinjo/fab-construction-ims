# Fab Construction — Materials Inventory

Inventory system for **Fab Construction**'s construction materials across several warehouses. Supplier invoices are uploaded as PDFs or photos, read automatically, checked by a person, and booked into stock in one step.

**Case study:** [denxhinjo-labs.vercel.app/projects/fab-inventory-system](https://denxhinjo-labs.vercel.app/projects/fab-inventory-system)

## Tech Stack

| Layer          | Technology                                              |
|----------------|---------------------------------------------------------|
| Frontend       | React 18 + TypeScript + Tailwind CSS + Vite             |
| Backend        | FastAPI (Python 3.12)                                   |
| Database       | PostgreSQL 16                                           |
| ORM            | SQLAlchemy 2 + Alembic                                  |
| Auth           | JWT (python-jose) + bcrypt                              |
| Invoice reading| PyMuPDF (PDF text) + Tesseract OCR (scans and photos) + a rule-based parser |
| State          | TanStack Query (React Query)                            |

---

## What it does

| Page | |
|---|---|
| **Paneli** (Dashboard) | What needs attention today: invoices to check, transfers on the way, materials below minimum (and whether another warehouse can cover them); value per warehouse; recent movements. |
| **Stoku** (Stock) | One row per material, one column per warehouse. Quantities below that warehouse's minimum are red. Export to Excel (CSV). Per-warehouse minimums and physical-count corrections in the material dialog. |
| **Pranimet** (Receipts) | Upload up to 20 invoices at once (PDF, scan or phone photo). Each is read, matched to materials and waits for review. The review screen shows the document next to the rows; confirming books the stock. |
| **Transferimet** (Transfers) | Move stock between warehouses. Stock leaves the source when sent and enters the destination when received ("arrived in full" or "differences"). "Fill up to minimum" proposes what the destination is short of. Printable delivery note. |
| **Historiku** (History) | Every stock movement: receipts, transfers, corrections — linked to its invoice or transfer. |
| Depot / Furnizuesit / Përdoruesit | Warehouses, suppliers and users (admin). |

The UI is in Albanian with an English toggle.

### How invoices are read

No AI service is involved and invoices never leave the server.

1. **Text** — a PDF exported from invoicing software has a text layer, which is used directly (words are regrouped into rows by position). A scanned PDF (e.g. CamScanner) or a photo has none, so the page is read with **Tesseract OCR** using the Albanian + English language data.
2. **Header** — invoice number, date, supplier name and NIPT are found by their labels, in Albanian or English (`Nr. Fature`, `Data dhe ora e lëshimit`, `Emri i Shitësit`, `Invoice No`, ...). OCR mix-ups in the NIPT (`O`/`0`, `I`/`1`) are corrected by its fixed format.
3. **Rows** — each item row's trailing numbers are assigned to quantity / unit price / net / VAT / gross so that **quantity × price = net** and **net + VAT = gross**. That arithmetic also repairs OCR damage (a unit price read as `1169833` is restored to `116.9833` from net ÷ quantity) and decides each row's colour on the review screen: green when the numbers agree, amber when a person should look.
4. **Matching** — the supplier by NIPT, then name. Each row's material, most to least certain: what this supplier's code/description was linked to on an earlier invoice → SKU → a close name (sizes like Ø10/Ø12 must agree). Unmatched rows become proposed new materials. Transport and service lines are recognised as costs, not stock.
5. **Learning** — confirming an invoice remembers every row's supplier code and description, so the next invoice from that supplier matches without guessing.

Reading a scanned page takes about 5–10 seconds. The parser lives in `backend/app/services/invoice_parser.py` and is covered by tests against real OCR output.

---

## Quick Start (Local Development)

### Prerequisites

- Python 3.10+
- Node.js 20+
- PostgreSQL 16
- **Tesseract OCR** with Albanian data — only needed to read scans and photos; digital PDFs work without it.
  - Windows: install from [UB Mannheim](https://github.com/UB-Mannheim/tesseract/wiki), tick *Albanian* under additional languages, and set `TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe` in `backend/.env` if it's not on PATH.
  - Debian/Ubuntu: `apt install tesseract-ocr tesseract-ocr-sqi`
  - macOS: `brew install tesseract tesseract-lang`

### Backend

```bash
psql -U postgres -c "CREATE DATABASE fab_construction_ims;"

cd backend
cp .env.example .env            # set SECRET_KEY; DATABASE_URL if different
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python seed_data.py             # demo warehouses, materials and users (only on an empty DB)
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/api/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

### Docker (full stack, includes Tesseract)

```bash
cp .env.example .env
docker compose up --build
# App: http://localhost:3000   API: http://localhost:8000/api/docs
```

---

## Demo Accounts

Created by `seed_data.py`. The login form accepts the username or the email.

| Role              | Username    | Password              |
|-------------------|-------------|-----------------------|
| Admin             | `admin`     | `Admin@123`           |
| Admin             | `denxhinjo` | `Denis@123`           |
| Warehouse manager | `arkfab`    | `Fabconstruction2026` |

---

## Deployment

The backend needs the `tesseract-ocr` system package to read scans and photos, so deploy it as a **Docker** service (`backend/Dockerfile` installs it). `render.yaml` does this.

Hosts that run the backend without system packages (Vercel serverless, Render's native Python runtime) still read digital PDFs, but scans and photos arrive as "not read" and are filled in by hand.

Uploaded invoice files are stored in the database (not on disk), so they survive redeploys on hosts with an ephemeral filesystem.

---

## Project Structure

```
backend/
  app/
    models/        invoice.py, supplier_product_alias.py, product.py, product_stock.py, warehouse_transfer.py, ...
    routers/       invoices.py, products.py (+ /api/stock), transfers.py, dashboard.py (+ /api/search), stock_movements.py, ...
    services/
      invoice_reader.py     file -> text (PDF text layer or Tesseract)
      invoice_parser.py     text -> invoice header + rows (rule-based, arithmetic-checked)
      invoice_matching.py   supplier / material matching and remembered aliases
      inventory_service.py  every stock change goes through record_movement()
  alembic/         migrations
  tests/           pytest (parser, invoices end-to-end, stock, transfers, auth)
  seed_data.py
frontend/src/
  pages/           Dashboard, Stock/, Receipts/ (list + review), Transfers/, History/, Locations/, Suppliers/, Users/
  components/      layout/ (Sidebar, Header), ui/ (MaterialPicker, Modal, Badge, ...)
  lib/format.ts    numbers, money, dates, movement labels
  i18n/locales/    sq.json, en.json
```

---

## API

| Method | Path | |
|---|---|---|
| POST | /api/invoices | Upload a PDF/JPEG/PNG; read, parse and match it |
| GET | /api/invoices | List, with counts per status |
| GET | /api/invoices/{id} | Invoice with rows and matches |
| GET | /api/invoices/{id}/file | The uploaded file |
| PUT | /api/invoices/{id} | Save review changes for later |
| POST | /api/invoices/{id}/accept | Book the stock rows into the chosen warehouse |
| POST | /api/invoices/{id}/reject | Discard without booking |
| GET | /api/stock | Stock matrix (filters: location, category, below_min, search) |
| GET | /api/stock/export | CSV for Excel |
| POST | /api/stock/adjust | Physical-count correction |
| GET/POST/PUT/DELETE | /api/products | Materials (create/edit/archive: admin) |
| GET/POST | /api/transfers | List / send (stock leaves the source) |
| POST | /api/transfers/{id}/receive | Receive in full, or per item with differences |
| GET | /api/stock-movements | History |
| GET | /api/dashboard, /api/dashboard/counts | Dashboard and sidebar badges |
| GET | /api/search?q= | Materials, invoices and transfers |

Plus auth, users, locations, suppliers and categories. Everyone signed in sees all warehouses; changing stock in a warehouse needs access to it (admins have all).

---

## Environment Variables

`backend/.env` (see `backend/.env.example`):

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/fab_construction_ims
SECRET_KEY=change-me-min-32-chars
ALLOWED_ORIGINS=http://localhost:5173
TESSERACT_CMD=             # only if tesseract isn't on PATH
OCR_LANGUAGES=sqi+eng
MAX_INVOICE_FILE_MB=15
```

`SECRET_KEY` has no default — the app refuses to start without it. Frontend: `VITE_API_URL` (production API origin), `VITE_CURRENCY` (stock valuation currency, default `ALL`).

---

## Testing

```bash
cd backend && pytest -q          # in-memory SQLite; no Postgres or Tesseract needed
cd frontend && npm run lint && npm run build && npm test
```

CI (`.github/workflows/ci.yml`) runs both on every push and PR.

---

## Notes

- **Removed in v3**: work orders, projects, purchase orders, reports, low-stock emails and product images. Their database tables are left in place with their data.
- **JWT storage**: the access token is kept in `localStorage` — simple, but a successful XSS could read it. Move to an httpOnly cookie before handling data beyond this internal tool.
- **Not built yet**: forwarding invoices by email into Receipts (needs an inbound-mail provider).
