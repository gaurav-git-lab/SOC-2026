/**
 * App - Main controller and router for the SOS Emergency Response Application.
 * Coordinates page transitions and registers global event listeners.
 */
class App {
    constructor() {
        this.activeScreen = 'home';
    }

    /**
     * Initializes the application, registers listeners, and checks profile state.
     */
    async init() {
        console.log('[App] Initializing application...');

        // Initialize battery manager
        if (window.batteryManager) {
            await window.batteryManager.init();
            this._updateBatteryStatusUI(window.batteryManager.getLevel(), window.batteryManager.isCharging());
            
            // Listen for battery level changes
            window.batteryManager.onLevelChange((lvl) => {
                this._updateBatteryStatusUI(lvl, window.batteryManager.isCharging());
            });
        }

        // Initialize location manager
        if (window.locationManager) {
            window.locationManager.startTracking();
            
            // Listen for GPS location updates
            window.locationManager.onUpdate((pos) => {
                this._updateGPSStatusUI(pos);
            });

            window.locationManager.onError((err) => {
                this._handleGPSError(err);
            });
        }

        // Setup Screen Navigation click handlers
        this._setupNavigation();

        // Setup Main SOS Trigger button listener
        const emergencyBtn = document.getElementById('emergency-btn');
        if (emergencyBtn) {
            emergencyBtn.addEventListener('click', () => {
                if (window.emergencyManager) {
                    window.emergencyManager.startCountdown();
                }
            });
        }

        // Initial setup/routing check
        if (window.profileManager) {
            if (window.profileManager.isProfileComplete()) {
                this.navigateTo('home');
            } else {
                this.navigateTo('onboarding');
            }
        } else {
            this.navigateTo('home');
        }

        // Setup Test Mode Toggle
        this._setupTestMode();

        // Load data in backgrounds
        this.refreshData();
    }

