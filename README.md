# Al Sharq Youth Program Finder

A two-minute, bingo-style survey for visitors at Al Sharq Forum 2026 (Istanbul, 28–29 November).
Visitors answer 12 short questions on their phone (from a QR code) or on the iPad at the stand, and get:

- their matched support stream: **Fellowship**, **Impact** or **Hubs**
- a personality ticket (one of 8 types) with their top 3 strengths
- a filled bingo card, where the winning line shows the match
- the next step, which depends on their age and weekly time

It runs in English, Turkish and Arabic (right to left), works offline after the first visit, and saves
anonymous results to a Google Sheet.

## Who edits what

| Area | Files | Guide |
|---|---|---|
| Content: text, translations, questions, points, settings | `content/` | [CONTENT.md](CONTENT.md) |
| Code: screens, design, scoring, saving, tests, publishing | `index.html`, `src/`, `sw.js`, `tests/`, `.github/` | this file |

Work on a branch (`content/...` or `code/...`) and open a pull request into `main`. Every pull request
runs the content check and a browser smoke test. Merging into `main` publishes the site.

## Run it locally

```bash
python3 -m http.server 8000
```

Open http://localhost:8000. Add `?lang=tr` or `?lang=ar` to start in another language.

## Checks

```bash
node tests/check-content.mjs
```

```bash
npm install && npx playwright install chromium && npm run smoke
```

The content check validates every content file and simulates every possible set of answers to show
how often each stream wins. The smoke test plays the survey to a result in every language on a phone,
a small phone and an iPad in landscape.

## How a match is made

1. Each answer adds 1–3 points to one or two of 8 areas (big picture, dialogue, leadership, designing,
   launching, mobilising, civic, hub life).
2. Each area's total is divided by the most anyone could score there, giving 0–100%.
3. Those percentages are multiplied by each stream's weights in `content/config.json` (`matrix`) and added up.
4. The highest total wins. A tie goes to the stream whose strongest areas scored higher, then to `tieOrder`.

The personality comes from the visitor's strongest area, and the 3 strengths from their top 3 areas.
The code is in `src/scoring.js`.

## Publishing (GitHub Pages)

1. In the repository on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Every merge into `main` runs `.github/workflows/pages.yml`, which checks the content and publishes the site.
3. The address is shown on the workflow run and in Settings → Pages
   (usually `https://<owner>.github.io/<repo>/`).

## Saving results to a Google Sheet

1. Create a Google Sheet owned by the Al Sharq Youth account, for example "Program Finder results".
2. In the sheet: **Extensions → Apps Script**. Replace the code with `apps-script/Code.gs` and save.
3. **Deploy → New deployment → type: Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy and approve access.
4. Copy the web app address (it starts with `https://script.google.com/macros/s/`) into
   `content/config.json` → `resultsUrl`, and merge it.
5. Finish one survey on the live site; a row appears in the **Results** tab.

Each row holds the time, language, question style, matched stream, personality, strengths, next step,
scores and answer ids. No names or contact details are collected. If the device is offline, finished
surveys wait on the device and are sent when the connection returns.

## The QR code

Once the site is live:

```bash
npm install && npm run qr -- https://<owner>.github.io/<repo>/
```

This writes `assets/qr.svg` (for print) and `assets/qr.png`.

## The iPad at the stand

- Open the site in Safari, then **Share → Add to Home Screen**. It opens full screen like an app.
- Load it once on Wi-Fi; after that it also works offline.
- Turn on **Guided Access** (Settings → Accessibility) to keep visitors inside the survey.
- The result screen returns to the welcome screen by itself after `idleSeconds`.
