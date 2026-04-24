/**
 * alarms.js — Alarm & notification system for TaskFlow
 */

const Alarms = {
  _checkIntervalId: null,
  _audioContext: null,
  _permissionGranted: false,

  /**
   * Initialize the alarm system
   */
  init() {
    this.requestPermission();
    this.startChecking();
  },

  /**
   * Request notification permission
   */
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return;
    }

    if (Notification.permission === 'granted') {
      this._permissionGranted = true;
    } else if (Notification.permission !== 'denied') {
      const result = await Notification.requestPermission();
      this._permissionGranted = result === 'granted';
    }
  },

  /**
   * Start checking alarms every 30 seconds
   */
  startChecking() {
    if (this._checkIntervalId) return;
    this._checkIntervalId = setInterval(() => this.checkAlarms(), 30000);
    // Initial check
    setTimeout(() => this.checkAlarms(), 2000);
  },

  /**
   * Stop checking alarms
   */
  stopChecking() {
    if (this._checkIntervalId) {
      clearInterval(this._checkIntervalId);
      this._checkIntervalId = null;
    }
  },

  /**
   * Check all tasks for alarm triggers
   */
  checkAlarms() {
    const tasks = Store.getTasks();
    const now = Date.now();

    tasks.forEach(task => {
      if (task.phase === 'completed') return;
      if (!task.alarm || !task.alarm.enabled) return;

      const intervalMs = (task.alarm.intervalMinutes || 60) * 60 * 1000;
      const lastTriggered = task.alarm.lastTriggered
        ? new Date(task.alarm.lastTriggered).getTime()
        : new Date(task.startedAt).getTime();

      if (now - lastTriggered >= intervalMs) {
        this.triggerAlarm(task);
        // Update lastTriggered
        Store.updateTask(task.id, {
          alarm: { ...task.alarm, lastTriggered: new Date().toISOString() }
        });
      }
    });
  },

  /**
   * Trigger an alarm for a task
   */
  triggerAlarm(task) {
    const elapsed = Timer.formatTime(Timer.getElapsedMs(task), 'long');
    const phaseLabels = { in_progress: 'En Proceso', paused: 'En Pausa' };
    const phaseLabel = phaseLabels[task.phase] || task.phase;

    // Browser notification
    if (this._permissionGranted) {
      const notification = new Notification('⏰ TaskFlow — Recordatorio', {
        body: `"${task.title}" — ${phaseLabel}\nAsignado: ${task.assignee}\nTiempo: ${elapsed}`,
        icon: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%236366f1"/><text x="50" y="65" text-anchor="middle" fill="white" font-size="50" font-family="sans-serif">TF</text></svg>'),
        tag: task.id,
        requireInteraction: true
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        // Highlight the task in UI
        if (typeof UI !== 'undefined' && UI.highlightTask) {
          UI.highlightTask(task.id);
        }
      };
    }

    // Play sound
    this.playAlarmSound();

    // Visual indicator
    this.showVisualAlarm(task);
  },

  /**
   * Play alarm sound using Web Audio API
   */
  playAlarmSound() {
    const settings = Store.getSettings();
    if (!settings.soundEnabled) return;

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();

      // Create a pleasant notification sound
      const playTone = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      playTone(587.33, now, 0.2);        // D5
      playTone(739.99, now + 0.2, 0.2);  // F#5
      playTone(880, now + 0.4, 0.3);     // A5

    } catch (e) {
      console.warn('Could not play alarm sound:', e);
    }
  },

  /**
   * Show visual alarm indicator
   */
  showVisualAlarm(task) {
    const card = document.querySelector(`[data-task-id="${task.id}"]`);
    if (card) {
      card.classList.add('alarm-active');
      setTimeout(() => card.classList.remove('alarm-active'), 10000);
    }

    // Show toast notification
    if (typeof UI !== 'undefined' && UI.showToast) {
      const elapsed = Timer.formatTime(Timer.getElapsedMs(task), 'long');
      UI.showToast(`⏰ "${task.title}" — ${elapsed}`, 'warning', 8000);
    }
  },

  /**
   * Snooze an alarm (delay by 15 minutes)
   */
  snoozeAlarm(taskId, minutes = 15) {
    const task = Store.getTask(taskId);
    if (!task) return;

    const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    Store.updateTask(taskId, {
      alarm: { ...task.alarm, lastTriggered: snoozeUntil }
    });

    if (typeof UI !== 'undefined' && UI.showToast) {
      UI.showToast(`Alarma pospuesta ${minutes} min para "${task.title}"`, 'info');
    }
  },

  /**
   * Toggle alarm for a task
   */
  toggleAlarm(taskId) {
    const task = Store.getTask(taskId);
    if (!task) return;

    Store.updateTask(taskId, {
      alarm: { ...task.alarm, enabled: !task.alarm.enabled }
    });
  },

  /**
   * Update alarm interval for a task
   */
  setAlarmInterval(taskId, minutes) {
    const task = Store.getTask(taskId);
    if (!task) return;

    Store.updateTask(taskId, {
      alarm: { ...task.alarm, intervalMinutes: minutes, enabled: true }
    });
  }
};
