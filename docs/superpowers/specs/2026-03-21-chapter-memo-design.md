# Chapter Memo Feature — Design Spec

**Date:** 2026-03-21
**Status:** Approved

---

## Overview

책방 챕터 페이지에서 텍스트를 드래그 선택한 후 메모를 작성할 수 있는 기능.
메모는 GitHub Issues API를 통해 저장되며 모든 방문자에게 공개된다.
작성/수정/삭제는 블로그 소유자(이찬한)만 가능하다.

---

## Data Storage

### GitHub Issues API

- **저장소**: `chanani/blog-posts` (기존 콘텐츠 레포)
- **Issue 구조**: 챕터마다 Issue 하나, 제목 형식 `memo/{bookSlug}/{chapterPath}`
- **메모 단위**: Issue의 개별 Comment
- **Comment body 형식** (JSON 블록으로 구조화):

```
<!-- memo-data
{
  "selectedText": "드래그한 원문 텍스트",
  "note": "메모 내용"
}
-->
메모 내용 (사람이 읽을 수 있는 형태)
```

- **읽기**: 공개 GitHub REST API — 누구나 가능
- **쓰기/수정/삭제**: GitHub PAT (`GITHUB_TOKEN`) → Vercel 서버리스 함수 경유

---

## API: `api/memos.js`

### GET `/api/memos?book={bookSlug}&chapter={chapterPath}`
- 해당 챕터의 Issue를 찾아 comments 목록 반환
- Issue 없으면 빈 배열 반환
- 응답 형식:
```json
[
  {
    "id": "comment_id",
    "selectedText": "원문 텍스트",
    "note": "메모 내용",
    "author": "chanani",
    "createdAt": "2026-03-21T00:00:00Z"
  }
]
```

### POST `/api/memos`
- 요청 body: `{ bookSlug, chapterPath, selectedText, note, adminToken }`
- `adminToken`으로 소유자 검증 (환경변수 `ADMIN_TOKEN`과 비교)
- Issue 없으면 새로 생성 후 comment 추가
- 응답: 생성된 메모 객체

### DELETE `/api/memos?commentId={id}`
- 요청 body: `{ adminToken }`
- GitHub comment 삭제

---

## Frontend Components

### `src/hooks/useMemo.js`
- `memos` 상태 (배열)
- `fetchMemos(bookSlug, chapterPath)` — GET 호출
- `addMemo(selectedText, note)` — POST 호출
- `deleteMemo(commentId)` — DELETE 호출

### `src/utils/memoDOM.js`
- `applyMemosToDOM(container, memos, onMemoClick)` — 형광펜처럼 DOM 조작
- 매칭된 텍스트 뒤에 `<span class="memo-icon">📝</span>` 삽입
- 클릭 시 말풍선 표시 콜백 호출
- `clearMemos(container)` — 기존 아이콘 제거

### `Chapter.jsx` 변경
1. 기존 형광펜 팝업에 **"메모"** 버튼 추가
2. "메모" 클릭 시 텍스트 입력 팝업으로 전환 (textarea)
3. 저장 후 `applyMemosToDOM` 재실행
4. 📝 아이콘 클릭 시 말풍선 (note 내용 + 소유자는 삭제 버튼)

---

## UI 흐름

```
[텍스트 드래그]
      ↓
[팝업: "형광펜" | "메모" | "✕"]
      ↓ (메모 클릭)
[팝업 전환: textarea + "저장" | "취소"]
      ↓ (저장)
[해당 텍스트 뒤에 📝 아이콘 표시]
      ↓ (아이콘 클릭)
[말풍선: 메모 내용 + 삭제 버튼(소유자)]
```

---

## 환경변수

| 변수 | 용도 |
|------|------|
| `GITHUB_TOKEN` | GitHub API 쓰기 (기존 사용 중) |
| `ADMIN_TOKEN` | 소유자 검증용 시크릿 (신규) |

---

## 제약 및 고려사항

- **텍스트 매칭**: 형광펜과 동일하게 `highlightDOM.js`의 `getTextNodes` + 정규식 방식 재사용
- **중복 메모**: 동일 텍스트에 여러 메모 가능 (각각 별도 아이콘)
- **Rate limit**: GitHub API 공개 읽기는 60req/hour, PAT 사용 시 5000req/hour
- **캐싱**: GET 응답에 `s-maxage=60` CDN 캐시 적용
- **모바일**: 아이콘 탭으로 말풍선 표시, 터치 UX 고려
