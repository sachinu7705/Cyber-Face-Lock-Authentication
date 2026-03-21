import sqlite3
from pathlib import Path
from config import DB_FILE

DB_FILE.parent.mkdir(parents=True, exist_ok=True)

def get_conn():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        pin TEXT
    )''')
    cur.execute('''
    CREATE TABLE IF NOT EXISTS unlock_log (
        id INTEGER PRIMARY KEY,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        name TEXT,
        method TEXT,
        app TEXT
    )''')
    conn.commit()
    conn.close()

def add_user(name, pin=None):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('INSERT OR IGNORE INTO users (name, pin) VALUES (?, ?)', (name, pin))
    conn.commit()
    conn.close()

def remove_user(name):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('DELETE FROM users WHERE name = ?', (name,))
    cur.execute('DELETE FROM unlock_log WHERE name = ?', (name,))
    conn.commit()
    conn.close()

def list_users():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT name, created_at FROM users ORDER BY id DESC')
    rows = cur.fetchall()
    conn.close()
    return rows

def log_unlock(name, method, app=None):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('INSERT INTO unlock_log (name, method, app) VALUES (?, ?, ?)', (name, method, app))
    conn.commit()
    conn.close()

def query_today():
    from datetime import datetime
    today = datetime.now().strftime('%Y-%m-%d')
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT name, COUNT(*) FROM unlock_log WHERE date(timestamp)=? GROUP BY name", (today,))
    rows = cur.fetchall()
    conn.close()
    return [(r[0], r[1]) for r in rows]

# init on import
init_db()
