"""
SOS Guardian Backend Server
============================
Flask + SQLite backend for the SOS Guardian Emergency Response App.
Handles user profiles, emergency contacts, emergency activations,
and live GPS location streaming with full database persistence.
"""

import os
import sys
import json
import uuid
import sqlite3
import urllib.request
import urllib.error
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Load environment variables from .env file if python-dotenv is installed
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Ensure stdout/stderr can render the emoji used in log messages. Windows
# consoles default to cp1252, where printing emoji raises UnicodeEncodeError
# and (because logging happens inside request handlers) turns into a 500.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        pass

# ─── App Setup ────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'database.sqlite')

# Gemini config for the AI triage proxy. The key is read from the environment
# or loaded from a local .env file.
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
GEMINI_URL = ('https://generativelanguage.googleapis.com/v1beta/'
              'models/gemini-2.0-flash:generateContent')

app = Flask(__name__, static_folder='public', static_url_path='')
CORS(app)


# ─── Database Initialization ─────────────────────────────────────────────────
def get_db():
    """Returns a new database connection with row_factory set."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db():
    """Creates all tables if they don't already exist."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS profiles (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            email       TEXT,
            phone       TEXT NOT NULL,
            pin         TEXT NOT NULL,
            age         TEXT,
            gender      TEXT,
            blood_type  TEXT,
            conditions  TEXT,  -- JSON array
            allergies   TEXT,  -- JSON array
            medications TEXT,  -- JSON array
            disability  TEXT,
            hospital    TEXT,
            language    TEXT,
            notes       TEXT,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS contacts (
            id           TEXT PRIMARY KEY,
            profile_id   TEXT NOT NULL,
            name         TEXT NOT NULL,
            phone        TEXT NOT NULL,
            relationship TEXT DEFAULT 'Other',
            created_at   TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS emergencies (
            id            TEXT PRIMARY KEY,
            profile_id    TEXT,  -- nullable: emergencies can be activated anonymously
            status        TEXT DEFAULT 'active',  -- 'active', 'cancelled', 'resolved'
            latitude      REAL,
            longitude     REAL,
            accuracy      REAL,
            activated_at  TEXT DEFAULT (datetime('now')),
            deactivated_at TEXT,
            contacts_alerted INTEGER DEFAULT 0,
            stations_alerted INTEGER DEFAULT 0,
            stations_responded INTEGER DEFAULT 0,
            notes         TEXT,
            FOREIGN KEY (profile_id) REFERENCES profiles(id)
        );

        CREATE TABLE IF NOT EXISTS location_log (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            emergency_id  TEXT NOT NULL,
            latitude      REAL NOT NULL,
            longitude     REAL NOT NULL,
            accuracy      REAL,
            timestamp     TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (emergency_id) REFERENCES emergencies(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS alert_log (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            emergency_id TEXT NOT NULL,
            event_type   TEXT NOT NULL,  -- 'contact_alert', 'police_alert', 'police_response', 'ai_triage', 'system'
            target_name  TEXT,
            status       TEXT,
            message      TEXT,
            timestamp    TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (emergency_id) REFERENCES emergencies(id) ON DELETE CASCADE
        );
    """)

    conn.commit()
    conn.close()
    print("[DB] Database initialized successfully.")


def migrate_db():
    """Brings older database files up to the current schema.

    The first release shipped `emergencies.profile_id` as NOT NULL, which made
    anonymous activations (no saved profile) fail with a FOREIGN KEY/NOT NULL
    error. This rebuilds the table as nullable when an old schema is detected.
    """
    conn = get_db()
    cols = conn.execute("PRAGMA table_info(emergencies)").fetchall()
    profile_col = next((c for c in cols if c['name'] == 'profile_id'), None)

    if profile_col and profile_col['notnull'] == 1:
        print("[DB] Migrating emergencies.profile_id to nullable...")
        conn.executescript("""
            PRAGMA foreign_keys=OFF;
            BEGIN;
            CREATE TABLE emergencies_new (
                id            TEXT PRIMARY KEY,
                profile_id    TEXT,
                status        TEXT DEFAULT 'active',
                latitude      REAL,
                longitude     REAL,
                accuracy      REAL,
                activated_at  TEXT DEFAULT (datetime('now')),
                deactivated_at TEXT,
                contacts_alerted INTEGER DEFAULT 0,
                stations_alerted INTEGER DEFAULT 0,
                stations_responded INTEGER DEFAULT 0,
                notes         TEXT,
                FOREIGN KEY (profile_id) REFERENCES profiles(id)
            );
            INSERT INTO emergencies_new SELECT * FROM emergencies;
            DROP TABLE emergencies;
            ALTER TABLE emergencies_new RENAME TO emergencies;
            COMMIT;
            PRAGMA foreign_keys=ON;
        """)
        conn.commit()
        print("[DB] Migration complete.")

    conn.close()


# ─── Static File Serving ──────────────────────────────────────────────────────
@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')


# ─── PROFILE APIS ─────────────────────────────────────────────────────────────
@app.route('/api/profile', methods=['GET'])
def get_profile():
    """Returns the first (and only) user profile, or 404 if none exists."""
    conn = get_db()
    row = conn.execute("SELECT * FROM profiles LIMIT 1").fetchone()
    conn.close()

    if not row:
        return jsonify(None), 200

    profile = dict(row)
    # Parse JSON arrays
    for field in ('conditions', 'allergies', 'medications'):
        if profile.get(field):
            try:
                profile[field] = json.loads(profile[field])
            except (json.JSONDecodeError, TypeError):
                profile[field] = []
        else:
            profile[field] = []

    return jsonify(profile), 200


@app.route('/api/profile', methods=['POST'])
def save_profile():
    """Creates or updates the user profile."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    name = data.get('name', '').strip()
    phone = data.get('phone', '').strip()
    pin = data.get('pin', '').strip()

    if not name or not phone or not pin:
        return jsonify({"error": "Name, phone, and PIN are required"}), 400

    if len(pin) != 4 or not pin.isdigit():
        return jsonify({"error": "PIN must be exactly 4 digits"}), 400

    conn = get_db()
    existing = conn.execute("SELECT id FROM profiles LIMIT 1").fetchone()

    profile_id = existing['id'] if existing else str(uuid.uuid4())

    conditions = json.dumps(data.get('conditions', []))
    allergies = json.dumps(data.get('allergies', []))
    medications = json.dumps(data.get('medications', []))

    if existing:
        conn.execute("""
            UPDATE profiles SET
                name=?, email=?, phone=?, pin=?, age=?, gender=?,
                blood_type=?, conditions=?, allergies=?, medications=?,
                disability=?, hospital=?, language=?, notes=?,
                updated_at=datetime('now')
            WHERE id=?
        """, (
            name, data.get('email', ''), phone, pin, data.get('age', ''),
            data.get('gender', ''), data.get('bloodType', ''),
            conditions, allergies, medications,
            data.get('disability', ''), data.get('hospital', ''),
            data.get('language', ''), data.get('notes', ''),
            profile_id
        ))
    else:
        conn.execute("""
            INSERT INTO profiles (id, name, email, phone, pin, age, gender,
                blood_type, conditions, allergies, medications,
                disability, hospital, language, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            profile_id, name, data.get('email', ''), phone, pin,
            data.get('age', ''), data.get('gender', ''),
            data.get('bloodType', ''), conditions, allergies, medications,
            data.get('disability', ''), data.get('hospital', ''),
            data.get('language', ''), data.get('notes', '')
        ))

    conn.commit()
    conn.close()

    return jsonify({"success": True, "id": profile_id}), 200


@app.route('/api/profile/verify-pin', methods=['POST'])
def verify_pin():
    """Verify the user's 4-digit PIN."""
    data = request.get_json()
    pin = data.get('pin', '') if data else ''

    conn = get_db()
    row = conn.execute("SELECT pin FROM profiles LIMIT 1").fetchone()
    conn.close()

    if not row:
        return jsonify({"valid": False, "error": "No profile found"}), 404

    return jsonify({"valid": row['pin'] == pin}), 200


# ─── CONTACTS APIS ────────────────────────────────────────────────────────────
@app.route('/api/contacts', methods=['GET'])
def get_contacts():
    """Returns all emergency contacts for the current profile."""
    conn = get_db()
    profile = conn.execute("SELECT id FROM profiles LIMIT 1").fetchone()

    if not profile:
        conn.close()
        return jsonify([]), 200

    rows = conn.execute(
        "SELECT * FROM contacts WHERE profile_id=? ORDER BY created_at ASC",
        (profile['id'],)
    ).fetchall()
    conn.close()

    return jsonify([dict(r) for r in rows]), 200


@app.route('/api/contacts', methods=['POST'])
def add_contact():
    """Adds a new emergency contact (max 5)."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    name = data.get('name', '').strip()
    phone = data.get('phone', '').strip()

    if not name or not phone:
        return jsonify({"error": "Name and phone are required"}), 400

    conn = get_db()
    profile = conn.execute("SELECT id FROM profiles LIMIT 1").fetchone()

    if not profile:
        conn.close()
        return jsonify({"error": "No profile exists. Create a profile first."}), 400

    count = conn.execute(
        "SELECT COUNT(*) as cnt FROM contacts WHERE profile_id=?",
        (profile['id'],)
    ).fetchone()['cnt']

    if count >= 5:
        conn.close()
        return jsonify({"error": "Maximum 5 contacts allowed"}), 400

    contact_id = data.get('id') or str(uuid.uuid4())

    conn.execute(
        "INSERT INTO contacts (id, profile_id, name, phone, relationship) VALUES (?, ?, ?, ?, ?)",
        (contact_id, profile['id'], name, phone, data.get('relationship', 'Other'))
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True, "id": contact_id}), 201


@app.route('/api/contacts/<contact_id>', methods=['PUT'])
def update_contact(contact_id):
    """Updates an existing emergency contact."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    conn = get_db()
    conn.execute(
        "UPDATE contacts SET name=?, phone=?, relationship=? WHERE id=?",
        (data.get('name', ''), data.get('phone', ''), data.get('relationship', 'Other'), contact_id)
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True}), 200


@app.route('/api/contacts/<contact_id>', methods=['DELETE'])
def delete_contact(contact_id):
    """Deletes an emergency contact."""
    conn = get_db()
    conn.execute("DELETE FROM contacts WHERE id=?", (contact_id,))
    conn.commit()
    conn.close()

    return jsonify({"success": True}), 200


# ─── EMERGENCY APIS ───────────────────────────────────────────────────────────
@app.route('/api/emergency/activate', methods=['POST'])
def activate_emergency():
    """Activates a new emergency session. Logs it in the database."""
    data = request.get_json() or {}

    conn = get_db()
    profile = conn.execute("SELECT id FROM profiles LIMIT 1").fetchone()

    # No profile yet → store NULL (anonymous activation) rather than a dangling
    # 'anonymous' id that would violate the foreign key constraint.
    profile_id = profile['id'] if profile else None
    emergency_id = str(uuid.uuid4())

    lat = data.get('latitude')
    lng = data.get('longitude')
    accuracy = data.get('accuracy')

    conn.execute("""
        INSERT INTO emergencies (id, profile_id, status, latitude, longitude, accuracy)
        VALUES (?, ?, 'active', ?, ?, ?)
    """, (emergency_id, profile_id, lat, lng, accuracy))

    # Log activation event
    conn.execute("""
        INSERT INTO alert_log (emergency_id, event_type, status, message)
        VALUES (?, 'system', 'activated', 'Emergency SOS activated')
    """, (emergency_id,))

    conn.commit()
    conn.close()

    print(f"[EMERGENCY] 🚨 ACTIVATED — ID: {emergency_id} | Profile: {profile_id} | Location: {lat}, {lng}")

    return jsonify({"success": True, "emergency_id": emergency_id}), 201


@app.route('/api/emergency/deactivate', methods=['POST'])
def deactivate_emergency():
    """Deactivates (cancels/resolves) the most recent active emergency."""
    data = request.get_json() or {}
    reason = data.get('reason', 'cancelled')

    conn = get_db()
    emergency = conn.execute(
        "SELECT id FROM emergencies WHERE status='active' ORDER BY activated_at DESC LIMIT 1"
    ).fetchone()

    if not emergency:
        conn.close()
        return jsonify({"error": "No active emergency found"}), 404

    conn.execute("""
        UPDATE emergencies SET status=?, deactivated_at=datetime('now') WHERE id=?
    """, (reason, emergency['id']))

    conn.execute("""
        INSERT INTO alert_log (emergency_id, event_type, status, message)
        VALUES (?, 'system', ?, ?)
    """, (emergency['id'], reason, f'Emergency {reason} by user'))

    conn.commit()
    conn.close()

    print(f"[EMERGENCY] 🛑 DEACTIVATED — ID: {emergency['id']} | Reason: {reason}")

    return jsonify({"success": True}), 200


@app.route('/api/emergency/location', methods=['POST'])
def log_location():
    """Logs a GPS coordinate for the active emergency."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    conn = get_db()
    emergency = conn.execute(
        "SELECT id FROM emergencies WHERE status='active' ORDER BY activated_at DESC LIMIT 1"
    ).fetchone()

    if not emergency:
        conn.close()
        return jsonify({"error": "No active emergency"}), 404

    conn.execute("""
        INSERT INTO location_log (emergency_id, latitude, longitude, accuracy)
        VALUES (?, ?, ?, ?)
    """, (
        emergency['id'],
        data.get('latitude'),
        data.get('longitude'),
        data.get('accuracy')
    ))

    # Also update the emergency's last known location
    conn.execute("""
        UPDATE emergencies SET latitude=?, longitude=?, accuracy=? WHERE id=?
    """, (data.get('latitude'), data.get('longitude'), data.get('accuracy'), emergency['id']))

    conn.commit()
    conn.close()

    return jsonify({"success": True}), 200


@app.route('/api/emergency/log', methods=['POST'])
def log_alert_event():
    """Logs a timeline event (contact alert, police alert, etc.) for the active emergency."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    conn = get_db()
    emergency = conn.execute(
        "SELECT id FROM emergencies WHERE status='active' ORDER BY activated_at DESC LIMIT 1"
    ).fetchone()

    if not emergency:
        conn.close()
        return jsonify({"error": "No active emergency"}), 404

    conn.execute("""
        INSERT INTO alert_log (emergency_id, event_type, target_name, status, message)
        VALUES (?, ?, ?, ?, ?)
    """, (
        emergency['id'],
        data.get('event_type', 'system'),
        data.get('target_name'),
        data.get('status'),
        data.get('message')
    ))

    conn.commit()
    conn.close()

    return jsonify({"success": True}), 200


@app.route('/api/emergency/stats', methods=['POST'])
def update_emergency_stats():
    """Updates the summary stats for the active emergency."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    conn = get_db()
    emergency = conn.execute(
        "SELECT id FROM emergencies WHERE status='active' ORDER BY activated_at DESC LIMIT 1"
    ).fetchone()

    if not emergency:
        conn.close()
        return jsonify({"error": "No active emergency"}), 404

    conn.execute("""
        UPDATE emergencies SET
            contacts_alerted=?,
            stations_alerted=?,
            stations_responded=?
        WHERE id=?
    """, (
        data.get('contacts_alerted', 0),
        data.get('stations_alerted', 0),
        data.get('stations_responded', 0),
        emergency['id']
    ))

    conn.commit()
    conn.close()

    return jsonify({"success": True}), 200


# ─── AI TRIAGE PROXY ──────────────────────────────────────────────────────────
@app.route('/api/triage', methods=['POST'])
def triage_proxy():
    """Server-side proxy to the Gemini API so the API key never reaches the
    browser. Forwards the request body unchanged and returns Gemini's JSON."""
    if not GEMINI_API_KEY:
        print("[TRIAGE] Missing GEMINI_API_KEY environment variable")
        return jsonify({"error": "Gemini API key is not configured on the server. Please set the GEMINI_API_KEY environment variable."}), 500

    payload = request.get_json(silent=True) or {}
    body = json.dumps(payload).encode('utf-8')

    req = urllib.request.Request(
        f"{GEMINI_URL}?key={GEMINI_API_KEY}",
        data=body,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = resp.read()
        return app.response_class(data, status=200, mimetype='application/json')
    except urllib.error.HTTPError as e:
        return jsonify({"error": "Upstream AI error", "status": e.code}), 502
    except Exception as e:
        print(f"[TRIAGE] Proxy error: {e}")
        return jsonify({"error": "AI service unavailable"}), 502


# ─── HISTORY / ADMIN APIS ────────────────────────────────────────────────────
@app.route('/api/emergencies', methods=['GET'])
def get_emergency_history():
    """Returns all past emergencies."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM emergencies ORDER BY activated_at DESC"
    ).fetchall()
    conn.close()

    return jsonify([dict(r) for r in rows]), 200


@app.route('/api/emergencies/<emergency_id>/log', methods=['GET'])
def get_emergency_log(emergency_id):
    """Returns the full timeline log for a specific emergency."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM alert_log WHERE emergency_id=? ORDER BY timestamp ASC",
        (emergency_id,)
    ).fetchall()
    conn.close()

    return jsonify([dict(r) for r in rows]), 200


@app.route('/api/emergencies/<emergency_id>/locations', methods=['GET'])
def get_emergency_locations(emergency_id):
    """Returns the full GPS location history for a specific emergency."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM location_log WHERE emergency_id=? ORDER BY timestamp ASC",
        (emergency_id,)
    ).fetchall()
    conn.close()

    return jsonify([dict(r) for r in rows]), 200


# ─── Server Startup ──────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("=" * 60)
    print("  🛡️  SOS GUARDIAN — Backend Server")
    print("=" * 60)
    init_db()
    migrate_db()
    print(f"[SERVER] Database: {DB_PATH}")
    print(f"[SERVER] Frontend: {os.path.join(BASE_DIR, 'public')}")
    print(f"[SERVER] Starting on http://localhost:3000")
    print("=" * 60)
    app.run(host='0.0.0.0', port=3000, debug=True)
