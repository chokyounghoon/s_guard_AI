import re

with open('frontend/src/pages/SCallertPage.jsx', 'r') as f:
    content = f.read()

# 1. Rule Setting
# 2. Incident Call Tracking
# 3. PDS API 설정 관리
# 4. 앱 통화 상태

# We will split the file into parts based on the section comments.
part1_split = content.split('{/* ════════════════════════════════════════════\n            2️⃣  INCIDENT CALL TRACKING (장애 ID 기반 발신 현황)\n        ════════════════════════════════════════════ */}')

before_incident = part1_split[0]
after_incident_part = part1_split[1]

part2_split = after_incident_part.split('{/* ════════════════════════════════════════════\n            3️⃣  PDS API 설정 관리\n        ════════════════════════════════════════════ */}')

incident_call_tracking = part2_split[0]
after_pds_part = part2_split[1]

part3_split = after_pds_part.split('        {selectedSid && (\n        <section className="bg-[#0c1020]/60 backdrop-blur-xl rounded-[2rem] border border-white/5 p-6 shadow-xl relative overflow-hidden mt-6">')

pds_api = part3_split[0]
app_call_status = '        {selectedSid && (\n        <section className="bg-[#0c1020]/60 backdrop-blur-xl rounded-[2rem] border border-white/5 p-6 shadow-xl relative overflow-hidden mt-6">' + part3_split[1]

# Now, let's fix the <main> tag.
before_incident = before_incident.replace(
    '<main className="flex-1 overflow-y-auto max-w-5xl mx-auto w-full px-4 py-6 space-y-6 pb-24">',
    '<main className="flex-1 overflow-y-auto w-full px-4 lg:px-6 2xl:px-8 py-6 pb-24 mx-auto max-w-[2000px]">\n  <div className="flex flex-col xl:flex-row gap-6 items-start">\n    {/* Left Column: Rule & PDS */}\n    <div className="w-full xl:w-7/12 flex flex-col gap-6">'
)

# After Rule Setting, add closing div for Rule, and append PDS API, then close Left Column.
# Actually, wait. The split point `before_incident` contains everything up to the end of Rule Setting.
# So we can just append PDS API directly.

left_column = before_incident + '{/* ════════════════════════════════════════════\n            3️⃣  PDS API 설정 관리\n        ════════════════════════════════════════════ */}' + pds_api + '    </div>\n\n'

right_column = '    {/* Right Column: Incident Call & App Call Status */}\n    <div className="w-full xl:w-5/12 flex flex-col gap-6">\n' + '{/* ════════════════════════════════════════════\n            2️⃣  INCIDENT CALL TRACKING (장애 ID 기반 발신 현황)\n        ════════════════════════════════════════════ */}' + incident_call_tracking + app_call_status

# The end of app_call_status has `</main>`. We need to insert `</div>` before `</main>` to close the flex-row container.
right_column = right_column.replace('      </main>', '    </div>\n  </div>\n      </main>')

new_content = left_column + right_column

with open('frontend/src/pages/SCallertPage.jsx', 'w') as f:
    f.write(new_content)

print("Done")
