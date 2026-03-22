import os

def main():
    filepath = "/Users/khcho/work_antigravity/s_guard_AI/backend/main.py"
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Inject get_kst
    if "def get_kst():" not in content:
        import_stmt = "from datetime import datetime, timedelta"
        new_import = """from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

def get_kst():
    return datetime.now(ZoneInfo('Asia/Seoul')).replace(tzinfo=None)"""
        content = content.replace(import_stmt, new_import, 1)

    # Replace datetime.utcnow()
    content = content.replace("datetime.utcnow()", "get_kst()")
    
    # Replace datetime.utcnow
    content = content.replace("datetime.utcnow", "get_kst")

    # Replace datetime.now()
    content = content.replace("datetime.now()", "get_kst()")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

if __name__ == "__main__":
    main()
