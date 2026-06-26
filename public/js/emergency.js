/**
 * Emergency Manager - Orchestrates the entire emergency activation flow
 * Coordinates all modules: location, battery, audio, contacts, police, dashboard, AI triage
 */
class EmergencyManager {
    constructor() {
        this.isActive = false;
        this.isCountingDown = false;
        this.countdownTimer = null;
        this.countdownValue = 3;
        this.escalationTimer = null;
        this.escalationInterval = 30; // seconds between police batch escalations
        this.activationTime = null;
        this.elapsedInterval = null;
    }

    /**
     * Starts the emergency countdown (3 seconds with cancel option)
     */
    startCountdown() {
        if (this.isActive || this.isCountingDown) return;

        this.isCountingDown = true;
        this.countdownValue = 3;

        const overlay = document.getElementById('countdown-overlay');
        const numberEl = document.getElementById('countdown-number');
        const cancelBtn = document.getElementById('cancel-countdown-btn');

        overlay.classList.add('active');
        numberEl.textContent = this.countdownValue;
        numberEl.classList.add('animate-countdown');

        // Play alert sound
        if (window.notificationManager) {
            window.notificationManager.playAlertSound();
            window.notificationManager.vibrate([200, 100, 200, 100, 400]);
        }

        // Cancel button handler
        const cancelHandler = () => {
            this.cancelCountdown();
            cancelBtn.removeEventListener('click', cancelHandler);
        };
        cancelBtn.addEventListener('click', cancelHandler);

        // Countdown tick
        this.countdownTimer = setInterval(() => {
            this.countdownValue--;
            if (this.countdownValue > 0) {
                numberEl.textContent = this.countdownValue;
                numberEl.classList.remove('animate-countdown');
                void numberEl.offsetWidth; // force reflow
                numberEl.classList.add('animate-countdown');
                if (window.notificationManager) {
                    window.notificationManager.vibrate([200]);
                }
            } else {
                clearInterval(this.countdownTimer);
                this.countdownTimer = null;
                overlay.classList.remove('active');
                this.isCountingDown = false;
                cancelBtn.removeEventListener('click', cancelHandler);
                this.activate();
            }
        }, 1000);
    }

    /**
     * Cancels the countdown before emergency activates
     */
    cancelCountdown() {
        if (!this.isCountingDown) return;

        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.isCountingDown = false;

        const overlay = document.getElementById('countdown-overlay');
        overlay.classList.remove('active');

        if (window.notificationManager) {
            window.notificationManager.showToast('Emergency cancelled', 'info');
        }
    }

    /**
     * Activates the full emergency sequence
     */
    async activate() {
        if (this.isActive) return;
        this.isActive = true;
        this.activationTime = new Date();

        // Flash screen red
        if (window.notificationManager) {
            window.notificationManager.flashScreen();
            window.notificationManager.vibrate([500, 200, 500, 200, 500]);
        }

        // Switch to dashboard view
        if (window.app) {
            window.app.navigateTo('dashboard');
            document.getElementById('bottom-nav').style.display = 'none';
        }

        // Update emergency button state
        const btn = document.getElementById('emergency-btn');
        if (btn) btn.classList.add('active');

        // Initialize dashboard
        const dashContainer = document.getElementById('dashboard-container');
        if (window.dashboardManager) {
            window.dashboardManager.init(dashContainer);
            window.dashboardManager.show();
            window.dashboardManager.startTimer();
            window.dashboardManager.addTimelineEvent('🚨', 'Emergency activated', 'danger');
        }

        // Step 1: Get GPS location
        await this._acquireLocation();

        // Step 2: Load profile & compose message
        const message = this._composeEmergencyMessage();

        // Step 3: Alert emergency contacts
        await this._alertContacts(message);

        // Step 4: Check battery & start mic
        await this._handleAudioStreaming();

        // Step 5: Start police cascade
        this._startPoliceCascade();

        // Step 6: Initialize AI triage (accessible from dashboard)
        this._initAITriage();

        // Set up cancel handler on dashboard
        if (window.dashboardManager) {
            window.dashboardManager.onCancelEmergency(() => {
                this.deactivate();
            });
        }
    }

