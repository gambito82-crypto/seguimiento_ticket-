/**
 * store.js — State management with Firebase Realtime Database + localStorage fallback
 */

const STORAGE_KEY = 'taskflow_tasks';
const SETTINGS_KEY = 'taskflow_settings';

const Store = {
  _listeners: [],
  _tasks: [],
  _initialized: false,

  /**
   * Generate a unique ID
   */
  generateId() {
    return 'tf_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  },

  /**
   * Initialize the store — load from localStorage first, then subscribe to Firebase
   */
  init() {
    // Load from localStorage immediately (cache)
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this._tasks = raw ? JSON.parse(raw) : [];
    } catch (e) {
      this._tasks = [];
    }

    // Subscribe to Firebase real-time updates
    if (typeof firebaseConnected !== 'undefined' && firebaseConnected && typeof firebaseTasksRef !== 'undefined') {
      firebaseTasksRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
          this._tasks = Object.values(data);
        } else {
          this._tasks = [];
        }
        // Cache to localStorage
        this._saveLocal();
        this._notify();
      }, (error) => {
        console.error('Firebase read error:', error);
      });

      // Monitor connection
      this._monitorConnection();
    } else {
      this._setConnectionStatus(false, 'Offline');
    }

    this._initialized = true;
  },

  /**
   * Monitor Firebase connection status
   */
  _monitorConnection() {
    if (!firebaseConnected || !firebaseDB) {
      this._setConnectionStatus(false, 'Offline');
      return;
    }
    const connRef = firebaseDB.ref('.info/connected');
    connRef.on('value', (snap) => {
      if (snap.val() === true) {
        this._setConnectionStatus(true, 'Conectado');
      } else {
        this._setConnectionStatus(false, 'Desconectado');
      }
    });
  },

  /**
   * Update the connection status indicator in the UI
   */
  _setConnectionStatus(online, label) {
    const dot = document.getElementById('status-dot');
    const labelEl = document.getElementById('status-label');
    const container = document.getElementById('header-status');
    if (!dot || !labelEl || !container) return;

    if (online) {
      dot.style.background = '#10b981';
      dot.style.boxShadow = '0 0 6px #10b981';
      container.style.color = '#10b981';
    } else {
      dot.style.background = '#f59e0b';
      dot.style.boxShadow = '0 0 6px #f59e0b';
      container.style.color = '#f59e0b';
    }
    labelEl.textContent = label;
  },

  /**
   * Get all tasks
   */
  getTasks() {
    return [...this._tasks];
  },

  /**
   * Save to localStorage (cache)
   */
  _saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._tasks));
    } catch (e) {
      console.error('localStorage save error:', e);
    }
  },

  /**
   * Save to Firebase (primary) + localStorage (cache)
   */
  _saveToFirebase() {
    this._saveLocal();

    if (typeof firebaseConnected !== 'undefined' && firebaseConnected && typeof firebaseTasksRef !== 'undefined') {
      const dataObj = {};
      this._tasks.forEach(t => { dataObj[t.id] = t; });
      firebaseTasksRef.set(dataObj).catch((err) => {
        console.error('Firebase write error:', err);
        if (typeof UI !== 'undefined' && UI.showToast) {
          UI.showToast('⚠️ Sin conexión — guardado localmente', 'warning');
        }
      });
    } else {
      this._notify();
    }
  },

  /**
   * Get a single task by ID
   */
  getTask(id) {
    return this._tasks.find(t => t.id === id) || null;
  },

  /**
   * Create a new task
   */
  createTask({ title, description, assignee, incNumber, crqNumber, priority, alarmIntervalMinutes }) {
    const now = new Date().toISOString();
    const task = {
      id: this.generateId(),
      title: title || 'Sin título',
      description: description || '',
      assignee: assignee || 'Sin asignar',
      incNumber: incNumber || '',
      crqNumber: crqNumber || '',
      phase: 'in_progress',
      priority: priority || 'medium',
      createdAt: now,
      startedAt: now,
      completedAt: null,
      totalElapsedMs: 0,
      lastResumedAt: now,
      alarm: {
        enabled: alarmIntervalMinutes > 0,
        intervalMinutes: alarmIntervalMinutes || 60,
        lastTriggered: null
      },
      history: [
        { from: null, to: 'in_progress', at: now, note: 'Tarea creada' }
      ]
    };

    this._tasks.unshift(task);
    this._saveToFirebase();
    return task;
  },

  /**
   * Update a task by ID
   */
  updateTask(id, updates) {
    const index = this._tasks.findIndex(t => t.id === id);
    if (index === -1) return null;

    this._tasks[index] = { ...this._tasks[index], ...updates };
    this._saveToFirebase();
    return this._tasks[index];
  },

  /**
   * Delete a task by ID
   */
  deleteTask(id) {
    this._tasks = this._tasks.filter(t => t.id !== id);
    this._saveToFirebase();
  },

  /**
   * Change the phase of a task with history tracking
   */
  changePhase(id, newPhase, note = '') {
    const index = this._tasks.findIndex(t => t.id === id);
    if (index === -1) return null;

    const task = this._tasks[index];
    const now = new Date().toISOString();
    const oldPhase = task.phase;

    // Calculate elapsed time when leaving in_progress
    if (oldPhase === 'in_progress' && task.lastResumedAt) {
      const elapsed = Date.now() - new Date(task.lastResumedAt).getTime();
      task.totalElapsedMs = (task.totalElapsedMs || 0) + elapsed;
      task.lastResumedAt = null;
    }

    // Set lastResumedAt when entering in_progress
    if (newPhase === 'in_progress') {
      task.lastResumedAt = now;
    }

    // Set completedAt when finishing
    if (newPhase === 'completed') {
      task.completedAt = now;
      task.lastResumedAt = null;
    }

    // If reactivating from completed
    if (oldPhase === 'completed' && newPhase === 'in_progress') {
      task.completedAt = null;
      task.lastResumedAt = now;
    }

    task.phase = newPhase;
    task.history = task.history || [];
    task.history.push({
      from: oldPhase,
      to: newPhase,
      at: now,
      note: note || this._getPhaseChangeNote(oldPhase, newPhase)
    });

    this._tasks[index] = task;
    this._saveToFirebase();
    return task;
  },

  _getPhaseChangeNote(from, to) {
    const labels = { in_progress: 'En Proceso', paused: 'En Pausa', completed: 'Finalizada' };
    return `Cambió de "${labels[from] || 'N/A'}" a "${labels[to]}"`;
  },

  /**
   * Get tasks filtered by phase
   */
  getTasksByPhase(phase) {
    return this._tasks.filter(t => t.phase === phase);
  },

  /**
   * Get statistics
   */
  getStats() {
    const tasks = this._tasks;
    const today = new Date().toDateString();
    return {
      total: tasks.length,
      inProgress: tasks.filter(t => t.phase === 'in_progress').length,
      paused: tasks.filter(t => t.phase === 'paused').length,
      completed: tasks.filter(t => t.phase === 'completed').length,
      completedToday: tasks.filter(t =>
        t.phase === 'completed' &&
        t.completedAt &&
        new Date(t.completedAt).toDateString() === today
      ).length
    };
  },

  /**
   * Get all unique assignees
   */
  getAssignees() {
    const assignees = [...new Set(this._tasks.map(t => t.assignee).filter(Boolean))];
    return assignees.sort();
  },

  /**
   * Get settings
   */
  getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : { defaultAlarmInterval: 60, soundEnabled: true };
    } catch (e) {
      return { defaultAlarmInterval: 60, soundEnabled: true };
    }
  },

  /**
   * Save settings
   */
  saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  /**
   * Subscribe to store changes
   */
  subscribe(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(l => l !== callback);
    };
  },

  _notify() {
    this._listeners.forEach(cb => {
      try { cb(); } catch (e) { console.error('Store listener error:', e); }
    });
  }
};
