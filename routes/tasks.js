const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run } = require('../db/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/tasks
router.get('/', (req, res) => {
  const { project_id, status, priority } = req.query;
  let sql = `
    SELECT t.*, u.name as assigned_to_name, u.avatar_color as assigned_avatar,
      c.name as created_by_name, p.name as project_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users c ON t.created_by = c.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE (t.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)
      OR t.project_id IN (SELECT id FROM projects WHERE owner_id = ?))
  `;
  const params = [req.user.id, req.user.id];
  if (project_id) { sql += ' AND t.project_id = ?'; params.push(project_id); }
  if (status) { sql += ' AND t.status = ?'; params.push(status); }
  if (priority) { sql += ' AND t.priority = ?'; params.push(priority); }
  sql += ' ORDER BY t.created_at DESC';
  res.json(query(sql, params));
});

// GET /api/tasks/overdue
router.get('/overdue', (req, res) => {
  const tasks = query(`
    SELECT t.*, u.name as assigned_to_name, p.name as project_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.due_date < date('now') AND t.status != 'done'
    AND (t.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)
      OR t.project_id IN (SELECT id FROM projects WHERE owner_id = ?))
    ORDER BY t.due_date ASC
  `, [req.user.id, req.user.id]);
  res.json(tasks);
});

// POST /api/tasks
router.post('/', (req, res) => {
  const { title, description, project_id, assigned_to, priority, due_date, status } = req.body;
  if (!title) return res.status(400).json({ error: 'Task title is required' });
  if (!project_id) return res.status(400).json({ error: 'Project ID is required' });

  const project = queryOne('SELECT * FROM projects WHERE id = ?', [project_id]);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const isMember = queryOne('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?', [project_id, req.user.id]);
  if (!isMember && project.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You are not a member of this project' });
  }

  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  const validStatuses = ['todo', 'in_progress', 'review', 'done'];
  const id = uuidv4();

  run(`INSERT INTO tasks (id, title, description, project_id, assigned_to, created_by, priority, due_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, title, description || '', project_id,
    assigned_to || null, req.user.id,
    validPriorities.includes(priority) ? priority : 'medium',
    due_date || null,
    validStatuses.includes(status) ? status : 'todo'
  ]);

  const task = queryOne(`
    SELECT t.*, u.name as assigned_to_name, c.name as created_by_name, p.name as project_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users c ON t.created_by = c.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `, [id]);
  res.status(201).json(task);
});

// GET /api/tasks/:id
router.get('/:id', (req, res) => {
  const task = queryOne(`
    SELECT t.*, u.name as assigned_to_name, u.avatar_color as assigned_avatar,
      c.name as created_by_name, p.name as project_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users c ON t.created_by = c.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `, [req.params.id]);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const comments = query(`
    SELECT tc.*, u.name as user_name, u.avatar_color
    FROM task_comments tc JOIN users u ON tc.user_id = u.id
    WHERE tc.task_id = ? ORDER BY tc.created_at ASC
  `, [req.params.id]);

  res.json({ ...task, comments });
});

// PUT /api/tasks/:id
router.put('/:id', (req, res) => {
  const task = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { title, description, status, priority, assigned_to, due_date } = req.body;
  const validStatuses = ['todo', 'in_progress', 'review', 'done'];
  const validPriorities = ['low', 'medium', 'high', 'urgent'];

  run(`UPDATE tasks SET
    title = ?, description = ?, status = ?, priority = ?,
    assigned_to = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`, [
    title || task.title,
    description !== undefined ? description : task.description,
    validStatuses.includes(status) ? status : task.status,
    validPriorities.includes(priority) ? priority : task.priority,
    assigned_to !== undefined ? (assigned_to || null) : task.assigned_to,
    due_date !== undefined ? (due_date || null) : task.due_date,
    req.params.id
  ]);

  const updated = queryOne(`
    SELECT t.*, u.name as assigned_to_name, c.name as created_by_name, p.name as project_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users c ON t.created_by = c.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `, [req.params.id]);
  res.json(updated);
});

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
  const task = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const project = queryOne('SELECT * FROM projects WHERE id = ?', [task.project_id]);
  if (task.created_by !== req.user.id && project.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to delete this task' });
  }

  run('DELETE FROM task_comments WHERE task_id = ?', [req.params.id]);
  run('DELETE FROM tasks WHERE id = ?', [req.params.id]);
  res.json({ message: 'Task deleted' });
});

// POST /api/tasks/:id/comments
router.post('/:id/comments', (req, res) => {
  const { comment } = req.body;
  if (!comment) return res.status(400).json({ error: 'Comment text is required' });

  const task = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const id = uuidv4();
  run('INSERT INTO task_comments (id, task_id, user_id, comment) VALUES (?, ?, ?, ?)',
    [id, req.params.id, req.user.id, comment]);

  const newComment = queryOne(`
    SELECT tc.*, u.name as user_name, u.avatar_color
    FROM task_comments tc JOIN users u ON tc.user_id = u.id WHERE tc.id = ?
  `, [id]);
  res.status(201).json(newComment);
});

module.exports = router;
