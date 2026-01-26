# Finance Tracker

A clean, mobile-first personal finance tracker with accounts, income/expense/loan tracking, statistics, and offline-ready PWA support. Built with React + Vite + Tailwind.

## Features
- Home dashboard with total balance, privacy toggle, and recent transactions
- Transaction types: Expense, Income, and Loan (Borrow/Lend)
- Loan status tracking (Open / Settled)
- Statistics with monthly charts and yearly balance overview
- Accounts (Cash, Bank, Mobile Wallet) with balances
- Currency selection on first launch
- Data import/export with safety warning
- Dark mode toggle
- PWA-ready for install and offline use

## Tech Stack
- Vite + React + TypeScript
- Tailwind CSS
- Dexie (IndexedDB)
- TanStack Query
- Recharts
- Radix UI (shadcn/ui components)
- Vite PWA plugin

## Getting Started

### 1) Install dependencies
```bash
npm install
```

### 2) Run locally
```bash
npm run dev
```

### 3) Build
```bash
npm run build
```

### 4) Preview production build
```bash
npm run preview
```

## PWA / Offline
The app uses Vite PWA to cache the app shell and assets for offline use. Install prompts appear on supported browsers (Android/Chrome). On iOS, use "Add to Home Screen".

## Project Structure
```
src/
  components/        # shared UI and app components
  hooks/             # React hooks
  lib/               # storage, db, utils
  pages/             # route pages
  index.css          # theme and global styles
public/
  icon-192.png
  icon-512.png
  favicon.png
```

## Scripts
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run preview` — preview build

## License
MIT
