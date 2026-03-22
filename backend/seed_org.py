from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import sys

# Update the python path to import from the main application
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import OrganizationDB, UserDB

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sguard.db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Hardcoded data structure based on the user's provided image text
# Format: { 'Name': [Children] } or just 'Name' for leaves
org_data = [
    {
        "name": "임원실",
        "children": [
            "감사팀",
            "준법지원팀"
        ]
    },
    {
        "name": "경영부문",
        "children": [
            {
                "name": "경영기획본부",
                "children": [
                    "경영기획팀",
                    "재무팀",
                    "인사팀",
                    "현지법인"
                ]
            },
            {
                "name": "경영지원본부",
                "children": [
                    "품질혁신팀",
                    "구매계약팀",
                    "업무지원팀",
                    "변화추진SAQ"
                ]
            }
        ]
    },
    {
        "name": "미래성장부문",
        "children": [
            {
                "name": "AX본부",
                "children": [
                    "AI&DATA팀",
                    "AI운영팀"
                ]
            },
            {
                "name": "클라우드 본부",
                "children": [
                    "클라우드사업팀",
                    "클라우드운영팀",
                    "그룹클라우드팀"
                ]
            }
        ]
    },
    {
        "name": "개발운영부문",
        "children": [
            {
                "name": "그룹공통본부",
                "children": [
                    "공통지원팀",
                    "공통플랫폼팀"
                ]
            },
            {
                "name": "뱅킹본부",
                "children": [
                    "뱅킹코어팀",
                    "뱅킹정보팀",
                    "뱅킹글로벌팀"
                ]
            },
            {
                "name": "금융본부",
                "children": [
                    {
                        "name": "카드개발팀",
                        "children": [
                            "상담", "홈페이지", "오토금융", "모바일지원",
                            "내부관리지원", "재무정보", "BD플렛폼지원", "마케팅",
                            "포인트", "데이터비즈", "통합메시지"
                        ]
                    },
                    "증권개발팀",
                    "증권채널팀",
                    "라이프개발팀"
                ]
            },
            {
                "name": "DX본부",
                "children": [
                    "DX추진팀",
                    "금융DX팀",
                    "모바일DX팀",
                    "글로벌DX팀"
                ]
            }
        ]
    },
    {
        "name": "인프라&보안부문",
        "children": [
            {
                "name": "인프라 본부",
                "children": [
                    "인프라 SRE팀",
                    "뱅킹IS팀",
                    "뱅킹정보IS팀",
                    "뱅킹통신보안팀",
                    "카드IS팀",
                    "증권IS팀",
                    "라이프 IS팀"
                ]
            },
            {
                "name": "정보보호본부",
                "children": [
                    "보안컨설팅팀",
                    "보안사업팀",
                    "사이버대응팀"
                ]
            }
        ]
    },
    "TFT외부직원"
]

def seed_database():
    db = SessionLocal()
    try:
        # Clear existing org data
        db.query(OrganizationDB).delete()
        db.commit()
        print("Existing organization data cleared.")

        # Counters for generating codes
        counters = {1: 1, 2: 1, 3: 1, 4: 1}
        
        def get_prefix(depth):
            if depth == 1: return "DIV"
            if depth == 2: return "DEP"
            if depth == 3: return "TEA"
            return "PRT"

        def insert_recursive(nodes, parent_id=None, depth=1):
            sort_order = 0
            for item in nodes:
                # Determine name and children
                if isinstance(item, str):
                    name = item
                    children = []
                else:
                    name = item["name"]
                    children = item.get("children", [])

                # Generate code
                code = f"{get_prefix(depth)}-{counters[depth]:03d}"
                counters[depth] += 1

                # Create Node
                node = OrganizationDB(
                    name=name,
                    code=code,
                    parent_id=parent_id,
                    depth=depth,
                    sort_order=sort_order
                )
                db.add(node)
                db.flush() # To get the node.id immediately

                # Recursively add children
                if children:
                    insert_recursive(children, node.id, depth + 1)
                
                sort_order += 1

        # Start insertion exactly at depth 1
        insert_recursive(org_data, parent_id=None, depth=1)
        db.commit()
        print("Organization data seeded successfully.")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