    /**
     * Step 1: Acquire GPS location
     */
    async _acquireLocation() {
        if (window.dashboardManager) {
            window.dashboardManager.addTimelineEvent('📍', 'Sharing live GPS location...', 'pending');
        }

        try {
            if (window.locationManager) {
                const pos = await window.locationManager.getCurrentPosition();
                if (window.dashboardManager) {
                    window.dashboardManager.addTimelineEvent('📍', `Location acquired (±${Math.round(pos.accuracy)}m)`, 'success');
                    window.dashboardManager.updateGPS(pos.lat, pos.lng, pos.accuracy, pos.timestamp);
                }

                // Continue tracking for live updates
                window.locationManager.onUpdate((position) => {
                    if (window.dashboardManager && this.isActive) {
                        window.dashboardManager.updateGPS(position.lat, position.lng, position.accuracy, position.timestamp);
                    }
                });
            }
        } catch (err) {
            if (window.dashboardManager) {
                window.dashboardManager.addTimelineEvent('⚠️', 'GPS unavailable: ' + (err.message || 'Permission denied'), 'warning');
            }
        }
    }

    /**
     * Step 2: Compose emergency message with profile + location
     */
    _composeEmergencyMessage() {
        let location = null;
        if (window.locationManager) {
            const pos = window.locationManager.currentPosition;
            if (pos) {
                location = { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy };
            }
        }

        if (window.profileManager) {
            return window.profileManager.getEmergencyMessage(location);
        }

        // Fallback message if no profile
        const mapLink = location ? `https://maps.google.com/?q=${location.lat},${location.lng}` : 'Location unavailable';
        return `🚨 EMERGENCY ALERT 🚨\n\n📍 Location: ${mapLink}\n⏰ Time: ${new Date().toLocaleString()}\n\nThis is an automated emergency alert. Please respond immediately.`;
    }

    /**
     * Step 3: Alert all emergency contacts
     */
    async _alertContacts(message) {
        if (!window.contactsManager) return;

        const contacts = window.contactsManager.getContacts();
        if (contacts.length === 0) {
            if (window.dashboardManager) {
                window.dashboardManager.addTimelineEvent('⚠️', 'No emergency contacts configured', 'warning');
            }
            return;
        }

        if (window.dashboardManager) {
            window.dashboardManager.addTimelineEvent('📨', 'Sending distress alert to emergency contacts...', 'pending');
        }

        // Simulate sending alerts to each contact
        for (const contact of contacts) {
            // Simulate sending delay
            await this._delay(800 + Math.random() * 500);

            if (window.dashboardManager) {
                window.dashboardManager.updateContactStatus(contact.id, 'sent', new Date());
                window.dashboardManager.addTimelineEvent('✉️', `Alert sent to ${contact.name} (${contact.relationship})`, 'success');
            }

            // Simulate delivery after a short delay
            setTimeout(() => {
                if (window.dashboardManager && this.isActive) {
                    window.dashboardManager.updateContactStatus(contact.id, 'delivered', new Date());
                }
            }, 2000 + Math.random() * 3000);
        }

        if (window.dashboardManager) {
            const stats = this._getStats();
            window.dashboardManager.updateProgressSummary(stats);
        }
    }

    /**
     * Step 4: Check battery and start microphone if > 15%
     */
    async _handleAudioStreaming() {
        if (!window.batteryManager) return;

        await window.batteryManager.init();
        const level = window.batteryManager.getLevel();
        const isAbove = window.batteryManager.isAboveThreshold(15);

        if (window.dashboardManager) {
            window.dashboardManager.updateBatteryStatus(level, window.batteryManager.isCharging());
        }

        if (isAbove) {
            if (window.dashboardManager) {
                window.dashboardManager.addTimelineEvent('🎙️', `Battery at ${level}% — Starting microphone...`, 'pending');
            }

            try {
                if (window.audioManager) {
                    await window.audioManager.startCapture();

                    // Draw waveform on dashboard canvas
                    const canvas = document.getElementById('audio-waveform-canvas');
                    if (canvas) {
                        window.audioManager.drawWaveform(canvas);
                    }

                    if (window.dashboardManager) {
                        window.dashboardManager.addTimelineEvent('🎙️', 'Microphone streaming live', 'success');
                        this._startAudioStatusUpdates();
                    }
                }
            } catch (err) {
                if (window.dashboardManager) {
                    window.dashboardManager.addTimelineEvent('⚠️', 'Microphone unavailable: ' + (err.message || 'Permission denied'), 'warning');
                }
            }
        } else {
            if (window.dashboardManager) {
                window.dashboardManager.addTimelineEvent('🔇', `Battery low (${level}%) — Microphone disabled to conserve power`, 'warning');
                window.dashboardManager.updateAudioStatus(false, 0, 0);
            }
        }

        // Monitor battery for threshold crossing
        window.batteryManager.onThresholdCross(({ level: newLevel, crossedBelow: crossedDown }) => {
            if (!this.isActive) return;

            if (window.dashboardManager) {
                window.dashboardManager.updateBatteryStatus(newLevel, window.batteryManager.isCharging());
            }

            if (crossedDown && window.audioManager && window.audioManager.isActive()) {
                window.audioManager.stopCapture();
                if (window.dashboardManager) {
                    window.dashboardManager.addTimelineEvent('🔇', `Battery dropped to ${newLevel}% — Microphone stopped`, 'danger');
                    window.dashboardManager.updateAudioStatus(false, 0, 0);
                }
                if (window.notificationManager) {
                    window.notificationManager.showToast('Microphone disabled — battery too low', 'warning');
                }
            } else if (!crossedDown && !window.audioManager.isActive()) {
                // Battery recovered above 15%
                if (window.dashboardManager) {
                    window.dashboardManager.addTimelineEvent('🔋', `Battery recovered to ${newLevel}% — Microphone can be restarted`, 'info');
                }
            }
        });

        // Monitor battery level changes
        window.batteryManager.onLevelChange((newLevel) => {
            if (this.isActive && window.dashboardManager) {
                window.dashboardManager.updateBatteryStatus(newLevel, window.batteryManager.isCharging());
            }
        });
    }

