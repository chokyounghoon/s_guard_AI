import re

with open('/Users/khcho/work_antigravity/s_guard_AI/frontend/src/pages/DashboardPage.jsx', 'r') as f:
    content = f.read()

# Define the start and end markers
start_marker = r'<div className="relative">\s*\{\/\* Vertical Line \*\/\}\s*<div className="absolute left-\[11px\] top-4 bottom-4 w-\[2px\] bg-gradient-to-b from-blue-600/50 via-purple-500/50 to-transparent" \/>'
end_marker = r'\{\/\* Workflow Details Sidebar \*\/\}'

match_start = re.search(start_marker, content)
match_end = re.search(end_marker, content)

if not match_start or not match_end:
    print("Could not find markers")
    exit(1)

start_idx = match_start.start()
end_idx = match_end.start()

new_timeline = """<div className="bg-[#151926]/40 backdrop-blur-xl border border-white/5 rounded-3xl shadow-2xl relative p-5 lg:p-8 pb-8 mt-4">
            {/* 타임라인 선 */}
            <div className="absolute left-[38px] lg:left-[50px] top-10 bottom-10 w-[2px] bg-gradient-to-b from-blue-600/50 via-white/10 to-transparent pointer-events-none" />

            <div className="space-y-8">
              {selectedIncidentIdFlow ? (
                // Workflow Flow View
                <AnimatePresence>
                  {(() => {
                    const firstPendingIdx = FLOW_STEPS.findIndex(step => {
                      if (step.id === 'RAG_AGENT') {
                        return !incidentWorkflowSteps.find(s => s.id === 'RAG') && !incidentWorkflowSteps.find(s => s.id === 'AGENT');
                      }
                      return !incidentWorkflowSteps.find(s => s.id === step.id);
                    });
                    
                    return FLOW_STEPS.map((step, sIdx) => {
                      let stepData = incidentWorkflowSteps.find(s => s.id === step.id);
                      
                      if (step.id === 'RAG_AGENT') {
                         const rag = incidentWorkflowSteps.find(s => s.id === 'RAG');
                         const agent = incidentWorkflowSteps.find(s => s.id === 'AGENT');
                         if (rag && agent) {
                           stepData = { 
                             ...agent, 
                             id: 'RAG_AGENT',
                             timestamp: agent.timestamp > rag.timestamp ? agent.timestamp : rag.timestamp, 
                             detail: 'AI 에이전트 그룹이 수천 건의 과거 데이터와 내부 지식베이스를 결합하여 인시던트 근본 원인을 입체적으로 분석하고 대응 시나리오를 수립했습니다.' 
                           };
                         } else if (rag || agent) {
                           stepData = { ...(rag || agent), id: 'RAG_AGENT' };
                         }
                      }
                      
                      const done = !!stepData;
                      const next = sIdx === firstPendingIdx;
                      const Icon = step.icon;
                      
                      if (step.id === 'WARROOM' && stepData?.detail?.includes('2.0님')) {
                        stepData.detail = stepData.detail.replace('2.0님', '조경훈님');
                      }
                      
                      let intervalText = null;
                      let intervalMinutes = 0;
                      if (done && sIdx < FLOW_STEPS.length - 1) {
                        const nextId = FLOW_STEPS[sIdx+1].id;
                        let nextStepData = incidentWorkflowSteps.find(s => s.id === nextId);
                        if (!nextStepData && nextId === 'RAG_AGENT') {
                          nextStepData = incidentWorkflowSteps.find(s => s.id === 'RAG') || incidentWorkflowSteps.find(s => s.id === 'AGENT');
                        }
                        if (nextStepData) {
                          const diff = new Date(nextStepData.timestamp) - new Date(stepData.timestamp);
                          const m = Math.floor(diff / 60000);
                          const sec = Math.floor((diff % 60000) / 1000);
                          intervalMinutes = m;
                          intervalText = m > 60 ? `⏱ ${Math.floor(m/60)}시간 ${m%60}분 소요` : m > 0 ? `⏱ ${m}분 ${sec}초 소요` : `⏱ ${sec}초 소요`;
                        } else if (sIdx === firstPendingIdx - 1) {
                          const diff = currentTime - new Date(stepData.timestamp);
                          const m = Math.floor(diff / 60000);
                          const sec = Math.floor((diff % 60000) / 1000);
                          intervalMinutes = m;
                          intervalText = m > 60 ? `⏱ ${Math.floor(m/60)}시간 ${m%60}분 경과` : m > 0 ? `⏱ ${m}분 ${sec}초 경과` : `⏱ ${sec}초 경과`;
                        }
                      }
                      
                      const endStep = incidentWorkflowSteps.find(s => s.id === 'KNOWLEDGE');
                      const isClosed = !!endStep;

                      return (
                        <motion.div key={step.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: sIdx * 0.1 }} className="relative pl-14 lg:pl-20">
                          {/* 아이콘 마커 */}
                          <div className={`absolute left-0 top-0 w-10 h-10 lg:w-12 lg:h-12 rounded-2xl border-2 border-[#151926] z-20 flex items-center justify-center transition-all duration-500
                            ${done ? `bg-${step.color === 'blue' ? 'blue' : step.color === 'purple' ? 'purple' : step.color === 'indigo' ? 'indigo' : 'emerald'}-500 shadow-[0_0_15px_rgba(var(--color-${step.color === 'blue' ? 'blue' : step.color === 'purple' ? 'purple' : step.color === 'indigo' ? 'indigo' : 'emerald'}-500),0.5)]` : next ? 'bg-[#151926] border-blue-500' : 'bg-[#151926] border-white/10'}`}>
                            <Icon className={`w-4 h-4 lg:w-5 lg:h-5 ${done ? 'text-white' : next ? 'text-blue-400' : 'text-slate-600'}`} />
                            {next && <div className="absolute inset-0 rounded-2xl bg-blue-500/20 animate-ping" />}
                          </div>

                          {/* 콘텐츠 카드 */}
                          <div className={`p-4 lg:p-5 rounded-2xl border transition-all duration-300 ${done ? 'bg-white/[0.03] border-white/10 shadow-lg' : next ? 'bg-blue-900/10 border-blue-500/30 shadow-[0_0_20px_rgba(37,99,235,0.1)]' : 'bg-transparent border-transparent opacity-40'}`}>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                              <h4 className={`text-base font-black tracking-tight ${done ? 'text-white' : next ? 'text-blue-400' : 'text-slate-500'}`}>
                                {step.label}
                              </h4>
                              {done ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono text-slate-400 bg-black/30 px-2 py-0.5 rounded-md">{formatYYMMDD(stepData.timestamp)}</span>
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                </div>
                              ) : next && (
                                <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md uppercase animate-pulse border border-blue-500/20">Processing</span>
                              )}
                            </div>
                            
                            <p className={`text-sm leading-relaxed ${done ? 'text-slate-300' : next ? 'text-blue-200' : 'text-slate-600'}`}>
                              {done ? stepData.detail : next ? '실시간 AI 분석 및 보안 정책 대조를 통한 대응 시퀀스가 활성화되었습니다.' : '이전 단계 완료 대기 중'}
                            </p>

                            {/* 워룸 진입 버튼 */}
                            {(done || next) && step.id === 'WARROOM' && (
                              <button onClick={() => navigate(`/chat/${String(selectedIncidentIdFlow).replace('INC-', '')}`)} className={`mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-xs transition-all shadow-lg active:scale-95
                                ${isClosed ? 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>
                                <MessageSquare className="w-4 h-4" />
                                {isClosed ? '워룸 히스토리 보기' : 'War-Room 입장하기'}
                                <ChevronRight className="w-4 h-4 opacity-70" />
                              </button>
                            )}

                            {/* 소요 시간 라벨 */}
                            {intervalText && sIdx < FLOW_STEPS.length - 1 && (
                              <div className="mt-3 flex justify-end">
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shadow-sm ${
                                  intervalMinutes > 60 ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' : intervalMinutes > 10 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                }`}>
                                  {intervalText}
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    });
                  })()}
                </AnimatePresence>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                    <Activity className="w-8 h-8 text-slate-500" />
                  </div>
                  <h3 className="text-slate-400 font-bold mb-1">인시던트 상세 정보</h3>
                  <p className="text-sm text-slate-500">대시보드 또는 지도에서 인시던트를 선택하세요</p>
                </div>
              )}
            </div>
          </div>
          
          """

new_content = content[:start_idx] + new_timeline + content[end_idx:]

with open('/Users/khcho/work_antigravity/s_guard_AI/frontend/src/pages/DashboardPage.jsx', 'w') as f:
    f.write(new_content)

print("Timeline replaced successfully.")
