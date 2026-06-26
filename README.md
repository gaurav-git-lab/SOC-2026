# 🛡️ SOS Guardian — Emergency Response App

SOS Guardian is a lightweight emergency response web application featuring a Flask + SQLite backend and a dynamic frontend built with vanilla HTML, CSS, and JavaScript. The application facilitates real-time user profiling, emergency contact management, PIN-secured emergency activation/deactivation, and live location streaming. It also integrates an AI triage system proxying requests securely to Google's Gemini API.

---

## 🚀 Features

- **Emergency Activation/Deactivation**: Single-click activation of SOS emergency sessions with PIN verification (4-digit code) to cancel or resolve.
- **Medical & Emergency Profile**: Store crucial details locally, such as blood type, medical conditions, allergies, active medications, disabilities, preferred hospital, and spoken languages.
- **Emergency Contacts**: Manage up to 5 custom emergency contacts with names, relationship categories, and phone numbers.
- **Live Location Tracking**: Periodic GPS tracking and coordinate streaming to update response stations or contacts in real-time.
- **AI Triage System**: Uses Gemini API proxying on the backend to evaluate emergency notes and classify situations securely without exposing API keys to the client.
- **Local Persistence**: Full SQLite database integration to store profile data, contact directories, activation logs, location logs, and system events.

---

## 🛠️ Tech Stack

- **Backend**: Python 3, Flask, SQLite3, Flask-CORS
- **Frontend**: Vanilla HTML5, CSS3 (Modern dark-themed UI), ES6 JavaScript
- **AI Engine**: Google Gemini API (`gemini-2.0-flash`) via python standard HTTP requests

---

## 📦 Project Structure

```text
├── server.py             # Flask backend API endpoints & database helper logic
├── database.sqlite       # Local SQLite database (Auto-created, Git-ignored)
├── .gitignore            # Git exclusion configuration
├── .env.example          # Template configuration file for environment keys
├── .env                  # Local secret key storage (Git-ignored)
└── public/               # Frontend asset directory
    ├── index.html        # Main app template
    ├── css/
    │   └── index.css     # Styling, animations, and typography
    └── js/
        ├── app.js        # Main initialization code
        ├── profile.js    # Medical profile management screen
        ├── contacts.js   # Emergency contact directory screen
        ├── ai-triage.js  # Gemini triage interaction
        ├── location.js   # GPS location tracking & logging
        └── ...           # Helper scripts (audio, battery, notifications)
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have Python 3.x installed.

### 1. Clone & Set Up the Repository

```bash
# Navigate to the workspace
cd SOC-2026
```

### 2. Configure Environment Variables

Create your local `.env` configuration:
```bash
# Copy template file
cp .env.example .env
```
Open `.env` and add your Gemini API Key:
```env
GEMINI_API_KEY=your_actual_gemini_api_key
```

### 3. Install Dependencies

Install Flask and Flask-CORS (you can also optionally install `python-dotenv` to load `.env` variables automatically):

```bash
pip install Flask flask-cors python-dotenv
```

### 4. Run the Server

Start the application:
```bash
python server.py
```
The server will initialize the SQLite database (`database.sqlite`) and host the app at **`http://localhost:3000`**.

---

## 🔒 Security Practices

- **API Keys**: Do not commit your `.env` file containing API keys. The `.gitignore` is configured to prevent environment configurations from being uploaded to GitHub.
- **Database**: The SQLite database file (`database.sqlite`) containing user profiles and active coordinates is local and excluded from commits.
