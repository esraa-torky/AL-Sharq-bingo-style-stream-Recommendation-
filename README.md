# Al Sharq Youth Program Finder

The site has three pages:

- **`index.html`, the landing page:** who Al Sharq Youth are, values, the path to impact, the three
  support streams, "Your journey starts here" (Join a hub, Establish a hub, Join a program) and
  "Take the next step" with a link to the test. A moving network drawing sits next to the headline.
  It uses its own calm style (`src/site.css`), separate from the test's paper look.
- **`form.html?f=<form>`, one page per form:** `join-hub`, `establish-hub` or `join-program`.
- **`test.html`, the Program Finder:** on its own for the iPad at the stand. Opened from the website
  (`test.html?site=1`), its result offers "Apply to …", which opens the Join a program form showing the match.

The Program Finder is a two-minute, bingo-style survey for visitors at Al Sharq Forum 2026 (Istanbul, 28–29 November).
Visitors answer 12 short questions on their phone (from a QR code) or on the iPad at the stand, and get:

- their matched support stream: **Fellowship**, **Impact** or **Hubs**
- a personality ticket (one of 8 types) with their top 3 strengths
- a filled bingo card, where the winning line shows the match
- the next step, which depends on their age and weekly time

It runs in English, Turkish and Arabic (right to left), works offline after the first visit, and saves
anonymous results to a Google Sheet.
Each page turn tears the paper sheet away with a soft paper sound (made in the browser, no audio files);
visitors can switch sound off with the speaker button on the welcome screen.

On slower phones the site switches to a light mode: a short slide instead of the page curl, and no paper grain.
It starts on for low-memory or data-saver devices, turns on by itself if a page curl runs slowly, and can be
forced by adding `?lite` to the address. Devices set to reduce motion get a short fade with no movement instead.

## Who edits what

| Area | Files | Guide |
|---|---|---|
| Content: text, translations, questions, points, settings | `content/` | [CONTENT.md](CONTENT.md) |
| Code: screens, design, scoring, saving, tests, publishing | `index.html`, `form.html`, `test.html`, `src/`, `sw.js`, `tests/`, `.github/` | this file |

Work on a branch (`content/...` or `code/...`) and open a pull request into `main`. Every pull request
runs the content check and a browser smoke test. Merging into `main` publishes the site.

## Run it locally

```bash
python3 -m http.server 8000
```

Open http://localhost:8000 for the landing page and http://localhost:8000/test.html for the test on its own.
Add `?lang=tr` or `?lang=ar` to start in another language. A form opens directly at, for example,
http://localhost:8000/form.html?f=join-hub.

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

The site is published by GitHub Pages straight from the `main` branch
(**Settings → Pages → Source: Deploy from a branch**, branch `main`, folder `/ (root)`).
Every merge into `main` goes live a minute or two later at
https://esraa-torky.github.io/AL-Sharq-bingo-style-stream-Recommendation-/

Because merging publishes, only merge a pull request once its **Checks** (content check and smoke test) are green.
To make GitHub enforce this, add a branch rule for `main` in **Settings → Branches** that requires the
"Content check" and "Smoke test" status checks to pass.

## Saving results to a Google Sheet

1. Create a Google Sheet owned by the Al Sharq Youth account, for example "Program Finder results".
2. In the sheet: **Extensions → Apps Script**. Replace the code with `apps-script/Code.gs` and save.
3. **Give it permission (needed once):** in the function list at the top choose **setup**, press **Run**, then
   **Review permissions** → choose the account → **Advanced** → **Go to … (unsafe)** → **Allow**.
   The log should say "Ready". This also creates the **Results**, **Join a hub**, **Establish a hub** and
   **Join a program** tabs.
4. **Deploy → New deployment → type: Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy.
5. Copy the web app address (it starts with `https://script.google.com/macros/s/`) into
   `content/config.json` → `resultsUrl`, and merge it.
6. Finish one survey on the live site; a row appears in the **Results** tab. Send one landing-page form;
   a row appears in its tab.

**After changing the script**, publish the change without changing the address:
**Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.

**If saving fails:** open **Executions** (the list icon on the left of the Apps Script page) and click a failed run
to see its error. "Authorization is required" means step 3 was skipped.

Automated tests never send results: the smoke test blocks the Apps Script address, and the site does not save
when it runs inside an automated browser.

**Results** rows hold the time, language, question style, matched stream, personality, strengths, next step,
scores and answer ids, with no names or contact details.

The three form tabs **do hold personal details** (name, email, phone number and what people wrote), so share the spreadsheet only with the team. Each tab takes its column headings from the first form
sent to it, in English whatever language the visitor used; if a field is added to `content/forms.json`
later, a new column appears at the end. `testMatch` and `testPersonality` are filled when the visitor
came to the program form from the test. A hidden spam-trap field drops most bot submissions.

If the device is offline, finished surveys and forms wait on the device and are sent when the connection returns.

## The QR code

The QR code for posters and cards should open the landing page (the site address). Once the site is live:

```bash
npm install && npm run qr -- https://<owner>.github.io/<repo>/
```

This writes `assets/qr.svg` (for print) and `assets/qr.png`.

## The iPad at the stand

- Open `test.html` in Safari (the site address followed by `test.html`), then **Share → Add to Home Screen**. It opens full screen like an app.
- Load it once on Wi-Fi; after that it also works offline.
- Turn on **Guided Access** (Settings → Accessibility) to keep visitors inside the survey.
- The result screen returns to the welcome screen by itself after `idleSeconds`.