    /**
     * Setup test mode
     */
    _setupTestMode() {
        const toggleBtn = document.getElementById('test-mode-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                window.testMode = !window.testMode;
                toggleBtn.classList.toggle('active', window.testMode);
                
                if (window.testMode) {
                    if (window.notificationManager) {
                        window.notificationManager.showToast('Test Mode Enabled: Task is done. Simulating actual emergency.', 'warning');
                    }

                    // Inject random pre-saved profile if none exists
                    if (window.profileManager && !window.profileManager.isProfileComplete()) {
                        window.profileManager.saveProfile({
                            name: 'Jane Doe (Test)',
                            email: 'jane.test@example.com',
                            phone: '9876543210',
                            pin: '1234',
                            age: '28',
                            gender: 'Female',
                            bloodType: 'A+',
                            conditions: ['Asthma'],
                            customCondition: '',
                            allergies: ['Penicillin'],
                            medications: ['Albuterol'],
                            disability: 'None',
                            hospital: 'City General Hospital',
                            language: 'English',
                            notes: 'Test Mode Automated Profile'
                        });
                    }

                    // Inject random contacts if none exist
                    if (window.contactsManager && window.contactsManager.getContacts().length === 0) {
                        window.contactsManager.addContact({ id: 'test-1', name: 'John Smith', phone: '1112223333', relationship: 'Spouse' });
                        window.contactsManager.addContact({ id: 'test-2', name: 'Mary Johnson', phone: '4445556666', relationship: 'Parent' });
                    }

                    this.refreshData();

                    // Restart location tracking to pick up test mode
                    if (window.locationManager) {
                        window.locationManager.stopTracking();
                        window.locationManager.startTracking();
                    }

                    // Automatically start the emergency sequence
                    if (window.emergencyManager) {
                        window.emergencyManager.startCountdown();
                    }
                } else {
                    if (window.notificationManager) {
                        window.notificationManager.showToast('Test Mode Disabled.', 'info');
                    }
                    if (window.locationManager) {
                        window.locationManager.stopTracking();
                        window.locationManager.startTracking();
                    }
                }
            });
        }
    }

    /**
     * Navigates to a specific screen view
     * @param {string} screenId View ID (e.g. 'home', 'contacts', 'profile', 'dashboard', 'ai-chat', 'onboarding')
     */
    navigateTo(screenId) {
        console.log(`[App] Navigating to screen: ${screenId}`);
        this.activeScreen = screenId;

        // Hide all screens, show active screen
        const screens = document.querySelectorAll('.screen');
        screens.forEach(s => s.classList.remove('active'));

        // Handle onboarding prefix mapping
        const targetScreenId = screenId === 'onboarding' ? 'screen-onboarding' : `screen-${screenId}`;
        const targetScreen = document.getElementById(targetScreenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }

        // Update Bottom Navigation Bar items active class
        const navItems = document.querySelectorAll('.bottom-nav .nav-item');
        navItems.forEach(item => {
            const dest = item.getAttribute('data-screen');
            if (dest === screenId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Hide navigation bar on dashboard, chat, and onboarding screens
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) {
            if (screenId === 'dashboard' || screenId === 'ai-chat' || screenId === 'onboarding') {
                bottomNav.style.display = 'none';
            } else {
                bottomNav.style.display = 'flex';
            }
        }

        // Hook screen specific loads
        if (screenId === 'contacts') {
            const container = document.getElementById('contacts-container');
            if (window.contactsManager) window.contactsManager.renderContactsList(container);
        } else if (screenId === 'profile') {
            const container = document.getElementById('profile-container');
            if (window.profileManager) window.profileManager.renderProfileSummary(container);
        } else if (screenId === 'onboarding') {
            const container = document.getElementById('profile-wizard-container');
            if (window.profileManager) window.profileManager.renderProfileForm(container);
        }
    }

    /**
     * Refreshes dynamic cards list render elements
     */
    refreshData() {
        const contactsContainer = document.getElementById('contacts-container');
        if (contactsContainer && window.contactsManager) {
            window.contactsManager.renderContactsList(contactsContainer);
        }

        const profileContainer = document.getElementById('profile-container');
        if (profileContainer && window.profileManager) {
            window.profileManager.renderProfileSummary(profileContainer);
        }
    }

    /**
     * Setup bottom navigation click listeners
     * @private
     */
    _setupNavigation() {
        const navItems = document.querySelectorAll('.bottom-nav .nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const dest = e.currentTarget.getAttribute('data-screen');
                if (dest === 'contacts' || dest === 'profile') {
                    this.promptPin(() => {
                        this.navigateTo(dest);
                    });
                } else {
                    this.navigateTo(dest);
                }
            });
        });
    }

    /**
     * Display the PIN authentication overlay
     * @param {Function} successCallback 
     * @param {Function} cancelCallback 
     */
    promptPin(successCallback, cancelCallback) {
        if (!window.profileManager || !window.profileManager.isProfileComplete()) {
            // No profile/PIN set, allow bypass
            if (successCallback) successCallback();
            return;
        }

        const overlay = document.getElementById('pin-auth-overlay');
        const dots = document.querySelectorAll('.pin-dot');
        const keys = document.querySelectorAll('.pin-key');
        const cancelBtn = document.getElementById('pin-auth-cancel-btn');
        const clearBtn = document.getElementById('pin-key-clear');
        const backBtn = document.getElementById('pin-key-back');

        let currentPin = '';

        const updateDots = () => {
            dots.forEach((dot, index) => {
                dot.classList.remove('filled', 'error');
                if (index < currentPin.length) dot.classList.add('filled');
            });
        };

        const showError = () => {
            dots.forEach(dot => dot.classList.add('error'));
            if (window.notificationManager) window.notificationManager.vibrate([100, 100, 100]);
            setTimeout(() => {
                currentPin = '';
                updateDots();
            }, 500);
        };

        const handleKey = (val) => {
            if (currentPin.length < 4) {
                currentPin += val;
                updateDots();

                if (currentPin.length === 4) {
                    setTimeout(() => {
                        if (window.profileManager.verifyPin(currentPin)) {
                            closeOverlay();
                            if (successCallback) successCallback();
                        } else {
                            showError();
                        }
                    }, 200);
                }
            }
        };

        // Clear existing listeners by cloning
        const newKeys = [];
        keys.forEach(k => {
            if (k.id === 'pin-key-clear' || k.id === 'pin-key-back') return;
            const nk = k.cloneNode(true);
            k.parentNode.replaceChild(nk, k);
            newKeys.push(nk);
        });

        newKeys.forEach(k => {
            k.addEventListener('click', (e) => {
                const val = e.currentTarget.getAttribute('data-val');
                handleKey(val);
            });
        });

        // Rebind control keys
        const newClearBtn = clearBtn.cloneNode(true);
        clearBtn.parentNode.replaceChild(newClearBtn, clearBtn);
        newClearBtn.addEventListener('click', () => {
            currentPin = '';
            updateDots();
        });

        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        newBackBtn.addEventListener('click', () => {
            currentPin = currentPin.slice(0, -1);
            updateDots();
        });

        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', () => {
            closeOverlay();
            if (cancelCallback) cancelCallback();
        });

        const closeOverlay = () => {
            overlay.classList.remove('active');
        };

        currentPin = '';
        updateDots();
        overlay.classList.add('active');
    }

    /**
     * Update GPS Status bar UI values
     * @private
     */
    _updateGPSStatusUI(pos) {
        const gpsStatus = document.getElementById('gps-status');
        const coordsDisplay = document.getElementById('coords-display');
        const mapsLink = document.getElementById('maps-link');

        if (gpsStatus) {
            gpsStatus.classList.add('active');
            const span = gpsStatus.querySelector('span');
            if (span) span.textContent = `GPS: Active (±${Math.round(pos.accuracy)}m)`;
        }

        if (coordsDisplay) {
            coordsDisplay.textContent = `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
        }

        if (mapsLink && window.locationManager) {
            mapsLink.href = window.locationManager.getMapLink();
        }
    }

    /**
     * Handle GPS errors on status bar
     * @private
     */
    _handleGPSError(err) {
        const gpsStatus = document.getElementById('gps-status');
        const coordsDisplay = document.getElementById('coords-display');

        if (gpsStatus) {
            gpsStatus.classList.remove('active');
            const span = gpsStatus.querySelector('span');
            if (span) span.textContent = 'GPS: Error';
        }

        if (coordsDisplay) {
            coordsDisplay.textContent = err.message || 'GPS Signal Lost';
        }
    }

    /**
     * Update Battery Status bar UI values
     * @private
     */
    _updateBatteryStatusUI(level, isCharging) {
        const batteryStatus = document.getElementById('battery-status');
        const fillRect = document.getElementById('battery-fill-rect');

        if (batteryStatus) {
            const span = batteryStatus.querySelector('span');
            if (span) {
                span.textContent = `Battery: ${level}%${isCharging ? ' ⚡' : ''}`;
            }

            // Adjust styles based on low battery
            if (level <= 15) {
                batteryStatus.classList.add('low');
            } else {
                batteryStatus.classList.remove('low');
            }
        }

        if (fillRect) {
            // Adjust filled width (scale is based on battery.js range 0-100)
            // The battery rect inside SVG starts at x=4, width=14
            const fillWidth = (level / 100) * 14;
            fillRect.setAttribute('width', fillWidth.toString());
            
            // Adjust battery glow color
            if (level <= 15) {
                fillRect.setAttribute('fill', '#ff2d55');
                fillRect.setAttribute('opacity', '0.8');
            } else if (level <= 50) {
                fillRect.setAttribute('fill', '#ffd60a');
                fillRect.setAttribute('opacity', '0.6');
            } else {
                fillRect.setAttribute('fill', '#30d158');
                fillRect.setAttribute('opacity', '0.6');
            }
        }
    }
}

// Global instance
window.app = new App();

// Trigger application start on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.app.init().catch(err => {
        console.error('[App] Failed to initialize application:', err);
    });
});
