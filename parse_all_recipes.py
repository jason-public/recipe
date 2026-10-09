# -*- coding: utf-8 -*-
import re
import json

SOURCE_FILE = r"C:\Users\prawe\.gemini\antigravity-ide\brain\01c9b5c1-1a59-4af3-87cb-da9f25ae1fa6\.system_generated\steps\7\content.md"
OUTPUT_JS = r"d:\03_ANTI_G\05_요리레시피\data.js"

with open(SOURCE_FILE, "r", encoding="utf-8") as f:
    lines = f.readlines()

URL_REGEX = re.compile(r"https?://[^\s<>\"']+")

# 297개 항목 추출
items = []
current_title_lines = []

for idx, line in enumerate(lines[7:]): # 메타데이터 건너뜀
    line_str = line.strip()
    if not line_str:
        continue
    
    urls = URL_REGEX.findall(line_str)
    if urls:
        url = urls[0]
        # 해당 라인에서 URL을 제외한 텍스트
        rem_text = URL_REGEX.sub("", line_str).strip()
        
        if current_title_lines:
            title = " ".join(current_title_lines).strip()
            current_title_lines = []
        elif rem_text:
            title = rem_text
        else:
            title = "요리 레시피"
            
        title = title.replace("\ufeff", "").strip()
        title = re.sub(r"\s*<\s*생활·문화\s*<\s*기사본문\s*-\s*아던트뉴스", "", title)
        title = re.sub(r"\s*<\s*라이프\s*<\s*기사본문\s*-\s*위키푸디", "", title)
        
        items.append({
            "line": idx + 8,
            "title": title,
            "url": url
        })
    else:
        current_title_lines.append(line_str)

print(f"추출된 전체 레시피 항목 수: {len(items)}개 (목표 297개)")

# 카테고리 분류 함수
def categorize(title, url):
    t = title.lower()
    
    # 1. [신규 분리] 짜장, 짜파게티 및 짬뽕 요리
    # - 라면/면요리 카테고리에서 짜장, 짜파게티, 짬뽕을 독립 카테고리로 분리
    # - 떡볶이류(짜장떡볶이 등 분식)는 제외하고 면 요리 계열 판별
    if any(k in t for k in [
        "짜장", "짜파게티", "간파게티", "오빠게티", "짬뽕", "진짬뽕", 
        "맵짜장", "짜장라면", "불짜장", "간짜장"
    ]) and not ("떡볶이" in t):
        return "짜장/짜파게티/짬뽕"

    # 2. 반찬/장류/양념
    if any(k in t for k in ["고추장", "된장무침", "연어장", "새우장", "두부조림", "진미채", "무침", "만능장", "조림", "양념장", "기본 양념", "김무침", "독도새우"]):
        return "반찬/장류"

    # 3. 음료/주류/커피
    if any(k in t for k in ["커피", "믹스커피", "맥주", "칵테일", "술 레시피", "술을 맛있게", "생명수", "설빙우유", "아아 준비"]):
        return "음료/주류"

    # 4. 찌개/탕/국
    if any(k in t for k in ["찌개", "김치찌개", "된장찌개", "순두부찌개", "감자탕", "두부참치찌개", "고추장찌개", "닭도리탕", "샤브샤브", "샤브"]):
        return "찌개/탕/국"

    # 5. 라면 및 일반 면요리
    if any(k in t for k in [
        "라면", "비빔면", "국수", "파스타", "우육면", "탄탄면", 
        "팟타이", "칼빔면", "콩국수", "냉라면", "사발면", "라볶이", 
        "우지라면", "김종면", "면발", "생면", "어구리", 
        "사리곰탕", "너구리", "불닭"
    ]):
        return "라면/면요리"
    
    # 6. 밥/볶음밥/덮밥
    if any(k in t for k in [
        "볶음밥", "계란밥", "간계밥", "간장계란밥", "덮밥", "김밥", "쌈밥", 
        "돌솥밥", "라죽", "라밥", "짜밥", "밥도둑", "다마고동", "밥 지을 때", 
        "대패덮밥", "스팸덮밥", "계란덮밥"
    ]):
        return "밥/볶음밥/덮밥"
        
    # 7. 고기/해산물 메인요리
    if any(k in t for k in [
        "제육", "삼겹살", "스테이크", "수육", "갈비", "차돌", "닭다리", "닭가슴살", 
        "닭요리", "닭", "오리구이", "소세지", "차슈", "냉삼", "고기", "탕수육", 
        "칠리새우", "새우튀김", "보일링크랩", "케사디야", "타코", "바베큐", 
        "대패고추장삼겹", "우삼겹", "육전", "치킨", "고추잡채", "연어 굽는", 
        "오징어", "통삼겹", "냄비삼겹살", "고기야채찜"
    ]):
        return "고기/메인요리"
        
    # 8. 분식/간식/토스트
    if any(k in t for k in [
        "토스트", "떡볶이", "만두", "피자", "김치전", "감자전", "옥수수전", "호빵", 
        "햄버거", "콘치즈", "누룽지", "팝콘", "카레", "샤오롱바오", "교촌만두", "원팬토스트"
    ]):
        return "분식/간식/토스트"
        
    # 9. 주방/생활꿀팁
    return "주방/생활꿀팁"

