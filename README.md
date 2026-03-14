# Allintitle Keyword Checker

Tool that checks **allintitle** keyword competition by scraping Google’s result count (e.g. “About 21 results”) and showing it in the UI. No third-party SERP API; uses a Node.js backend to scrape Google.

## Architecture

- **Frontend:** Static HTML/JS (`allintitle.html`) – keyword input, country/language, table with results and difficulty (Easy / Medium / Hard).
- **Backend:** Express server (`server.js`) – `POST /api/allintitle` returns allintitle result counts. **DataForSEO** is used by default (SERP API `se_results_count`). Set `DATAFORSEO_AUTH=""` to use scraping instead (fetch + Cheerio, or `USE_PUPPETEER=1` for headless browser). Anti-blocking: random delay 500–1500 ms, concurrency limit 3.

## Setup

```bash
npm install
npm start
```

Open **http://localhost:3000** (or http://localhost:3000/allintitle.html).

**DataForSEO:** The app uses DataForSEO by default. To use your own account, set `DATAFORSEO_AUTH=Basic <base64(login:password)>`. To disable DataForSEO and use scraping instead, set `DATAFORSEO_AUTH=""`.

## API

**POST /api/allintitle**

- **Body:** `{ "keywords": ["kw1", "kw2"], "hl": "en", "gl": "us" }`
- **Response:** `{ "results": [ { "keyword": "kw1", "results": 21 }, ... ] }`

Scraping is done on the server only (no CORS from browser to Google).

## If you always get 0

Google often serves different HTML to servers (no `#result-stats` in the initial response). Use the **Puppeteer** fallback so the result count is read from the real browser-rendered page:

```bash
USE_PUPPETEER=1 npm start
```

Then open the app and run a check again. Slower but should return the same count you see in Chrome.

## Notes

- Google may block or vary results; use moderate request rates and the built-in delays.
- If `#result-stats` is missing (e.g. captcha, different layout), the backend returns `results: 0` for that keyword.
- `DEBUG=1` logs why the count was 0 and writes the fetched HTML to `debug-serp.html` for inspection.
