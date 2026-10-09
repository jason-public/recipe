# -*- coding: utf-8 -*-
import re

SOURCE_FILE = r"C:\Users\prawe\.gemini\antigravity-ide\brain\01c9b5c1-1a59-4af3-87cb-da9f25ae1fa6\.system_generated\steps\7\content.md"

with open(SOURCE_FILE, "r", encoding="utf-8") as f:
    lines = f.readlines()

URL_REGEX = re.compile(r"https?://[^\s<>\"']+")

total_urls = []
for idx, line in enumerate(lines):
    # 상단 8줄의 Source 메타데이터 제외
    if idx < 7:
        continue
    urls = URL_REGEX.findall(line)
    for u in urls:
        total_urls.append((idx + 1, u, line.strip()))

print(f"Total lines: {len(lines)}")
print(f"Total recipe URLs found: {len(total_urls)}")
for idx, (ln, u, raw) in enumerate(total_urls[:10]):
    print(f"[{idx+1}] Line {ln}: {u}")
