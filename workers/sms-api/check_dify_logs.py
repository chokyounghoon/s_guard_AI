import os
import sqlite3
import json

wrangler_dir = '/Users/khcho/work_antigravity/s_guard_AI/workers/sms-api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/'
files = os.listdir(wrangler_dir)
sqlite_files = [f for f in files if f.endswith('.sqlite') and f != 'metadata.sqlite']

if not sqlite_files:
    print("No database found.")
    exit(0)

db_path = os.path.join(wrangler_dir, sqlite_files[0])
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=== LATEST DIFY DEBUG LOGS ===")
try:
    cursor.execute("SELECT * FROM dify_debug_logs ORDER BY id DESC LIMIT 5")
    rows = cursor.fetchall()
    for row in rows:
        print(f"\nID: {row['id']} | IncID: {row['inc_id']} | Code: {row['status_code']}")
        print(f"Endpoint: {row['api_endpoint']}")
        print(f"Error: {row['error_message']}")
        payload = row['request_payload']
        if payload:
            print("Payload (trimmed):", payload[:1200])
except Exception as e:
    print("Error querying database:", e)

conn.close()
