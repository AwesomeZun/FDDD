# FDDD 모션 쇼릴 (한국어 · 15초 / 30초)

[FDDD](https://github.com/AwesomeZun/FDDD)([flybrain.kr](https://flybrain.kr))를 소재로 만든 모션 그래픽 쇼릴입니다. 화면에 나오는 뇌, 스파이크, 연결, 단백질, 도킹 점수는 FDDD 저장소의 실제 데이터와 엔진 계산값으로 그렸습니다. HTML 한 파일이 원본이고, 그 HTML을 60fps로 프레임 단위 렌더해 MP4를 만들었습니다.

## 산출물 (`dist/`)

| 파일 | 설명 |
|---|---|
| `fddd-showreel-30s-ko-v1.0.0.mp4` | 30초 마스터. 1920×1080, 60fps, H.264 High(약 27 Mbps), Apple AAC VBR, -14 LUFS. 커버 이미지를 내장했습니다. |
| `fddd-showreel-15s-ko-v1.0.0.mp4` | 15초 마스터. 30초 편집본을 자른 것이 아니라 8마디에 맞춰 새로 짠 편집본입니다. |
| `fddd-showreel-30s-ko-share-v1.0.0.mp4` | 메신저 공유용 경량본(약 10 Mbps, 29.5 MB). 커버를 내장했습니다. |
| `fddd-showreel-15s-ko-share-v1.0.0.mp4` | 메신저 공유용 경량본(17 MB). 커버를 내장했습니다. |
| `fddd-showreel-v1.0.0.html` | 원본 HTML. 폰트, 데이터, 음악까지 전부 들어 있어 파일 하나만 열어도 재생됩니다. 15초/30초 전환, 스크럽, 키보드(Space 재생, ←/→ 한 프레임, Shift+←/→ 1초, 1/2 편집본 전환)를 지원합니다. |
| `thumbnails/*-cover-1920x1080-*` | 커버(재생 표시 + 길이 배지). MP4에 들어간 이미지와 같습니다. |
| `thumbnails/*-share-1200x630-*` | 링크 공유 카드(OG 이미지 비율). |

### 썸네일이 쓰이는 곳

- **Finder, QuickLook**: MP4 안의 커버(`covr`, attached_pic)를 보여 줍니다. `qlmanage -t`로 네 파일 모두 커버가 썸네일로 나오는 것을 확인했습니다.
- **첫 프레임을 썸네일로 쓰는 메신저·플레이어**: 0번 프레임이 포스터 구도입니다. 영상은 이 포스터가 슬라이스로 부서지며 시작합니다.
- **링크 미리보기(OG)**: `thumbnails/…share-1200x630…jpg`를 `og:image`로 쓰시면 됩니다.

## 구성

128 BPM, 1마디 = 1.875초입니다. 장면 경계와 음악 구간은 `src/edl.json` 한 곳에서 정하고, 영상과 음악이 같은 이벤트 목록(`data/events_*.json`)을 씁니다. 첫 드롭과 −13.09 임팩트에서 화면 밝기 급변과 오디오 트랜지언트의 시각 차이는 1 ms 이내입니다.

| 30초 | 15초 | 장면 | 내용 | 전환 |
|---|---|---|---|---|
| 0–3.75 | 0–1.88 | 뉴런 하나 | 포스터 → 슬라이스 붕괴 → 빛나는 뉴런 하나 → 줌아웃하며 1에서 167,122까지 카운트 | — |
| 3.75–7.5 | 1.88–3.75 | 커넥톰 | 실측 세포체 140,024개와 실제 스파이크, 해부 구조 콜아웃, 167,122 → 6,241,236 | 플래시 |
| 7.5–11.25 | 3.75–5.63 | 20개의 뇌 | 20마리 각자의 실제 스파이크 타일 월, 이름·스텝·스파이크 수 | 매치 컷 |
| 11.25–15 | 5.63–7.5 | 실제 도킹 | PARP1(4R6E) 리본이 그려지고, 15R 리간드가 Vina 1순위 포즈에 결합 | 휩 |
| 15–18.75 | 7.5–9.38 | 점수와 보상 | −13.09 kcal/mol 슬램 → 8개 조합 순위 → 보상 변환 | 임팩트 |
| 18.75–22.5 | 9.38–11.25 | 머물까요, 떠날까요 | 3D 초파리(flybody)가 분자 서식지를 비행, 학습된 선호와 운동 출력 | 줌 |
| 22.5–26.25 | — | 학습 루프 | 5단계 카드(실제 데이터 미니 비주얼) → 멈추지 않는 루프 | 글리치 |
| 26.25–28.13 | 11.25–13.13 | 원칙 | 진짜 도킹 점수. / 진짜 스파이크. / 가짜는 없습니다. | 스트로브 |
| 28.13–30 | 13.13–15 | FDDD | 뉴런들이 FDDD 글자로 모이고, 모인 뒤에도 스파이크가 계속됩니다 | 플래시 |

## 실제 데이터와 연출의 경계

FDDD가 "Nothing faked"를 원칙으로 삼는 프로젝트라서, 데이터처럼 보이는 요소는 실제 값만 쓰고 연출은 따로 밝혀 둡니다.

**실제 데이터 · 계산값**

- 뇌 점 구름: MaleCNS v1.0 실측 세포체 위치 140,024개(FDDD `public/data/brain-atlas`)입니다.
- 스파이크: FDDD의 MaleCNS LIF 엔진(`public/engine/malecns/core.js`)을 Node에서 그대로 실행해 기록했습니다(`build/sim.mjs`). 매 스텝 167,122개 뉴런과 6,241,236개 연결을 전부 계산하며, 스텝당 평균 스파이크는 11,530개로 FDDD 문서의 측정값(약 1.1만~1.2만)과 맞습니다. 주인공 개체는 192스텝, 타일 19마리는 각자 다른 시드로 60스텝씩 기록했습니다.
- 스파이크 수, 영역별 발화율, 해독된 운동 출력(회전·상승·추진) 패널은 같은 계산에서 나온 값입니다.
- 연결선: 커넥톰의 실제 연결(시냅스 5개 이상) 가운데 멀고 강한 연결 7,000개를 표본으로 골랐습니다.
- 단백질: 도킹에 쓴 수용체의 실제 Cα 좌표(4R6E 350개, 2P16 286개, 3LN1 552개)와 PDB 2차 구조입니다.
- 리간드와 점수: AutoDock Vina 1순위 포즈 원자 좌표, `multi-target.json`의 점수 8개, 탐색 상자(15 × 20 × 14 Å)와 exhaustiveness 8입니다.
- 보상: FDDD 비례 모드 식(최고 1.0 · 최저 0.05 선형 재조정)으로 계산했습니다.
- 학습된 선호: `docs/brain-reward-loop.md`에 기록된 로컬 20마리 약 9분 실행 후 1번 개체 값입니다.
- 초파리: flybody 해부 메시입니다.

**연출 · 설정값**

- 엔진에 넣은 입력 스케줄(감각 채널 변화, 보상 채널이 켜지는 구간)은 영상용으로 정한 값입니다. 스파이크는 그 입력에 대한 실제 계산 결과입니다.
- 재생 속도(초당 12스텝), 발화 잔광, 스캔 평면, 연결선 위를 달리는 펄스 표현, 카메라, 리간드가 날아드는 경로, 초파리 비행 경로와 날갯짓, 로고 모핑, 카운터 애니메이션은 연출입니다.
- 167,122는 FDDD 런타임 모델에 포함된 뉴런 수이며 공식 traced 수와 다릅니다(FDDD `docs/malecns-selection-audit.json` 참고).
- 보상은 학습에 쓰는 외부 보상이며 보정된 결합 친화도가 아닙니다. 영상 안에도 이 문장을 넣었습니다.

## 다시 만들기

```sh
# 데이터부터 다시 만들 때(FDDD 저장소 필요)
FDDD_DIR=/path/to/FDDD ./make.sh 1.0.1 data
# data/가 이미 있을 때
./make.sh 1.0.1
```

`make.sh`는 다음 순서로 실행합니다. HTML 조립(음악 없이) → 이벤트 추출 → 음악 합성 → 최종 HTML 조립 → 썸네일 → 60fps 렌더 → 음량 정규화 → MP4 합치기(커버 삽입) → 공유용 경량본.

필요한 것은 다음과 같습니다.

- Node 22 이상
- Python 3.11 이상(`numpy`, `scipy`, `fonttools`+`brotli`, `playwright`, `Pillow`)
- ffmpeg(macOS의 `aac_at` 인코더 사용)
- Playwright Chromium

폰트는 `~/Library/Fonts/PretendardVariable.ttf`와 `JetBrainsMonoNLNerdFontMono-{Medium,SemiBold,Bold}.ttf`를 서브셋으로 만들어 넣습니다. 렌더는 M4 Max 기준으로 30초 편집본이 약 1분 40초, 두 편집본 전체가 약 3분 걸립니다.

## 폴더

- `src/reel.js`: 렌더 엔진과 장면(WebGL2 점 구름·메시, HDR 톤매핑, 블룸·아나모픽 스트릭·색수차·그레인 후처리, 키네틱 타이포)
- `src/template.html`, `src/edl.json`: HTML 틀, 편집 결정표(장면·음악 구간)
- `build/sim.mjs`: 실제 스파이크 기록
- `build/prep.py`: 분자, 메시, 연결선 데이터 준비
- `build/build.py`: 단일 HTML 조립(폰트 서브셋 포함)
- `build/events.py`: 영상 이벤트 추출
- `build/audio.py`: 음악·효과음 합성(샘플 없이 numpy로 생성)
- `build/render.py`: MP4와 썸네일
- `build/preview.py`: 검수용 프레임 추출
- `data/`: 파생 데이터(gzip), 이벤트, 음악

## 크레딧 · 라이선스

- MaleCNS v1.0 커넥톰과 세포체 위치: FlyEM(HHMI Janelia), University of Cambridge, MRC Laboratory of Molecular Biology, Google Research. CC BY 4.0. 논문 “Sexual dimorphism in the complete connectome of the Drosophila male central nervous system”(2026), doi:10.1016/j.cell.2026.08.015
- 초파리 메시: flybody, TuragaLab, Apache-2.0
- 스파이크 엔진: FDDD MaleCNS LIF 엔진. [fly-connectome-template](https://github.com/cobanov/fly-connectome-template)(Mert Cobanov, Cobanov Template Attribution License 1.0) 기반입니다.
- 단백질 구조: RCSB PDB 4R6E, 2P16, 3LN1
- 도킹: AutoDock Vina(Webina). FDDD에서 실행한 결과를 사용했습니다.
- 폰트: Pretendard, JetBrains Mono. 둘 다 SIL Open Font License 1.1이며 서브셋으로 내장했습니다.
- 음악·효과음: `build/audio.py`로 직접 합성했습니다.
- 모션 디자인: Claude
