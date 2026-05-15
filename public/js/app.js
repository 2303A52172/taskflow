/* === TASKFLOW FRONTEND === */
const API = '';
let token = localStorage.getItem('tf_token');
let currentUser = JSON.parse(localStorage.getItem('tf_user') || 'null');
let currentProjectId = null;

// === UTILS ===
const $ = id => document.getElementById(id);
const toast = (msg, type = 'success') => {
  const el = $('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  setTimeout(() => el.classList.remove('show'), 3000);
};

const api = async (path, opts = {}) => {
  const res = await fetch(`${API}/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
const isOverdue = d => d && new Date(d) < new Date() ? true : false;
const priorityIcon = p => ({ low: '▽', medium: '◇', high: '▲', urgent: '⚠' }[p] || '◇');
const statusLabel = s => ({ todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' }[s] || s);

// === AUTH ===
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    $(`${btn.dataset.tab}-form`).classList.add('active');
    $('auth-error').textContent = '';
  });
});

$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { email: $('login-email').value, password: $('login-password').value }
    });
    saveSession(data);
  } catch (err) {
    $('auth-error').textContent = err.message;
  }
});

$('signup-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const data = await api('/auth/signup', {
      method: 'POST',
      body: {
        name: $('signup-name').value,
        email: $('signup-email').value,
        password: $('signup-password').value,
        role: $('signup-role').value
      }
    });
    saveSession(data);
  } catch (err) {
    $('auth-error').textContent = err.message;
  }
});

const saveSession = ({ token: t, user }) => {
  token = t;
  currentUser = user;
  localStorage.setItem('tf_token', t);
  localStorage.setItem('tf_user', JSON.stringify(user));
  initApp();
};

$('logout-btn').addEventListener('click', () => {
  token = null; currentUser = null;
  localStorage.removeItem('tf_token');
  localStorage.removeItem('tf_user');
  $('auth-screen').classList.add('active');
  $('app-shell').classList.remove('active');
});

// === APP INIT ===
const initApp = () => {
  $('auth-screen').classList.remove('active');
  $('app-shell').classList.add('active');

  $('user-avatar').textContent = currentUser.name[0].toUpperCase();
  $('user-name-sidebar').textContent = currentUser.name;
  $('user-role-sidebar').textContent = currentUser.role;

  loadDashboard();
};

// === NAVIGATION ===
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    showView(link.dataset.view);
  });
});

const showView = (view) => {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $(`view-${view}`).classList.add('active');
  if (view === 'dashboard') loadDashboard();
  else if (view === 'projects') loadProjects();
  else if (view === 'tasks') loadTasks();
};

// === DASHBOARD ===
const loadDashboard = async () => {
  try {
    const data = await api('/dashboard');
    renderStats(data.stats);
    renderCompactTasks($('recent-tasks-list'), data.recent_tasks);
    renderCompactTasks($('overdue-tasks-list'), data.overdue_tasks, true);
  } catch (err) { toast(err.message, 'error'); }
};

const renderStats = (s) => {
  const stats = [
    { label: 'Total Tasks', num: s.total_tasks, color: '#6ee7b7' },
    { label: 'To Do', num: s.todo, color: '#94a3b8' },
    { label: 'In Progress', num: s.in_progress, color: '#fb923c' },
    { label: 'Review', num: s.review, color: '#818cf8' },
    { label: 'Done', num: s.done, color: '#4ade80' },
    { label: 'Overdue', num: s.overdue, color: '#f87171' },
  ];
  $('stats-grid').innerHTML = stats.map(s => `
    <div class="stat-card" style="--accent-color: ${s.color}">
      <div class="stat-num">${s.num}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');
};

const renderCompactTasks = (el, tasks, overdue = false) => {
  if (!tasks.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">${overdue ? '✓' : '○'}</div><p>${overdue ? 'Nothing overdue!' : 'No tasks yet'}</p></div>`;
    return;
  }
  el.innerHTML = tasks.slice(0, 6).map(t => `
    <div class="task-compact" onclick="openTaskDetail('${t.id}')">
      <span class="priority-${t.priority}">${priorityIcon(t.priority)}</span>
      <span class="task-compact-title">${t.title}</span>
      <span class="status-badge status-${t.status}">${statusLabel(t.status)}</span>
      ${t.due_date ? `<span class="task-compact-meta task-due ${isOverdue(t.due_date) ? 'overdue' : ''}">${fmtDate(t.due_date)}</span>` : ''}
    </div>
  `).join('');
};

// === PROJECTS ===
const loadProjects = async () => {
  try {
    const projects = await api('/projects');
    renderProjects(projects);
  } catch (err) { toast(err.message, 'error'); }
};

const renderProjects = (projects) => {
  if (!projects.length) {
    $('projects-grid').innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">◉</div><p>No projects yet. Create your first one!</p></div>`;
    return;
  }
  $('projects-grid').innerHTML = projects.map(p => `
    <div class="project-card" onclick="openProject('${p.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <span class="status-badge status-${p.status}">${p.status}</span>
      </div>
      <div class="project-name">${p.name}</div>
      <div class="project-desc">${p.description || 'No description'}</div>
      <div class="project-meta">
        <div class="project-stat"><strong>${p.task_count || 0}</strong>Tasks</div>
        <div class="project-stat"><strong>${p.open_tasks || 0}</strong>Open</div>
        <div class="project-stat"><strong>${p.member_count || 0}</strong>Members</div>
      </div>
    </div>
  `).join('');
};

$('new-project-btn').addEventListener('click', () => {
  openModal(`
    <h3>New Project</h3>
    <div class="modal-form">
      <div class="field"><label>Project Name</label><input id="m-proj-name" placeholder="My Awesome Project"/></div>
      <div class="field"><label>Description</label><textarea id="m-proj-desc" rows="3" placeholder="What's this project about?" style="resize:vertical"></textarea></div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="createProject()">Create Project</button>
      </div>
    </div>
  `);
});

const createProject = async () => {
  try {
    await api('/projects', {
      method: 'POST',
      body: { name: $('m-proj-name').value, description: $('m-proj-desc').value }
    });
    closeModal();
    loadProjects();
    toast('Project created!');
  } catch (err) { toast(err.message, 'error'); }
};

// === PROJECT DETAIL ===
const openProject = async (id) => {
  currentProjectId = id;
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('view-project-detail').classList.add('active');

  try {
    const [project, tasks] = await Promise.all([
      api(`/projects/${id}`),
      api(`/tasks?project_id=${id}`)
    ]);

    $('project-detail-title').textContent = project.name;

    $('project-detail-content').innerHTML = `
      <div class="detail-section">
        <h3>Project Info</h3>
        <p style="color:var(--text2);font-size:14px;margin-bottom:12px">${project.description || 'No description'}</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <span class="status-badge status-${project.status}">${project.status}</span>
          <span style="font-size:12px;color:var(--text3);font-family:var(--font-mono)">Owner: ${project.owner_name}</span>
          <span style="font-size:12px;color:var(--text3);font-family:var(--font-mono)">Created: ${fmtDate(project.created_at)}</span>
        </div>
        ${project.owner_id === currentUser.id || currentUser.role === 'admin' ? `
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn-secondary" onclick="editProjectStatus('${project.id}', '${project.status}')">Change Status</button>
            <button class="btn-secondary" style="border-color:var(--danger);color:var(--danger)" onclick="deleteProject('${project.id}')">Delete Project</button>
          </div>
        ` : ''}
      </div>

      <div class="detail-section">
        <h3>Team (${project.members.length})</h3>
        <div class="members-list">
          ${project.members.map(m => `
            <div class="member-item">
              <div class="member-avatar">${m.name[0]}</div>
              <div class="member-name">${m.name}</div>
              <div class="member-role">${m.project_role}</div>
              <span style="font-size:11px;color:var(--text3)">${m.email}</span>
              ${project.owner_id === currentUser.id && m.id !== currentUser.id ? `
                <button onclick="removeMember('${project.id}', '${m.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px">✕</button>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <div class="detail-section">
        <h3 style="display:flex;justify-content:space-between">
          Tasks (${tasks.length})
          <button class="btn-primary" style="font-size:12px;padding:6px 12px" onclick="openNewTaskModal('${id}')">+ Add Task</button>
        </h3>
        <div class="tasks-board" style="grid-template-columns:repeat(4,1fr)">
          ${['todo','in_progress','review','done'].map(s => `
            <div class="board-col">
              <div class="board-col-title">
                ${statusLabel(s)}
                <span class="col-count">${tasks.filter(t => t.status === s).length}</span>
              </div>
              <div class="board-tasks">
                ${tasks.filter(t => t.status === s).map(t => `
                  <div class="task-card" onclick="openTaskDetail('${t.id}')">
                    <div class="task-card-title">${t.title}</div>
                    <div class="task-card-footer">
                      <span class="priority-${t.priority}">${priorityIcon(t.priority)} ${t.priority}</span>
                      ${t.due_date ? `<span class="task-due ${isOverdue(t.due_date) && t.status !== 'done' ? 'overdue' : ''}">${fmtDate(t.due_date)}</span>` : ''}
                    </div>
                    ${t.assigned_to_name ? `<div style="font-size:11px;color:var(--text3);margin-top:6px">→ ${t.assigned_to_name}</div>` : ''}
                  </div>
                `).join('') || '<div style="font-size:12px;color:var(--text3);padding:8px">Empty</div>'}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (err) { toast(err.message, 'error'); }
};

$('back-to-projects').addEventListener('click', () => {
  showView('projects');
  document.querySelector('.nav-link[data-view="projects"]').classList.add('active');
});

$('add-member-btn').addEventListener('click', () => {
  if (!currentProjectId) return;
  openModal(`
    <h3>Add Team Member</h3>
    <div class="modal-form">
      <div class="field"><label>Member Email</label><input id="m-member-email" placeholder="colleague@company.com"/></div>
      <div class="field"><label>Project Role</label>
        <select id="m-member-role">
          <option value="member">Member</option>
          <option value="manager">Manager</option>
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="addMember()">Add Member</button>
      </div>
    </div>
  `);
});

const addMember = async () => {
  try {
    await api(`/projects/${currentProjectId}/members`, {
      method: 'POST',
      body: { email: $('m-member-email').value, role: $('m-member-role').value }
    });
    closeModal();
    openProject(currentProjectId);
    toast('Member added!');
  } catch (err) { toast(err.message, 'error'); }
};

const removeMember = async (projectId, userId) => {
  if (!confirm('Remove this member from the project?')) return;
  try {
    await api(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' });
    openProject(projectId);
    toast('Member removed');
  } catch (err) { toast(err.message, 'error'); }
};

const deleteProject = async (id) => {
  if (!confirm('Delete this project and all its tasks? This cannot be undone.')) return;
  try {
    await api(`/projects/${id}`, { method: 'DELETE' });
    showView('projects');
    document.querySelector('.nav-link[data-view="projects"]').classList.add('active');
    toast('Project deleted');
  } catch (err) { toast(err.message, 'error'); }
};

const editProjectStatus = (id, current) => {
  openModal(`
    <h3>Update Project Status</h3>
    <div class="modal-form">
      <div class="field"><label>Status</label>
        <select id="m-proj-status">
          <option value="active" ${current==='active'?'selected':''}>Active</option>
          <option value="completed" ${current==='completed'?'selected':''}>Completed</option>
          <option value="archived" ${current==='archived'?'selected':''}>Archived</option>
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="updateProjectStatus('${id}')">Update</button>
      </div>
    </div>
  `);
};

const updateProjectStatus = async (id) => {
  try {
    await api(`/projects/${id}`, { method: 'PUT', body: { status: $('m-proj-status').value } });
    closeModal();
    openProject(id);
    toast('Project updated!');
  } catch (err) { toast(err.message, 'error'); }
};

// === TASKS ===
const loadTasks = async () => {
  const status = $('task-filter-status').value;
  const priority = $('task-filter-priority').value;
  let url = '/tasks?';
  if (status) url += `status=${status}&`;
  if (priority) url += `priority=${priority}&`;

  try {
    const tasks = await api(url);
    renderTaskBoard(tasks);
  } catch (err) { toast(err.message, 'error'); }
};

const renderTaskBoard = (tasks) => {
  const cols = ['todo', 'in_progress', 'review', 'done'];
  $('tasks-board').innerHTML = cols.map(s => {
    const colTasks = tasks.filter(t => t.status === s);
    return `
      <div class="board-col">
        <div class="board-col-title">
          ${statusLabel(s)}
          <span class="col-count">${colTasks.length}</span>
        </div>
        <div class="board-tasks">
          ${colTasks.length ? colTasks.map(t => `
            <div class="task-card" onclick="openTaskDetail('${t.id}')">
              <div class="task-card-title">${t.title}</div>
              <div class="task-card-footer">
                <span class="priority-${t.priority}">${priorityIcon(t.priority)} ${t.priority}</span>
                ${t.due_date ? `<span class="task-due ${isOverdue(t.due_date) && t.status !== 'done' ? 'overdue' : ''}">${fmtDate(t.due_date)}</span>` : ''}
              </div>
              <div class="task-card-project" style="margin-top:6px">${t.project_name || ''}</div>
            </div>
          `).join('') : `<div style="font-size:12px;color:var(--text3);padding:8px;text-align:center">Empty</div>`}
        </div>
      </div>
    `;
  }).join('');
};

$('task-filter-status').addEventListener('change', loadTasks);
$('task-filter-priority').addEventListener('change', loadTasks);

const openNewTaskModal = async (projectId = null) => {
  let projectOptions = '';
  try {
    const projects = await api('/projects');
    projectOptions = projects.map(p => `<option value="${p.id}" ${p.id == projectId ? 'selected' : ''}>${p.name}</option>`).join('');
  } catch (e) {}

  openModal(`
    <h3>New Task</h3>
    <div class="modal-form">
      <div class="field"><label>Title</label><input id="m-task-title" placeholder="Task title" required/></div>
      <div class="field"><label>Description</label><textarea id="m-task-desc" rows="3" style="resize:vertical" placeholder="Optional details..."></textarea></div>
      <div class="field"><label>Project</label><select id="m-task-project">${projectOptions}</select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="field"><label>Priority</label>
          <select id="m-task-priority">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div class="field"><label>Status</label>
          <select id="m-task-status">
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>
      <div class="field"><label>Due Date</label><input id="m-task-due" type="date"/></div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="createTask()">Create Task</button>
      </div>
    </div>
  `);
};

$('new-task-btn').addEventListener('click', () => openNewTaskModal());

const createTask = async () => {
  const projectId = $('m-task-project').value;
  if (!projectId) return toast('Select a project', 'error');
  const title = $('m-task-title').value.trim();
  if (!title) return toast('Title required', 'error');

  try {
    await api('/tasks', {
      method: 'POST',
      body: {
        title,
        description: $('m-task-desc').value,
        project_id: projectId,
        priority: $('m-task-priority').value,
        status: $('m-task-status').value,
        due_date: $('m-task-due').value || null
      }
    });
    closeModal();
    if ($('view-tasks').classList.contains('active')) loadTasks();
    if ($('view-project-detail').classList.contains('active') && currentProjectId) openProject(currentProjectId);
    toast('Task created!');
  } catch (err) { toast(err.message, 'error'); }
};

// === TASK DETAIL ===
const openTaskDetail = async (id) => {
  try {
    const task = await api(`/tasks/${id}`);
    openModal(`
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
        <span class="status-badge status-${task.status}">${statusLabel(task.status)}</span>
        <span class="priority-${task.priority}">${priorityIcon(task.priority)} ${task.priority}</span>
      </div>
      <h3 style="margin:12px 0 8px">${task.title}</h3>
      <p style="color:var(--text2);font-size:13px;margin-bottom:20px;line-height:1.6">${task.description || 'No description'}</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;font-size:12px;font-family:var(--font-mono)">
        <div><span style="color:var(--text3)">Project:</span> <span>${task.project_name || 'N/A'}</span></div>
        <div><span style="color:var(--text3)">Assigned:</span> <span>${task.assigned_to_name || 'Unassigned'}</span></div>
        <div><span style="color:var(--text3)">Due:</span> <span class="${isOverdue(task.due_date) && task.status !== 'done' ? 'priority-urgent' : ''}">${fmtDate(task.due_date) || 'No due date'}</span></div>
        <div><span style="color:var(--text3)">By:</span> <span>${task.created_by_name}</span></div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">
        ${['todo','in_progress','review','done'].map(s => `
          <button onclick="updateTaskStatus(${task.id}, '${s}')" 
            style="font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:${task.status===s?'var(--accent)':'var(--bg3)'};color:${task.status===s?'#0a0a0f':'var(--text2)'};cursor:pointer;font-family:var(--font-head);font-weight:600">
            ${statusLabel(s)}
          </button>
        `).join('')}
      </div>

      <div style="border-top:1px solid var(--border);padding-top:16px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text2);margin-bottom:12px">
          Comments (${task.comments.length})
        </div>
        <div id="comments-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
          ${task.comments.map(c => `
            <div style="background:var(--bg3);border-radius:8px;padding:10px 12px">
              <div style="font-size:12px;font-weight:600;margin-bottom:4px">${c.user_name} <span style="color:var(--text3);font-weight:400">${fmtDate(c.created_at)}</span></div>
              <div style="font-size:13px;color:var(--text2)">${c.comment}</div>
            </div>
          `).join('') || '<div style="font-size:12px;color:var(--text3)">No comments yet</div>'}
        </div>
        <div style="display:flex;gap:8px">
          <input id="comment-input" placeholder="Add a comment..." style="flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);font-family:var(--font-head);font-size:13px;outline:none"/>
          <button onclick="addComment('${task.id}')" class="btn-primary" style="padding:8px 14px">Post</button>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-top:16px;border-top:1px solid var(--border);padding-top:16px">
        ${task.created_by === currentUser.id || currentUser.role === 'admin' ? `
          <button onclick="deleteTask('${task.id}')" style="background:none;border:1px solid var(--border);border-radius:8px;color:var(--text3);padding:8px 14px;cursor:pointer;font-size:12px;font-family:var(--font-head)" onmouseover="this.style.borderColor='var(--danger)';this.style.color='var(--danger)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text3)'">Delete Task</button>
        ` : ''}
      </div>
    `);
  } catch (err) { toast(err.message, 'error'); }
};

const updateTaskStatus = async (taskId, status) => {
  try {
    await api(`/tasks/${taskId}`, { method: 'PUT', body: { status } });
    closeModal();
    if ($('view-tasks').classList.contains('active')) loadTasks();
    if ($('view-project-detail').classList.contains('active') && currentProjectId) openProject(currentProjectId);
    if ($('view-dashboard').classList.contains('active')) loadDashboard();
    toast(`Moved to ${statusLabel(status)}`);
  } catch (err) { toast(err.message, 'error'); }
};

const addComment = async (taskId) => {
  const comment = $('comment-input').value.trim();
  if (!comment) return;
  try {
    await api(`/tasks/${taskId}/comments`, { method: 'POST', body: { comment } });
    openTaskDetail(taskId);
    toast('Comment added!');
  } catch (err) { toast(err.message, 'error'); }
};

const deleteTask = async (id) => {
  if (!confirm('Delete this task?')) return;
  try {
    await api(`/tasks/${id}`, { method: 'DELETE' });
    closeModal();
    if ($('view-tasks').classList.contains('active')) loadTasks();
    if ($('view-project-detail').classList.contains('active') && currentProjectId) openProject(currentProjectId);
    toast('Task deleted');
  } catch (err) { toast(err.message, 'error'); }
};

// === MODAL ===
const openModal = (html) => {
  $('modal-content').innerHTML = html;
  $('modal-overlay').classList.add('open');
};

const closeModal = () => {
  $('modal-overlay').classList.remove('open');
  $('modal-content').innerHTML = '';
};

$('modal-close').addEventListener('click', closeModal);
$('modal-overlay').addEventListener('click', e => { if (e.target === $('modal-overlay')) closeModal(); });

// === BOOT ===
if (token && currentUser) {
  initApp();
} else {
  $('auth-screen').classList.add('active');
}