import os
import glob
import re

def main():
    files = glob.glob('/Users/khcho/work_antigravity/s_guard_AI/frontend/src/**/*.jsx', recursive=True)
    count = 0
    for f in files:
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
        
        orig = content
        
        # Replace explicit strings
        content = content.replace("'http://localhost:8000'", "'https://sguardai.khcho0421.workers.dev'")
        content = content.replace("'https://api.chokerslab.store'", "'https://sguardai.khcho0421.workers.dev'")
        content = content.replace("`http://localhost:8000", "`https://sguardai.khcho0421.workers.dev")
        content = content.replace("`https://api.chokerslab.store", "`https://sguardai.khcho0421.workers.dev")

        # Also replace ternary strings like: window.location.hostname === 'localhost' ? 'http://localhost:8000' : 'https://...'
        # We can just let them be, but both sides become the new URL, which is fine functionally. 
        # But to be cleaner:
        content = content.replace("window.location.hostname === 'localhost' ? 'https://sguardai.khcho0421.workers.dev' : 'https://sguardai.khcho0421.workers.dev'", "'https://sguardai.khcho0421.workers.dev'")
        
        if content != orig:
            with open(f, 'w', encoding='utf-8') as file:
                file.write(content)
            count += 1
            print(f"Updated {f}")
    
    print(f"Total {count} files updated.")

if __name__ == '__main__':
    main()