    /**
     * Periodically update audio status on dashboard
     */
    _startAudioStatusUpdates() {
        const updateAudio = () => {
            if (!this.isActive) return;
            if (window.audioManager && window.audioManager.isActive() && window.dashboardManager) {
                const contacts = window.contactsManager ? window.contactsManager.getContacts().length : 0;
                window.dashboardManager.updateAudioStatus(true, window.audioManager.getDuration(), contacts);
            }
            if (this.isActive) {
                requestAnimationFrame(updateAudio);
            }
        };
        requestAnimationFrame(updateAudio);
    }

    /**
     * Step 5: Start cascading police station alerts
     */
    _startPoliceCascade() {
        if (!window.policeManager) return;

        // Get user's location for nearby search
        let userLat = 28.6139; // Default: Delhi
        let userLng = 77.2090;

        if (window.locationManager && window.locationManager.currentPosition) {
            userLat = window.locationManager.currentPosition.lat;
            userLng = window.locationManager.currentPosition.lng;
        }

        // Sort stations by proximity
        window.policeManager.getNearestStations(userLat, userLng);

        if (window.dashboardManager) {
            window.dashboardManager.addTimelineEvent('🚔', 'Notifying nearest police stations...', 'pending');
        }

        // Start alerting first batch
        this._alertPoliceBatch(0);
    }

    /**
     * Alert a batch of police stations and handle escalation
     */
    async _alertPoliceBatch(batchIndex) {
        if (!this.isActive || !window.policeManager) return;

        const batch = window.policeManager.getNextBatch(batchIndex);
        const totalBatches = window.policeManager.getTotalBatches();

        if (!batch || batch.length === 0) {
            if (window.dashboardManager) {
                window.dashboardManager.addTimelineEvent('⚠️', 'All police stations contacted — awaiting response', 'warning');
            }
            return;
        }

        if (window.dashboardManager) {
            window.dashboardManager.addTimelineEvent('🚔', `Alerting police batch ${batchIndex + 1} of ${totalBatches} (${batch.length} stations)`, 'pending');
            window.dashboardManager.showBatch(batchIndex, batch);
        }

        // Update station statuses to alerting
        for (const station of batch) {
            window.policeManager.setStationStatus(station.id, 'alerting');
            if (window.dashboardManager) {
                window.dashboardManager.updatePoliceStation(station.id, 'alerting');
            }
        }

        // Wait a moment then set to awaiting
        await this._delay(1500);
        
        if (window.dashboardManager && batchIndex === 0) {
            window.dashboardManager.addTimelineEvent('⏳', 'Awaiting acknowledgment...', 'pending');
        }

        for (const station of batch) {
            window.policeManager.setStationStatus(station.id, 'awaiting');
            if (window.dashboardManager) {
                window.dashboardManager.updatePoliceStation(station.id, 'awaiting');
            }
        }

        // Start escalation countdown
        let secondsLeft = this.escalationInterval;
        let anyResponded = false;

        // Start response simulation for this batch
        const responsePromises = batch.map(station => {
            return window.policeManager.alertStation(station).then(result => {
                if (!this.isActive) return;

                const status = result.responded ? 'responded' : 'no-response';
                window.policeManager.setStationStatus(station.id, status);

                if (window.dashboardManager) {
                    window.dashboardManager.updatePoliceStation(station.id, status);

                    if (result.responded) {
                        anyResponded = true;
                        window.dashboardManager.addTimelineEvent('✅', `${station.name} responded!`, 'success');
                        const stats = this._getStats();
                        window.dashboardManager.updateProgressSummary(stats);
                    } else {
                        window.dashboardManager.addTimelineEvent('❌', `${station.name} — no response`, 'danger');
                    }
                }
            });
        });

        // Escalation timer
        this.escalationTimer = setInterval(() => {
            secondsLeft--;
            if (window.dashboardManager) {
                window.dashboardManager.updateEscalationTimer(secondsLeft, this.escalationInterval);
            }

            if (secondsLeft <= 0) {
                clearInterval(this.escalationTimer);
                this.escalationTimer = null;

                // Check if any responded
                if (!anyResponded && this.isActive) {
                    if (window.dashboardManager) {
                        window.dashboardManager.addTimelineEvent('🔄', `No response from batch ${batchIndex + 1} — escalating...`, 'warning');
                    }
                    // Escalate to next batch
                    this._alertPoliceBatch(batchIndex + 1);
                }
            }
        }, 1000);

        // Also handle if responses come in before timer ends
        Promise.all(responsePromises).then(() => {
            if (anyResponded && this.escalationTimer) {
                // A station responded, but keep timer for remaining stations
                // Don't escalate further since we got a response
            }
        });
    }

