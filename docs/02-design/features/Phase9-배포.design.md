# Design: Phase9-배포

## 아키텍처 결정

- EC2 t2.micro에 Docker로 FastAPI + Redis 실행, DB는 RDS로 분리
- 프로덕션 전용 `docker-compose.prod.yml`로 로컬 설정과 완전 분리
- `entrypoint.prod.sh`: `--reload` 제거, `--workers 2` (t2.micro 1 vCPU 기준)
- `.env.production`은 서버에서 직접 생성, `.gitignore` 등록
- Alembic 마이그레이션은 컨테이너 시작 시 자동 실행

---

## 파일 구조

```
bridge/
├── docker-compose.prod.yml              # 신규: api + redis (db 제외)
└── backend/
    ├── entrypoint.prod.sh               # 신규: 프로덕션 uvicorn 실행
    ├── .env.production.template         # 신규: 환경변수 키 템플릿 (git 포함)
    └── .env.production                  # 서버에서 생성, git 제외 (gitignore)
```

---

## docker-compose.prod.yml

```yaml
version: "3.9"

services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    env_file:
      - ./backend/.env.production
    ports:
      - "8000:8000"
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped
    command: sh /app/entrypoint.prod.sh
```

**로컬 대비 변경 사항:**
- `db` 서비스 제거 (→ RDS 사용)
- 볼륨 마운트 `./backend:/app` 제거 (이미지에 소스 포함)
- `restart: unless-stopped` 추가
- `entrypoint.prod.sh` 호출로 변경
- `.env.production` 참조

---

## entrypoint.prod.sh

```sh
#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting production server..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 2
```

**로컬 대비 변경 사항:**
- `--reload` 제거
- `--workers 2` 추가 (t2.micro 1 vCPU 기준)

---

## .env.production.template

```env
# Database (RDS PostgreSQL)
DATABASE_URL=postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{RDS_ENDPOINT}:5432/{DB_NAME}
POSTGRES_DB={DB_NAME}
POSTGRES_USER={DB_USER}
POSTGRES_PASSWORD={DB_PASSWORD}

# Redis (EC2 로컬 컨테이너)
REDIS_URL=redis://redis:6379/0

# JWT
JWT_SECRET_KEY={랜덤 64자 이상 시크릿}
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=14

# Encryption (AES-256-GCM) — 32 bytes base64 인코딩
ENCRYPTION_KEY={base64 인코딩 32바이트 키}

# App
APP_ENV=production
APP_DEBUG=false
```

---

## .gitignore 추가

기존 `.gitignore`에 아래 항목 추가:

```
.env.production
```

---

## EC2 서버 설정 순서

### 1. 인스턴스 생성
- AMI: Amazon Linux 2023 또는 Ubuntu 22.04 LTS
- 인스턴스 타입: t2.micro
- 키페어: 신규 생성 또는 기존 사용
- 보안 그룹: 아래 인바운드 규칙 적용

### 2. 보안 그룹 설정

| 타입 | 프로토콜 | 포트 | 소스 | 용도 |
|------|---------|------|------|------|
| SSH | TCP | 22 | 내 IP | 서버 관리 |
| Custom TCP | TCP | 8000 | 0.0.0.0/0 | API 접근 |

### 3. Docker 설치 (Amazon Linux 2023)

```bash
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ec2-user

# Docker Compose V2
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
```

### 4. 프로젝트 배포

```bash
git clone {REPO_URL} /home/ec2-user/bridge
cd /home/ec2-user/bridge

# .env.production 생성 (템플릿 기반)
cp backend/.env.production.template backend/.env.production
nano backend/.env.production   # 실제 값 입력

# 빌드 및 실행
docker compose -f docker-compose.prod.yml up -d --build
```

---

## RDS 설정 체크리스트

### RDS 생성 옵션

| 항목 | 값 |
|------|---|
| 엔진 | PostgreSQL 16 |
| 인스턴스 | db.t3.micro (프리티어) |
| 스토리지 | gp2 20GB |
| 퍼블릭 액세스 | 비활성화 |
| VPC | EC2와 동일 VPC |
| 보안 그룹 | EC2 SG에서 5432 인바운드 허용 |

### RDS 보안 그룹 인바운드 규칙

| 타입 | 프로토콜 | 포트 | 소스 |
|------|---------|------|------|
| PostgreSQL | TCP | 5432 | EC2 보안 그룹 ID |

### DATABASE_URL 형식

```
postgresql+asyncpg://bridge:{password}@{rds-endpoint}.rds.amazonaws.com:5432/bridge
```

---

## 시크릿 생성 명령어

서버에서 `.env.production` 작성 시 아래 명령으로 시크릿 생성:

```bash
# JWT_SECRET_KEY (64바이트 hex)
openssl rand -hex 64

# ENCRYPTION_KEY (32바이트 base64)
python3 -c "import os, base64; print(base64.b64encode(os.urandom(32)).decode())"
```

---

## 헬스체크 및 검증

```bash
# 컨테이너 상태 확인
docker compose -f docker-compose.prod.yml ps

# 로그 확인
docker compose -f docker-compose.prod.yml logs api

# API 헬스체크
curl http://{EC2_PUBLIC_IP}:8000/health
# 기대 응답: {"status": "ok"}

# Swagger UI 접근 (선택)
# http://{EC2_PUBLIC_IP}:8000/docs
```

---

## 구현 순서

1. `backend/entrypoint.prod.sh` — 프로덕션 엔트리포인트
2. `backend/.env.production.template` — 환경변수 템플릿
3. `.gitignore` 수정 — `.env.production` 추가
4. `docker-compose.prod.yml` — 프로덕션 컴포즈
5. AWS RDS 생성 (콘솔)
6. AWS EC2 생성 + Docker 설치 (콘솔 + SSH)
7. EC2에서 git clone + `.env.production` 작성
8. `docker compose -f docker-compose.prod.yml up -d --build`
9. `GET /health` 헬스체크 확인
