# Editing the content

This guide is for whoever edits the survey's words, questions and points, person or agent.
**Only edit files in `content/`.** Everything else (`src/`, `index.html`, `form.html`, `test.html`, `tests/`, `.github/`) is the code, and
another person works on it at the same time.

## How to work

1. Make a branch from `main` named `content/<what-you-change>`, for example `content/turkish-review`.
2. Edit the files in `content/` (see below).
3. Run the check: `node tests/check-content.mjs`. It must end with **Content check passed**.
4. Preview: run `python3 -m http.server 8000` in the repo folder and open http://localhost:8000
   for the landing page, or http://localhost:8000/test.html for the test
   (add `?lang=tr` or `?lang=ar` to the address to jump to a language).
5. Open a pull request into `main`. The same check runs automatically; when it is green and the
   pull request is merged, the live site updates within a minute or two.

Keep each pull request small and about one thing (for example "reword question 3" or "Arabic review").

## The files

| File | What it holds | Who usually edits it |
|---|---|---|
| `content/en.json` | All English text | Content |
| `content/tr.json`, `content/ar.json` | The same text in Turkish and Arabic | Content, translators |
| `content/questions.json` | Question and answer **ids**, and the **points** each answer adds | Content, with care |
| `content/config.json` | The matrix, question style, rules, results address | Agreed changes only |
| `content/landing.en.json`, `landing.tr.json`, `landing.ar.json` | All website text: landing page, numbers, Learn more link, form titles and labels | Content, translators |
| `content/forms.json` | The three forms: field ids, types, which are required, options | Agreed changes only |

### Text (`en.json`, `tr.json`, `ar.json`)

- All three files have **exactly the same structure**. Change the words, never the keys
  (the names before the colons).
- Text in `{curly braces}` is filled in by the site: keep it as it is, for example `{n}`, `{stream}`, `{s}`.
- `<br>` in the title is a line break.
- `choices` holds the reflective-choice questions, keyed by question id, with answers `a` to `e`.
- `statements` holds the rated statements, keyed by id.
- `personality.types` holds the 8 personality names and their one-line descriptions, one per area.
  `personality.areas` holds the short strength labels.
- `cells` is the 5 × 5 bingo card. The middle cell is shown as a star, so its text is never displayed.
- Keep answers short: they sit in squares. About **6 words or fewer** works best on a phone.
- `ui.draftNote` is shown under the welcome text while a translation is still a draft.
  Set it to `""` once a native speaker has checked that language.

### Questions and points (`questions.json`)

- Each answer adds **1 to 3 points** to one or two of the 8 areas:
  `big` (big picture), `dial` (dialogue), `lead` (leadership), `design` (designing solutions),
  `launch` (launching initiatives), `mobil` (mobilising people), `civic` (civic and policy), `hub` (hub life).
- A question has **2 to 5 answers** (the squares are B, I, N, G, O).
- To **add a question**: add it here with a new id and its answers' points, then add its text with the
  same id to **all three** language files.
- To **reword** a question, only change the language files.
- If you change points, run the check: it prints how often each stream wins over every possible set
  of answers. Every stream must win at least 5%, and a fair spread is roughly a third each.

### Settings (`config.json`)

- `questionStyle`: `"scale"` (rated statements) or `"choices"` (reflective choices).
  **This decides which set of questions visitors see.**
- `matrix`: how much each stream (`F` Fellowship, `I` Impact, `H` Hubs) cares about each area, 0 to 3.
  Every row must add up to 10. Change only after agreeing with the program team.
- `rules`: which time and age answers trigger the special next steps.
- `idleSeconds`: how long the result stays up at the stand before it goes back to the welcome screen.
- `resultsUrl`: the Google Apps Script address that saves results (see README.md). Leave empty to save nothing.
- `draftLanguages`: languages that still show the draft note.
- `pageTurnSound`: the audio file played on each page turn, for example `assets/sounds/page-turn.mp3`. Leave empty for the built-in paper rustle.

### Website (`landing.<lang>.json`, `forms.json`)

- The three landing files have the same structure as each other, like the survey text files.
  `{name}` and `{stream}` are placeholders; keep them.
- **Headline**: in `hero.title`, the words between `<em>` and `</em>` are shown in gold on their own line.
  Keep the two tags when rewording, around the words to highlight.
- **Numbers** in the header: `hero.stats`, a list of `[number, label]` pairs. A number may carry a plus sign
  before or after it (`800+`, `+800`); the digits count up when the page opens.
- The links in the top bar reuse the small section headings (`about.eyebrow`, `path.eyebrow`, `streams.eyebrow`),
  so keep those short.
- **Learn more** button: `links.learnMore`, a full `https://` address (it can differ per language).
- `forms.json` lists the fields every form asks (`shared`), then each form with its own fields.
  A field has an `id`, a `type` (`text`, `email`, `tel`, `url`, `select`, `textarea`, `checkboxes` or
  `radios`), `required`, and `options` for choice fields.
- Every field needs a label in `fields` of each landing file. A form can give a field its own label under
  `forms.<form id>.labels`, as the "Why are you interested in …" question does. Every option needs a text
  in `options.<field id>`.
- Each form's `sheet` is the tab it saves to. Changing a form id or sheet name also needs a code change in
  `apps-script/Code.gs`, so ask before doing it.
- Adding a field or option is fine: the Sheet adds a column by itself.

## What the check catches

- invalid JSON (a missing comma or quote)
- a missing or empty translation, or a lost `{placeholder}`
- an answer without points, or points for an unknown area
- a matrix row that does not add up to 10, or bingo lines that overlap
- a stream that wins less than 5% of the time with the question style in use
- on the website: a field, option or form without text in a language, an unknown field type, a choice
  field without options, a Learn more link that is not https://, or a form whose tab the Apps Script does not know
