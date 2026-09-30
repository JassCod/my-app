# TeamPulse — manager workspace (mobile app)

> **Accounts:** every person signs in with their own login. **Managers** can do everything; **colleagues** see only their own tasks and reports, update progress, add notes and send their daily report. See [Turn on accounts](#turn-on-accounts-firebase).

A mobile-first, installable web app (PWA) for managers to **assign tasks to colleagues, collect their daily reports, add notes on top, and keep a day-by-day record of completed and incomplete work**. It can be shared and downloaded as PDF or CSV.

## Features

| Tab | What it does |
| --- | --- |
| **Home** | Today's completion ring, live stats, a 7-day completion chart (tap a bar to open that day), who hasn't reported, overdue and high-priority work, an activity feed, and team pulse cards. |
| **Tasks** | Search, status filters (To do / In progress / Done / Overdue), a per-colleague filter and sorting. Tap a task to change its status, drag its progress, **add notes or extra instructions**, share it, edit it or delete it. Export as PDF or CSV. |
| **Reports** | The **daily record**. Pick any day (strip or calendar) to see the completion rate, colleague reports, **incomplete work carried forward** grouped by colleague, overdue items, and what was completed. Review each report with a rating and a manager note. **Share or download the day as a PDF**, or export all reports to CSV. |
| **Team** | Colleague cards with progress. Each profile shows incomplete tasks, completed tasks and report history, with actions to assign a task, request a report, or download a PDF report for that colleague. |
| **More** | Profile, dark/light theme, motion effects toggle, exports, sharing the app, installing it on a phone, and JSON backup/restore. |
| **+ button** | Quick actions: assign a task, record a report, request a report, add a colleague. |

## Who can do what

| | Manager | Colleague |
| --- | :-: | :-: |
| See the whole team, every task and every report | ✅ | — |
| Add, edit or remove colleagues; send invites | ✅ | — |
| Create, edit, reassign or delete tasks | ✅ | — |
| See their own tasks | ✅ | ✅ |
| Update status and progress, add notes on their own tasks | ✅ | ✅ |
| Write and edit their own daily report | ✅ | ✅ |
| Rate reports and add manager notes | ✅ | — |
| Give another person manager access | ✅ | — |
| Export PDF / CSV | whole team | own work |

These rules are enforced by the server (`firestore.rules`), not only hidden in the app. `tests/rules.test.mjs` checks them. Run it with `npm run test:rules`.

## Turn on accounts (Firebase)

Until this is done, the app runs in **demo mode**: one device, no logins. Firebase is free at this size.

1. Go to <https://console.firebase.google.com>, choose **Create a project**, and give it any name. You can turn Analytics off.
2. **Build → Authentication → Get started → Email/Password → Enable → Save.**
3. **Authentication → Settings → Authorized domains → Add domain:** `jasscod.github.io`.
4. **Build → Firestore Database → Create database** (production mode, any location).
   Open the **Rules** tab, replace everything with the contents of [`firestore.rules`](firestore.rules), and click **Publish**.
5. **Project settings (gear icon) → Your apps → Web (`</>`)**. Register the app and copy the `firebaseConfig` values into
   [`src/lib/firebaseConfig.ts`](src/lib/firebaseConfig.ts). These values are public identifiers, not passwords.
6. Push to `main`. When the site is updated, **open it straight away and tap "Set up your team"**. The first account
   becomes the manager, and after that nobody else can set up a team.
7. Add colleagues **with their email**, open a colleague, and tap **Invite to app**. Send them the link. It only works for that email address.

Signing out removes the team's data from that phone.

### Demo mode: getting reports without accounts
1. On a colleague's profile (or from the + button), tap **Request report**. You can share the personal link via WhatsApp, email or anything else.
2. The colleague opens the link on their phone and sees a report form listing their open tasks, with progress sliders.
3. They tap **Send to manager**, which shares a return link back to you.
4. You open that link. The report is added to the daily record and their task progress is updated.

### Design
Glassmorphism surfaces, drifting aurora lights, floating particles and a perspective grid floor. Cards tilt in 3D and catch light as you move over them. The hero card has an animated gradient border, and there are spring animations, count-up numbers, animated progress rings and bottom-sheet modals. It follows `prefers-reduced-motion` and has a toggle to switch the effects off.

## Run locally
```bash
npm install
npm run dev      # open the printed URL on your phone (same Wi-Fi)
npm run build    # production build in dist/
```

## Put it online
The included workflow (`.github/workflows/deploy.yml`) publishes the app to **GitHub Pages** on every push to `main`.
Enable it once under **Settings → Pages → Build and deployment → Source: GitHub Actions**. The app will then be live at
`https://<user>.github.io/<repo>/`. On a phone, open that link and choose **Add to Home Screen** to install it. It works offline.

`dist/` is a plain static site, so Netlify, Vercel or Cloudflare Pages also work.

## Data
- **With accounts:** data is stored in your Firebase project and syncs live between everyone's phones. It also works offline and catches up when the connection returns.
- **Demo mode:** data stays on the device (localStorage), with backup and restore under **More**.

## Tech
React 19, TypeScript, Vite, lucide icons, jsPDF (lazy-loaded) for PDF reports, and Firebase Authentication with Cloud Firestore (lazy-loaded) for accounts and sync.

Local development against the Firebase emulators, with no real project needed:
```bash
npm run emulators      # terminal 1: Auth + Firestore emulators
npm run dev:cloud      # terminal 2: app connected to the emulators
npm run test:rules     # security rules tests
```
