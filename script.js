/**
 * TASKY — Task Manager
 * script.js
 * 
 * Handles: task CRUD, localStorage persistence,
 * filtering, stats, modals, and UI state.
 */

// ── State ──────────────────────────────────────────
/** @type {{ id: string, text: string, done: boolean, createdAt: number }[]} */
let tasks = [];
let currentFilter = 'all';
let editingId = null; // ID of the task being edited

// ── DOM References ──────────────────────────────────
const taskInput     = document.getElementById('taskInput');
const addBtn        = document.getElementById('addBtn');
const taskList      = document.getElementById('taskList');
const emptyState    = document.getElementById('emptyState');
const errorMsg      = document.getElementById('errorMsg');
const currentDate   = document.getElementById('currentDate');
const greetingText  = document.getElementById('greetingText');
const sectionTitle  = document.getElementById('sectionTitle');
const visibleCount  = document.getElementById('visibleCount');

// Stat counters
const totalCount   = document.getElementById('totalCount');
const doneCount    = document.getElementById('doneCount');
const pendingCount = document.getElementById('pendingCount');
const progressPct  = document.getElementById('progressPct');
const progressCircle = document.getElementById('progressCircle');

// Filter buttons
const filterBtns   = document.querySelectorAll('.filter-btn');
const clearAllBtn  = document.getElementById('clearAllBtn');

// Edit modal
const modalOverlay = document.getElementById('modalOverlay');
const editInput    = document.getElementById('editInput');
const modalClose   = document.getElementById('modalClose');
const modalCancel  = document.getElementById('modalCancel');
const modalSave    = document.getElementById('modalSave');

// Confirm modal
const confirmOverlay = document.getElementById('confirmOverlay');
const confirmNo      = document.getElementById('confirmNo');
const confirmYes     = document.getElementById('confirmYes');

// ── Initialisation ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  injectSvgDefs();   // gradient for progress ring
  setDateAndGreeting();
  loadFromStorage();
  renderAll();
});

// ── Date & Greeting ─────────────────────────────────
function setDateAndGreeting() {
  const now  = new Date();
  const hour = now.getHours();

  // Greeting based on time of day
  const greeting =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' :
                'Good evening';
  greetingText.textContent = greeting;

  // Formatted date: "Wednesday, 10 June 2026"
  currentDate.textContent = now.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

// ── LocalStorage ────────────────────────────────────
function loadFromStorage() {
  try {
    const stored = localStorage.getItem('tasky_tasks');
    tasks = stored ? JSON.parse(stored) : [];
  } catch {
    tasks = [];
  }
}

function saveToStorage() {
  localStorage.setItem('tasky_tasks', JSON.stringify(tasks));
}

// ── Task CRUD ────────────────────────────────────────

/** Generate a simple unique ID */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Add a new task */
function addTask() {
  const text = taskInput.value.trim();

  if (!text) {
    showError();
    return;
  }

  hideError();

  tasks.unshift({
    id: uid(),
    text,
    done: false,
    createdAt: Date.now()
  });

  saveToStorage();
  taskInput.value = '';
  renderAll();
}

/** Toggle completion status */
function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.done = !task.done;
    saveToStorage();
    renderAll();
  }
}

/** Remove a task with animation */
function deleteTask(id) {
  const li = document.querySelector(`[data-id="${id}"]`);
  if (li) {
    li.classList.add('removing');
    li.addEventListener('animationend', () => {
      tasks = tasks.filter(t => t.id !== id);
      saveToStorage();
      renderAll();
    }, { once: true });
  }
}

/** Open edit modal */
function openEditModal(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  editingId = id;
  editInput.value = task.text;
  modalOverlay.classList.add('open');
  setTimeout(() => editInput.focus(), 50);
}

/** Save edited task */
function saveEdit() {
  const newText = editInput.value.trim();
  if (!newText) return;

  const task = tasks.find(t => t.id === editingId);
  if (task) {
    task.text = newText;
    saveToStorage();
    renderAll();
  }
  closeEditModal();
}

function closeEditModal() {
  modalOverlay.classList.remove('open');
  editingId = null;
}

// ── Rendering ────────────────────────────────────────

/** Main render function — updates everything */
function renderAll() {
  renderTasks();
  updateStats();
}

