# AIContents

## LEGO F1 챔피언스

웹브라우저에서 실행할 수 있는 간단한 레고 스타일 F1 레이싱 게임 데모입니다. `lego-f1-racer/index.html` 파일을 열어 직접 체험해보세요.

## 브랜치 충돌(merge conflict) 해결 방법

GitHub Pull Request 화면에서 `This branch has conflicts that must be resolved` 경고가 보이면, 기준 브랜치(main 등)와 현재 작업 브랜치의 동일 파일이 서로 다른 방식으로 수정되었다는 뜻입니다. 아래 순서로 충돌을 해결한 뒤 다시 푸시하면 경고가 사라집니다.

1. **기준 브랜치 최신 내용 가져오기**
   ```bash
   git fetch origin
   ```
   기준 브랜치를 로컬에 최신 상태로 내려받습니다.

2. **작업 브랜치에 기준 브랜치 병합(혹은 리베이스)**
   가장 일반적인 방법은 병합입니다.
   ```bash
   git checkout 작업브랜치
   git merge origin/main
   ```
   리베이스를 선호한다면 `git rebase origin/main`을 사용합니다.

3. **충돌 표시 구간 수정**
   충돌이 난 파일에는 `<<<<<<<`, `=======`, `>>>>>>>` 표식이 들어갑니다. 원하는 내용으로 직접 수정을 끝낸 뒤 저장하세요.

4. **해결된 파일을 스테이징하고 커밋**
   ```bash
   git add <파일경로>
   git commit
   ```
   병합 커밋 메시지를 작성하거나, 리베이스 중이라면 `git rebase --continue`를 실행합니다.

5. **원격 브랜치 업데이트**
   ```bash
   git push origin 작업브랜치
   ```
   충돌을 해결한 커밋이 푸시되면 PR의 충돌 경고가 해제됩니다.

> 병합 도중 문제가 생기면 `git merge --abort`, 리베이스 중에는 `git rebase --abort`로 되돌릴 수 있습니다.

필요 시 GitHub의 **Resolve conflicts** 버튼으로 웹에서 직접 수정할 수도 있지만, 로컬에서 충돌을 해결하면 테스트와 확인이 수월합니다.
