import sys
sys.path.append("backend")
from utils.tokenizer import tokenizer
session_id = "test_session_1"
original_text = "이 인시던트는 홍길동 대리가 담당합니다. 연락처는 010-1234-5678 이며, 사번은 18121020, 이메일은 hong@shinhan.com 입니다."
print("Original:", original_text)

tokenized = tokenizer.tokenize(original_text, session_id)
print("Tokenized:", tokenized)

detokenized = tokenizer.detokenize(tokenized, session_id)
print("Detokenized:", detokenized)
