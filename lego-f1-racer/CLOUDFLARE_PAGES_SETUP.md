# Cloudflare Pages 배포 가이드

다음 단계는 `lego-f1-racer` 정적 사이트를 Cloudflare Pages에 배포하기 위한 절차입니다.

## 1. Cloudflare 계정 및 새 Pages 프로젝트 생성
- [Cloudflare 대시보드](https://dash.cloudflare.com/)에 로그인하거나 새 계정을 만듭니다.
- 왼쪽 메뉴에서 **Workers & Pages** → **Pages**로 이동한 뒤 **Create a project**를 선택합니다.
- **Connect to Git**를 선택하여 GitHub 계정을 연결하고, 이 저장소를 선택합니다.

## 2. 빌드 설정 구성
- **Project name**은 원하는 이름으로 입력합니다. 이후 `your-project`라는 예시 이름을 사용합니다.
- **Production branch**는 기본 브랜치(예: `main`)로 지정합니다. 기본 브랜치에 푸시될 때 자동으로 배포됩니다.
- **Build settings**에서 **Framework preset**을 `None`으로 유지하고, **Build command**와 **Build output directory** 입력란에 각각 다음을 설정합니다:
  - Build command: 비워 둡니다. (빌드 없이 정적 자산만 업로드)
  - Build output directory: `lego-f1-racer`

## 3. 환경 변수 및 추가 설정
- 추가 환경 변수가 필요 없다면 그대로 **Save and Deploy**를 선택합니다.
- 첫 배포가 시작되고 완료될 때까지 대기합니다. 완료 후에는 `https://your-project.pages.dev` 형식의 프로덕션 URL과 미리보기 URL이 표시됩니다.

## 4. 자동 배포 및 커스텀 도메인
- 기본 브랜치에 커밋을 푸시하면 자동으로 새 배포가 생성됩니다.
- 커스텀 도메인이 필요하다면 Pages 프로젝트의 **Custom domains** 섹션에서 원하는 도메인을 추가합니다.
  - 도메인의 DNS에 `CNAME` 레코드를 추가하고, 대상은 `your-project.pages.dev`로 설정합니다.

## 5. 초기 배포 검증
- 초기 배포가 완료되면 Pages 미리보기 URL을 열고 게임 조작 키(방향키, `R` 키)가 정상적으로 동작하는지 확인합니다.
- 필요하다면 Pages 설정에서 **Web Analytics** 또는 **Speed Insights** 기능을 활성화하여 방문자 통계와 성능 데이터를 수집합니다.

## 6. 캐싱 정책 관리
- Cloudflare Pages는 기본적으로 자동 캐싱을 제공합니다. 정적 자산의 캐시 제어를 세밀하게 조정하려면 배포 출력 디렉터리(`lego-f1-racer`)에 `_headers` 파일을 추가합니다.
- `_headers` 예시:
  ```
  /game.js
    Cache-Control: public, max-age=31536000
  /styles.css
    Cache-Control: public, max-age=31536000
  /index.html
    Cache-Control: no-cache
  ```
  위 설정은 `game.js`와 `styles.css` 파일을 장기 캐시하고, HTML 문서는 항상 최신 콘텐츠를 확인하도록 구성합니다. 필요에 따라 각 자산에 맞는 정책을 정의하세요.

이 과정을 완료하면 `lego-f1-racer` 폴더의 정적 콘텐츠가 Cloudflare Pages를 통해 지속적으로 배포됩니다.
