import os
from sqlalchemy import create_engine, MetaData
from datetime import datetime

DATABASE_URL = "postgresql://sguard_user:sguard_password@localhost:5433/sguard_db"
engine = create_engine(DATABASE_URL)
metadata = MetaData()
metadata.reflect(bind=engine)

def format_value(value):
    if value is None:
        return "NULL"
    if isinstance(value, str):
        # Escape single quotes and replace newlines with standard characters if needed
        # SQLite accepts newlines in strings, just need to escape ' with ''
        escaped = value.replace("'", "''")
        return f"'{escaped}'"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, datetime):
        return f"'{value.strftime('%Y-%m-%d %H:%M:%S')}'"
    return str(value)

tables_to_dump = [
    'users',
    'organizations',
    'login_history',
    'activity_logs',
    'incidents',
    'incident_history',
    'action_results',
    'received_messages',
    'sms_history',
    'alert_keywords',
    'warroom_chats',
    'warroom_attachments',
    'reset_verifications',
    'aichat_history',
    'autopilot_insight',
    'postmortems'
]

output_file = "/Users/khcho/work_antigravity/s_guard_AI/workers/sms-api/data_migration.sql"

with open(output_file, 'w', encoding='utf-8') as f:
    for table_name in tables_to_dump:
        if table_name not in metadata.tables:
            continue
            
        table = metadata.tables[table_name]
        with engine.connect() as conn:
            result = conn.execute(table.select())
            rows = result.fetchall()
            
            if not rows:
                continue
                
            columns = result.keys()
            col_names = ", ".join(f'"{col}"' for col in columns)
            
            f.write(f"\n-- Data for {table_name}\n")
            for row in rows:
                # rows contain tuples
                vals = []
                for idx, col in enumerate(columns):
                    val = row[idx]
                    vals.append(format_value(val))
                    
                val_str = ", ".join(vals)
                # D1 needs semicolon
                stmt = f'INSERT OR REPLACE INTO "{table_name}" ({col_names}) VALUES ({val_str});\n'
                f.write(stmt)

print(f"Migration script written to {output_file}")
