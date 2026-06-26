/**
 * Contacts Manager - Handles emergency contacts CRUD operations
 * and rendering of the contacts interface.
 */
class ContactsManager {
    constructor() {
        this.STORAGE_KEY = 'sos_emergency_contacts';
        this.MAX_CONTACTS = 5;
        this.contacts = this.getContacts();
    }

    /**
     * Get contacts from localStorage
     * @returns {Array} Array of contact objects
     */
    getContacts() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error reading contacts from localStorage:', e);
            return [];
        }
    }

    /**
     * Save contacts to localStorage
     */
    _saveToStorage() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.contacts));
        } catch (e) {
            console.error('Error saving contacts to localStorage:', e);
        }
    }

    /**
     * Add a new contact
     * @param {Object} contact { name, phone, relationship }
     * @returns {Object} Added contact or error object
     */
    addContact(contact) {
        if (this.contacts.length >= this.MAX_CONTACTS) {
            return { error: `Maximum of ${this.MAX_CONTACTS} contacts reached.` };
        }

        if (!contact.name || !contact.name.trim()) {
            return { error: 'Name is required.' };
        }

        if (!contact.phone || !this.validatePhone(contact.phone)) {
            return { error: 'Valid phone number is required (at least 10 digits).' };
        }

        const newContact = {
            id: this._generateId(),
            name: contact.name.trim(),
            phone: contact.phone.trim(),
            relationship: contact.relationship || 'Other'
        };

        this.contacts.push(newContact);
        this._saveToStorage();
        return { success: true, contact: newContact };
    }

    /**
     * Update an existing contact
     * @param {string} id Contact UUID
     * @param {Object} data Updated details
     * @returns {Object} Update status
     */
    updateContact(id, data) {
        const index = this.contacts.findIndex(c => c.id === id);
        if (index === -1) {
            return { error: 'Contact not found.' };
        }

        if (!data.name || !data.name.trim()) {
            return { error: 'Name is required.' };
        }

        if (!data.phone || !this.validatePhone(data.phone)) {
            return { error: 'Valid phone number is required.' };
        }

        this.contacts[index] = {
            id,
            name: data.name.trim(),
            phone: data.phone.trim(),
            relationship: data.relationship || 'Other'
        };

        this._saveToStorage();
        return { success: true, contact: this.contacts[index] };
    }

    /**
     * Delete a contact
     * @param {string} id Contact UUID
     * @returns {boolean} Success status
     */
    deleteContact(id) {
        const initialLength = this.contacts.length;
        this.contacts = this.contacts.filter(c => c.id !== id);
        if (this.contacts.length !== initialLength) {
            this._saveToStorage();
            return true;
        }
        return false;
    }

    /**
     * Get current number of contacts
     * @returns {number}
     */
    getContactCount() {
        return this.contacts.length;
    }

    /**
     * Validate phone number format (at least 10 digits, allows optional + prefix)
     * @param {string} phone
     * @returns {boolean}
     */
    validatePhone(phone) {
        const cleanPhone = phone.replace(/[^0-9+]/g, '');
        return cleanPhone.length >= 10;
    }

    /**
     * Render the contacts management list in the DOM
     * @param {HTMLElement} container
     */
    renderContactsList(container) {
        if (!container) return;
        container.innerHTML = '';

        this.contacts = this.getContacts(); // Reload fresh state

        if (this.contacts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <h3>No contacts added</h3>
                    <p>Add up to ${this.MAX_CONTACTS} emergency contacts. They will receive your location and live audio during an emergency.</p>
                </div>
            `;
        } else {
            const listDiv = document.createElement('div');
            listDiv.className = 'contacts-container';

            this.contacts.forEach(contact => {
                const initials = contact.name.split(' ').map(n => n[0]).join('').substring(0, 2);
                const card = document.createElement('div');
                card.className = 'contact-card';
                card.innerHTML = `
                    <div class="contact-info-block">
                        <div class="contact-avatar">${initials}</div>
                        <div class="contact-details">
                            <span class="contact-name">${contact.name}</span>
                            <span class="contact-phone">${contact.phone}</span>
                            <span class="contact-relation-badge">${contact.relationship}</span>
                        </div>
                    </div>
                    <div class="contact-actions">
                        <button class="contact-action-btn edit-btn" data-id="${contact.id}" title="Edit contact">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="contact-action-btn delete-btn" data-id="${contact.id}" title="Delete contact">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                            </svg>
                        </button>
                    </div>
                `;

                // Add event listeners
                card.querySelector('.edit-btn').addEventListener('click', (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    const c = this.contacts.find(item => item.id === id);
                    if (c) this.renderAddContactModal(document.getElementById('modal-content'), c);
                });

                card.querySelector('.delete-btn').addEventListener('click', (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    if (confirm('Are you sure you want to delete this contact?')) {
                        this.deleteContact(id);
                        this.renderContactsList(container);
                        if (window.notificationManager) {
                            window.notificationManager.showToast('Contact deleted', 'info');
                        }
                    }
                });

                listDiv.appendChild(card);
            });

            container.appendChild(listDiv);
        }

        // Add Floating Action Button for adding contact
        if (this.contacts.length < this.MAX_CONTACTS) {
            const fab = document.createElement('button');
            fab.className = 'add-contact-btn';
            fab.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
            `;
            fab.addEventListener('click', () => {
                this.renderAddContactModal(document.getElementById('modal-content'));
            });
            container.appendChild(fab);
        }
    }

    /**
     * Render the Add/Edit contact Modal form
     * @param {HTMLElement} container
     * @param {Object|null} editContact Contact to edit, or null for new contact
     */
    renderAddContactModal(container, editContact = null) {
        if (!container) return;
        const isEdit = editContact !== null;

        container.innerHTML = `
            <div class="contact-form">
                <h2 style="margin-bottom: var(--space-4); font-size: 20px; font-weight: 700;">
                    ${isEdit ? 'Edit Contact' : 'Add Contact'}
                </h2>
                <div class="form-group">
                    <label class="form-label">Name *</label>
                    <input type="text" id="contact-name-input" class="form-input" placeholder="Full Name" value="${isEdit ? editContact.name : ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Phone Number *</label>
                    <input type="tel" id="contact-phone-input" class="form-input" placeholder="e.g. 9876543210" value="${isEdit ? editContact.phone : ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Relationship</label>
                    <select id="contact-relationship-select" class="form-input">
                        <option value="Parent" ${isEdit && editContact.relationship === 'Parent' ? 'selected' : ''}>Parent</option>
                        <option value="Spouse" ${isEdit && editContact.relationship === 'Spouse' ? 'selected' : ''}>Spouse</option>
                        <option value="Sibling" ${isEdit && editContact.relationship === 'Sibling' ? 'selected' : ''}>Sibling</option>
                        <option value="Child" ${isEdit && editContact.relationship === 'Child' ? 'selected' : ''}>Child</option>
                        <option value="Friend" ${isEdit && editContact.relationship === 'Friend' ? 'selected' : ''}>Friend</option>
                        <option value="Other" ${!isEdit || editContact.relationship === 'Other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                <div style="display: flex; gap: var(--space-3); margin-top: var(--space-5);">
                    <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
                    <button class="btn btn-primary" id="modal-save-btn">Save</button>
                </div>
            </div>
        `;

        const overlay = document.getElementById('modal-overlay');
        overlay.classList.add('active');

        const close = () => {
            overlay.classList.remove('active');
            container.innerHTML = '';
        };

        document.getElementById('modal-cancel-btn').addEventListener('click', close);

        document.getElementById('modal-save-btn').addEventListener('click', () => {
            const name = document.getElementById('contact-name-input').value;
            const phone = document.getElementById('contact-phone-input').value;
            const relationship = document.getElementById('contact-relationship-select').value;

            let result;
            if (isEdit) {
                result = this.updateContact(editContact.id, { name, phone, relationship });
            } else {
                result = this.addContact({ name, phone, relationship });
            }

            if (result.error) {
                if (window.notificationManager) {
                    window.notificationManager.showToast(result.error, 'danger');
                } else {
                    alert(result.error);
                }
            } else {
                close();
                const contactsContainer = document.getElementById('contacts-container');
                if (contactsContainer) {
                    this.renderContactsList(contactsContainer);
                }
                if (window.notificationManager) {
                    window.notificationManager.showToast(isEdit ? 'Contact updated' : 'Contact added', 'success');
                }
            }
        });
    }

    /**
     * Get HTML string representing compact cards for the dashboard
     * @returns {string} HTML content
     */
    getAlertStatusCards() {
        const list = this.getContacts();
        if (list.length === 0) {
            return `<div style="grid-column: 1/-1; text-align: center; font-size: 13px; color: var(--text-muted); padding: var(--space-4);">No emergency contacts configured</div>`;
        }

        return list.map(c => `
            <div class="contact-status-card" id="contact-card-${c.id}">
                <span class="name">${c.name}</span>
                <span class="relation">${c.relationship}</span>
                <div class="contact-status-indicator sending" id="contact-status-${c.id}">
                    <span class="status-icon">⏳</span>
                    <span class="status-label">Queued</span>
                </div>
                <a href="tel:${c.phone}" class="contact-action-btn" style="position: absolute; right: 8px; top: 8px; width: 28px; height: 28px; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); display: flex; align-items: center; justify-content: center; border-radius: 50%; color: var(--pending-blue); text-decoration: none;" title="Call ${c.name}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                </a>
            </div>
        `).join('');
    }

    /**
     * Generate simple random UUID
     * @private
     * @returns {string}
     */
    _generateId() {
        return 'contact-' + Math.random().toString(36).substring(2, 9);
    }
}

// Global instance
const contactsManager = new ContactsManager();
window.contactsManager = contactsManager;
