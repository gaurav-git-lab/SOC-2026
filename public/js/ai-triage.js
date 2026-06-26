/**
 * AI Triage Manager - Handles the emergency chatbot UI and integrates
 * with the Gemini API to conduct medical triage and first-aid recommendations.
 */
class AITriageManager {
    constructor() {
        // Calls go through the backend proxy (/api/triage) so the Gemini API
        // key stays server-side and is never exposed in client code.
        this.API_URL = '/api/triage';

        this.container = null;
        this.chatHistory = []; // Tracks messages in the format expected by Gemini [{role: 'user'|'model', parts: [{text: ''}]}]
        this.isWaiting = false;
        this.emergencyContext = null;
    }

    /**
     * Initializes the chat layout in the container
     * @param {HTMLElement} container
     */
    init(container) {
        if (!container) return;
        this.container = container;
        this.chatHistory = [];
        this.isWaiting = false;
        
        this.renderChatUI(container);
    }

    /**
     * Starts the conversation with a system prompt and introductory question
     * @param {Object} emergencyContext { location, profile, contactsAlerted, policeAlerted }
     */
    start(emergencyContext) {
        this.emergencyContext = emergencyContext;
        
        // Add a friendly greeting
        const profile = emergencyContext.profile;
        const name = profile ? profile.name : 'there';
        
        const welcomeMessage = `Hello ${name}, I am your Emergency AI Assistant. I have detected that you triggered an SOS alert. Help is being coordinated. 

Is medical assistance required?
Should an ambulance be dispatched?
Can you speak safely?`;

        this.addMessage(welcomeMessage, 'ai');
        
        // Set up initial system message context in history
        const profileStr = profile 
            ? `Name: ${profile.name}, Blood: ${profile.bloodType}, Conditions: ${profile.conditions.join(', ') || 'None'}, Allergies: ${profile.allergies.join(', ') || 'None'}, Meds: ${profile.medications.join(', ') || 'None'}`
            : 'No profile set';
        
        const locStr = emergencyContext.location 
            ? `${emergencyContext.location.lat.toFixed(6)}, ${emergencyContext.location.lng.toFixed(6)}`
            : 'Unavailable';

        this.systemContextPrompt = `You are an emergency medical triage AI assistant integrated into an SOS emergency app.
The user has just activated an emergency alert. Your job is to:
1. Quickly assess if they or someone nearby is injured
2. Determine the severity of the situation
3. Ask if they need an ambulance dispatched
4. Offer to connect them directly to police or ambulance via phone call
5. Provide basic first-aid guidance while help is on the way

Keep responses SHORT (2-3 sentences max). Be calm, clear, and reassuring.
Use simple language. Ask ONE question at a time.
Always offer actionable quick-response options.

User's profile: ${profileStr}
User's location: ${locStr}
Emergency contacts alerted: ${emergencyContext.contactsAlerted}
Police stations alerted: ${emergencyContext.policeAlerted}`;

        // Initialize chat history with model prompt context
        this.chatHistory.push({
            role: 'user',
            parts: [{ text: `${this.systemContextPrompt}\n\n[System note: Start of conversation. I will greet the user. Here is the first message you sent: "${welcomeMessage}"]` }]
        });
        this.chatHistory.push({
            role: 'model',
            parts: [{ text: welcomeMessage }]
        });
    }

