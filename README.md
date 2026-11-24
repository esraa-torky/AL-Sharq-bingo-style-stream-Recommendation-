# Al Sharq Youth Program Finder

A two-minute, bingo-style survey for visitors at Al Sharq Forum 2026 (Istanbul, 28–29 November).
Visitors answer 12 short questions on their phone (from a QR code) or on the iPad at the stand, and get:

- their matched support stream: **Fellowship**, **Impact** or **Hubs**
- a personality ticket (one of 8 types) with their top 3 strengths
- a filled bingo card, where the winning line shows the match
- the next step, which depends on their age and weekly time
- an optional form to leave their name, email and phone so we can tell them when applications open

It runs in English, Turkish and Arabic (right to left), works offline after the first visit, and saves
anonymous results, and the contact details of visitors who agree, to a Google Sheet.
Each page turn tears the paper sheet away with a soft paper sound (made in the browser, no audio files);
visitors can switch sound off with the speaker button on the welcome screen.

On slower phones the site switches to a light mode: a short slide instead of the page curl, and no paper grain.
It starts on for low-memory or data-saver devices, turns on by itself if a page curl runs slowly, and can be
forced by adding `?lite` to the address. Devices set to reduce motion get a short fade with no movement instead.

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
node tests/check-apps-script.mjs
```

```bash
npm install && npx playwright install chromium && npm run smoke
```

The content check validates every content file and simulates every possible set of answers to show
how often each stream wins. The Apps Script check runs `apps-script/Code.gs` against a pretend spreadsheet:
its contact rules must match the form's (`src/contact.js`), nothing sent to it may end up as a formula, and bad
requests must be refused. The smoke test plays the survey to a result in every language on a phone,
a small phone and an iPad in landscape, then checks saving, the contact form and the idle reset.

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

Two tabs are filled:

- **Results**: one row per finished survey: time, language, question style, matched stream, personality,
  strengths, next step, scores and answer ids. Nothing personal.
- **Contacts**: one row per visitor who filled in the form on the result screen **and** ticked the consent box:
  time, language, matched stream, name, email, phone (optional) and the consent text they agreed to.

### Setting it up

1. Create a Google Sheet owned by the Al Sharq Youth account, for example "Program Finder results".
2. In the sheet: **Extensions → Apps Script**. Replace the code with `apps-script/Code.gs` and save.
3. **Give it permission (needed once):** in the function list at the top choose **setup**, press **Run**, then
   **Review permissions** → choose the account → **Advanced** → **Go to … (unsafe)** → **Allow**.
   The log should say "Ready". This also creates the **Results** and **Contacts** tabs.
4. **Deploy → New deployment → type: Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy.
5. Copy the web app address (it starts with `https://script.google.com/macros/s/`) into
   `content/config.json` → `resultsUrl`, and merge it.
6. Finish one survey on the live site; a row appears in the **Results** tab. Leave test details in the form;
   a row appears in **Contacts**. Delete both test rows.

**After changing the script**, publish the change without changing the address:
**Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.

> **Order matters when `Code.gs` changes.** Publish the new script version *before* merging site changes that
> send something new. An older script quietly drops what it does not know: before this version, contact details
> would have been lost.

**If saving fails:** open **Executions** (the list icon on the left of the Apps Script page) and click a failed run
to see its error. "Authorization is required" means step 3 was skipped. "Not saved: …" means the script refused
a request (the reason is logged, never the visitor's details).

Automated tests never send results to the real sheet: the smoke test answers the Apps Script address itself, and
the site does not save when it runs inside an automated browser.

If the device is offline, finished surveys and contact details wait on the device and are sent when the
connection returns. Each row is removed from the device as soon as it has been sent.

### Keeping the contact details safe

What the code does:

- Contact details are only sent after the visitor ticks the consent box. The phone number is optional.
- The script checks every request itself, using the same rules as the form. Anything else is refused: no consent,
  a bad email or phone, an unknown language or stream, a request that is too large.
- Every value is stored as plain text, so nothing typed into the form or sent to the script can run as a formula,
  even if the sheet is later downloaded and opened in Excel.
- Contact details live in their own tab, apart from the anonymous answers.
- On the stand's iPad (see below), the browser does not offer to fill in the previous visitor's details. Details
  typed but not sent are wiped when the screen goes back to the welcome page.

What only you can do (please go through this before the forum):

- **Share the spreadsheet with as few people as possible**, by name. Never "Anyone with the link".
- **Agree how long you keep the contacts** (for example, until the 2027 call closes), then delete them.
  Delete someone's row when they ask.
- **Have the consent text checked** (`ui.contactConsent` in each language file) by whoever handles data protection.
  Turkey's KVKK and, for EU visitors, the GDPR apply. If Al Sharq Youth has a privacy notice online, put its
  address in `content/config.json` → `privacyUrl` and a link to it appears under the consent text.
- The script's address is public (it is in `config.json`), so anyone could send it made-up rows. The checks keep
  them harmless, but they could still add junk. Look over the **Contacts** tab before you use it.

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
- Run it from the home screen icon (or add `?kiosk` to the address in Safari). The site then knows it is the shared
  iPad: it never offers to fill in the previous visitor's name or email, and a survey left half-way goes back
  to the welcome screen after twice `idleSeconds`.
- In **Settings → Apps → Safari → AutoFill**, switch off contact info, and in **Settings → General → Keyboard**,
  switch off **Predictive**. This stops the keyboard suggesting a previous visitor's name or email.
- The result screen returns to the welcome screen by itself after `idleSeconds` without a tap.