/** Render the filtered task list */
function renderTasks() {
  // Determine visible tasks based on current filter
  const filtered = tasks.filter(t => {
    if (currentFilter === 'active')    return !t.done;
    if (currentFilter === 'completed') return t.done;
    return true;
  });

  // Section label
  const labels = { all: 'All Tasks', active: 'Active Tasks', completed: 'Completed Tasks' };
  sectionTitle.textContent = labels[currentFilter];

  // Badge count
  const word = filtered.length === 1 ? 'task' : 'tasks';
  visibleCount.textContent = `${filtered.length} ${word}`;

  // Empty state toggle
  emptyState.classList.toggle('visible', filtered.length === 0);

  // Build list items
  taskList.innerHTML = '';
  filtered.forEach(task => {
    const li = createTaskElement(task);
    taskList.appendChild(li);
  });
}

/** Create a task <li> element */
function createTaskElement(task) {
  const li = document.createElement('li');
  li.className = `task-item ${task.done ? 'done' : ''}`;
  li.dataset.id = task.id;

  li.innerHTML = `
    <button class="check-btn" aria-label="${task.done ? 'Mark incomplete' : 'Mark complete'}">
      <i class="fa-solid fa-check"></i>
    </button>
    <span class="task-text">${escapeHtml(task.text)}</span>
    <div class="task-actions">
      <button class="action-btn edit-btn" aria-label="Edit task" title="Edit">
        <i class="fa-solid fa-pen"></i>
      </button>
      <button class="action-btn del-btn" aria-label="Delete task" title="Delete">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `;

  // Attach events
  li.querySelector('.check-btn').addEventListener('click', () => toggleTask(task.id));
  li.querySelector('.edit-btn').addEventListener('click', () => openEditModal(task.id));
  li.querySelector('.del-btn').addEventListener('click', () => deleteTask(task.id));

  return li;
}

/** Update the stats panel (counts + progress ring) */
function updateStats() {
  const total   = tasks.length;
  const done    = tasks.filter(t => t.done).length;
  const pending = total - done;
  const pct     = total === 0 ? 0 : Math.round((done / total) * 100);

  totalCount.textContent   = total;
  doneCount.textContent    = done;
  pendingCount.textContent = pending;
  progressPct.textContent  = pct + '%';

  // Animate SVG ring (circumference = 2π × 34 ≈ 213.6)
  const circumference = 213.6;
  const offset = circumference - (pct / 100) * circumference;
  progressCircle.style.strokeDashoffset = offset;
}

// ── Error Handling ───────────────────────────────────
function showError() {
  errorMsg.classList.add('visible');
  taskInput.style.borderColor = 'rgba(242,100,100,0.6)';
  taskInput.style.boxShadow  = '0 0 0 3px rgba(242,100,100,0.12)';
  taskInput.focus();
}

function hideError() {
  errorMsg.classList.remove('visible');
  taskInput.style.borderColor = '';
  taskInput.style.boxShadow  = '';
}

// ── Filter ───────────────────────────────────────────
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderTasks();
  });
});

// ── Clear All ────────────────────────────────────────
clearAllBtn.addEventListener('click', () => {
  if (tasks.length === 0) return;
  confirmOverlay.classList.add('open');
});

confirmYes.addEventListener('click', () => {
  tasks = [];
  saveToStorage();
  renderAll();
  confirmOverlay.classList.remove('open');
});

confirmNo.addEventListener('click', () => {
  confirmOverlay.classList.remove('open');
});

// Close confirm modal on overlay click
confirmOverlay.addEventListener('click', e => {
  if (e.target === confirmOverlay) confirmOverlay.classList.remove('open');
});

// ── Modal Events ──────────────────────────────────────
addBtn.addEventListener('click', addTask);

taskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});
taskInput.addEventListener('input', () => {
  if (taskInput.value.trim()) hideError();
});

modalClose.addEventListener('click',  closeEditModal);
modalCancel.addEventListener('click', closeEditModal);
modalSave.addEventListener('click',   saveEdit);

editInput.addEventListener('keydown', e => {
  if (e.key === 'Enter')  saveEdit();
  if (e.key === 'Escape') closeEditModal();
});

// Close edit modal on overlay click
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeEditModal();
});

// ── SVG Gradient Def ─────────────────────────────────
/** Injects a hidden <svg> with the gradient used by the progress ring stroke */
function injectSvgDefs() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.innerHTML = `
    <defs>
      <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stop-color="#7c5cfc"/>
        <stop offset="100%" stop-color="#5b8af7"/>
      </linearGradient>
    </defs>
  `;
  document.body.prepend(svg);
}

// ── Utility ──────────────────────────────────────────
/** Prevent XSS when rendering task text */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
