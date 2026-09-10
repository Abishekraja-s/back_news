# Backend — The Great India News API

Upload this **`server`** folder separately to host the Node.js API (Render, Railway, VPS, cPanel Node, etc.).

## Quick Start (Local)

1. Copy environment file:
   ```powershell
   copy .env.example .env
   ```
   Edit `.env` with your MongoDB Atlas URL.

2. Double-click **`start.bat`**  
   Or run:
   ```powershell
   cd server
   npm.cmd install
   npm.cmd run dev
   ```

3. API runs at http://localhost:5000

## Seed Database

Double-click **`seed.bat`** or run:
```powershell
npm.cmd run seed
```

## Environment Variables (`.env`)

```env
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/great-india-news
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

For production, set `CLIENT_URL` to your live frontend URL:
```env
CLIENT_URL=https://your-website.com
NODE_ENV=production
```

Multiple frontend URLs (comma-separated):
```env
CLIENT_URL=https://site1.com,https://site2.com
```

## Production Start

```powershell
npm.cmd install --production
npm.cmd start
```

## Deploy To

- **Render / Railway / Fly.io** — deploy `server` folder, set env vars
- **VPS** — PM2: `pm2 start server.js --name great-india-news-api`
- **cPanel Node** — point app to `server.js`

## API Health Check

```
GET /api/health
```

## Folder Contents

```
server/
├── controllers/   API logic
├── models/        MongoDB schemas
├── routes/        API routes
├── middleware/    Auth, upload, etc.
├── utils/         Seed, helpers
├── uploads/       Uploaded images
├── server.js      Entry point
├── start.bat      Windows starter
└── .env           Secrets (do NOT commit)
```

## Admin Login (after seed)

- Email: `admin@thegreatindianews.com`
- Password: `admin123`
