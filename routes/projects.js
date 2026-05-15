const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run } = require('../db/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/projects
router.get('/', (req, res) => {
  const projects = query(`
    SELECT p.*, u.name as owner_name,
      (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status != 'done') as open_tasks
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    WHERE p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
    ORDER BY p.created_at DESC
  `, [req.user.id, req.user.id]);
  res.json(projects);
});

// POST /api/projects
router.post('/', (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  const id = uuidv4();
  run('INSERT INTO projects (id, name, description, owner_id) VALUES (?, ?, ?, ?)',
    [id, name, description || '', req.user.id]);
  run('INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)',
    [uuidv4(), id, req.user.id, 'manager']);

  res.status(201).json(queryOne('SELECT * FROM projects WHERE id = ?', [id]));
});

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  const project = queryOne(`
    SELECT p.*, u.name as owner_name FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id WHERE p.id = ?
  `, [req.params.id]);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const isMember = queryOne('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!isMember && project.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const members = query(`
    SELECT u.id, u.name, u.email, u.role as global_role, u.avatar_color, pm.role as project_role, pm.joined_at
    FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ?
  `, [req.params.id]);

  res.json({ ...project, members });
});

// PUT /api/projects/:id
router.put('/:id', (req, res) => {
  const project = queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const isManager = queryOne("SELECT id FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'manager'", [req.params.id, req.user.id]);
  if (project.owner_id !== req.user.id && !isManager && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only owner or manager can update' });
  }

  const { name, description, status } = req.body;
  const validStatuses = ['active', 'completed', 'archived'];
  run('UPDATE projects SET name = ?, description = ?, status = ? WHERE id = ?', [
    name || project.name,
    description !== undefined ? description : project.description,
    validStatuses.includes(status) ? status : project.status,
    req.params.id
  ]);
  res.json(queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]));
});

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
  const project = queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (project.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only owner can delete' });
  }
  run('DELETE FROM tasks WHERE project_id = ?', [req.params.id]);
  run('DELETE FROM project_members WHERE project_id = ?', [req.params.id]);
  run('DELETE FROM projects WHERE id = ?', [req.params.id]);
  res.json({ message: 'Project deleted' });
});

// POST /api/projects/:id/members
router.post('/:id/members', (req, res) => {
  const { email, role } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const project = queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const isManager = queryOne("SELECT id FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'manager'", [req.params.id, req.user.id]);
  if (project.owner_id !== req.user.id && !isManager && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only owner or manager can add members' });
  }

  const user = queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!user) return res.status(404).json({ error: 'No user found with that email' });

  const existing = queryOne('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?', [req.params.id, user.id]);
  if (existing) return res.status(409).json({ error: 'User is already a member' });

  run('INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)',
    [uuidv4(), req.params.id, user.id, role === 'manager' ? 'manager' : 'member']);

  res.status(201).json({ message: `${user.name} added to project` });
});

// DELETE /api/projects/:id/members/:userId
router.delete('/:id/members/:userId', (req, res) => {
  const project = queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (project.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only owner can remove members' });
  }
  run('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [req.params.id, req.params.userId]);
  res.json({ message: 'Member removed' });
});

module.exports = router;
