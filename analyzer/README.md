# App Store 리뷰 분석기

App Store 앱 ID를 입력하면 Apple 공개 RSS 피드에서 등록된 고객 리뷰를 모두 수집해
아래를 분석하는 순수 클라이언트(브라우저) 대시보드입니다. Astryx 디자인 시스템으로 UI를 구성합니다.

- **기간별 평점 변화** — 월별 평균 평점 추이(라인) + 월별 리뷰량·감정 구성(스택 막대)
- **긍/부정 평가 및 내용 그루핑** — 별점 + 한국어 감정 사전 결합 분류, 주제(토픽)별 감정 집계
- **리뷰 이벤트 흔적** — 평점 급락·리뷰 급증·버전 품질 저하·이벤트성(리뷰 유도) 리뷰 클러스터 자동 탐지
- **인사이트** — 위 결과를 종합한 자동 요약(추세, 핵심 강점/불만, 버전 영향, 평점 신뢰도)
- **CSV 내보내기** — 결과 헤더의 버튼으로 다운로드
  - `리뷰 CSV`: 전체 리뷰 + 분석 컬럼(감정, 평점·내용 불일치, 짧은정형5★, 주제, 제목, 내용)
  - `분석 요약 CSV`: 요약·월별 추이·주제·버전·이벤트·인사이트를 한 파일로
  - Excel 한글 호환을 위해 UTF-8 BOM 포함

## 구조

```
analyzer/
  src/
    engine/
      fetchReviews.js   # RSS 페이지 1~10 수집(재시도·중복제거·정규화)
      analyze.js        # 분석 엔진(순수 함수: 추세·감정·토픽·이벤트·인사이트)
      lexicon.js        # 한국어 감정/토픽 사전
    ui/
      App.jsx           # Astryx 대시보드
      charts.jsx        # 토큰 기반 SVG 차트(외부 차트 라이브러리 없음)
    main.jsx            # 엔트리(Astryx CSS import + 마운트)
  test/run.mjs          # 엔진 스모크 테스트(sample_page3.json)
  build.mjs             # esbuild 번들 → dist/
  index.html
```

## 빌드 & 실행

```bash
cd analyzer
node build.mjs           # dist/bundle.js, dist/bundle.css, dist/index.html 생성
npx serve dist -l 5174   # http://localhost:5174
```

개발 중 자동 리빌드: `node build.mjs --watch`

## 동작 원리 / 한계

- iTunes RSS(`itunes.apple.com/{country}/rss/customerreviews/...`)는 `Access-Control-Allow-Origin: *`
  를 반환하므로 백엔드 없이 브라우저에서 직접 호출합니다.
- **앱 명칭/아이콘/개발사**는 iTunes Lookup API에서 가져와 결과 상단에 타이틀로 표시합니다. 이 엔드포인트는
  CORS 헤더가 없어 `fetch`가 막히므로 JSONP(`callback=`, `<script>` 태그)로 로드합니다
  ([fetchAppInfo.js](src/engine/fetchAppInfo.js)). 실패해도 분석에는 영향이 없으며 `앱 {id}`로 대체됩니다.
- Apple 공개 RSS는 **앱당 최근 약 500건(10페이지 × 50)** 까지만 제공합니다. 그보다 오래된
  리뷰는 조회되지 않으며, 상한 도달 시 UI에 안내됩니다.
- 이 피드는 간헐적으로 빈 응답을 주므로 페이지별 최대 4회 재시도 후 판단합니다.
- 감정/토픽 분석은 투명한 한국어 사전 기반이며, 별점을 1차 신호로 사용하고 텍스트로 보정합니다
  (예: 5★이지만 "로그인 안 됨" 같은 평점·내용 불일치 감지).
```
