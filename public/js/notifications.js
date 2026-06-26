/**
 * @fileoverview Notification System Module
 * Provides toast notifications, browser notifications, procedural alert sounds,
 * vibration patterns, and screen flash effects for the SOS Emergency Response App.
 */

class NotificationManager {
  constructor() {
    /** @private {HTMLElement|null} Lazy-created toast container element */
    this._toastContainer = null;
  }

  /**
   * Displays a toast notification that slides in from the top-right corner.
   * Automatically removes itself after the specified duration.
   * @param {string} message - The notification message text.
   * @param {'info'|'success'|'warning'|'danger'} [type='info'] - Visual style of the toast.
   * @param {number} [duration=3000] - Time in ms before the toast auto-dismisses.
   * @returns {void}
   */
  showToast(message, type = 'info', duration = 3000) {
    this._ensureContainer();

    // Icon mapping for each toast type
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      danger: '🚨'
    };

    // Color mapping for each toast type
    const colors = {
      info: { bg: 'rgba(59, 130, 246, 0.95)', border: '#60a5fa' },
      success: { bg: 'rgba(34, 197, 94, 0.95)', border: '#4ade80' },
      warning: { bg: 'rgba(234, 179, 8, 0.95)', border: '#facc15' },
      danger: { bg: 'rgba(239, 68, 68, 0.95)', border: '#f87171' }
    };

    const color = colors[type] || colors.info;
    const icon = icons[type] || icons.info;

    // Build toast element
    const toast = document.createElement('div');
    toast.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 18px;
      margin-bottom: 10px;
      background: ${color.bg};
      border-left: 4px solid ${color.border};
      border-radius: 8px;
      color: #fff;
      font-family: 'Inter', 'Segoe UI', sans-serif;
      font-size: 14px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      transform: translateX(120%);
      transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease;
      opacity: 0;
      max-width: 380px;
      word-wrap: break-word;
      pointer-events: auto;
    `;

    // Toast icon
    const iconSpan = document.createElement('span');
    iconSpan.style.cssText = 'font-size: 18px; flex-shrink: 0;';
    iconSpan.textContent = icon;

    // Toast message
    const msgSpan = document.createElement('span');
    msgSpan.style.cssText = 'flex: 1;';
    msgSpan.textContent = message;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: rgba(255,255,255,0.8);
      font-size: 18px;
      cursor: pointer;
      padding: 0 0 0 8px;
      line-height: 1;
      flex-shrink: 0;
    `;
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this._removeToast(toast));

    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);
    toast.appendChild(closeBtn);

    this._toastContainer.appendChild(toast);

    // Slide in (trigger reflow then animate)
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    });

    // Auto-dismiss after duration
    setTimeout(() => this._removeToast(toast), duration);
  }

  /**
   * Requests browser notification permission from the user.
   * @returns {Promise<NotificationPermission>} The resulting permission state.
   */
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('[NotificationManager] Browser notifications are not supported.');
      return 'denied';
    }
    const result = await Notification.requestPermission();
    console.log('[NotificationManager] Notification permission:', result);
    return result;
  }

  /**
   * Sends a browser-level notification (requires prior permission grant).
   * @param {string} title - Notification title.
   * @param {string} body - Notification body text.
   * @param {string} [icon] - URL of the notification icon.
   * @returns {Notification|null} The created Notification, or null if unavailable.
   */
  sendBrowserNotification(title, body, icon) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      console.warn('[NotificationManager] Cannot send browser notification: permission not granted.');
      return null;
    }

    return new Notification(title, { body, icon });
  }

  /**
   * Plays a procedural alert beep pattern using the Web Audio API.
   * Pattern: beep (440Hz) → pause → beep → pause → beep.
   * No external audio files are used.
   * @returns {void}
   */
  playAlertSound() {
    let audioCtx;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[NotificationManager] Web Audio API not available.');
      return;
    }

    const beepDuration = 0.15; // seconds per beep
    const pauseDuration = 0.1; // seconds between beeps
    const frequency = 440;     // Hz (A4 note)

    // Schedule 3 beeps: beep-pause-beep-pause-beep
    for (let i = 0; i < 3; i++) {
      const startTime = audioCtx.currentTime + i * (beepDuration + pauseDuration);

      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startTime);

      // Smooth envelope to avoid clicking
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.5, startTime + 0.01);
      gainNode.gain.setValueAtTime(0.5, startTime + beepDuration - 0.01);
      gainNode.gain.linearRampToValueAtTime(0, startTime + beepDuration);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start(startTime);
      oscillator.stop(startTime + beepDuration);
    }

    // Close the audio context after all beeps finish
    const totalDuration = 3 * beepDuration + 2 * pauseDuration + 0.1;
    setTimeout(() => audioCtx.close().catch(() => {}), totalDuration * 1000);
  }

  /**
   * Triggers device vibration using the Vibration API.
   * @param {number[]} [pattern=[200, 100, 200, 100, 400]] - Vibration pattern
   *   in milliseconds (vibrate, pause, vibrate, …).
   * @returns {void}
   */
  vibrate(pattern = [200, 100, 200, 100, 400]) {
    if (!navigator.vibrate) {
      console.warn('[NotificationManager] Vibration API not supported.');
      return;
    }
    navigator.vibrate(pattern);
  }

  /**
   * Briefly flashes the entire screen red using a full-screen overlay.
   * The flash lasts approximately 300ms and fades out over 200ms.
   * @returns {void}
   */
  flashScreen() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(255, 0, 0, 0.45);
      z-index: 999999;
      pointer-events: none;
      transition: opacity 0.2s ease-out;
      opacity: 1;
    `;

    document.body.appendChild(overlay);

    // Begin fade-out after 300ms, then remove
    setTimeout(() => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 200);
    }, 300);
  }

  /**
   * Ensures the toast container exists in the DOM. Creates it lazily on first use.
   * @private
   * @returns {void}
   */
  _ensureContainer() {
    if (this._toastContainer && document.body.contains(this._toastContainer)) return;

    this._toastContainer = document.createElement('div');
    this._toastContainer.id = 'sos-toast-container';
    this._toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 100000;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      pointer-events: none;
    `;

    // Allow clicks on child toasts but not the container itself
    this._toastContainer.addEventListener('click', () => {}, true);

    document.body.appendChild(this._toastContainer);
  }

  /**
   * Smoothly removes a toast element with a slide-out animation.
   * @private
   * @param {HTMLElement} toast - The toast DOM element to remove.
   * @returns {void}
   */
  _removeToast(toast) {
    if (!toast || !toast.parentNode) return;

    toast.style.transform = 'translateX(120%)';
    toast.style.opacity = '0';

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 350);
  }
}

const notificationManager = new NotificationManager();
window.notificationManager = notificationManager;

