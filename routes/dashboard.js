const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../db/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/dashboard
router.get('/', (req, res) => {
  const userId = req.user.id;

  const projectIds = query(`
    SELECT DISTINCT p.id FROM projects p
    LEFT JOIN project_members pm ON pm.project_id = p.id
    WHERE p.owner_id = ? OR pm.user_id = ?
  `, [userId, userId]).map(r => r.id);

  if (!projectIds.length) {
    return res.json({
      stats: { total_tasks: 0, todo: 0, in_progress: 0, review: 0, done: 0, overdue: 0 },
      projects: [], recent_tasks: [], overdue_tasks: [], my_tasks: []
    });
  }

  const ph = projectIds.map(() => '?').join(',');

  const stats = queryOne(`
    SELECT
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status='todo' THEN 1 ELSE 0 END) as todo,
      SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status='review' THEN 1 ELSE 0 END) as review,
      SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done,
      SUM(CASE WHEN due_date < date('now') AND status != 'done' THEN 1 ELSE 0 END) as overdue
    FROM tasks WHERE project_id IN (${ph})
  `, projectIds);

  const projects = query(`
    SELECT p.*,
      COUNT(DISTINCT pm.user_id) as member_count,
      COUNT(DISTINCT t.id) as task_count,
      SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) as completed_tasks
    FROM projects p
    LEFT JOIN project_members pm ON pm.project_id = p.id
    LEFT JOIN tasks t ON t.project_id = p.id
    WHERE p.id IN (${ph})
    GROUP BY p.id ORDER BY p.created_at DESC LIMIT 5
  `, projectIds);

  const recentTasks = query(`
    SELECT t.*, u.name as assigned_to_name, p.name as project_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.project_id IN (${ph})
    ORDER BY t.updated_at DESC LIMIT 10
  `, projectIds);

  const overdueTasks = query(`
    SELECT t.*, u.name as assigned_to_name, p.name as project_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.project_id IN (${ph}) AND t.due_date < date('now') AND t.status != 'done'
    ORDER BY t.due_date ASC LIMIT 10
  `, projectIds);

  const myTasks = query(`
    SELECT t.*, p.name as project_name FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.assigned_to = ? AND t.status != 'done'
    ORDER BY t.due_date ASC LIMIT 10
  `, [userId]);

  res.json({ stats, projects, recent_tasks: recentTasks, overdue_tasks: overdueTasks, my_tasks: myTasks });
});

// GET /api/dashboard/users (admin only)
router.get('/users', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  res.json(query('SELECT id, name, email, role, avatar_color, created_at FROM users ORDER BY created_at DESC'));
});

module.exports = router;
