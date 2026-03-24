import os
import logging
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 데이터베이스 설정
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://sguard_user:sguard_password@localhost:5432/sguard_db")
# Docker 내부에서 'db'를 사용하지만 호스트에서는 'localhost'일 수 있으므로 환경변수가 있으면 그것을 사용

engine = create_engine(DATABASE_URL)

def clear_all_data():
    tables = [
        "incident_history",
        "warroom_chats",
        "warroom_attachments",
        "action_results",
        "activity_logs",
        "autopilot_insight",
        "aichat_history",
        "incidents",
        "received_messages",
        "sms_history"
    ]
    
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            # PostgreSQL에서는 TRUNCATE ... CASCADE를 사용하여 제약 조건이 있는 테이블을 한꺼번에 비울 수 있습니다.
            table_list = ", ".join(tables)
            logger.info(f"Truncating tables: {table_list}")
            connection.execute(text(f"TRUNCATE {table_list} RESTART IDENTITY CASCADE;"))
            transaction.commit()
            logger.info("All data cleared successfully.")
        except Exception as e:
            transaction.rollback()
            logger.error(f"Failed to clear data: {e}")
            raise e

if __name__ == "__main__":
    clear_all_data()