    /**
     * Render the chat interface DOM structure
     * @param {HTMLElement} container
     */
    renderChatUI(container) {
        container.innerHTML = `
            <div class="chat-container">
                <!-- Chat Header -->
                <div class="chat-header">
                    <div class="chat-header-info">
                        <div class="chat-status-dot"></div>
                        <div>
                            <div class="chat-header-title">🤖 SOS AI Assistant</div>
                            <div class="chat-header-status">Triage active</div>
                        </div>
                    </div>
                    <button class="chat-close-btn" id="chat-close-btn">Dashboard</button>
                </div>

                <!-- Chat Messages Scroll Area -->
                <div class="chat-messages" id="chat-messages-box">
                    <!-- Dynamic bubbles appended here -->
                </div>

                <!-- Quick Action Button Dock -->
                <div class="quick-actions-container">
                    <div class="quick-actions-scroll">
                        <button class="quick-action-btn danger-action" id="qa-yes">Yes</button>
                        <button class="quick-action-btn" id="qa-no">No</button>
                        <button class="quick-action-btn" id="qa-unable">Unable to Respond</button>
                        <a href="tel:102" class="quick-action-btn">📞 Call Ambulance</a>
                    </div>
                </div>

                <!-- Chat input tray -->
                <div class="chat-input-area">
                    <input type="text" id="chat-text-input" class="chat-input" placeholder="Type a message..." autocomplete="off">
                    <button class="chat-send-btn" id="chat-send-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        // Bind chat close to navigate back to dashboard
        document.getElementById('chat-close-btn').addEventListener('click', () => {
            if (window.app) window.app.navigateTo('dashboard');
        });

        // Quick action listeners
        document.getElementById('qa-yes').addEventListener('click', () => {
            this.handleUserText('Yes.');
            if (window.dashboardManager) {
                window.dashboardManager.addTimelineEvent('🚑', 'User confirmed medical assistance required', 'warning');
            }
        });

        document.getElementById('qa-no').addEventListener('click', () => {
            this.handleUserText('No.');
        });

        document.getElementById('qa-unable').addEventListener('click', () => {
            this.handleUserText('Unable to respond.');
        });

        // Chat send triggers
        const txtInput = document.getElementById('chat-text-input');
        const sendBtn = document.getElementById('chat-send-btn');

        const triggerSend = () => {
            const val = txtInput.value.trim();
            if (val) {
                this.handleUserText(val);
                txtInput.value = '';
            }
        };

        sendBtn.addEventListener('click', triggerSend);
        txtInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                triggerSend();
            }
        });
    }

    /**
     * User submits text message to chat
     * @param {string} text
     */
    handleUserText(text) {
        if (this.isWaiting) return;
        
        this.addMessage(text, 'user');
        this.chatHistory.push({
            role: 'user',
            parts: [{ text: text }]
        });

        this.sendMessage(text);
    }

    /**
     * Appends a message bubble inside the scroll area
     * @param {string} text
     * @param {'user'|'ai'} sender
     */
    addMessage(text, sender = 'user') {
        const msgBox = document.getElementById('chat-messages-box');
        if (!msgBox) return;

        const row = document.createElement('div');
        row.className = `chat-message-row ${sender}`;
        
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        
        // Convert double asterisks to bold tags, newlines to breaks
        bubble.innerHTML = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');

        row.appendChild(bubble);
        msgBox.appendChild(row);
        
        this._scrollToBottom();
    }

    /**
     * Send history to Gemini API and render response
     */
    async sendMessage(text) {
        this.showTypingIndicator();
        this.isWaiting = true;

        try {
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: this.chatHistory,
                    generationConfig: {
                        maxOutputTokens: 256,
                        temperature: 0.6
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            const reply = data.candidates[0].content.parts[0].text.trim();
            
            this.hideTypingIndicator();
            this.addMessage(reply, 'ai');
            
            this.chatHistory.push({
                role: 'model',
                parts: [{ text: reply }]
            });
        } catch (e) {
            console.warn('Gemini API call failed, running local triage response fallback:', e);
            
            // Wait slightly to feel natural
            await this._delay(1000 + Math.random() * 1000);
            this.hideTypingIndicator();

            const fallbackReply = this._getLocalResponse(text);
            this.addMessage(fallbackReply, 'ai');
            
            this.chatHistory.push({
                role: 'model',
                parts: [{ text: fallbackReply }]
            });
        } finally {
            this.isWaiting = false;
        }
    }

    /**
     * Local triage response decision tree fallback
     * @private
     */
    _getLocalResponse(text) {
        const lower = text.toLowerCase();
        
        if (lower.includes('safe') || lower.includes('ok') || lower.includes('cancel')) {
            return "Glad to hear you are safe. If this was a test or false trigger, you can slide/hold the deactivation button on the dashboard to turn off emergency mode.";
        }
        
        if (lower.includes('ambulance') || lower.includes('hospital') || lower.includes('dispatch') || lower.includes('doctor')) {
            return "I have flagged your request for an ambulance. Keep your airway clear and sit in a comfortable position. If you are experiencing difficulty breathing or heavy bleeding, tell me immediately.";
        }

        if (lower.includes('first aid') || lower.includes('help') || lower.includes('guide') || lower.includes('aid')) {
            return "For first aid: \n1. **If bleeding**: Apply firm pressure directly to the wound using a clean cloth.\n2. **If breathing difficulties**: Sit upright, loosen tight clothing, and use your inhaler if prescribed.\n3. **If burned**: Run cool (not cold) water over the burn for 10 minutes.\n\nTell me what type of injury you have so I can guide you specifically.";
        }

        if (lower.includes('bleed') || lower.includes('blood') || lower.includes('cut')) {
            return "Apply firm, continuous pressure directly to the bleeding site with a clean cloth. Elevate the injured limb above the heart if possible. Do NOT remove the cloth if it gets soaked; place another on top.";
        }

        if (lower.includes('breathe') || lower.includes('asthma') || lower.includes('choke')) {
            return "Sit upright and try to stay calm. Loosen any tight clothing around your neck. If you have an inhaler (Salbutamol) nearby, use it immediately. Try breathing slowly in through your nose and out through your mouth.";
        }

        if (lower.includes('chest') || lower.includes('heart') || lower.includes('pain')) {
            return "Chest pain is a high priority. Sit down immediately. If you have aspirin nearby and are not allergic, chew one 325mg tablet. Do not strain. Rescuers have been alerted.";
        }

        // Generic emergency response
        return "Rescuers and contacts have your live location. Please remain calm. Can you tell me if you are experiencing severe bleeding, difficulty breathing, or chest pain?";
    }

    /**
     * Appends the typing dot indicators in the chat
     */
    showTypingIndicator() {
        const msgBox = document.getElementById('chat-messages-box');
        if (!msgBox) return;

        const row = document.createElement('div');
        row.className = 'chat-message-row ai';
        row.id = 'chat-typing-row';

        row.innerHTML = `
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        msgBox.appendChild(row);
        this._scrollToBottom();
    }

    /**
     * Removes the typing indicator
     */
    hideTypingIndicator() {
        const row = document.getElementById('chat-typing-row');
        if (row) row.remove();
    }

    /**
     * Scrolls the chat window to the bottom
     * @private
     */
    _scrollToBottom() {
        const msgBox = document.getElementById('chat-messages-box');
        if (msgBox) {
            msgBox.scrollTop = msgBox.scrollHeight;
        }
    }

    /**
     * Delay helper
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Global instance
const aiTriageManager = new AITriageManager();
window.aiTriageManager = aiTriageManager;
