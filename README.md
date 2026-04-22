# Finance Tracker
![Vercel](https://img.shields.io/badge/deployed%20on-Vercel-black?logo=vercel)
![PWA](https://img.shields.io/badge/PWA-ready-purple)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)
![License](https://img.shields.io/badge/License-MIT-green)

A clean, mobile-first personal finance tracker with accounts, income/expense/borrow–lend tracking, statistics, and offline-ready PWA support. Built with React, Vite, and Tailwind CSS.

Built as a practical finance app with a strong focus on simplicity, clean UX, and real-world data handling.

## 🚀 Live Demo
https://financetracker-web.vercel.app


## ✨ Features

* Home dashboard with total balance, privacy toggle, and recent transactions
* Transaction types: **Expense**, **Income**, and **Borrow / Lend**
* Borrow / Lend tracking with **Open / Settled** status and settlement handling
* Statistics with monthly charts and yearly balance overview
* Accounts support (Cash, Bank, Mobile Wallet) with automatic balance updates
* Currency selection on first launch (default: BDT ৳)
* Editable transactions with delete confirmation
* Data import/export with safety warning
* Light / Dark / System theme toggle
* PWA-ready for install and offline use

## 🧠 Tech Stack

* **Vite + React + TypeScript**
* **Tailwind CSS**
* **Dexie (IndexedDB)** for offline storage
* **TanStack Query**
* **Recharts**
* **Radix UI (shadcn/ui components)**
* **Vite PWA plugin**

## 🛠️ Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Run locally

```bash
npm run dev
```

### 3) Build for production

```bash
npm run build
```

### 4) Preview production build

```bash
npm run preview
```

## 📱 PWA / Offline Support

The app uses **Vite PWA** to cache the app shell and assets for offline use.

* On **Android / Chrome**: install prompt appears automatically
* On **iOS (Safari)**: use **Add to Home Screen**

Once installed, the app works offline.

## 🗂️ Project Structure

```text
src/
  components/        # Shared UI and app components
  hooks/             # Custom React hooks
  lib/               # Storage, database, utilities
  pages/             # Route pages
  index.css          # Theme tokens and global styles
public/
  icon-192.png
  icon-512.png
  favicon.png
```

## 📜 Scripts

* `npm run dev` — start development server
* `npm run build` — build for production
* `npm run preview` — preview production build

## 👤 Author

**Sha Mohamad Yeahia Idris**
Email: [shamohammadidris45@gmail.com](mailto:shamohammadidris45@gmail.com)
GitHub: [https://github.com/idris58](https://github.com/idris58)

## 📝 License
[MIT License](LICENSE).
