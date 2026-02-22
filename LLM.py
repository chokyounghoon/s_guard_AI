import json
import re

def mask_log(log_line):
    """로그 내의 IP 주소나 숫자를 <IP>, <NUM> 기호로 치환하여 패턴화합니다."""
    log_line = re.sub(r'\d+\.\d+\.\d+\.\d+', '<IP>', log_line)
    log_line = re.sub(r'\b\d+\b', '<NUM>', log_line)
    return log_line.strip()

# 1. 파일 읽기 및 전처리
logs = []
print("HDFS_2k.log 파일을 읽고 파싱을 시작합니다...")
with open('HDFS_2k.log', 'r') as f:
    for line in f:
        # 로그의 앞부분(날짜, 시간, PID 등)을 제외하고 실제 핵심 메시지 부분만 추출합니다.
        # HDFS 로그 샘플 기준 'INFO' 이후의 텍스트를 사용
        parts = line.strip().split('INFO')
        if len(parts) > 1:
            msg = mask_log(parts[1])
            logs.append(msg)

# 2. 슬라이딩 윈도우로 학습 데이터 세트 생성 (컨텍스트 3개 -> 타겟 1개)
window_size = 3
dataset = []

for i in range(len(logs) - window_size):
    context = logs[i : i + window_size]
    target = logs[i + window_size]
    
    # MLX LLaMA 파인튜닝 포맷에 맞춘 프롬프트 작성
    prompt = "다음은 시스템 로그의 연속된 흐름입니다. 정상적인 다음 로그 패턴을 예측하세요.\n"
    prompt += "\n".join([f"이전 로그 [{j+1}]: {log}" for j, log in enumerate(context)])
    prompt += f"\n\n[예측된 다음 로그]: {target}"
    
    # "text" 키를 가진 JSON 포맷으로 저장 (Hugging Face / MLX 기본 규격)
    dataset.append({"text": prompt})

# 3. JSONL 파일로 저장
with open('train.jsonl', 'w', encoding='utf-8') as f:
    for item in dataset:
        f.write(json.dumps(item, ensure_ascii=False) + '\n')

print(f"완료! 총 {len(dataset)}개의 학습 데이터가 'train.jsonl' 파일로 생성되었습니다.")