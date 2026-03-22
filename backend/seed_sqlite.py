import os
import sys
import hashlib
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import Base, UserDB, OrganizationDB, IncidentDB

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sguard.db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # 1. Seed Users
        users_data = [
            {
                "email": "test@shinhan.com",
                "name": "조경훈(수정)",
                "password_hash": "4fbf9ecf5e577f9028cc0ab5298bde61:00974f73c939aa9409cb0cc624c018dab60efa3e3b1c2387c829b298ff1e56d8",
                "role": "analyst",
                "company": "신한은행",
                "employee_id": "SH001",
                "phone": "010-0000-0000",
                "honbu": "금융본부",
                "team": "카드개발팀",
                "part": "모바일"
            },
            {
                "email": "khcho0421@gmail.com",
                "name": "조경훈",
                "password_hash": "f19a3e9b0b3d73cfaacafbbc3f28ca07:1f8ac864e2f1677a990eeb9643228d27d8cdce1dee22ef4e3ce81d20eb3eebe0",
                "role": "analyst",
                "company": "신한DS",
                "employee_id": "18121020",
                "phone": "010-4732-8880",
                "honbu": "금융본부",
                "team": "카드개발팀",
                "part": "상담"
            }
        ]
        
        for u in users_data:
            if not db.query(UserDB).filter(UserDB.email == u["email"]).first():
                user = UserDB(**u)
                db.add(user)
        
        # 2. Seed some mock incidents to show data
        if not db.query(IncidentDB).first():
            mock_incidents = [
                {
                    "code": datetime.now().strftime("%Y%m%d%03d"),
                    "title": "네트워크 지연 발생 (상담 시스템)",
                    "description": "상담 시스템 모바일 접속 지연 보고됨",
                    "severity": "MAJOR",
                    "status": "접수중",
                    "incident_type": "Network",
                    "created_at": datetime.now()
                }
            ]
            for inc in mock_incidents:
                db.add(IncidentDB(**inc))
                
        db.commit()
        print("SQLite Database seeded successfully with users and mock incidents.")
        
    except Exception as e:
        db.rollback()
        print(f"Error seeding: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