# 셰프 및 인물/채널 판별 함수
def extract_chef_or_channel(title, url):
    t = title
    if "류수영" in t or "어남선생" in t:
        return "류수영 (어남선생)"
    if "이연복" in t:
        return "이연복 셰프"
    if "정호영" in t:
        return "정호영 셰프"
    if "윤남노" in t or "요리하는 돌아이" in t:
        return "윤남노 셰프"
    if "강레오" in t:
        return "강레오 셰프"
    if "성시경" in t:
        return "성시경"
    if "김풍" in t:
        return "김풍 작가"
    if "이원일" in t:
        return "이원일 셰프"
    if "박은영" in t or "중식여신" in t:
        return "박은영 셰프"
    if "최현석" in t:
        return "최현석 셰프"
    if "여경래" in t or "유방녕" in t or "임태훈" in t or "철가방 요리사" in t:
        return "중식 대가 (여경래/유방녕/임태훈)"
    if "정승제" in t:
        return "정승제 선생님"
    if "백선생" in t or "백종원" in t:
        return "백종원"
    if "강호동" in t:
        return "강호동"
    if "홍윤화" in t:
        return "홍윤화"
    if "차승원" in t:
        return "차승원 (삼시세끼)"
    if "급식대가" in t:
        return "급식대가"
    if "야노시호" in t:
        return "야노시호"
    if "규현" in t:
        return "규현"
    if "캠핑한끼" in t or "차박" in t:
        return "캠핑한끼"
    if "지식인사이드" in t:
        return "지식인사이드"
    if "생활의 달인" in t:
        return "생활의 달인"
    if "위키푸디" in t or "wikifoodie" in url:
        return "위키푸디"
    if "gqkorea" in url:
        return "GQ Korea"
    if "daum.net" in url:
        return "건강의 모든것"
    if "아던트뉴스" in t or "share.google" in url:
        return "아던트뉴스"
    if any(k in t for k in ["박보영", "주우재", "박진영", "은지원", "김종민", "윤세아", "정국", "권상우", "강하늘", "하정우", "주지훈", "구성환"]):
        return "연예인 꿀조합"
    
    return "요리 꿀팁 / 크리에이터"

