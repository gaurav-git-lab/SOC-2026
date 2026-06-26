/**
 * @fileoverview Microphone Capture & Waveform Visualization Module
 * Handles live microphone input, audio analysis, and real-time
 * bar-style waveform rendering for the SOS Emergency Response App.
 */

class AudioManager {
  constructor() {
    /** @private {MediaStream|null} Active microphone stream */
    this._stream = null;

    /** @private {AudioContext|null} Web Audio API context */
    this._audioContext = null;

    /** @private {AnalyserNode|null} Frequency/time-domain analyser */
    this._analyser = null;

    /** @private {number|null} requestAnimationFrame ID for waveform loop */
    this._animationFrameId = null;

    /** @private {number|null} Timestamp when capture started (ms) */
    this._startTime = null;

    /** @private {boolean} Whether the microphone is actively capturing */
    this._active = false;
  }

  /**
   * Starts microphone capture and initializes the audio processing pipeline.
   * Creates an AudioContext, connects the mic stream to an AnalyserNode.
   * @returns {Promise<void>}
   * @throws {Error} If microphone access is denied or unavailable.
   */
  async startCapture() {
    if (this._active) {
      console.warn('[AudioManager] Capture is already active.');
      return;
    }

    try {
      // Request microphone access
      this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create audio processing pipeline
      this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this._audioContext.createMediaStreamSource(this._stream);

      // Configure analyser for waveform visualization
      this._analyser = this._audioContext.createAnalyser();
      this._analyser.fftSize = 256;
      this._analyser.smoothingTimeConstant = 0.75;

      source.connect(this._analyser);

      this._startTime = Date.now();
      this._active = true;

      console.log('[AudioManager] Microphone capture started.');
    } catch (error) {
      console.error('[AudioManager] Failed to start capture:', error.message);
      throw error;
    }
  }

  /**
   * Stops microphone capture and tears down all audio resources.
   * Stops all media tracks, closes the AudioContext, and cancels any
   * active waveform animation.
   * @returns {void}
   */
  stopCapture() {
    // Stop all microphone tracks
    if (this._stream) {
      this._stream.getTracks().forEach(track => track.stop());
      this._stream = null;
    }

    // Close the audio context
    if (this._audioContext) {
      this._audioContext.close().catch(() => {});
      this._audioContext = null;
    }

    // Cancel waveform rendering
    this.stopWaveform();

    this._analyser = null;
    this._startTime = null;
    this._active = false;

    console.log('[AudioManager] Microphone capture stopped.');
  }

  /**
   * Returns whether the microphone is actively capturing audio.
   * @returns {boolean}
   */
  isActive() {
    return this._active;
  }

  /**
   * Returns the AnalyserNode for external waveform or frequency analysis.
   * @returns {AnalyserNode|null} The analyser node, or null if not capturing.
   */
  getAnalyserNode() {
    return this._analyser;
  }

  /**
   * Renders a real-time bar-style waveform visualization on a canvas element.
   * Uses requestAnimationFrame for smooth 60fps rendering.
   * The visualization uses frequency data to create a professional audio bar display.
   * @param {HTMLCanvasElement} canvasElement - The canvas to draw on.
   * @returns {void}
   */
  drawWaveform(canvasElement) {
    if (!this._analyser || !canvasElement) {
      console.warn('[AudioManager] Cannot draw waveform: analyser or canvas missing.');
      return;
    }

    const ctx = canvasElement.getContext('2d');
    const analyser = this._analyser;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    /**
     * Internal render loop — draws frequency bars each frame.
     */
    const render = () => {
      this._animationFrameId = requestAnimationFrame(render);

      analyser.getByteFrequencyData(dataArray);

      const width = canvasElement.width;
      const height = canvasElement.height;

      // Clear canvas with dark background
      ctx.fillStyle = 'rgba(15, 15, 25, 0.92)';
      ctx.fillRect(0, 0, width, height);

      // Calculate bar dimensions
      const barCount = Math.min(bufferLength, 64);
      const gap = 2;
      const barWidth = (width - gap * (barCount - 1)) / barCount;

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i] / 255;
        const barHeight = value * height * 0.85;

        const x = i * (barWidth + gap);
        const y = height - barHeight;

        // Dynamic gradient based on bar intensity
        const hue = 200 + value * 60; // Blue → Cyan shift
        const saturation = 70 + value * 30;
        const lightness = 40 + value * 25;

        // Main bar
        const gradient = ctx.createLinearGradient(x, y, x, height);
        gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness}%, 1)`);
        gradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness - 15}%, 0.6)`);

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, barHeight);

        // Glow cap on top of each bar
        ctx.fillStyle = `hsla(${hue}, 100%, 75%, ${0.3 + value * 0.7})`;
        ctx.fillRect(x, y, barWidth, Math.max(2, barHeight * 0.05));

        // Reflection below (subtle mirror effect)
        ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.08)`;
        ctx.fillRect(x, height, barWidth, -(barHeight * 0.15));
      }
    };

    // Cancel any existing loop before starting a new one
    this.stopWaveform();
    render();
  }

  /**
   * Stops the waveform animation frame loop.
   * @returns {void}
   */
  stopWaveform() {
    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
  }

  /**
   * Returns the elapsed recording duration in seconds.
   * @returns {number} Duration in seconds, or 0 if not recording.
   */
  getDuration() {
    if (!this._startTime || !this._active) return 0;
    return Math.floor((Date.now() - this._startTime) / 1000);
  }

  /**
   * Returns a formatted status string showing mic state and duration.
   * @returns {string} E.g. '🎙️ Mic Live — 2m 35s' or '🔇 Mic Off'.
   */
  getStatusText() {
    if (!this._active) return '🔇 Mic Off';

    const totalSeconds = this.getDuration();
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `🎙️ Mic Live — ${minutes}m ${seconds}s`;
  }
}

const audioManager = new AudioManager();
window.audioManager = audioManager;

