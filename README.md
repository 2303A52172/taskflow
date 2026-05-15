# TaskFlow — Project & Task Management

A full-stack project management web app built with Node.js, Express, SQLite, and Vanilla JS.

## 🌐 Live Demo
**https://taskflow-production-448f.up.railway.app**

## Features
- **Authentication** — JWT-based signup/login with roles (admin, manager, member)
- **Projects** — Create, manage, archive projects with team members
- **Tasks** — Kanban board with statuses: Todo, In Progress, Review, Done
- **Dashboard** — Live stats, recent tasks, overdue alerts
- **Role-based Access Control** — Admin > Manager > Member
- **Comments** — Per-task discussion threads

## Tech Stack
- **Backend**: Node.js + Express
- **Database**: SQLite via `sql.js` (zero-config, no compilation needed)
- **Auth**: JWT tokens (7-day expiry)
- **Frontend**: Vanilla JS + custom CSS (no frameworks)

## Local Development

```bash
# Install dependencies
npm install

# Copy env file
copy .env.example .env

# Start server
npm start
```

App runs on http://localhost:3000

## Deployment
Deployed on **Railway** — https://taskflow-production-448f.up.railway.app

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