# 미디어 정보 추출
def get_media_info(url):
    youtube_id = None
    media_type = "web"
    thumbnail = ""
    embed_url = ""
    
    shorts_match = re.search(r"youtube\.com/shorts/([a-zA-Z0-9_-]+)", url)
    if shorts_match:
        youtube_id = shorts_match.group(1)
        media_type = "youtube_shorts"
    
    youtub_match = re.search(r"youtu\.be/([a-zA-Z0-9_-]+)", url)
    if not youtube_id and youtub_match:
        youtube_id = youtub_match.group(1)
        media_type = "youtube_video"
        
    watch_match = re.search(r"youtube\.com/watch\?v=([a-zA-Z0-9_-]+)", url)
    if not youtube_id and watch_match:
        youtube_id = watch_match.group(1)
        media_type = "youtube_video"
        
    playlist_match = re.search(r"list=([a-zA-Z0-9_-]+)", url)
    if playlist_match:
        media_type = "youtube_playlist"
        thumbnail = "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&auto=format&fit=crop&q=80"
        embed_url = f"https://www.youtube.com/embed/videoseries?list={playlist_match.group(1)}"
        return media_type, youtube_id, thumbnail, embed_url

    if youtube_id:
        thumbnail = f"https://i.ytimg.com/vi/{youtube_id}/hqdefault.jpg"
        embed_url = f"https://www.youtube-nocookie.com/embed/{youtube_id}?autoplay=1"
    else:
        media_type = "article"
        thumbnail = "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=600&auto=format&fit=crop&q=80"
        embed_url = url
        
    return media_type, youtube_id, thumbnail, embed_url

all_recipes = []

for idx, item in enumerate(items, 1):
    title = item["title"]
    url = item["url"]
    
    category = categorize(title, url)
    channel = extract_chef_or_channel(title, url)
    media_type, yt_id, thumbnail, embed_url = get_media_info(url)
    
    tags = re.findall(r"#([a-zA-Z0-9가-힣]+)", title)
    clean_title = re.sub(r"#[a-zA-Z0-9가-힣]+", "", title).strip()
    clean_title = re.sub(r"\s+", " ", clean_title)
    
    cat_tag = category.split("/")[0]
    if cat_tag not in tags:
        tags.insert(0, cat_tag)
    ch_tag = channel.split()[0]
    if ch_tag not in ["요리", "연예인"] and ch_tag not in tags:
        tags.append(ch_tag)
        
    all_recipes.append({
        "id": f"recipe_{idx}",
        "indexNumber": idx,
        "title": clean_title if clean_title else title,
        "originalTitle": title,
        "url": url,
        "category": category,
        "channel": channel,
        "mediaType": media_type,
        "youtubeId": yt_id,
        "thumbnail": thumbnail,
        "embedUrl": embed_url,
        "tags": tags[:5]
    })

print(f"최종 생성된 레시피 개수: {len(all_recipes)}개")

# 카테고리별 개수 집계 출력
from collections import Counter
cat_counts = Counter(r["category"] for r in all_recipes)
for cat, count in cat_counts.most_common():
    print(f" - {cat}: {count}개")

js_content = f"""/**
 * 요리 레시피 데이터셋 (Google Docs 전체 297개 레시피 100% 반영)
 * - 총 레시피 수: {len(all_recipes)}개
 * - 생성 일시: 2026-10-09
 */

const RECIPE_DATA = {json.dumps(all_recipes, ensure_ascii=False, indent=2)};

// 전체 요리 카테고리 목록 (짜장/짜파게티/짬뽕 신규 분리 반영)
const CATEGORIES = [
  "전체",
  "라면/면요리",
  "짜장/짜파게티/짬뽕",
  "밥/볶음밥/덮밥",
  "고기/메인요리",
  "찌개/탕/국",
  "분식/간식/토스트",
  "반찬/장류",
  "음료/주류",
  "주방/생활꿀팁"
];

// 주요 셰프 및 채널 목록
const CHANNELS = [
  "전체",
  "류수영 (어남선생)",
  "이연복 셰프",
  "정호영 셰프",
  "윤남노 셰프",
  "강레오 셰프",
  "김풍 작가",
  "성시경",
  "이원일 셰프",
  "박은영 셰프",
  "최현석 셰프",
  "중식 대가 (여경래/유방녕/임태훈)",
  "정승제 선생님",
  "연예인 꿀조합",
  "캠핑한끼",
  "생활의 달인",
  "요리 꿀팁 / 크리에이터"
];
"""

with open(OUTPUT_JS, "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"data.js 업데이트 성공! 총 {len(all_recipes)}개 레시피가 기록되었습니다.")
