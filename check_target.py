# -*- coding: utf-8 -*-
import re

with open('data.js', 'r', encoding='utf-8') as f:
    text = f.read()

pattern = re.compile(r'"indexNumber":\s*(\d+).*?"title":\s*"(.*?)".*?"category":\s*"(.*?)".*?"channel":\s*"(.*?)"', re.DOTALL)
matches = pattern.findall(text)

ramen = [m for m in matches if m[2] == "라면/면요리"]

keywords = ["짜장", "짜파게티", "오빠게티", "간파게티", "짬뽕", "진짬뽕", "맵짜장", "짜장라면", "불짜장"]
targets = []

for m in ramen:
    idx, title, cat, channel = m
    t = title.lower()
    if any(k in t for k in keywords):
        targets.append(m)

with open('target_list.txt', 'w', encoding='utf-8') as out:
    out.write(f"총 라면/면요리: {len(ramen)}개\n")
    out.write(f"분리 대상 (짜장/짜파게티/짬뽕): {len(targets)}개\n\n")
    for m in targets:
        out.write(f"#{m[0]} [{m[3]}] {m[1]}\n")

    out.write("\n\n--- 다른 카테고리에 있는 짜장/짬뽕 키워드 ---\n")
    others = [m for m in matches if m[2] != "라면/면요리" and any(k in m[1].lower() for k in keywords)]
    for m in others:
        out.write(f"#{m[0]} ({m[2]}) [{m[3]}] {m[1]}\n")

print("target_list.txt 생성 완료")
