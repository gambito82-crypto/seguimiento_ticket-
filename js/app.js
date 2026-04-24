/**
 * app.js — Main application initialization for TaskFlow
 */

const App = {
  init() {
    // Initialize store (connects to Firebase)
    Store.init();

    // Initialize UI
    UI.init();

    // Start timer
    Timer.start();

    // Initialize alarms
    Alarms.init();

    // Timer tick updates
    Timer.onTick(() => {
      UI.updateTimers();
      UI.updateClock();
    });

    // Store change listener (re-render on Firebase updates)
    Store.subscribe(() => {
      UI.renderKanban();
    });

    // Initial clock update
    UI.updateClock();

    console.log('🚀 TaskFlow initialized (Firebase mode)');
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
