# TeamPulse — manager workspace (mobile app)

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

### Getting reports from colleagues (no server needed)
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
Everything is stored on the device (localStorage). Use **More → Back up all data** to move it to another device, and **Restore** to load it there. On first launch the app loads demo data; use **Start fresh** to clear it.

## Tech
React 19, TypeScript, Vite, lucide icons, and jsPDF (lazy-loaded) for PDF reports. There is no backend.
