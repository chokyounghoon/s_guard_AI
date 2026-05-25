import re

with open('/Users/khcho/work_antigravity/s_guard_AI/workers/sms-api/src/index.js', 'r') as f:
    content = f.read()

# 1. Replace specific 'SYSTEM' with c.get('user')?.employee_id || 'SYSTEM' in standard CRUD routes
replacements = [
    (r"\.bind\(hashedPw, modDt, 'SYSTEM', employee_id\.trim\(\)\)", r".bind(hashedPw, modDt, employee_id.trim(), employee_id.trim())"),
    (r"\.bind\(hashedTempPassword, modDt, 'SYSTEM', employee_id\.trim\(\)\)", r".bind(hashedTempPassword, modDt, employee_id.trim(), employee_id.trim())"),
    
    (r"data\.reg_id\s*\|\|\s*'SYSTEM',\s*now,\s*data\.mod_id\s*\|\|\s*'SYSTEM',\s*now", r"c.get('user')?.employee_id || 'SYSTEM', now, c.get('user')?.employee_id || 'SYSTEM', now"),
    (r"body\.reg_id\s*\|\|\s*'SYSTEM',\s*now,\s*body\.reg_id\s*\|\|\s*'SYSTEM',\s*now", r"c.get('user')?.employee_id || 'SYSTEM', now, c.get('user')?.employee_id || 'SYSTEM', now"),
    
    (r"body\.mod_id\s*\|\|\s*'SYSTEM',\s*now", r"c.get('user')?.employee_id || 'SYSTEM', now"),
    
    (r"'SYSTEM',\s*now,\s*'SYSTEM',\s*now,\s*now,\s*now", r"c.get('user')?.employee_id || 'SYSTEM', now, c.get('user')?.employee_id || 'SYSTEM', now, now, now"),
    (r"'SYSTEM',\s*now,\s*'SYSTEM',\s*now,\s*now", r"c.get('user')?.employee_id || 'SYSTEM', now, c.get('user')?.employee_id || 'SYSTEM', now, now"),
    (r"'SYSTEM',\s*now,\s*'SYSTEM',\s*now,", r"c.get('user')?.employee_id || 'SYSTEM', now, c.get('user')?.employee_id || 'SYSTEM', now,"),
    
    (r"user_id\s*\|\|\s*'SYSTEM'", r"user_id || c.get('user')?.employee_id || 'SYSTEM'"),
    (r"creator_id\s*\|\|\s*'SYSTEM'", r"creator_id || c.get('user')?.employee_id || 'SYSTEM'"),
    (r"sender_id\s*\|\|\s*'SYSTEM'", r"sender_id || c.get('user')?.employee_id || 'SYSTEM'"),
    (r"data\.user_id\s*\|\|\s*'SYSTEM'", r"data.user_id || c.get('user')?.employee_id || 'SYSTEM'"),
]

for old, new in replacements:
    content = re.sub(old, new, content)

with open('/Users/khcho/work_antigravity/s_guard_AI/workers/sms-api/src/index.js', 'w') as f:
    f.write(content)

print("Replacements done.")
