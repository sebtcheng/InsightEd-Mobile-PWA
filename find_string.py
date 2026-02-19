
filename = 'api/index.js'
with open(filename, 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if 'calculateSchoolProgress' in line:
            print(f"{i+1}: {line.strip()}")
