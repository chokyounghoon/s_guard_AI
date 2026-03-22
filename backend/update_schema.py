from sqlalchemy import create_engine, text
import os

DATABASE_URL = "postgresql://sguard_user:sguard_password@localhost:5433/sguard_db"
engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        # Add received_count to received_messages
        conn.execute(text("ALTER TABLE received_messages ADD COLUMN IF NOT EXISTS received_count INTEGER DEFAULT 1;"))
        conn.commit()
    print("Column 'received_count' added successfully to 'received_messages'.")
except Exception as e:
    print(f"Error: {e}")
