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
  - 제목이 길 경우 SHA1 해시 suffix 추가: `memo/{bookSlug}/{hash}`
- **메모 단위**: Issue의 개별 Comment
- **Comment body 형식** (JSON 블록으로 구조화):

```
<!-- memo-data
{
  "selectedText": "드래그한 원문 텍스트",
  "note": "메모 내용",
  "occurrence": 0
}
-->
메모 내용 (사람이 읽을 수 있는 형태)
```

- **읽기/쓰기**: 모두 `process.env.VITE_GITHUB_TOKEN` 사용 (기존 env var 명칭 그대로)
- **소유자 검증**: `process.env.ADMIN_PASSWORD` 비교

---

## API: `api/memos.js`

### GET `/api/memos?book={bookSlug}&chapter={chapterPath}`
- `VITE_GITHUB_TOKEN`으로 해당 챕터 Issue 검색 후 comments 반환
- Issue 없으면 빈 배열 반환
- 응답 헤더: `s-maxage=60` CDN 캐시
- 응답 형식:
```json
[
  {
    "id": "comment_id",
    "selectedText": "원문 텍스트",
    "note": "메모 내용",
    "occurrence": 0,
    "createdAt": "2026-03-21T00:00:00Z"
  }
]
```

### POST `/api/memos`
- 요청 body: `{ bookSlug, chapterPath, selectedText, note, occurrence, adminPassword }`
- `adminPassword`는 `useAuth().getToken()`으로 전달 (기존 인증 패턴 준수)
- `process.env.ADMIN_PASSWORD`와 비교해 소유자 검증
- Issue 없으면 새로 생성 후 comment 추가
- 응답: 생성된 메모 객체

### PATCH `/api/memos`
- 요청 body: `{ commentId, note, adminPassword }`
- GitHub comment 내용 업데이트
- 응답: 수정된 메모 객체

### DELETE `/api/memos`
- 요청 body: `{ commentId, adminPassword }`
- GitHub comment 삭제

---

## Frontend Components

### `src/hooks/useChapterMemo.js`
- `memos` 상태 (배열), `loading`, `error` 상태
- `fetchMemos(bookSlug, chapterPath)` — GET 호출
- `addMemo(selectedText, note, occurrence)` — POST 호출, `getToken()`으로 adminPassword 전달
- `editMemo(commentId, note)` — PATCH 호출
- `deleteMemo(commentId)` — DELETE 호출

### `src/utils/memoDOM.js`
- `applyMemosToDOM(container, memos, onMemoClick)` — DOM에 📝 아이콘 삽입
  - `getTextNodes`를 `highlightDOM.js`에서 **export**하여 공유 (기존 private → named export로 변경)
  - `occurrence` 인덱스로 N번째 매치 선택
  - 매칭 텍스트 직후에 `<span class="memo-icon" data-mid="{id}">📝</span>` 삽입
  - 클릭 시 `onMemoClick(memo)` 콜백 호출
- `clearMemos(container)` — `span[data-mid]` 제거 후 **`container.normalize()` 호출**
  - normalize를 포함해야 분할된 텍스트 노드가 누적되지 않음

### `occurrence` 계산 (Chapter.jsx)
- `addMemo` 호출 전, 현재 `memos` 배열에서 동일 `selectedText`의 개수를 세어 `occurrence` 결정
- 예: 이미 같은 텍스트 메모가 2개면 `occurrence = 2`

### Chapter.jsx 변경
1. `useChapterMemo` 훅 추가
2. 기존 형광펜 팝업에 **"메모"** 버튼 추가
3. "메모" 클릭 시 textarea 입력 팝업으로 전환
4. **`highlights` 또는 `memos` 변경 시 반드시 두 함수 모두 재실행** (constraint):
   - `applyHighlightsToDOM(container, highlights, removeHighlight)` — 내부에서 `clearHighlights` + normalize 실행
   - `applyMemosToDOM(container, memos, onMemoClick)` — 내부에서 `clearMemos` + normalize 실행
   - 두 함수는 항상 이 순서로 함께 호출 (하이라이트 먼저)
5. 📝 아이콘 클릭 시 말풍선 표시 (메모 내용 + 소유자는 수정/삭제 버튼)
6. 소유자 판별: `useAuth()` 컨텍스트 활용

---

## DOM 조작 순서 (항상 쌍으로 호출)

```
applyHighlightsToDOM(container, highlights, removeHighlight)
  └─ clearHighlights() → mark 제거 + normalize()
  └─ findAndHighlight() × N → mark 삽입

applyMemosToDOM(container, memos, onMemoClick)
  └─ clearMemos() → span 제거 + normalize()
  └─ findAndInsertIcon() × N → span 삽입
```

두 함수는 항상 이 순서로 함께 호출. 단독 호출 금지.

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
[말풍선: 메모 내용 + (소유자) 수정/삭제 버튼]
```

---

## 반응형 디자인

- **768px 이하**: textarea 팝업 너비 90vw, 하단 고정
- **480px 이하**: 말풍선 너비 280px, 화면 밖 넘침 방지 (left 클램프)
- 모바일 텍스트 선택: 기존 `onTouchEnd` 이벤트 그대로 활용

---

## 환경변수

| 변수 | 용도 |
|------|------|
| `VITE_GITHUB_TOKEN` | GitHub API 읽기/쓰기 (기존) |
| `ADMIN_PASSWORD` | 소유자 검증 (기존) |

신규 환경변수 없음.

---

## 제약 및 고려사항

- **중복 텍스트**: `occurrence` 필드로 N번째 매치 지정
- **Rate limit**: `VITE_GITHUB_TOKEN` 사용으로 5000 req/hour 확보
- **Issue 제목 길이**: 경로가 길면 SHA1 해시로 단축
- **캐싱**: GET에 `s-maxage=60` 적용. 저장 후 클라이언트 상태는 즉시 업데이트되나, 다른 방문자는 최대 60초 후에 반영됨 (known tradeoff)
- **중복 저장 경쟁**: 동일 텍스트에 메모를 빠르게 두 번 저장하면 `occurrence`가 같아질 수 있음 (known limitation, 단일 사용자 시나리오에서는 실질적으로 발생 없음)
- **하이라이트+메모 동시 적용**: 두 함수는 항상 쌍으로 호출하는 것이 불변 규칙
