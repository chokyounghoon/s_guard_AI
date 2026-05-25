import sqlite3
import re
import os
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "sguard.db")

class TokenManager:
    def __init__(self):
        self.init_db()

    def init_db(self):
        try:
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS TB_TOKEN_MAP (
                        session_id TEXT,
                        token_key TEXT,
                        original_value TEXT,
                        created_at DATETIME,
                        PRIMARY KEY (session_id, token_key)
                    )
                """)
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to initialize TB_TOKEN_MAP: {e}")

    def _get_next_token_id(self, session_id: str, prefix: str) -> str:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COUNT(*) FROM TB_TOKEN_MAP 
                WHERE session_id = ? AND token_key LIKE ?
            """, (session_id, f"[{prefix}_%]"))
            count = cursor.fetchone()[0]
            return f"[{prefix}_{count + 1}]"

    def _save_token(self, session_id: str, token_key: str, original_value: str):
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO TB_TOKEN_MAP (session_id, token_key, original_value, created_at)
                VALUES (?, ?, ?, ?)
            """, (session_id, token_key, original_value, datetime.utcnow()))
            conn.commit()

    def _get_original_value(self, session_id: str, token_key: str) -> str:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT original_value FROM TB_TOKEN_MAP
                WHERE session_id = ? AND token_key = ?
            """, (session_id, token_key))
            row = cursor.fetchone()
            return row[0] if row else token_key

    def tokenize(self, text: str, session_id: str) -> str:
        if not text:
            return text

        tokenized_text = text

        # 1. Phone Numbers (e.g. 010-1234-5678 or 01012345678)
        phone_pattern = re.compile(r'\b010[-.]?\d{3,4}[-.]?\d{4}\b')
        for match in set(phone_pattern.findall(tokenized_text)):
            token = self._get_next_token_id(session_id, "PHONE")
            self._save_token(session_id, token, match)
            tokenized_text = tokenized_text.replace(match, token)

        # 2. Emp ID (e.g. 18121020 or S06997)
        emp_id_pattern = re.compile(r'\b(?:18\d{6}|[S]\d{5})\b')
        for match in set(emp_id_pattern.findall(tokenized_text)):
            token = self._get_next_token_id(session_id, "EMP")
            self._save_token(session_id, token, match)
            tokenized_text = tokenized_text.replace(match, token)

        # 3. Name with Title (e.g. 홍길동 대리, 김철수 팀장)
        name_title_pattern = re.compile(r'([가-힣]{2,4})\s*(대리|과장|차장|부장|본부장|팀장|사원|주임|매니저|프로)(?:[가-힣]*)')
        for match in set(name_title_pattern.findall(tokenized_text)):
            name = match[0]
            # Replace only the name part
            token = self._get_next_token_id(session_id, "NAME")
            self._save_token(session_id, token, name)
            tokenized_text = tokenized_text.replace(name, token)

        # 4. Email
        email_pattern = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
        for match in set(email_pattern.findall(tokenized_text)):
            token = self._get_next_token_id(session_id, "EMAIL")
            self._save_token(session_id, token, match)
            tokenized_text = tokenized_text.replace(match, token)

        return tokenized_text

    def detokenize(self, text: str, session_id: str) -> str:
        if not text:
            return text

        detokenized_text = text
        token_pattern = re.compile(r'\[(PHONE|EMP|NAME|EMAIL)_\d+\]')
        
        for token in set(token_pattern.findall(text)):
            full_token = f"[{token}]"
            # It's actually matching the word inside brackets without brackets.
            pass

        # Use findall properly
        for full_token in set(re.findall(r'\[(?:PHONE|EMP|NAME|EMAIL)_\d+\]', text)):
            original_value = self._get_original_value(session_id, full_token)
            detokenized_text = detokenized_text.replace(full_token, original_value)

        return detokenized_text

tokenizer = TokenManager()
