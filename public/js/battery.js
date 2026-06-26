/**
 * @fileoverview Battery Monitoring Module
 * Tracks device battery level and charging state with threshold alerts
 * for the SOS Emergency Response App.
 */

class BatteryManager {
  constructor() {
    /** @private {BatteryManager|null} Browser battery reference */
    this._battery = null;

    /** @private {boolean} Whether the Battery API is supported */
    this._supported = false;

    /** @private {boolean} Whether init() has been called */
    this._initialized = false;

    /** @private {Function[]} Level change callbacks */
    this._levelCallbacks = [];

    /** @private {Array<{callback: Function, threshold: number, wasBelowThreshold: boolean}>} */
    this._thresholdCallbacks = [];

    /** @private {number} Test battery level */
    this._testLevel = 60; // Start at 60 for test mode to show drain
    
    /** @private {number|null} Test mode interval ID */
    this._testIntervalId = null;
  }

  /**
   * Initializes the battery monitor by requesting the Battery API.
   * Sets up event listeners for level and charging state changes.
   * Falls back gracefully if the API is unavailable.
   * @returns {Promise<void>}
   */
  async init() {
    if (this._initialized) return;
    this._initialized = true;

    try {
      if (!navigator.getBattery) {
        throw new Error('Battery API not supported');
      }

      this._battery = await navigator.getBattery();
      this._supported = true;

      // Bind event listeners for real-time updates
      this._battery.addEventListener('levelchange', () => this._handleLevelChange());
      this._battery.addEventListener('chargingchange', () => this._handleLevelChange());

      console.log('[BatteryManager] Initialized. Level:', this.getLevel() + '%');
    } catch (error) {
      console.warn('[BatteryManager] Battery API unavailable, using fallback values.', error.message);
      this._supported = false;
    }

    if (window.testMode) {
      this._startTestDrain();
    }
  }

  /**
   * Starts simulated battery drain for test mode
   * @private
   */
  _startTestDrain() {
    if (this._testIntervalId) return;
    this._testLevel = 25; // drop it to show transition easily
    this._testIntervalId = setInterval(() => {
      if (!window.testMode) {
        clearInterval(this._testIntervalId);
        this._testIntervalId = null;
        return;
      }
      this._testLevel = Math.max(0, this._testLevel - 5);
      this._handleLevelChange();
    }, 5000); // drain 5% every 5s
  }

  /**
   * Returns the current battery level as a percentage (0–100).
   * @returns {number} Battery percentage. Returns 100 if API is unsupported.
   */
  getLevel() {
    if (window.testMode) return this._testLevel;
    if (!this._supported || !this._battery) return 100;
    return Math.round(this._battery.level * 100);
  }

  /**
   * Returns whether the device is currently charging.
   * @returns {boolean} True if charging. Returns false if API is unsupported.
   */
  isCharging() {
    if (window.testMode) return false; // Simulate draining
    if (!this._supported || !this._battery) return false;
    return this._battery.charging;
  }

  /**
   * Checks if the battery level is above the given threshold.
   * @param {number} [threshold=15] - The percentage threshold to check against.
   * @returns {boolean} True if level is strictly above the threshold.
   */
  isAboveThreshold(threshold = 15) {
    return this.getLevel() > threshold;
  }

  /**
   * Registers a callback that fires on any battery level change.
   * @param {Function} callback - Receives the new level percentage.
   * @returns {void}
   */
  onLevelChange(callback) {
    if (typeof callback === 'function') {
      this._levelCallbacks.push(callback);
    }
  }

  /**
   * Registers a callback that fires when the battery crosses a threshold
   * in either direction (above → below or below → above).
   * @param {Function} callback - Receives {level, crossedBelow: boolean}.
   * @param {number} [threshold=15] - The percentage threshold.
   * @returns {void}
   */
  onThresholdCross(callback, threshold = 15) {
    if (typeof callback === 'function') {
      this._thresholdCallbacks.push({
        callback,
        threshold,
        wasBelowThreshold: this.getLevel() <= threshold
      });
    }
  }

  /**
   * Returns a human-readable battery status string.
   * @returns {string} Formatted status like '67% • Charging' or '12% • Low'.
   */
  getStatusText() {
    if (!this._supported) return 'Unknown';

    const level = this.getLevel();
    const charging = this.isCharging();

    let state;
    if (charging) {
      state = 'Charging';
    } else if (level <= 15) {
      state = 'Low';
    } else if (level <= 50) {
      state = 'Moderate';
    } else {
      state = 'Good';
    }

    return `${level}% • ${state}`;
  }

  /**
   * Returns a color string representing the battery health.
   * @returns {'green'|'yellow'|'red'} Color based on battery level.
   *   - 'green'  → above 50%
   *   - 'yellow' → between 15% and 50% (inclusive)
   *   - 'red'    → below 15%
   */
  getStatusColor() {
    const level = this.getLevel();
    if (level > 50) return 'green';
    if (level >= 15) return 'yellow';
    return 'red';
  }

  /**
   * Handles internal level/charging change events and dispatches callbacks.
   * @private
   */
  _handleLevelChange() {
    const level = this.getLevel();

    // Fire all general level-change callbacks
    this._levelCallbacks.forEach(cb => cb(level));

    // Check threshold crossings
    this._thresholdCallbacks.forEach(entry => {
      const isBelowNow = level <= entry.threshold;
      if (isBelowNow !== entry.wasBelowThreshold) {
        entry.callback({
          level,
          crossedBelow: isBelowNow
        });
        entry.wasBelowThreshold = isBelowNow;
      }
    });
  }
}

const batteryManager = new BatteryManager();
window.batteryManager = batteryManager;

