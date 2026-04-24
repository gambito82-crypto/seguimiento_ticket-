/**
 * ui.js — UI rendering and component management for TaskFlow
 */

const UI = {
  _currentFilter: 'all',
  _currentAssigneeFilter: 'all',
  _searchQuery: '',
  _detailTaskId: null,

  /**
   * Initialize the UI
   */
  init() {
    this.renderStats();
    this.renderKanban();
    this.bindEvents();
  },

  /**
   * Bind global events
   */
  bindEvents() {
    // New task button
    document.getElementById('btn-new-task')?.addEventListener('click', () => this.openTaskModal());

    // Modal close
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') this.closeModal();
    });

    // Task form submission
    document.getElementById('task-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleTaskSubmit(e.target);
    });

    // Search input
    document.getElementById('search-input')?.addEventListener('input', (e) => {
      this._searchQuery = e.target.value.toLowerCase();
      this.renderKanban();
    });

    // Filter by assignee
    document.getElementById('filter-assignee')?.addEventListener('change', (e) => {
      this._currentAssigneeFilter = e.target.value;
      this.renderKanban();
    });

    // Close detail panel
    document.getElementById('detail-close')?.addEventListener('click', () => this.closeDetailPanel());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        this.closeDetailPanel();
      }
      if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.openTaskModal();
      }
    });

    // Settings button
    document.getElementById('btn-settings')?.addEventListener('click', () => this.openSettingsModal());
  },

  // ============================================================
  // STATISTICS
  // ============================================================

  renderStats() {
    const stats = Store.getStats();
    this._setText('stat-total', stats.total);
    this._setText('stat-in-progress', stats.inProgress);
    this._setText('stat-paused', stats.paused);
    this._setText('stat-completed', stats.completedToday);

    // Update assignee filter
    this.updateAssigneeFilter();
  },

  updateAssigneeFilter() {
    const select = document.getElementById('filter-assignee');
    if (!select) return;
    const assignees = Store.getAssignees();
    const currentVal = select.value;
    select.innerHTML = '<option value="all">Todos</option>';
    assignees.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      select.appendChild(opt);
    });
    select.value = currentVal;
  },

  // ============================================================
  // KANBAN BOARD
  // ============================================================

  renderKanban() {
    this.renderColumn('in_progress', 'col-in-progress');
    this.renderColumn('paused', 'col-paused');
    this.renderColumn('completed', 'col-completed');
    this.renderStats();
  },

  renderColumn(phase, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let tasks = Store.getTasksByPhase(phase);

    // Apply filters
    if (this._searchQuery) {
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(this._searchQuery) ||
        t.assignee.toLowerCase().includes(this._searchQuery) ||
        (t.incNumber && t.incNumber.toLowerCase().includes(this._searchQuery)) ||
        (t.crqNumber && t.crqNumber.toLowerCase().includes(this._searchQuery)) ||
        (t.description && t.description.toLowerCase().includes(this._searchQuery))
      );
    }

    if (this._currentAssigneeFilter !== 'all') {
      tasks = tasks.filter(t => t.assignee === this._currentAssigneeFilter);
    }

    // Update column count
    const countEl = container.closest('.kanban-column')?.querySelector('.column-count');
    if (countEl) countEl.textContent = tasks.length;

    container.innerHTML = '';

    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-column">
          <span class="empty-icon">${phase === 'in_progress' ? '🚀' : phase === 'paused' ? '⏸️' : '✅'}</span>
          <p>Sin tareas</p>
        </div>
      `;
      return;
    }

    tasks.forEach(task => {
      container.appendChild(this.createTaskCard(task));
    });
  },

  createTaskCard(task) {
    const card = document.createElement('div');
    card.className = `task-card priority-${task.priority}`;
    card.dataset.taskId = task.id;

    const elapsed = Timer.getElapsedMs(task);
    const elapsedStr = Timer.formatTime(elapsed, 'short');
    const isRunning = task.phase === 'in_progress';
    const priorityLabels = { high: 'Alta', medium: 'Media', low: 'Baja' };
    const priorityIcons = { high: '🔴', medium: '🟡', low: '🟢' };

    const badges = [];
    if (task.incNumber) badges.push(`<span class="card-ticket ticket-inc" title="INC-${this._escape(task.incNumber)}">INC-${this._escape(task.incNumber)}</span>`);
    if (task.crqNumber) badges.push(`<span class="card-ticket ticket-crq" title="CRQ-${this._escape(task.crqNumber)}">CRQ-${this._escape(task.crqNumber)}</span>`);
    const ticketBadges = badges.length ? `<div class="card-tickets">${badges.join(' ')}</div>` : '';

    card.innerHTML = `
      <div class="card-header">
        <span class="card-priority" title="Prioridad: ${priorityLabels[task.priority]}">${priorityIcons[task.priority]}</span>
        <span class="card-title">${this._escape(task.title)}</span>
        ${task.alarm?.enabled ? '<span class="card-alarm-icon" title="Alarma activa">🔔</span>' : ''}
      </div>
      ${ticketBadges}
      <div class="card-assignee">
        <span class="assignee-avatar">${this._getInitials(task.assignee)}</span>
        <span class="assignee-name">${this._escape(task.assignee)}</span>
      </div>
      <div class="card-timer ${isRunning ? 'timer-running' : ''}">
        <span class="timer-icon">${isRunning ? '⏱️' : '⏲️'}</span>
        <span class="timer-value" data-timer-id="${task.id}">${elapsedStr}</span>
      </div>
      <div class="card-actions">
        ${this._getPhaseActions(task)}
      </div>
      <div class="card-meta">
        <span title="Creada: ${Timer.formatDate(task.createdAt)}">${Timer.formatRelativeTime(task.createdAt)}</span>
      </div>
    `;

    // Click on card to open detail
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.card-actions') && !e.target.closest('.action-btn')) {
        this.openDetailPanel(task.id);
      }
    });

    // Action buttons
    card.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const taskId = btn.dataset.taskId;
        this.handleAction(action, taskId);
      });
    });

    return card;
  },

  _getPhaseActions(task) {
    const btnClass = 'action-btn';
    switch (task.phase) {
      case 'in_progress':
        return `
          <button class="${btnClass} btn-pause" data-action="pause" data-task-id="${task.id}" title="Pausar">
            <span>⏸</span> Pausar
          </button>
          <button class="${btnClass} btn-complete" data-action="complete" data-task-id="${task.id}" title="Finalizar">
            <span>✅</span> Finalizar
          </button>
        `;
      case 'paused':
        return `
          <button class="${btnClass} btn-resume" data-action="resume" data-task-id="${task.id}" title="Reanudar">
            <span>▶️</span> Reanudar
          </button>
          <button class="${btnClass} btn-complete" data-action="complete" data-task-id="${task.id}" title="Finalizar">
            <span>✅</span> Finalizar
          </button>
        `;
      case 'completed':
        return `
          <button class="${btnClass} btn-reopen" data-action="reopen" data-task-id="${task.id}" title="Reabrir">
            <span>🔄</span> Reabrir
          </button>
        `;
      default:
        return '';
    }
  },

  handleAction(action, taskId) {
    switch (action) {
      case 'pause':
        Store.changePhase(taskId, 'paused');
        break;
      case 'resume':
        Store.changePhase(taskId, 'in_progress');
        break;
      case 'complete':
        Store.changePhase(taskId, 'completed');
        break;
      case 'reopen':
        Store.changePhase(taskId, 'in_progress', 'Tarea reabierta');
        break;
      case 'delete':
        if (confirm('¿Eliminar esta tarea permanentemente?')) {
          Store.deleteTask(taskId);
          this.closeDetailPanel();
        }
        break;
    }
    this.renderKanban();
  },

  // ============================================================
  // TASK MODAL (Create/Edit)
  // ============================================================

  openTaskModal(taskId = null) {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('task-modal');
    const form = document.getElementById('task-form');
    const title = document.getElementById('modal-title');

    if (!overlay || !modal || !form) return;

    form.reset();

    if (taskId) {
      const task = Store.getTask(taskId);
      if (!task) return;
      title.textContent = 'Editar Tarea';
      form.dataset.editId = taskId;
      document.getElementById('input-title').value = task.title;
      document.getElementById('input-inc').value = task.incNumber || '';
      document.getElementById('input-crq').value = task.crqNumber || '';
      document.getElementById('input-description').value = task.description;
      document.getElementById('input-assignee').value = task.assignee;
      document.getElementById('input-priority').value = task.priority;
      document.getElementById('input-alarm-interval').value = task.alarm?.intervalMinutes || 60;
      document.getElementById('input-alarm-enabled').checked = task.alarm?.enabled ?? true;
    } else {
      title.textContent = 'Nueva Tarea';
      delete form.dataset.editId;
      const settings = Store.getSettings();
      document.getElementById('input-alarm-interval').value = settings.defaultAlarmInterval;
      document.getElementById('input-alarm-enabled').checked = true;
    }

    // Hide settings modal if open
    document.getElementById('settings-modal').style.display = 'none';
    document.getElementById('task-modal').style.display = 'block';
    overlay.classList.add('active');
    modal.classList.add('active');
    document.getElementById('input-title').focus();
  },

  closeModal() {
    document.getElementById('modal-overlay')?.classList.remove('active');
    document.getElementById('task-modal')?.classList.remove('active');
    document.getElementById('settings-modal')?.classList.remove('active');
    document.getElementById('settings-modal').style.display = 'none';
    document.getElementById('task-modal').style.display = 'block';
  },

  handleTaskSubmit(form) {
    const title = document.getElementById('input-title').value.trim();
    const incNumber = document.getElementById('input-inc').value.trim();
    const crqNumber = document.getElementById('input-crq').value.trim();
    const description = document.getElementById('input-description').value.trim();
    const assignee = document.getElementById('input-assignee').value.trim();
    const priority = document.getElementById('input-priority').value;
    const alarmInterval = parseInt(document.getElementById('input-alarm-interval').value) || 60;
    const alarmEnabled = document.getElementById('input-alarm-enabled').checked;

    if (!title) {
      this.showToast('El título es obligatorio', 'error');
      return;
    }

    if (form.dataset.editId) {
      // Edit mode
      const task = Store.getTask(form.dataset.editId);
      if (task) {
        Store.updateTask(form.dataset.editId, {
          title,
          incNumber,
          crqNumber,
          description,
          assignee: assignee || 'Sin asignar',
          priority,
          alarm: {
            ...task.alarm,
            intervalMinutes: alarmInterval,
            enabled: alarmEnabled
          }
        });
        this.showToast('Tarea actualizada ✓', 'success');
      }
    } else {
      // Create mode
      Store.createTask({
        title,
        incNumber,
        crqNumber,
        description,
        assignee: assignee || 'Sin asignar',
        priority,
        alarmIntervalMinutes: alarmEnabled ? alarmInterval : 0
      });
      this.showToast('Tarea creada ✓', 'success');
    }

    this.closeModal();
    this.renderKanban();
  },

  // ============================================================
  // DETAIL PANEL
  // ============================================================

  openDetailPanel(taskId) {
    const task = Store.getTask(taskId);
    if (!task) return;

    this._detailTaskId = taskId;
    const panel = document.getElementById('detail-panel');
    if (!panel) return;

    const elapsed = Timer.getElapsedMs(task);
    const phaseLabels = { in_progress: 'En Proceso', paused: 'En Pausa', completed: 'Finalizada' };
    const phaseClasses = { in_progress: 'phase-progress', paused: 'phase-paused', completed: 'phase-completed' };
    const priorityLabels = { high: 'Alta', medium: 'Media', low: 'Baja' };

    document.getElementById('detail-title').textContent = task.title;
    document.getElementById('detail-description').textContent = task.description || 'Sin descripción';
    document.getElementById('detail-assignee').textContent = task.assignee;
    document.getElementById('detail-inc').textContent = task.incNumber ? `INC-${task.incNumber}` : '—';
    document.getElementById('detail-crq').textContent = task.crqNumber ? `CRQ-${task.crqNumber}` : '—';
    document.getElementById('detail-phase').textContent = phaseLabels[task.phase];
    document.getElementById('detail-phase').className = `detail-phase-badge ${phaseClasses[task.phase]}`;
    document.getElementById('detail-priority').textContent = priorityLabels[task.priority];
    document.getElementById('detail-created').textContent = Timer.formatDate(task.createdAt);
    document.getElementById('detail-started').textContent = Timer.formatDate(task.startedAt);
    document.getElementById('detail-completed').textContent = task.completedAt ? Timer.formatDate(task.completedAt) : '—';
    document.getElementById('detail-elapsed').textContent = Timer.formatTime(elapsed, 'long');
    document.getElementById('detail-alarm-status').textContent = task.alarm?.enabled
      ? `Cada ${task.alarm.intervalMinutes} min`
      : 'Desactivada';

    // Render history
    const historyContainer = document.getElementById('detail-history');
    historyContainer.innerHTML = '';
    const history = [...task.history].reverse();
    history.forEach(entry => {
      const div = document.createElement('div');
      div.className = 'history-entry';
      div.innerHTML = `
        <span class="history-dot"></span>
        <div class="history-content">
          <span class="history-note">${this._escape(entry.note)}</span>
          <span class="history-time">${Timer.formatDate(entry.at)}</span>
        </div>
      `;
      historyContainer.appendChild(div);
    });

    // Action buttons in detail
    const actionsContainer = document.getElementById('detail-actions');
    actionsContainer.innerHTML = `
      <button class="detail-action-btn btn-edit" onclick="UI.openTaskModal('${task.id}')">
        ✏️ Editar
      </button>
      <button class="detail-action-btn btn-delete" onclick="UI.handleAction('delete', '${task.id}')">
        🗑️ Eliminar
      </button>
    `;

    panel.classList.add('active');
  },

  closeDetailPanel() {
    this._detailTaskId = null;
    document.getElementById('detail-panel')?.classList.remove('active');
  },

  /**
   * Update running timers in the UI
   */
  updateTimers() {
    const tasks = Store.getTasksByPhase('in_progress');
    tasks.forEach(task => {
      const el = document.querySelector(`[data-timer-id="${task.id}"]`);
      if (el) {
        el.textContent = Timer.formatTime(Timer.getElapsedMs(task), 'short');
      }
    });

    // Update detail panel timer if open
    if (this._detailTaskId) {
      const task = Store.getTask(this._detailTaskId);
      if (task) {
        const el = document.getElementById('detail-elapsed');
        if (el) el.textContent = Timer.formatTime(Timer.getElapsedMs(task), 'long');
      }
    }
  },

  /**
   * Highlight a task card (used by alarm system)
   */
  highlightTask(taskId) {
    const card = document.querySelector(`[data-task-id="${taskId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('highlight-pulse');
      setTimeout(() => card.classList.remove('highlight-pulse'), 3000);
    }
  },

  // ============================================================
  // SETTINGS MODAL
  // ============================================================

  openSettingsModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('settings-modal');
    if (!overlay || !modal) return;

    const settings = Store.getSettings();
    document.getElementById('settings-default-alarm').value = settings.defaultAlarmInterval;
    document.getElementById('settings-sound').checked = settings.soundEnabled;

    // Hide task modal, show settings
    document.getElementById('task-modal').style.display = 'none';
    modal.style.display = 'block';
    overlay.classList.add('active');
    modal.classList.add('active');
  },

  saveSettings() {
    const defaultAlarmInterval = parseInt(document.getElementById('settings-default-alarm').value) || 60;
    const soundEnabled = document.getElementById('settings-sound').checked;
    Store.saveSettings({ defaultAlarmInterval, soundEnabled });
    this.closeModal();
    this.showToast('Configuración guardada ✓', 'success');
  },

  // ============================================================
  // TOAST NOTIFICATIONS
  // ============================================================

  showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  },

  // ============================================================
  // CLOCK
  // ============================================================

  updateClock() {
    const el = document.getElementById('header-clock');
    if (el) {
      const now = new Date();
      el.textContent = now.toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
  },

  // ============================================================
  // UTILITIES
  // ============================================================

  _escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  _setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  },

  _getInitials(name) {
    if (!name) return '??';
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }
};
