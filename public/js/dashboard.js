/**
 * Dashboard Manager - Handles the UI rendering and updates for the emergency progress dashboard
 */
class DashboardManager {
    constructor() {
        this.container = null;
        this.timerInterval = null;
        this.elapsedSeconds = 0;
        this.cancelCallback = null;
        this.isHoldingCancel = false;
        this.cancelHoldTimer = null;
        this.cancelHoldDuration = 3000; // 3 seconds hold
        this.cancelHoldProgress = 0;
    }

    /**
     * Build the dashboard DOM structure
     * @param {HTMLElement} container
     */
    init(container) {
        if (!container) return;
        this.container = container;
        this.elapsedSeconds = 0;

        container.innerHTML = `
            <div class="dashboard-container">
                <!-- Top Summary Header -->
                <div class="dashboard-header">
                    <div class="dashboard-header-info">
                        <div class="dashboard-title-row">
                            <div class="dashboard-pulse-dot"></div>
                            <span class="dashboard-title">Emergency Broadcast Active</span>
                        </div>
                        <span class="dashboard-timer" id="dash-elapsed-timer">Active for 0s</span>
                    </div>
                    <div class="dashboard-summary-stats" id="dash-summary-stats">
                        0/0 contacts alerted • 0 police alerted
                    </div>
                </div>

                <!-- Main Content Grid -->
                <div class="dashboard-grid">
                    <!-- Left Column: Timeline -->
                    <div class="dashboard-column scrollable">
                        <div class="card timeline-card">
                            <span class="dashboard-card-title">🚨 Broadcast Event Feed</span>
                            <div class="timeline" id="dash-timeline-feed">
                                <!-- Events injected dynamically -->
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: Stats & Status Widgets -->
                    <div class="dashboard-column scrollable">
                        <!-- Contacts widget -->
                        <div class="card">
                            <span class="dashboard-card-title">👥 Contact Alert Status</span>
                            <div class="contacts-status-list" id="dash-contacts-list">
                                <!-- Contacts injected dynamically -->
                            </div>
                        </div>

                        <!-- Police Station Cascade Widget -->
                        <div class="card">
                            <span class="dashboard-card-title">🚔 Police Cascading System</span>
                            <div class="police-cascade">
                                <div class="escalation-timer-container">
                                    <span class="escalation-timer-label">Escalation Timer:</span>
                                    <span class="escalation-timer-value" id="dash-escalation-timer">BATCH AWAITING</span>
                                </div>
                                <div class="escalation-progress-bar">
                                    <div class="escalation-progress-fill" id="dash-escalation-bar"></div>
                                </div>
                                <div id="dash-police-cascade-batches" style="margin-top: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3);">
                                    <!-- Police batches injected dynamically -->
                                </div>
                            </div>
                        </div>

                        <!-- Location GPS Widget -->
                        <div class="card">
                            <span class="dashboard-card-title">📍 GPS Tracking</span>
                            <div class="coords-row" style="margin-bottom: 10px;">
                                <span class="coords-text" id="dash-gps-coords">Acquiring coordinates...</span>
                                <span class="eta-text" id="dash-responder-eta" style="color:var(--success-green); font-weight:bold; display:none; margin-left:auto;">ETA: -- mins</span>
                            </div>
                            <div class="live-map-container" style="position: relative; width: 100%; height: 200px; background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; margin-bottom: 10px;">
                                <canvas id="live-map-canvas" width="400" height="200" style="width: 100%; height: 100%; display: block;"></canvas>
                                <div class="radar-sweep" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: conic-gradient(from 0deg, transparent 70%, rgba(48, 209, 88, 0.4) 100%); animation: sweep 4s linear infinite; border-radius: 50%;"></div>
                            </div>
                            <a href="#" target="_blank" class="btn btn-secondary" id="dash-gps-maplink" style="display: none; width:100%;">
                                Open in Google Maps
                            </a>
                        </div>

                        <!-- Live Audio Widget -->
                        <div class="card">
                            <span class="dashboard-card-title">🎙️ Audio Broadcast</span>
                            <div class="audio-widget-container">
                                <div class="audio-status-row">
                                    <span class="audio-status-text" id="dash-audio-status">Initializing mic...</span>
                                    <div class="audio-recording-dot" id="dash-audio-dot" style="display: none;"></div>
                                </div>
                                <canvas class="waveform-canvas" id="audio-waveform-canvas"></canvas>
                            </div>
                        </div>

                        <!-- Battery Widget -->
                        <div class="card">
                            <span class="dashboard-card-title">🔋 Power Monitor</span>
                            <div class="battery-row">
                                <span class="battery-label" id="dash-battery-label">Device Battery:</span>
                                <span class="battery-percent" id="dash-battery-value">--%</span>
                            </div>
                            <div class="battery-banner" id="dash-battery-low-warning" style="display: none;">
                                ⚠️ Microphone disabled below 15% battery
                            </div>
                        </div>

                        <!-- Medical Overview Card -->
                        <div id="dash-medical-card-container">
                            <!-- Injected dynamically -->
                        </div>
                    </div>
                </div>

                <!-- Footer Actions -->
                <div class="dashboard-footer">
                    <button class="btn btn-primary triage-nav-btn" id="dash-goto-triage">
                        🤖 Talk to AI Medical Triage
                    </button>
                    
                    <!-- Hold to Cancel Confirm Button -->
                    <div class="hold-cancel-container">
                        <div class="hold-cancel-progress" id="dash-cancel-progress"></div>
                        <button class="hold-cancel-btn" id="dash-cancel-btn">
                            🛑 Hold to CANCEL Emergency (3s)
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Bind chat navigation
        document.getElementById('dash-goto-triage').addEventListener('click', () => {
            if (window.app) window.app.navigateTo('ai-chat');
        });

        // Initialize sub-components
        this._renderContacts();
        this._renderMedical();
        this._setupHoldToCancel();
        this._startLiveMapEngine();
    }

    /**
     * Toggle visibility
     */
    show() {
        if (this.container) this.container.style.display = 'block';
    }

    hide() {
        if (this.container) this.container.style.display = 'none';
    }

    /**
     * Start elapsed time timer
     */
    startTimer() {
        this.elapsedSeconds = 0;
        clearInterval(this.timerInterval);
        
        const timerEl = document.getElementById('dash-elapsed-timer');
        
        this.timerInterval = setInterval(() => {
            this.elapsedSeconds++;
            const mins = Math.floor(this.elapsedSeconds / 60);
            const secs = this.elapsedSeconds % 60;
            if (timerEl) {
                timerEl.textContent = `Active for ${mins > 0 ? `${mins}m ` : ''}${secs}s`;
            }
        }, 1000);
    }

    /**
     * Stop timer
     */
    stopTimer() {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
    }

    /**
     * Add timeline feed item
     */
    addTimelineEvent(icon, message, status = 'success') {
        const timeline = document.getElementById('dash-timeline-feed');
        if (!timeline) return;

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const eventEl = document.createElement('div');
        eventEl.className = `timeline-event ${status}`;
        eventEl.innerHTML = `
            <div class="timeline-dot">${icon}</div>
            <div class="timeline-header">
                <span class="timeline-msg">${message}</span>
                <span class="timeline-time">${timeStr}</span>
            </div>
        `;

        timeline.appendChild(eventEl);
        timeline.scrollTop = timeline.scrollHeight;
    }

    /**
     * Update contacts cards list UI
     * @private
     */
    _renderContacts() {
        const list = document.getElementById('dash-contacts-list');
        if (list && window.contactsManager) {
            list.innerHTML = window.contactsManager.getAlertStatusCards();
        }
    }

    /**
     * Render medical summary card
     * @private
     */
    _renderMedical() {
        const container = document.getElementById('dash-medical-card-container');
        if (container && window.profileManager) {
            window.profileManager.renderMedicalCard(container);
        }
    }

    /**
     * Update individual contact status
     */
    updateContactStatus(contactId, status, timestamp) {
        const card = document.getElementById(`contact-card-${contactId}`);
        const indicator = document.getElementById(`contact-status-${contactId}`);
        if (!card || !indicator) return;

        indicator.className = `contact-status-indicator ${status}`;
        
        let icon = '⏳';
        let label = 'Queued';
        
        if (status === 'sent') {
            icon = '📨';
            label = 'Sent';
        } else if (status === 'delivered') {
            icon = '✅';
            label = 'Delivered';
        }

        indicator.innerHTML = `
            <span class="status-icon">${icon}</span>
            <span class="status-label">${label}</span>
        `;
    }

    /**
     * Render a new police batch cascade panel
     */
    showBatch(batchIndex, stations) {
        const cascadeContainer = document.getElementById('dash-police-cascade-batches');
        if (!cascadeContainer) return;

        // Dim previous batches
        cascadeContainer.querySelectorAll('.police-batch').forEach(b => {
            b.classList.remove('current-batch');
            b.style.opacity = '0.5';
        });

        // Add visual separator if it's not the first batch
        if (batchIndex > 0) {
            const separator = document.createElement('div');
            separator.className = 'batch-separator';
            separator.innerHTML = `⬇️ Escalated Proximity Batch ⬇️`;
            cascadeContainer.appendChild(separator);
        }

        const batchDiv = document.createElement('div');
        batchDiv.className = 'police-batch current-batch';
        batchDiv.id = `police-batch-${batchIndex}`;
        
        const stationCardsHtml = stations.map(s => `
            <div class="police-station-card" id="police-station-${s.id}">
                <span class="police-station-name">${s.name}</span>
                <span class="police-station-distance">${s.distance.toFixed(1)} km</span>
                <span class="badge badge-pending" id="police-status-badge-${s.id}">Pending</span>
            </div>
        `).join('');

        batchDiv.innerHTML = `
            <div class="police-batch-header">
                <span>Batch ${batchIndex + 1} (Nearest Stations)</span>
                <span class="badge badge-danger">Alerting</span>
            </div>
            <div class="police-stations-list">
                ${stationCardsHtml}
            </div>
        `;

        cascadeContainer.appendChild(batchDiv);
        cascadeContainer.scrollTop = cascadeContainer.scrollHeight;
    }

    /**
     * Update individual police station status
     */
    updatePoliceStation(stationId, status) {
        const badge = document.getElementById(`police-status-badge-${stationId}`);
        if (!badge) return;

        badge.className = 'badge';
        
        if (status === 'queued') {
            badge.classList.add('badge-pending');
            badge.textContent = 'Pending';
        } else if (status === 'alerting') {
            badge.classList.add('badge-warning');
            badge.textContent = 'Contacted';
        } else if (status === 'awaiting') {
            badge.classList.add('badge-warning');
            badge.textContent = 'Acknowledged';
        } else if (status === 'responded') {
            badge.className = 'badge badge-success';
            badge.textContent = 'Response Team En Route';
            
            // Show ETA when response team en route
            const etaEl = document.getElementById('dash-responder-eta');
            if (etaEl) {
                etaEl.style.display = 'inline-block';
                const randomEta = Math.floor(Math.random() * 5) + 3; // 3 to 7 mins
                etaEl.textContent = `ETA: ${randomEta} mins`;
            }
        } else if (status === 'no-response') {
            badge.className = 'badge badge-danger';
            badge.textContent = 'No Resp';
        }
    }

    /**
     * Update escalation timer values
     */
    updateEscalationTimer(secondsLeft, totalSeconds) {
        const timerVal = document.getElementById('dash-escalation-timer');
        const timerFill = document.getElementById('dash-escalation-bar');

        if (timerVal) {
            if (secondsLeft <= 0) {
                timerVal.textContent = 'ESCALATING';
            } else {
                timerVal.textContent = `${secondsLeft}s left`;
            }
        }

        if (timerFill) {
            const pct = (secondsLeft / totalSeconds) * 100;
            timerFill.style.width = `${pct}%`;
        }
    }

    /**
     * Update GPS widgets
     */
    updateGPS(lat, lng, accuracy, timestamp) {
        const coordsEl = document.getElementById('dash-gps-coords');
        const linkEl = document.getElementById('dash-gps-maplink');

        if (coordsEl) {
            coordsEl.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)} (±${Math.round(accuracy)}m)`;
        }

