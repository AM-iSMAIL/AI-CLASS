# Class AI — Classroom Monitoring Platform

Class AI is an AI-powered classroom monitoring and student engagement application built with Next.js, TypeScript, Tailwind CSS, and Firebase. It uses artificial intelligence to track student focus, facilitate classroom interaction, provide real-time telemetry/insights, and help educators build premium interactive learning environments.

## 🚀 Features

*   **Premium WebGL Aesthetics:** Smooth dark-mode first design with a dynamic Three.js WebGL shader landing background and micro-animations.
*   **Dual Mode Architecture:**
    *   **AI Teacher Mode:** Autonomous virtual assistant with real-time waveform visualization, floating glowing avatar, and automatic speech subtitle generation.
    *   **Human Instructor Mode:** Interactive control board featuring visual teaching assistants, question recommendations, whiteboard overrides, and classroom controls.
*   **Student Waiting Room:** Interactive lobby with radar sonar visual rings, class participant rosters, and microphone/camera setup previews.
*   **Teacher Control Panel:** Grid dashboard featuring focus indicators, late-join toggle capabilities, automated Google Meet entry, and AI-script planners.
*   **Real-time Synchronization:** Built on top of Firebase Realtime/Firestore document subscriptions and state synchronization.

---

## 🛠️ Tech Stack & Architecture

*   **Frontend Framework:** [Next.js 15 (App Router)](https://nextjs.org/)
*   **Programming Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Database & Auth:** [Firebase v10+ (Firestore & Authentication)](https://firebase.google.com/)
*   **Styling & UI:** [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
*   **Animations:** [Three.js](https://threejs.org/) (shader-based, loaded via CDN for high performance)
*   **Icons:** [Lucide React](https://lucide.dev/)

---

## 📦 Getting Started

### 1. Prerequisites
Ensure you have **Node.js** (v18 or higher) and **npm** installed on your system.

### 2. Installation
Install the dependencies:
```bash
npm install
```

### 3. Environment Variables
Create a `.env.local` file in the root directory and add your Firebase credentials:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── auth/                # Teacher Sign In / Sign Up & Student Lobby
│   ├── dashboard/           # Classroom Analytics and Session Creator Wizard
│   ├── session/             # Dynamic [code] waiting rooms
│   ├── globals.css          # Core design system & Tailwind layers
│   ├── layout.tsx           # Layout, fonts, and metadata
│   └── page.tsx             # Interactive landing page with loading screens
├── components/
│   ├── ui/                  # Reusable shadcn & custom components
│   │   ├── button.tsx       # Tailwind-styled button
│   │   ├── loading-screen.tsx # App transition loading screen
│   │   └── shader-lines.tsx # Dynamic Three.js backdrop
│   ├── classroom-view.tsx   # Interactive full-screen Classroom Panel
│   └── dashboard-sidebar.tsx# Persistent sidebar layout
└── lib/
    ├── firebase.ts          # Firebase Client Scaffolding
    ├── auth-service.ts      # Authentication Helper Functions
    ├── session-service.ts   # Firestore Telemetry and Sync Handlers
    └── utils.ts             # Tailwind class merging utility
```
