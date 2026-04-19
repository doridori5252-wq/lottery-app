@echo off
chcp 65001 >nul
cd /d "C:\Users\P S M\Desktop\lottery-app"

echo ====================================
echo  한국 로또 자동 업데이트 시작
echo  %date% %time%
echo ====================================

:: Node.js로 최신 회차 가져오기
echo.
echo [1/3] 최신 당첨번호 가져오는 중...
node scripts\fetch-lotto.js
if %errorlevel% neq 0 (
  echo 오류: 번호 가져오기 실패
  pause
  exit /b 1
)

:: 변경사항 확인
git diff --quiet js\app.js js\lotto-history.js sw.js
if %errorlevel% equ 0 (
  echo.
  echo 이미 최신 데이터입니다. 업데이트 불필요.
  goto :end
)

:: GitHub에 자동 커밋 & 푸시
echo.
echo [2/3] GitHub에 저장 중...
git add js\app.js js\lotto-history.js sw.js
git commit -m "auto: 한국 로또 최신 당첨번호 업데이트 %date%"

echo.
echo [3/3] Netlify 배포 중 (GitHub push)...
git -c http.sslBackend=openssl push origin main
if %errorlevel% neq 0 (
  echo 오류: GitHub push 실패. 인터넷 연결을 확인하세요.
  pause
  exit /b 1
)

echo.
echo ====================================
echo  업데이트 완료! Netlify 자동 배포됩니다.
echo ====================================

:end
timeout /t 5 >nul
