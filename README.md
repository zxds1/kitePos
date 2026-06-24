# 🎯 KitePos - Modern Point of Sale System

> A full-stack, AI-powered point of sale and inventory management platform designed for SMBs and retail operations. Built with **TypeScript**, **Next.js**, **React**, and **Medusa**.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Development](#development)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## 🚀 Overview

**KitePos** is a comprehensive point-of-sale system built for modern retail operations. It combines a powerful backend infrastructure with an intuitive partner portal, enabling seamless sales transactions, inventory management, AI-assisted product matching, and business analytics.

The platform serves multiple surfaces:
- **Mobile POS Clients** - Fast, offline-capable point of sale applications
- **Admin Dashboard** - Operational and inventory management
- **Partner Portal** - Storefront management and partner integrations
- **Public Storefronts** - Customer-facing shop experiences

---

## 📁 Project Structure

```
kitePos/
├── backend/              # Core Medusa-based backend server
│   ├── src/
│   │   ├── api/         # API routes (auth, POS, admin, shops, partners)
│   │   ├── modules/     # Business domain modules (sales, suppliers, loyalty, etc.)
│   │   ├── services/    # Integrations (AI, cloud storage, billing, tax)
│   │   └── scripts/     # Seeding and utility scripts
│   ├── integration-tests/ # HTTP seam tests for API validation
│   ├── deploy/          # Blue/green deployment scripts and Nginx config
│   └── docs/            # Comprehensive backend documentation
│
├── partner-portal/      # Next.js-based partner management interface
│   ├── app/            # Next.js application
│   ├── components/     # React components
│   └── styles/         # Tailwind CSS styling
│
└── README.md           # This file
```

---

## ✨ Key Features

### Backend Features
- **Authentication & Security**
  - OTP and PIN-based authentication
  - Refresh token management
  - Staff recovery flows
  - Session lifecycle management

- **Point of Sale**
  - Real-time product catalog and inventory management
  - Offline sync ingestion for sales and restocks
  - Sales tracking with analytics and snapshots
  - Multi-store and terminal support

- **AI & Automation**
  - AI-assisted product extraction and matching
  - Photo recognition for product identification
  - Intelligent product catalog enrichment

- **Business Operations**
  - Multi-location management (shops, branches, terminals)
  - Partner usage logging and billing
  - Export functionality and data integrations
  - Tax and loyalty program management

- **Content Delivery**
  - Public storefront generation
  - Shop site publishing and serving
  - Media storage via Cloudflare R2

### Portal Features
- Partner portal for managing storefronts
- Storefront configuration and customization
- Business analytics and reporting dashboard
- Integration management

---

## 🛠 Tech Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: [Medusa](https://medusajs.com/) (Headless Commerce)
- **Language**: TypeScript
- **API**: REST with custom domain models
- **Database**: SQLite / PostgreSQL (configurable)
- **Storage**: AWS S3 / Cloudflare R2
- **Authentication**: JWT + custom flows
- **Testing**: Jest with Medusa test utilities
- **Build**: SWC

### Frontend (Partner Portal)
- **Framework**: Next.js 14
- **UI Library**: React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Package Manager**: npm 10.8+

---

## ⚡ Quick Start

### Prerequisites
- Node.js 20+ and npm 10.8+
- Git

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Run development server
npm run dev
```

Visit `http://localhost:9000` for the API.

### Partner Portal Setup

```bash
cd partner-portal

# Install dependencies
npm install

# Run development server
npm run dev
```

Visit `http://localhost:3000` for the portal.

### Build for Production

```bash
# Backend
cd backend
npm run build

# Partner Portal
cd partner-portal
npm run build
npm run start
```

---

## 🏗 Architecture

### API Layers

| Layer | Purpose | Location |
|-------|---------|----------|
| **Auth API** | OTP, PIN, token refresh, staff recovery | `src/api/auth`, `src/api/pos/auth` |
| **POS API** | Products, sales, restocks, settings, staff, stores, analytics, uploads | `src/api/pos` |
| **Admin API** | Operational and management routes | `src/api/admin` |
| **Shops API** | Public storefronts and shop endpoints | `src/api/shops` |

### Business Modules

Located in `src/modules/`:
- **Sales & Inventory**: Sales snapshots, restock management
- **Suppliers & Partners**: Supplier management, partner integrations, billing
- **Loyalty & Tax**: Loyalty programs, tax calculations and management
- **Exports**: Data export and integration flows

### Services

Located in `src/services/`:
- AI extraction and product matching
- Cloudflare R2 media storage
- Billing and partner management
- Loyalty program logic
- Tax compliance

---

## 💻 Development

### Testing

```bash
cd backend

# Unit tests
npm run test:unit

# Integration tests (modules)
npm run test:integration:modules

# Integration tests (HTTP API)
npm run test:integration:http
```

Integration tests live in `backend/integration-tests/http/`.

### Build & Validation

```bash
# Build backend
npm run build

# Seed test data
npm run seed
```

### Media Storage Configuration

Configure Cloudflare R2 via environment variables:
```env
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_BUCKET_NAME=...
CLOUDFLARE_R2_PUBLIC_BASE_URL=...
CLOUDFLARE_R2_ENDPOINT=... # optional
```

---

## 🚢 Deployment

The platform supports production-grade deployment with blue/green strategy:

### Environments
- **Staging**: Staging environment with `.env.staging`
- **Production**: Production environment with `.env.prod`

### Deployment Tools
- Blue/green deployment: `deploy/bluegreen-deploy.sh`
- Rollback: `deploy/rollback.sh`
- Nginx configuration included

### For Detailed Deployment Steps
See `backend/docs/deployment.md`

---

## 📚 Documentation

Comprehensive documentation is available in `backend/docs/`:

- **Getting Started** - Local development and installation
- **Deployment** - Staging, production, and rollback procedures
- **Admin** - Admin URL and CORS configuration
- **AI Integration** - AI routes, environment variables, and operations
- **Observability** - OpenTelemetry and health checks
- **Features** - Complete feature catalog
- **Feature Status** - Stability and completeness status of all surfaces
- **Demo Workspaces** - Demo data catalog and contracts

**Start here**: [`backend/docs/README.md`](./backend/docs/README.md)

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and add tests
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

Please ensure all tests pass before submitting:
```bash
npm run build
npm test
```

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🔗 Resources

- [Medusa Documentation](https://docs.medusajs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

## 💬 Support

For issues, questions, or suggestions, please [open an issue](https://github.com/zxds1/kitePos/issues) on GitHub.

---

**Built with ❤️ for modern retail operations**
