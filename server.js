/**
 * Keyword Finalization Tool – Serper API, login (admin / employee), admin can set API key.
 */
import "dotenv/config";

import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import https from "node:https";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const DEFAULT_API_KEY = "4d1b6ab3eeaac504de85e2727366d9088a48c965";

const PAGES_PER_KEYWORD = 3;
const REQUESTS_PER_PAGE = 4;
const CONCURRENCY_LIMIT = 2;
const DELAY_MS = 400;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "yfdjafiGYUFTV3778";
const EMPLOYEE_PASSWORD = process.env.EMPLOYEE_PASSWORD || "emphubhbh878#HJ";

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
      return data.serperApiKey || null;
    }
  } catch (e) {
    console.warn("[settings] Could not load settings:", e.message);
  }
  return process.env.SERPER_API_KEY || DEFAULT_API_KEY;
}

function saveApiKey(apiKey) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const data = { serperApiKey: apiKey || "" };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error("[settings] Could not save:", e.message);
    return false;
  }
}

let currentSerperApiKey = loadSettings();

function getSerperApiKey() {
  return currentSerperApiKey || DEFAULT_API_KEY;
}

app.use(express.json({ limit: "1mb" }));
const isProduction = process.env.NODE_ENV === "production";
app.use(
  session({
    secret: process.env.SESSION_SECRET || "keyword-tool-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    name: "kt.sid",
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);
// Do not serve app HTML or project files statically; pages only via protected routes below.

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  if (req.xhr || req.headers.accept?.includes("application/json")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  return res.redirect("/login");
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.role === "admin") return next();
  if (req.xhr || req.headers.accept?.includes("application/json")) {
    return res.status(403).json({ error: "Admin only" });
  }
  return res.redirect("/");
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function serperRequest(postData) {
  const apiKey = getSerperApiKey();
  return new Promise((resolve, reject) => {
    const options = {
      method: "POST",
      hostname: "google.serper.dev",
      path: "/search",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString();
        if (res.statusCode >= 400) {
          if (res.statusCode === 401 || res.statusCode === 403) {
            reject(new Error("Invalid API key"));
            return;
          }
          reject(new Error(`Serper HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error("Invalid JSON from Serper: " + body.slice(0, 100)));
        }
      });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function fetchSerperPage(keyword, opts, page) {
  const query = `allintitle:"${keyword.replace(/"/g, "")}"`;
  const body = {
    q: query,
    gl: opts.gl || "us",
    hl: opts.hl || "en",
    num: 10,
    page: page,
  };
  return serperRequest(JSON.stringify(body));
}

function mode(arr) {
  if (arr.length === 0) return 0;
  const counts = new Map();
  let maxCount = 0;
  let modeValue = arr[0];
  for (const n of arr) {
    const c = (counts.get(n) || 0) + 1;
    counts.set(n, c);
    if (c > maxCount) {
      maxCount = c;
      modeValue = n;
    }
  }
  return modeValue;
}

async function fetchSerperCount(keyword, opts) {
  let total = 0;
  for (let page = 1; page <= PAGES_PER_KEYWORD; page++) {
    const counts = [];
    for (let r = 0; r < REQUESTS_PER_PAGE; r++) {
      await delay(DELAY_MS);
      const data = await fetchSerperPage(keyword, opts, page);
      counts.push((data.organic || []).length);
    }
    total += mode(counts);
  }
  return total;
}

async function processKeyword(keyword, opts) {
  try {
    const results = await fetchSerperCount(keyword, opts);
    return { keyword, results };
  } catch (err) {
    const message = err.message === "Invalid API key" ? "Invalid API key" : err.message;
    console.error("[serper]", keyword, message);
    return { keyword, results: 0, error: message };
  }
}

async function runWithConcurrencyLimit(items, fn, limit) {
  const results = [];
  const executing = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);
    const e = p.then(() => {
      executing.splice(executing.indexOf(e), 1);
    });
    executing.push(e);
    if (executing.length >= limit) await Promise.race(executing);
  }
  return Promise.all(results);
}

app.post("/api/login", (req, res) => {
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (password === ADMIN_PASSWORD) {
    req.session.user = "admin";
    req.session.role = "admin";
    return res.json({ ok: true, user: "admin", role: "admin" });
  }
  if (password === EMPLOYEE_PASSWORD) {
    req.session.user = "employee";
    req.session.role = "employee";
    return res.json({ ok: true, user: "employee", role: "employee" });
  }
  res.status(401).json({ error: "Invalid password" });
});

app.post("/api/logout", requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/me", (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json({ user: req.session.user, role: req.session.role });
});

app.get("/api/settings", requireAuth, requireAdmin, (req, res) => {
  const key = getSerperApiKey();
  res.json({
    apiKeySet: !!key && key.length > 0,
    masked: key && key.length >= 4 ? "****" + key.slice(-4) : "",
  });
});

app.put("/api/settings", requireAuth, requireAdmin, (req, res) => {
  const apiKey = typeof req.body.apiKey === "string" ? req.body.apiKey.trim() : "";
  if (!apiKey) {
    return res.status(400).json({ error: "API key is required" });
  }
  currentSerperApiKey = apiKey;
  if (!saveApiKey(apiKey)) {
    return res.status(500).json({ error: "Failed to save settings" });
  }
  res.json({ ok: true });
});

app.post("/api/allintitle", requireAuth, async (req, res) => {
  const { keywords, hl, gl } = req.body || {};
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ error: "Missing or invalid body: expected { keywords: string[] }" });
  }
  const list = [...new Set(keywords.map((k) => String(k).trim()).filter(Boolean))];
  const opts = { hl: hl || "en", gl: gl || "us" };
  try {
    const results = await runWithConcurrencyLimit(
      list,
      (keyword) => processKeyword(keyword, opts),
      CONCURRENCY_LIMIT
    );
    res.json({ results });
  } catch (err) {
    console.error("[POST /api/allintitle]", err);
    res.status(500).json({ error: "Server error." });
  }
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/login", (req, res) => {
  if (req.session && req.session.user) return res.redirect("/");
  res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/admin", requireAuth, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "allintitle.html"));
});

// Any other route: no access without login (no static file serving of app pages)
app.use((req, res, next) => {
  if (req.session && req.session.user) {
    return res.redirect("/");
  }
  if (req.xhr || req.headers.accept?.includes("application/json")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.redirect("/login");
});

app.listen(PORT, () => {
  console.log(`Keyword Finalization Tool at http://localhost:${PORT}`);
  console.log(`  Login: admin / employee. Admin can set API key in Settings.`);
});
