# BePro IELTS

React frontend, FastAPI backend, and MongoDB database.

## Run locally on Windows

The local setup uses `backend/.env` and `frontend/.env`. These files are ignored
by Git. The backend requires `MONGO_URL`, `DB_NAME`, and `JWT_SECRET`; the
frontend requires `REACT_APP_BACKEND_URL=http://localhost:8000` (without
`/api`).

After installing dependencies, run these commands in three PowerShell terminals
from `D:\BeproIT\IELTS`:

**Database** (uses the downloaded server and project-local data):

```powershell
$mongo = Get-ChildItem .local/mongodb-server -Recurse -Filter mongod.exe | Select-Object -First 1
& $mongo.FullName --dbpath "$PWD/.local/mongodb" --bind_ip 127.0.0.1 --port 27017
```

**Backend:**

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn server:app --reload --host 127.0.0.1 --port 8000
```

**Frontend:**

```powershell
cd frontend
yarn.cmd start
```

Open http://localhost:3000. API documentation is at http://localhost:8000/docs.
The backend seeds initial content and the admin account configured by
`ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env`.

Press Ctrl+C in each terminal to stop a server. If servers are already running
in the background, stop those processes before starting another copy. Background
setup logs are stored in `.local/logs`.

## Install dependencies again

From the project root:

```powershell
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
cd frontend
yarn.cmd install --frozen-lockfile
```

Node.js and Yarn must be installed. AI grading, speaking transcription, and PDF
exam extraction require a valid `GEMINI_API_KEY` (and optional `GEMINI_MODEL`)
in `backend/.env` — see `backend/.env.example`. Restart the backend after
adding or changing it. On a free-tier (no billing) Google Cloud project,
"-pro" models currently have a 0 free quota; "-flash" models do work and are
the default.

## Deploy

**Backend → Render** (a persistent server process — required, since AI
evaluation runs as background tasks after the HTTP response returns, and a
request-scoped serverless platform like Vercel would kill that work early):

1. Push this repo to GitHub.
2. Render dashboard → New → Web Service → connect the repo.
3. Root directory: `backend`. Build command: `pip install -r requirements.txt`.
   Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`.
4. Add every variable from `backend/.env` as an environment variable on the
   service (copy values from your local `backend/.env`, never commit them).
   Set `CORS_ORIGINS` to your Vercel frontend URL once you have it (step 4
   below); comma-separate if you need more than one origin.
5. In MongoDB Atlas, add Render's outbound IPs to Network Access (or
   `0.0.0.0/0` if Render's plan uses dynamic IPs for your tier) so the backend
   can reach the database.

**Frontend → Vercel:**

1. Vercel dashboard → Add New → Project → import the same repo.
2. Root directory: `frontend`. Framework preset: Create React App (the build
   script already runs `craco build`, which Vercel's CRA preset handles).
3. Add environment variable `REACT_APP_BACKEND_URL` = your Render backend's
   URL (no trailing `/api`).
4. Deploy, then copy the resulting `*.vercel.app` URL back into the backend's
   `CORS_ORIGINS` on Render (step 4 above) and redeploy the backend.

`frontend/vercel.json` already adds the client-side-routing rewrite SPA
deployments need (without it, refreshing a deep link like `/admin/exams`
would 404).