    /**
     * Step 6: Initialize AI triage chat
     */
    _initAITriage() {
        if (!window.aiTriageManager) return;

        const chatContainer = document.getElementById('ai-chat-container');
        if (!chatContainer) return;

        const emergencyContext = {
            location: window.locationManager ? window.locationManager.currentPosition : null,
            profile: window.profileManager ? window.profileManager.getProfile() : null,
            contactsAlerted: window.contactsManager ? window.contactsManager.getContacts().length : 0,
            policeAlerted: window.policeManager ? window.policeManager.getAlertedCount() : 0
        };

        window.aiTriageManager.init(chatContainer);
        window.aiTriageManager.start(emergencyContext);

        if (window.dashboardManager) {
            window.dashboardManager.addTimelineEvent('🤖', 'AI Emergency Assistant ready', 'info');
        }
    }

    /**
     * Deactivate emergency - requires confirmation and PIN
     */
    deactivate() {
        if (!this.isActive) return;

        // Prompt for PIN before deactivating
        if (window.app && window.app.promptPin) {
            window.app.promptPin(() => {
                this._performDeactivation();
            });
        } else {
            this._performDeactivation();
        }
    }

    /**
     * Actual teardown of emergency state
     * @private
     */
    _performDeactivation() {
        this.isActive = false;
        this.activationTime = null;

        // Stop all active processes
        if (this.escalationTimer) {
            clearInterval(this.escalationTimer);
            this.escalationTimer = null;
        }

        // Stop audio
        if (window.audioManager && window.audioManager.isActive()) {
            window.audioManager.stopCapture();
        }

        // Stop dashboard timer
        if (window.dashboardManager) {
            window.dashboardManager.stopTimer();
            window.dashboardManager.addTimelineEvent('🛑', 'Emergency deactivated by user', 'info');
        }

        // Reset police manager
        if (window.policeManager) {
            window.policeManager.reset();
        }

        // Reset UI
        const btn = document.getElementById('emergency-btn');
        if (btn) btn.classList.remove('active');

        // Show nav bar again
        document.getElementById('bottom-nav').style.display = '';

        // Navigate back to home
        if (window.app) {
            window.app.navigateTo('home');
        }

        if (window.notificationManager) {
            window.notificationManager.showToast('Emergency deactivated', 'info');
        }
    }

    /**
     * Get current emergency stats
     */
    _getStats() {
        const contacts = window.contactsManager ? window.contactsManager.getContacts() : [];
        const contactsAlerted = contacts.length; // All get alerted
        let stationsResponded = 0;
        let totalStationsAlerted = 0;

        if (window.policeManager) {
            const statuses = window.policeManager.getAllStatuses();
            for (const [id, status] of statuses) {
                if (status !== 'queued') totalStationsAlerted++;
                if (status === 'responded') stationsResponded++;
            }
        }

        return {
            contactsAlerted,
            totalContacts: contacts.length,
            stationsResponded,
            totalStations: totalStationsAlerted,
            micActive: window.audioManager ? window.audioManager.isActive() : false,
            ambulanceRequested: false,
            elapsedTime: this.activationTime ? Math.floor((Date.now() - this.activationTime) / 1000) : 0
        };
    }

    /**
     * Utility: Promise-based delay
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check if emergency is currently active
     */
    getIsActive() {
        return this.isActive;
    }
}

// Global instance
window.emergencyManager = new EmergencyManager();
