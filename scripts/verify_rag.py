import requests
import json
import time

# Configuration
API_BASE = "https://sguardai.khcho0421.workers.dev"
# The DIFY_TOOL_KEY found in wrangler.toml
AUTH_TOKEN = "Bearer !QweAsd1018"

def test_rag_system():
    print("--- [RAG System Verification (768-dim)] ---")
    
    # 1. Test Data
    test_data = {
        "title": "네트워크 지연 장애 대응 가이드 (768-dim Test)",
        "content": "공통 네트워크 스위치 L3 장애 발생 시, 백업 라우터로의 세션 전환을 위해 BGP 라우팅 테이블을 강제로 갱신해야 합니다. 이 작업은 정지된 세션을 복구하는 최우선 단계입니다.",
        "category": "Network",
        "tags": "L3, BGP, Network, Test",
        "user_id": "TEST_ADMIN"
    }

    # 2. Save Knowledge
    print(f"Step 1: Saving test knowledge to D1...")
    save_res = requests.post(f"{API_BASE}/ai/knowledge/save", json=test_data)
    if save_res.status_code != 200:
        print(f"FAILED: {save_res.text}")
        return
    
    knowledge_id = save_res.json().get('id')
    print(f"SUCCESS: Knowledge ID {knowledge_id} saved.")

    # 3. Wait for sync (status update in D1)
    print("Step 2: Checking sync status (success in D1/Vectorize)...")
    time.sleep(2) # Give it a moment
    
    # We can check via the knowledge detail endpoint
    detail_res = requests.get(f"{API_BASE}/ai/knowledge/{knowledge_id}")
    if detail_res.status_code == 200:
        data = detail_res.json()
        status = data.get('status')
        print(f"Current Status: {status}")
        if status == 'SUCCESS':
            print("SUCCESS: Vectorize sync confirmed.")
        else:
            print(f"WARNING: Status is {status}. Error Log: {data.get('error_log')}")
    
    # 4. Perform AI Search (Similarity Search)
    print("\nStep 3: Performing Semantic Search...")
    query = "네트워크 스위치 장애시 라우팅 테이블 갱신 방법"
    search_res = requests.get(f"{API_BASE}/ai/knowledge/search", params={"q": query})
    
    if search_res.status_code == 200:
        results = search_res.json().get('results', [])
        print(f"Search Results Count: {len(results)}")
        if len(results) > 0:
            top_match = results[0]
            print(f"Top Match Title: {top_match.get('title')}")
            # Note: The search endpoint might not return the score directly depending on implementation, 
            # but we can try /retrieval if score is needed.
            print("SUCCESS: Semantic match found.")
        else:
            print("FAILED: No matching records found for relevant query.")
    
    # 5. Dify Retrieval emulation (check scores)
    print("\nStep 4: Checking Similarity Scores via /retrieval...")
    ret_res = requests.post(f"{API_BASE}/retrieval", 
                            headers={"Authorization": AUTH_TOKEN},
                            json={"query": query, "retrieval_setting": {"top_k": 3, "score_threshold": 0.0}})
    
    if ret_res.status_code == 200:
        records = ret_res.json().get('records', [])
        for i, rec in enumerate(records):
            print(f"Match {i+1}: Score={rec.get('score'):.4f}, Title={rec.get('title')}")
        if records and records[0].get('score') > 0.8:
            print("SUCCESS: High-precision match verified.")
    else:
        print(f"FAILED: Retrieval API error {ret_res.status_code}")

if __name__ == "__main__":
    test_rag_system()
