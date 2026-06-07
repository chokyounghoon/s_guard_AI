const fs = require('fs');
const file = '/Users/khcho/work_antigravity/s_guard_AI/frontend/src/pages/ChatSummaryPage.jsx';
const content = fs.readFileSync(file, 'utf8');

const startStr = "    const fetchSummary = async (isRetry = false) => {";
const endStr = "    fetchSummary();";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr, startIndex) + endStr.length;

if (startIndex === -1 || endIndex === -1) {
  console.log('Could not find start or end string');
  process.exit(1);
}

const newBlock = `    const checkExistingSummary = async () => {
      try {
        setIsLoading(true);
        const cleanId = String(incidentId || '').replace(/^INC-/i, '');
        console.log(\`[ChatSummary] Checking existing summary for \${cleanId}\`);
        const res = await fetch(getApiUrl(\`/db/summary/\${cleanId}\`), {
          headers: getAuthHeader()
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.summary) {
            setSummary(data.summary);
            setIsLoading(false);
            return;
          }
        }
        // DB에 요약이 없으면 자동 분석을 실행하지 않고 대기 (사용자가 직접 버튼 클릭해야 함)
        setSummary('');
        setIsLoading(false);
        setIsStreaming(false);
        setLoadingStatus('');
      } catch (e) {
        console.error("Failed to check existing summary:", e);
        setIsLoading(false);
        setIsStreaming(false);
      }
    };

    checkExistingSummary();`;

const newContent = content.substring(0, startIndex) + newBlock + content.substring(endIndex);
fs.writeFileSync(file, newContent, 'utf8');
console.log('Replacement successful!');
