# 🧊 MyFridge — Food Inventory Manager

A Progressive Web App (PWA) to track everything in your fridge, freezer, and pantry. Scan barcodes to add items, track expiry dates, and reduce food waste.

## Features

- 📷 **Barcode Scanning** — Scan products to auto-fill name, category, and image
- 📍 **Storage Locations** — Fridge, Freezer, and Pantry views
- 📅 **Expiry Tracking** — Color-coded alerts for items nearing expiration
- 🏷️ **Categories** — Auto-detected from product data (Dairy, Meat, Produce, etc.)
- 🔢 **Quantities** — Track how many of each item
- 📊 **Waste Stats** — See what you consume vs. waste over time
- 📱 **Installable** — Add to Home Screen on iPhone for native-app experience

## Architecture

- **Frontend**: Static PWA (HTML/CSS/JS) hosted on GitHub Pages
- **Backend**: Cloudflare Worker (serverless) + D1 database (SQLite)
- **Product Data**: Open Food Facts API (free, no key needed)

## Prerequisites

- [Node.js](https://nodejs.org/) (for Cloudflare deployment only)
- Free [GitHub](https://github.com) account
- Free [Cloudflare](https://dash.cloudflare.com/sign-up) account

## Setup & Deployment

### 1. Deploy the Backend (Cloudflare Worker)

```bash
# Install wrangler CLI
npm install -g wrangler

# Login to Cloudflare (opens browser)
wrangler login

# Create the D1 database
wrangler d1 create myfridge-db
# Copy the database_id from the output!

# Edit worker/wrangler.toml — replace "placeholder-will-be-replaced" with your database_id

# Initialize the database schema
wrangler d1 execute myfridge-db --remote --file=worker/src/schema.sql

# Deploy the worker
cd worker
npm install
wrangler deploy
# Note the deployed URL, e.g., https://myfridge-api.<your-subdomain>.workers.dev
```

### 2. Configure the Frontend

Edit `app.js` and set the `API_BASE_URL` to your Worker URL:

```javascript
const API_BASE_URL = 'https://myfridge-api.<your-subdomain>.workers.dev';
```

### 3. Deploy the Frontend (GitHub Pages)

```bash
# Create a GitHub repository called "MyFridge"
# Push all frontend files (index.html, style.css, app.js, manifest.json, sw.js, icons/)

git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/MyFridge.git
git push -u origin main
```

Then go to **Settings > Pages** in your GitHub repo, set Source to "Deploy from a branch" (main, / root), and save.

Your app will be live at: `https://<your-username>.github.io/MyFridge/`

### 4. Install on iPhone

1. Open Safari on your iPhone
2. Go to `https://<your-username>.github.io/MyFridge/`
3. Tap the **Share button** (square with arrow)
4. Tap **"Add to Home Screen"**
5. Tap **Add**

Done! MyFridge now appears as an app on your home screen. 🎉

## Project Structure

```
MyFridge/
├── index.html          # Main app page
├── style.css           # Mobile-first styling
├── app.js              # Application logic
├── manifest.json       # PWA configuration
├── sw.js               # Service worker (caching)
├── icons/
│   ├── icon-192.png    # App icon (192x192)
│   └── icon-512.png    # App icon (512x512)
├── worker/
│   ├── package.json    # Worker dependencies
│   ├── wrangler.toml   # Cloudflare config
│   └── src/
│       ├── index.js    # API endpoints
│       └── schema.sql  # Database schema
└── README.md
```

## Free Tier Limits

| Service | Limit | Your Usage |
|:--------|:------|:-----------|
| GitHub Pages | Unlimited | Static files only |
| Cloudflare Workers | 100,000 requests/day | ~20-50/day |
| Cloudflare D1 | 500 MB storage | A few KB |
| Open Food Facts | 15 requests/min | Occasional lookups |
