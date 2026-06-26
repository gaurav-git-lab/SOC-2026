/**
 * Profile Manager - Handles user profile creation, validation, storage,
 * and rendering of the onboarding wizard and settings summary.
 */
class ProfileManager {
    constructor() {
        this.STORAGE_KEY = 'sos_user_profile';
        this.profile = this.getProfile();
        this.currentStep = 1;
        this.totalSteps = 4;
        
        // Temp state during wizard flow
        this.tempData = {
            name: '',
            email: '',
            phone: '',
            pin: '',
            age: '',
            gender: 'Male',
            bloodType: '',
            conditions: [],
            customCondition: '',
            allergies: [],
            medications: [],
            disability: '',
            hospital: '',
            language: 'English',
            notes: ''
        };
    }

    /**
     * Get profile from localStorage
     * @returns {Object|null} Profile object or null
     */
    getProfile() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Error reading profile from localStorage:', e);
            return null;
        }
    }

    /**
     * Save profile to localStorage
     * @param {Object} data Profile data
     * @returns {Object} Save result
     */
    saveProfile(data) {
        if (!data.name || !data.name.trim()) {
            return { error: 'Name is required.' };
        }
        if (!data.phone || !data.phone.trim()) {
            return { error: 'Phone number is required.' };
        }
        if (!data.pin || data.pin.length !== 4) {
            return { error: 'A 4-digit PIN is required.' };
        }
        if (!data.bloodType) {
            return { error: 'Blood type is required.' };
        }

        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            this.profile = data;
            return { success: true };
        } catch (e) {
            console.error('Error saving profile to localStorage:', e);
            return { error: 'Failed to write profile storage.' };
        }
    }

    /**
     * Check if profile has all required fields
     * @returns {boolean}
     */
    isProfileComplete() {
        const p = this.getProfile();
        return p !== null && !!p.name && !!p.phone && !!p.pin && !!p.bloodType;
    }

    /**
     * Verify the PIN
     * @param {string} inputPin 
     * @returns {boolean}
     */
    verifyPin(inputPin) {
        const p = this.getProfile();
        if (!p) return false;
        return p.pin === inputPin;
    }

    /**
     * Compose emergency alert message string
     * @param {Object|null} location { lat, lng, accuracy }
     * @returns {string} Composed emergency alert text
     */
    getEmergencyMessage(location, profileOverride = null) {
        const p = profileOverride || this.getProfile() || this.tempData;
        const mapLink = location ? `https://www.google.com/maps?q=${location.lat},${location.lng}` : 'GPS Unavailable';
        const coords = location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'Unavailable';
        const accuracy = location ? `±${Math.round(location.accuracy)}m` : 'N/A';
        const time = new Date().toLocaleString();

        const condStr = (p.conditions && p.conditions.length > 0) 
            ? p.conditions.join(', ') + (p.customCondition ? `, ${p.customCondition}` : '')
            : (p.customCondition || 'None');

        const allergyStr = (p.allergies && p.allergies.length > 0) ? p.allergies.join(', ') : 'None';
        const medStr = (p.medications && p.medications.length > 0) ? p.medications.join(', ') : 'None';

        return `🚨 EMERGENCY ALERT 🚨
Name: ${p.name || 'Not specified'} | Age: ${p.age || 'N/A'} | Gender: ${p.gender || 'N/A'}
Blood Type: ${p.bloodType || 'Unknown'}
Medical Conditions: ${condStr}
Allergies: ${allergyStr}
Medications: ${medStr}
Disability: ${p.disability || 'None'}
Preferred Hospital: ${p.hospital || 'Not specified'}

📍 Live Location: ${mapLink}
Coordinates: ${coords}
Accuracy: ${accuracy}
⏰ Time: ${time}

This is an automated emergency alert. Please respond immediately.`;
    }

    /**
     * Render the multi-step onboarding wizard
     * @param {HTMLElement} container
     */
    renderProfileForm(container) {
        if (!container) return;
        
        // Load existing profile if editing
        const existing = this.getProfile();
        if (existing) {
            this.tempData = { ...existing };
        }

        this.currentStep = 1;
        this._renderWizardTemplate(container);
    }

    /**
     * Render the outer wizard template and dots
     * @private
     */
    _renderWizardTemplate(container) {
        container.innerHTML = `
            <div class="wizard">
                <div class="wizard-progress">
                    <div class="wizard-progress-bar" id="wizard-bar"></div>
                    <div class="wizard-dot active" data-step="1">1</div>
                    <div class="wizard-dot" data-step="2">2</div>
                    <div class="wizard-dot" data-step="3">3</div>
                    <div class="wizard-dot" data-step="4">4</div>
                </div>
                <div class="wizard-steps" id="wizard-steps-slider">
                    <div class="wizard-step active" id="step-view-1"></div>
                    <div class="wizard-step" id="step-view-2"></div>
                    <div class="wizard-step" id="step-view-3"></div>
                    <div class="wizard-step" id="step-view-4"></div>
                </div>
                <div class="wizard-nav">
                    <button class="btn btn-secondary" id="wiz-prev-btn" style="visibility: hidden;">Back</button>
                    <button class="btn btn-primary" id="wiz-next-btn">Next</button>
                </div>
            </div>
        `;

        this._renderStepContent(1);
        this._renderStepContent(2);
        this._renderStepContent(3);
        this._renderStepContent(4);

        // Bind navigational controls
        const prevBtn = document.getElementById('wiz-prev-btn');
        const nextBtn = document.getElementById('wiz-next-btn');

        prevBtn.addEventListener('click', () => this._navigateStep(-1));
        nextBtn.addEventListener('click', () => this._navigateStep(1));

        this._updateProgressUI();
    }

    /**
     * Render the internal content of a step
     * @private
     */
    _renderStepContent(stepNum) {
        const stepView = document.getElementById(`step-view-${stepNum}`);
        if (!stepView) return;

        if (stepNum === 1) {
            stepView.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: var(--space-4); font-size: 16px; font-weight: 700; color: var(--pending-blue);">ACCOUNT DETAILS</h3>
                    <div class="form-group">
                        <label class="form-label">Full Name *</label>
                        <input type="text" id="p-name" class="form-input" placeholder="e.g. Gaurav Sharma" value="${this.tempData.name}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email Address</label>
                        <input type="email" id="p-email" class="form-input" placeholder="e.g. gaurav@example.com" value="${this.tempData.email || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Phone Number *</label>
                        <input type="tel" id="p-phone" class="form-input" placeholder="e.g. 9876543210" value="${this.tempData.phone}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Security PIN (4 Digits) *</label>
                        <input type="password" id="p-pin" class="form-input" placeholder="****" maxlength="4" pattern="[0-9]*" inputmode="numeric" value="${this.tempData.pin || ''}">
                        <p style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Required to change settings or cancel an emergency.</p>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
                        <div class="form-group">
                            <label class="form-label">Age</label>
                            <input type="number" id="p-age" class="form-input" placeholder="Age" value="${this.tempData.age || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Gender</label>
                            <select id="p-gender" class="form-input">
                                <option value="Male" ${this.tempData.gender === 'Male' ? 'selected' : ''}>Male</option>
                                <option value="Female" ${this.tempData.gender === 'Female' ? 'selected' : ''}>Female</option>
                                <option value="Other" ${this.tempData.gender === 'Other' ? 'selected' : ''}>Other</option>
                            </select>
                        </div>
                    </div>
                </div>
            `;
        } else if (stepNum === 2) {
            const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
            const bloodButtons = bloodTypes.map(t => `
                <button type="button" class="blood-type-btn ${this.tempData.bloodType === t ? 'active' : ''}" data-blood="${t}">${t}</button>
            `).join('');

            const conditions = ['Diabetes', 'Asthma', 'Heart Disease', 'Epilepsy', 'Hypertension', 'Cancer', 'Kidney Disease', 'HIV/AIDS'];
            const condCheckboxes = conditions.map(c => `
                <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; margin-bottom: 6px; cursor: pointer;">
                    <input type="checkbox" class="cond-checkbox" value="${c}" ${this.tempData.conditions.includes(c) ? 'checked' : ''} style="accent-color: var(--emergency-red);">
                    ${c}
                </label>
            `).join('');

            stepView.innerHTML = `
                <div class="card" style="max-height: 58vh; overflow-y: auto; padding-right: 4px;">
                    <h3 style="margin-bottom: var(--space-3); font-size: 16px; font-weight: 700; color: var(--pending-blue);">MEDICAL PROFILE</h3>
                    
                    <div class="form-group">
                        <label class="form-label">Blood Type *</label>
                        <div class="blood-type-selector">
                            ${bloodButtons}
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Known Conditions</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; margin-bottom: var(--space-2);">
                            ${condCheckboxes}
                        </div>
                        <input type="text" id="custom-condition" class="form-input" placeholder="Other medical condition" value="${this.tempData.customCondition || ''}">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Allergies</label>
                        <div class="tag-input-container" id="allergy-tags-container">
                            <input type="text" id="allergy-input" placeholder="Type allergy & press Enter">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Current Medications</label>
                        <div class="tag-input-container" id="medication-tags-container">
                            <input type="text" id="medication-input" placeholder="Type medicine & press Enter">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Disabilities / Mobility Issues</label>
                        <textarea id="p-disability" class="form-input" rows="2" placeholder="e.g. Uses a wheelchair, Visual impairment" style="resize: none;">${this.tempData.disability || ''}</textarea>
                    </div>
                </div>
            `;

            // Bind blood selector
            stepView.querySelectorAll('.blood-type-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    stepView.querySelectorAll('.blood-type-btn').forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    this.tempData.bloodType = e.currentTarget.getAttribute('data-blood');
                });
            });

            // Bind Tag Inputs
            this._setupTagInput(stepView.querySelector('#allergy-input'), stepView.querySelector('#allergy-tags-container'), 'allergies');
            this._setupTagInput(stepView.querySelector('#medication-input'), stepView.querySelector('#medication-tags-container'), 'medications');
        } else if (stepNum === 3) {
            stepView.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: var(--space-4); font-size: 16px; font-weight: 700; color: var(--pending-blue);">EMERGENCY PREFERENCES</h3>
                    
                    <div class="form-group">
                        <label class="form-label">Preferred Hospital</label>
                        <input type="text" id="p-hospital" class="form-input" placeholder="Preferred hospital for triage" value="${this.tempData.hospital || ''}">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Primary Language</label>
                        <select id="p-language" class="form-input">
                            <option value="English" ${this.tempData.language === 'English' ? 'selected' : ''}>English</option>
                            <option value="Hindi" ${this.tempData.language === 'Hindi' ? 'selected' : ''}>Hindi</option>
                            <option value="Punjabi" ${this.tempData.language === 'Punjabi' ? 'selected' : ''}>Punjabi</option>
                            <option value="Bengali" ${this.tempData.language === 'Bengali' ? 'selected' : ''}>Bengali</option>
                            <option value="Other" ${this.tempData.language === 'Other' ? 'selected' : ''}>Other</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Additional Dispatch Notes</label>
                        <textarea id="p-notes" class="form-input" rows="3" placeholder="e.g. Contacts have spare keys, Gate code is 1234" style="resize: none;">${this.tempData.notes || ''}</textarea>
                    </div>
                </div>
            `;
        } else if (stepNum === 4) {
            stepView.innerHTML = `
                <div class="card" style="max-height: 58vh; overflow-y: auto;">
                    <h3 style="margin-bottom: var(--space-3); font-size: 16px; font-weight: 700; color: var(--pending-blue);">PREVIEW & CONFIRM</h3>
                    <p style="font-size: 13px; color: var(--text-muted); margin-bottom: var(--space-3);">This message format containing your critical health metrics will be automatically dispatched to contacts and rescuers:</p>
                    <div class="medical-preview" id="emergency-message-preview"></div>
                </div>
            `;
        }
    }

    /**
     * Setup tagging list events
     * @private
     */
    _setupTagInput(input, container, key) {
        if (!input || !container) return;

        // Render initial tags if any
        const renderTags = () => {
            // Remove existing tag elements
            container.querySelectorAll('.tag').forEach(t => t.remove());
            // Prepend tags before the input element
            this.tempData[key].forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.className = 'tag';
                tagEl.innerHTML = `${tag} <button class="tag-remove" type="button" data-val="${tag}">×</button>`;
                tagEl.querySelector('.tag-remove').addEventListener('click', (e) => {
                    const val = e.currentTarget.getAttribute('data-val');
                    this.tempData[key] = this.tempData[key].filter(t => t !== val);
                    renderTags();
                });
                container.insertBefore(tagEl, input);
            });
        };

        renderTags();

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const val = input.value.trim();
                if (val && !this.tempData[key].includes(val)) {
                    this.tempData[key].push(val);
                    input.value = '';
                    renderTags();
                }
            }
        });
    }

    /**
     * Save inputs from the current active step view into tempData
     * @private
     */
    _saveStepState() {
        if (this.currentStep === 1) {
            const nameEl = document.getElementById('p-name');
            const emailEl = document.getElementById('p-email');
            const phoneEl = document.getElementById('p-phone');
            const pinEl = document.getElementById('p-pin');
            const ageEl = document.getElementById('p-age');
            const genEl = document.getElementById('p-gender');
            if (nameEl) this.tempData.name = nameEl.value;
            if (emailEl) this.tempData.email = emailEl.value;
            if (phoneEl) this.tempData.phone = phoneEl.value;
            if (pinEl) this.tempData.pin = pinEl.value;
            if (ageEl) this.tempData.age = ageEl.value;
            if (genEl) this.tempData.gender = genEl.value;
        } else if (this.currentStep === 2) {
            // Blood type set via click listeners
            // Conditions
            const conds = [];
            document.querySelectorAll('.cond-checkbox').forEach(cb => {
                if (cb.checked) conds.push(cb.value);
            });
            this.tempData.conditions = conds;
            const customCondEl = document.getElementById('custom-condition');
            if (customCondEl) this.tempData.customCondition = customCondEl.value;
            // Allergies & meds set via tags
            const disEl = document.getElementById('p-disability');
            if (disEl) this.tempData.disability = disEl.value;
        } else if (this.currentStep === 3) {
            const hospEl = document.getElementById('p-hospital');
            const langEl = document.getElementById('p-language');
            const notesEl = document.getElementById('p-notes');
            if (hospEl) this.tempData.hospital = hospEl.value;
            if (langEl) this.tempData.language = langEl.value;
            if (notesEl) this.tempData.notes = notesEl.value;
        }
    }

    /**
     * Navigate between steps
     * @private
     */
    _navigateStep(dir) {
        this._saveStepState();

        // Validate required step fields
        if (dir > 0) {
            if (this.currentStep === 1) {
                if (!this.tempData.name || !this.tempData.name.trim()) {
                    this._shakeInput('p-name');
                    return;
                }
                if (!this.tempData.phone || !this.tempData.phone.trim()) {
                    this._shakeInput('p-phone');
                    return;
                }
                if (!this.tempData.pin || this.tempData.pin.length !== 4) {
                    this._shakeInput('p-pin');
                    if (window.notificationManager) {
                        window.notificationManager.showToast('A 4-digit PIN is required.', 'danger');
                    }
                    return;
                }
            } else if (this.currentStep === 2) {
                if (!this.tempData.bloodType) {
                    if (window.notificationManager) {
                        window.notificationManager.showToast('Please select your blood type.', 'warning');
                    }
                    return;
                }
            }
        }

        const nextStep = this.currentStep + dir;
        if (nextStep < 1 || nextStep > this.totalSteps) {
            if (nextStep > this.totalSteps) {
                // Submit saving
                const result = this.saveProfile(this.tempData);
                if (result.success) {
                    if (window.notificationManager) {
                        window.notificationManager.showToast('Profile saved successfully', 'success');
                    }
                    // Transition to Home Screen
                    if (window.app) {
                        window.app.navigateTo('home');
                    }
                } else {
                    if (window.notificationManager) {
                        window.notificationManager.showToast(result.error, 'danger');
                    }
                }
            }
            return;
        }

        // Apply slide animation
        const slider = document.getElementById('wizard-steps-slider');
        const nextStepEl = document.getElementById(`step-view-${nextStep}`);
        const currentStepEl = document.getElementById(`step-view-${this.currentStep}`);

        currentStepEl.classList.remove('active');
        nextStepEl.classList.add('active');

        // Translate the slides (100% per step)
        slider.style.transform = `translateX(-${(nextStep - 1) * 100}%)`;

        this.currentStep = nextStep;
        this._updateProgressUI();

        // If step 4, render the live template string
        if (this.currentStep === 4) {
            const previewEl = document.getElementById('emergency-message-preview');
            if (previewEl) {
                let currentLoc = null;
                if (window.locationManager && window.locationManager.currentPosition) {
                    currentLoc = window.locationManager.currentPosition;
                }
                // Use the in-progress wizard data so edits show in the preview.
                previewEl.textContent = this.getEmergencyMessage(currentLoc, this.tempData);
            }
        }
    }

    /**
     * Shake invalid element
     * @private
     */
    _shakeInput(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('animate-shake');
            el.focus();
            setTimeout(() => el.classList.remove('animate-shake'), 500);
        }
    }

    /**
     * Sync Wizard layout bars and active step indexes
     * @private
     */
    _updateProgressUI() {
        // Update bar width
        const bar = document.getElementById('wizard-bar');
        if (bar) {
            const pct = ((this.currentStep - 1) / (this.totalSteps - 1)) * 100;
            bar.style.width = `${pct}%`;
        }

        // Update dots status
        document.querySelectorAll('.wizard-dot').forEach(dot => {
            const step = parseInt(dot.getAttribute('data-step'));
            dot.classList.remove('active', 'complete');
            if (step === this.currentStep) {
                dot.classList.add('active');
            } else if (step < this.currentStep) {
                dot.classList.add('complete');
            }
        });

        // Toggle button labels
        const prevBtn = document.getElementById('wiz-prev-btn');
        const nextBtn = document.getElementById('wiz-next-btn');

        if (prevBtn) {
            prevBtn.style.visibility = this.currentStep === 1 ? 'hidden' : 'visible';
        }

        if (nextBtn) {
            nextBtn.textContent = this.currentStep === this.totalSteps ? 'Save' : 'Next';
            if (this.currentStep === this.totalSteps) {
                nextBtn.className = 'btn btn-danger';
            } else {
                nextBtn.className = 'btn btn-primary';
            }
        }
    }

    /**
     * Render the compact Profile summary card inside settings screen
     * @param {HTMLElement} container
     */
    renderProfileSummary(container) {
        if (!container) return;
        
        const p = this.getProfile();
        if (!p) {
            container.innerHTML = `
                <div class="card" style="text-align: center; padding: var(--space-6);">
                    <p style="color: var(--text-muted); margin-bottom: var(--space-4);">No user profile configured.</p>
                    <button class="btn btn-primary" id="settings-setup-profile-btn">Setup Profile</button>
                </div>
            `;
            document.getElementById('settings-setup-profile-btn').addEventListener('click', () => {
                if (window.app) window.app.navigateTo('onboarding');
            });
            return;
        }

        const condStr = (p.conditions && p.conditions.length > 0) 
            ? p.conditions.join(', ') + (p.customCondition ? `, ${p.customCondition}` : '')
            : (p.customCondition || 'None');

        container.innerHTML = `
            <div class="card">
                <div class="profile-summary">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
                        <h2 style="font-size: 18px; font-weight: 700; color: #fff;">${p.name}</h2>
                        <span class="badge badge-danger" style="font-size: 12px; font-weight: 800; padding: 4px 10px;">${p.bloodType}</span>
                    </div>

                    <div class="section-header">Personal Info</div>
                    <div class="profile-field-row">
                        <span class="profile-field-label">Primary Phone</span>
                        <span class="profile-field-value">${p.phone}</span>
                    </div>
                    <div class="profile-field-row">
                        <span class="profile-field-label">Age / Gender</span>
                        <span class="profile-field-value">${p.age || 'N/A'} yrs / ${p.gender || 'N/A'}</span>
                    </div>

                    <div class="section-header">Medical Details</div>
                    <div class="profile-field-row">
                        <span class="profile-field-label">Conditions</span>
                        <span class="profile-field-value">${condStr}</span>
                    </div>
                    <div class="profile-field-row">
                        <span class="profile-field-label">Allergies</span>
                        <span class="profile-field-value">${(p.allergies && p.allergies.length > 0) ? p.allergies.join(', ') : 'None'}</span>
                    </div>
                    <div class="profile-field-row">
                        <span class="profile-field-label">Medications</span>
                        <span class="profile-field-value">${(p.medications && p.medications.length > 0) ? p.medications.join(', ') : 'None'}</span>
                    </div>
                    <div class="profile-field-row">
                        <span class="profile-field-label">Disability</span>
                        <span class="profile-field-value">${p.disability || 'None'}</span>
                    </div>

                    <div class="section-header">Emergency Preferences</div>
                    <div class="profile-field-row">
                        <span class="profile-field-label">Preferred Hospital</span>
                        <span class="profile-field-value">${p.hospital || 'Not specified'}</span>
                    </div>
                    <div class="profile-field-row">
                        <span class="profile-field-label">Language</span>
                        <span class="profile-field-value">${p.language}</span>
                    </div>

                    <button class="btn btn-secondary" id="edit-profile-btn" style="margin-top: var(--space-4);">Edit Profile</button>
                </div>
            </div>
        `;

        document.getElementById('edit-profile-btn').addEventListener('click', () => {
            if (window.app) window.app.navigateTo('onboarding');
        });
    }

    /**
     * Render the compact medical info card on the emergency dashboard
     * @param {HTMLElement} container
     */
    renderMedicalCard(container) {
        if (!container) return;
        
        const p = this.getProfile();
        if (!p) {
            container.innerHTML = `<div class="card"><p style="font-size: 13px; color: var(--text-muted); text-align: center;">No profile setup</p></div>`;
            return;
        }

        const condStr = (p.conditions && p.conditions.length > 0) 
            ? p.conditions.join(', ') + (p.customCondition ? `, ${p.customCondition}` : '')
            : (p.customCondition || 'None');

        const allergies = (p.allergies && p.allergies.length > 0) ? p.allergies.join(', ') : 'None';
        const medications = (p.medications && p.medications.length > 0) ? p.medications.join(', ') : 'None';

        container.innerHTML = `
            <div class="card">
                <span class="dashboard-card-title">🚨 Patient Medical Profile</span>
                <div class="medical-summary-grid">
                    <div class="medical-summary-item">
                        <span class="medical-summary-label">Name</span>
                        <span class="medical-summary-value" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</span>
                    </div>
                    <div class="medical-summary-item">
                        <span class="medical-summary-label">Blood Type</span>
                        <span class="medical-summary-value" style="color: var(--emergency-red); font-weight: 700;">${p.bloodType}</span>
                    </div>
                    <div class="medical-summary-item" style="grid-column: 1 / span 2;">
                        <span class="medical-summary-label">Conditions</span>
                        <span class="medical-summary-value">${condStr}</span>
                    </div>
                    <div class="medical-summary-item">
                        <span class="medical-summary-label">Allergies</span>
                        <span class="medical-summary-value" style="color: var(--warning-yellow);">${allergies}</span>
                    </div>
                    <div class="medical-summary-item">
                        <span class="medical-summary-label">Medications</span>
                        <span class="medical-summary-value">${medications}</span>
                    </div>
                </div>
            </div>
        `;
    }
}

// Global instance
const profileManager = new ProfileManager();
window.profileManager = profileManager;
