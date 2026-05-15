# TaskFlow — Project & Task Management

A full-stack project management web app built with Node.js, Express, SQLite, and Vanilla JS.

## Features
- **Authentication** — JWT-based signup/login with roles (admin, manager, member)
- **Projects** — Create, manage, archive projects with team members
- **Tasks** — Kanban board with statuses: Todo, In Progress, Review, Done
- **Dashboard** — Live stats, recent tasks, overdue alerts
- **Role-based Access Control** — Admin > Manager > Member
- **Comments** — Per-task discussion threads

## Tech Stack
- **Backend**: Node.js + Express
- **Database**: SQLite via `better-sqlite3` (zero-config, file-based)
- **Auth**: JWT tokens (7-day expiry)
- **Frontend**: Vanilla JS + custom CSS (no frameworks)

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or production
npm start
```

App runs on http://localhost:3000

## Deploy on Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo
4. Add environment variable: `JWT_SECRET=your_random_secret_here`
5. Railway auto-detects Node.js and deploys!

The SQLite DB is stored as `taskflow.db` in the app directory. For persistent storage on Railway, you can add a volume mount at `/app/taskflow.db`.

## API Endpoints

### Auth
- `POST /api/auth/signup` — Register
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Current user

### Projects
- `GET /api/projects` — List all projects
- `POST /api/projects` — Create project
- `GET /api/projects/:id` — Project detail + members
- `PUT /api/projects/:id` — Update project
- `DELETE /api/projects/:id` — Delete project
- `POST /api/projects/:id/members` — Add member
- `DELETE /api/projects/:id/members/:userId` — Remove member

### Tasks
- `GET /api/tasks` — List tasks (filterable)
- `POST /api/tasks` — Create task
- `GET /api/tasks/:id` — Task detail + comments
- `PUT /api/tasks/:id` — Update task
- `DELETE /api/tasks/:id` — Delete task
- `POST /api/tasks/:id/comments` — Add comment

### Dashboard
- `GET /api/dashboard` — Stats + recent/overdue tasks

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | 3000 |
| `JWT_SECRET` | JWT signing secret | fallback_secret |
| `DB_PATH` | SQLite DB file path | ./taskflow.db |
