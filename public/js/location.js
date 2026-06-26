/**
 * @fileoverview GPS Location Tracking Module
 * Provides real-time geolocation tracking with callback support
 * and Google Maps integration for the SOS Emergency Response App.
 */

class LocationManager {
  constructor() {
    /** @private {number|null} Active watchPosition ID */
    this._watchId = null;

    /** @private {{lat: number, lng: number, accuracy: number, timestamp: number}|null} */
    this._currentPosition = null;

    /** @private {Function[]} Position update callbacks */
    this._callbacks = [];

    /** @private {Function[]} Error callbacks */
    this._errorCallbacks = [];

    /** @private {Object} Geolocation options */
    this._options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    /** @private {number|null} Test mode interval ID */
    this._testIntervalId = null;

    /** @private {Object} Base test location (Delhi NCR) */
    this._testBaseLocation = { lat: 28.6139, lng: 77.2090 };
  }

  /**
   * Starts continuous GPS tracking using the browser's Geolocation API.
   * Position updates are forwarded to all registered callbacks.
   * @returns {void}
   */
  startTracking() {
    if (this._watchId !== null || this._testIntervalId !== null) {
      console.warn('[LocationManager] Tracking is already active.');
      return;
    }

    if (window.testMode) {
      console.log('[LocationManager] Test Mode: Simulating GPS tracking.');
      this._simulateTestTracking();
      return;
    }

    if (!navigator.geolocation) {
      const error = new Error('Geolocation is not supported by this browser.');
      this._errorCallbacks.forEach(cb => cb(error));
      return;
    }

    this._watchId = navigator.geolocation.watchPosition(
      (position) => this._handlePosition(position),
      (error) => this._handleError(error),
      this._options
    );

    console.log('[LocationManager] Tracking started.');
  }

  /**
   * Stops the active GPS tracking watch.
   * @returns {void}
   */
  stopTracking() {
    if (this._watchId !== null) {
      navigator.geolocation.clearWatch(this._watchId);
      this._watchId = null;
      console.log('[LocationManager] Tracking stopped.');
    }
    if (this._testIntervalId !== null) {
      clearInterval(this._testIntervalId);
      this._testIntervalId = null;
      console.log('[LocationManager] Test tracking stopped.');
    }
  }

  /**
   * Requests the device's current position as a one-shot query.
   * @returns {Promise<{lat: number, lng: number, accuracy: number, timestamp: number}>}
   */
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (window.testMode) {
        const mockPos = {
          lat: this._testBaseLocation.lat,
          lng: this._testBaseLocation.lng,
          accuracy: 5 + Math.random() * 15,
          timestamp: Date.now()
        };
        this._currentPosition = mockPos;
        resolve(mockPos);
        return;
      }

      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = this._formatPosition(position);
          this._currentPosition = pos;
          resolve(pos);
        },
        (error) => reject(error),
        this._options
      );
    });
  }

  /**
   * The most recently tracked position, or null if none acquired yet.
   * @returns {{lat: number, lng: number, accuracy: number, timestamp: number}|null}
   */
  get currentPosition() {
    return this._currentPosition;
  }

  /**
   * Generates a Google Maps URL pinpointing the current tracked location.
   * @returns {string|null} Google Maps URL, or null if no position is available.
   */
  getMapLink() {
    if (!this._currentPosition) {
      return null;
    }
    const { lat, lng } = this._currentPosition;
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  /**
   * Registers a callback to be invoked on every position update.
   * @param {Function} callback - Receives {lat, lng, accuracy, timestamp}.
   * @returns {void}
   */
  onUpdate(callback) {
    if (typeof callback === 'function') {
      this._callbacks.push(callback);
    }
  }

  /**
   * Registers a callback to be invoked on geolocation errors.
   * @param {Function} callback - Receives a GeolocationPositionError or Error.
   * @returns {void}
   */
  onError(callback) {
    if (typeof callback === 'function') {
      this._errorCallbacks.push(callback);
    }
  }

  /**
   * Formats a raw GeolocationPosition into a clean object.
   * @private
   * @param {GeolocationPosition} position - Raw browser position.
   * @returns {{lat: number, lng: number, accuracy: number, timestamp: number}}
   */
  _formatPosition(position) {
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp
    };
  }

  /**
   * Internal handler for successful position updates.
   * @private
   * @param {GeolocationPosition} position - Raw browser position.
   */
  _handlePosition(position) {
    this._currentPosition = this._formatPosition(position);
    this._callbacks.forEach(cb => cb(this._currentPosition));
  }

  /**
   * Internal handler for geolocation errors.
   * @private
   * @param {GeolocationPositionError} error
   */
  _handleError(error) {
    console.error('[LocationManager] Error:', error.message);
    this._errorCallbacks.forEach(cb => cb(error));
  }

  /**
   * Simulates tracking movements for Test Mode.
   * @private
   */
  _simulateTestTracking() {
    this._testIntervalId = setInterval(() => {
      // Small random movements
      this._testBaseLocation.lat += (Math.random() - 0.5) * 0.0001;
      this._testBaseLocation.lng += (Math.random() - 0.5) * 0.0001;
      
      this._currentPosition = {
        lat: this._testBaseLocation.lat,
        lng: this._testBaseLocation.lng,
        accuracy: 5 + Math.random() * 10,
        timestamp: Date.now()
      };
      
      this._callbacks.forEach(cb => cb(this._currentPosition));
    }, 2000);
  }
}

const locationManager = new LocationManager();
window.locationManager = locationManager;