        if (linkEl) {
            linkEl.href = `https://www.google.com/maps?q=${lat},${lng}`;
            linkEl.style.display = 'inline-flex';
        }
    }

    /**
     * Update microphone capture status
     */
    updateAudioStatus(isActive, duration, recipientCount) {
        const statusEl = document.getElementById('dash-audio-status');
        const dotEl = document.getElementById('dash-audio-dot');

        if (statusEl) {
            if (isActive) {
                const mins = Math.floor(duration / 60);
                const secs = Math.floor(duration % 60);
                statusEl.textContent = `🎙️ Mic Live • ${mins}:${secs < 10 ? '0' : ''}${secs} (${recipientCount} links)`;
            } else {
                statusEl.textContent = `🔇 Microphone Off`;
            }
        }

        if (dotEl) {
            dotEl.style.display = isActive ? 'block' : 'none';
        }
    }

    /**
     * Update battery metrics
     */
    updateBatteryStatus(level, isCharging) {
        const valueEl = document.getElementById('dash-battery-value');
        const labelEl = document.getElementById('dash-battery-label');
        const warningEl = document.getElementById('dash-battery-low-warning');

        if (valueEl) {
            valueEl.textContent = `${level}%`;
            // Color code
            if (level > 50) {
                valueEl.style.color = 'var(--success-green)';
            } else if (level > 15) {
                valueEl.style.color = 'var(--warning-yellow)';
            } else {
                valueEl.style.color = 'var(--emergency-red)';
            }
        }

        if (labelEl) {
            labelEl.textContent = isCharging ? 'Device Charging:' : 'Device Battery:';
        }

        if (warningEl) {
            warningEl.style.display = level <= 15 ? 'flex' : 'none';
        }
    }

    /**
     * Update stats bar totals
     */
    updateProgressSummary(stats) {
        const summary = document.getElementById('dash-summary-stats');
        if (summary) {
            summary.textContent = `${stats.contactsAlerted}/${stats.totalContacts} contacts alerted • ${stats.stationsResponded} responded`;
        }
    }

    /**
     * Cancel triggers listener logic (requires 3s continuous hold)
     */
    onCancelEmergency(callback) {
        this.cancelCallback = callback;
    }

    /**
     * Set up mouse/touch event listeners for the Hold to Cancel button
     * @private
     */
    _setupHoldToCancel() {
        const cancelBtn = document.getElementById('dash-cancel-btn');
        const progressFill = document.getElementById('dash-cancel-progress');
        if (!cancelBtn || !progressFill) return;

        const startCancelHold = (e) => {
            e.preventDefault();
            if (this.isHoldingCancel) return;
            
            this.isHoldingCancel = true;
            cancelBtn.textContent = 'Hold tightly to cancel...';
            this.cancelHoldProgress = 0;

            const startTime = Date.now();

            this.cancelHoldTimer = setInterval(() => {
                const elapsed = Date.now() - startTime;
                this.cancelHoldProgress = Math.min((elapsed / this.cancelHoldDuration) * 100, 100);
                progressFill.style.width = `${this.cancelHoldProgress}%`;

                if (elapsed >= this.cancelHoldDuration) {
                    clearInterval(this.cancelHoldTimer);
                    this.isHoldingCancel = false;
                    progressFill.style.width = '0%';
                    cancelBtn.textContent = 'Emergency Cancelled';
                    if (this.cancelCallback) {
                        this.cancelCallback();
                    }
                }
            }, 50);
        };

        const stopCancelHold = () => {
            if (!this.isHoldingCancel) return;
            
            clearInterval(this.cancelHoldTimer);
            this.isHoldingCancel = false;
            this.cancelHoldProgress = 0;
            progressFill.style.width = '0%';
            cancelBtn.textContent = '🛑 Hold to CANCEL Emergency (3s)';
        };

        // Touch devices
        cancelBtn.addEventListener('touchstart', startCancelHold, { passive: false });
        cancelBtn.addEventListener('touchend', stopCancelHold);
        cancelBtn.addEventListener('touchcancel', stopCancelHold);

        // Desktop mouse
        cancelBtn.addEventListener('mousedown', startCancelHold);
        cancelBtn.addEventListener('mouseup', stopCancelHold);
        cancelBtn.addEventListener('mouseleave', stopCancelHold);
    }

    /**
     * Start the live map radar engine
     */
    _startLiveMapEngine() {
        const canvas = document.getElementById('live-map-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let frame = 0;
        
        const draw = () => {
            if (this.container && this.container.style.display === 'none') {
                requestAnimationFrame(draw);
                return;
            }

            const w = canvas.width;
            const h = canvas.height;

            // Clear
            ctx.clearRect(0, 0, w, h);

            // Draw Grid
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            for (let x = 0; x <= w; x += 20) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
            }
            for (let y = 0; y <= h; y += 20) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }

            // Draw center user dot
            const centerX = w / 2;
            const centerY = h / 2;
            
            // Pulse circle
            const pulseRadius = (frame % 60) / 60 * 40;
            ctx.beginPath();
            ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 45, 85, ${1 - pulseRadius/40})`;
            ctx.fill();

            // Inner dot
            ctx.beginPath();
            ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#ff2d55';
            ctx.fill();

            // Check if any police responded
            let responderActive = false;
            if (window.policeManager) {
                const statuses = window.policeManager.getAllStatuses();
                for (const status of statuses.values()) {
                    if (status === 'responded') responderActive = true;
                }
            }

            // Draw incoming responder if active
            if (responderActive) {
                // Animate responder moving towards center from top right
                const progress = (frame % 200) / 200; // Loops every 200 frames for demo
                const startX = w - 20;
                const startY = 20;
                
                const currentX = startX - (startX - centerX) * progress;
                const currentY = startY - (startY - centerY) * progress;

                // Draw route line
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(centerX, centerY);
                ctx.strokeStyle = 'rgba(48, 209, 88, 0.4)';
                ctx.setLineDash([5, 5]);
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.setLineDash([]); // reset

                // Draw responder dot
                ctx.beginPath();
                ctx.arc(currentX, currentY, 8, 0, Math.PI * 2);
                ctx.fillStyle = '#30d158'; // Green
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            frame++;
            requestAnimationFrame(draw);
        };

        draw();
    }
}

// Global instance
const dashboardManager = new DashboardManager();
window.dashboardManager = dashboardManager;
