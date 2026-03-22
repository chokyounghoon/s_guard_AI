from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://sguard_user:sguard_password@localhost:5433/sguard_db"
engine = create_engine(DATABASE_URL)

try:
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS login_history CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS activity_logs CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS reset_verifications CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS users CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS organizations CASCADE;"))
    print("Outdated tables dropped successfully.")
except Exception as e:
    print(f"Error dropping tables: {e}")
