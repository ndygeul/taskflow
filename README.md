# TaskFlow: IT Infrastructure & Service Management Portal

TaskFlow는 서버 관리자와 운영팀을 위한 통합 관리 시스템입니다. 시스템 모니터링, 작업 일지, 일정 관리, 자산 관리 기능을 단일 플랫폼에서 제공하여 업무 효율성을 극대화합니다.

## 🚀 주요 기능
- **통합 모니터링**: 서버 시스템 상태 실시간 대시보드 제공.
- **작업 관리 (Journal)**: 일일 작업 일지 작성, 조회 및 이력 관리.
- **게시판 (Board)**: 일반 게시판 및 비밀 게시판을 통한 팀 내부 소통.
- **일정 관리 (Schedule)**: FullCalendar 기반의 개인 및 팀 일정 관리.
- **자산 및 장애 관리**: 장비(Equipment) 현황 및 장애(Fault) 이력 추적.
- **멀티 DB 지원**: MariaDB를 기본으로 Oracle, Tibero 데이터베이스 연동 가능.
- **통합 검색**: 프로젝트 내 업무 기록 및 자산 정보에 대한 강력한 검색 기능.

## 🛠 기술 스택
- **Backend**: Python 3.10+, FastAPI
- **Frontend**: Bootstrap 5, jQuery, Chart.js, CKEditor5
- **Database**: MariaDB 10.11 (Default), support for Oracle & Tibero
- **DevOps**: Docker, Docker Compose, GitHub Actions
- **Libraries**: SQLAlchemy, Jinja2, APScheduler

## 📦 설치 및 실행 방법 (Docker Compose)
프로젝트에는 Docker 환경이 구성되어 있어 빠르게 실행할 수 있습니다.
1. **저장소 복제**
   ```bash
   git clone [https://github.com/your-repo/taskflow.git](https://github.com/your-repo/taskflow.git)
   cd taskflow
2. 환경 변수 설정
   ```bash
   cp .env.example .env
3. 컨테이너 실행
   ```bash
   docker-compose up -d
4. 접속 확인
   http://<호스트IP>

## 📂 프로젝트 구조
- **app/**: FastAPI 애플리케이션 코어
- **core/**: DB 연결(Oracle, Tibero) 및 보안 설정
- **models/**: 데이터베이스 테이블 정의
- **routers/**: 각 기능별 API 엔드포인트
- **static/**: CSS, JS, 폰트 및 이미지 자산
- **templates/**: Jinja2 기반 HTML 템플릿
- **docker-compose.yml**: 인프라 구성 정의
