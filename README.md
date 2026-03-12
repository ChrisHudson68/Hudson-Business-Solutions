# Hudson Business Solutions

**Hudson Business Solutions** is a multi-tenant construction operations platform built for tracking jobs, costs, employees, timesheets, invoices, payments, and profitability in one place.

Each company runs inside the same application while keeping its data isolated by tenant.

## Current stack

Hudson Business Solutions is currently built with:

- **TypeScript**
- **Hono**
- **JSX server-side rendering**
- **SQLite** via `better-sqlite3`
- **Docker Compose** for local development

This repository is **not** the older Flask/Gunicorn/PostgreSQL version.

---

## Core features

### Multi-tenant access

Each tenant is separated by subdomain.

Examples:

- `acme.localhost:3000`
- `taylors.localhost:3000`

Each tenant has isolated:

- users
- jobs
- financial records
- branding
- invoices
- timesheets

### Job management

Track jobs from kickoff through completion with:

- job name and client tracking
- contract amount
- retainage
- job status
- job detail pages
- profitability rollups

### Financial tracking

Track job financial performance with:

- income entries
- expense entries
- receipt uploads
- labor cost from timesheets
- invoice balances
- payment tracking

### Employees and timesheets

Manage labor data with:

- employee records
- hourly and salary pay types
- weekly timesheets
- automatic labor cost calculation

### Invoicing and payments

Create branded invoices and track collections with:

- invoice numbering
- due dates
- outstanding balances
- payment logging
- PDF invoice export

### Tenant branding and settings

Each tenant can store:

- company name
- logo
- company email
- phone
- address
- invoice prefix
- default tax and labor settings

---

## Project structure

```text
Hudson Business Solutions-dj-testing/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── public/
│   ├── brand/
│   └── css/
├── src/
│   ├── db/
│   │   ├── queries/
│   │   ├── schema.sql
│   │   └── seed.ts
│   ├── middleware/
│   ├── pages/
│   ├── routes/
│   ├── services/
│   └── index.tsx
└── README.md