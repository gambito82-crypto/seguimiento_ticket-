/**
 * timer.js — Real-time timer management for TaskFlow
 */

const Timer = {
  _intervalId: null,
  _callbacks: [],

  /**
   * Start the global timer tick (updates every second)
   */
  start() {
    if (this._intervalId) return;
    this._intervalId = setInterval(() => {
      this._callbacks.forEach(cb => {
        try { cb(); } catch (e) { console.error('Timer callback error:', e); }
      });
    }, 1000);
  },

  /**
   * Stop the global timer
   */
  stop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  },

  /**
   * Subscribe to timer ticks
   */
  onTick(callback) {
    this._callbacks.push(callback);
    return () => {
      this._callbacks = this._callbacks.filter(cb => cb !== callback);
    };
  },

  /**
   * Calculate the current elapsed time for a task in milliseconds
   */
  getElapsedMs(task) {
    if (!task) return 0;
    let total = task.totalElapsedMs || 0;

    // If task is in progress and has a lastResumedAt, add the live elapsed
    if (task.phase === 'in_progress' && task.lastResumedAt) {
      total += Date.now() - new Date(task.lastResumedAt).getTime();
    }

    return Math.max(0, total);
  },

  /**
   * Format milliseconds to human-readable string
   * Short format: "02:35:12"
   * Long format: "2h 35m 12s"
   */
  formatTime(ms, format = 'short') {
    if (ms <= 0) return format === 'short' ? '00:00:00' : '0s';

    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (format === 'long') {
      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);
      return parts.join(' ');
    }

    // Short format
    if (days > 0) {
      return `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  },

  /**
   * Format a date to relative time (e.g., "hace 5 min")
   */
  formatRelativeTime(dateStr) {
    if (!dateStr) return 'N/A';
    const diff = Date.now() - new Date(dateStr).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Justo ahora';
    if (minutes < 60) return `Hace ${minutes} min`;
    if (hours < 24) return `Hace ${hours}h`;
    if (days < 7) return `Hace ${days}d`;
    return new Date(dateStr).toLocaleDateString('es-CL');
  },

  /**
   * Format a date to a nice readable string
   */
  formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};
