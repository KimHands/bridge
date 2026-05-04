# Plan: Phase9-배포

## 개요

Bridge API를 AWS 프로덕션 환경에 배포한다.
EC2 t2.micro에 Docker로 FastAPI를 실행하고, RDS PostgreSQL을 DB로 사용한다.
로컬 Docker Compose와 분리된 프로덕션 전용 설정을 구성한다.

## 목표

1. **프로덕션 Docker 설정** — `docker-compose.prod.yml` + `entrypoint.prod.sh`
2. **환경변수 템플릿** — `.env.production.template` (gitignore 대응)
3. **EC2 서버 설정 가이드** — Docker 설치, 보안 그룹, 포트
4. **RDS 연결 및 Alembic 마이그레이션** — 프로덕션 DB 초기화
5. **배포 실행 및 헬스체크** — `GET /health` 정상 확인

## 범위

### 포함

1. **docker-compose.prod.yml**
   - `api` + `redis` 서비스만 포함 (db → RDS로 대체)
   - 볼륨 마운트 제거 (`./backend:/app` 삭제)
   - `restart: unless-stopped` 추가
   - `.env.production` 파일 참조

2. **entrypoint.prod.sh**
   - `--reload` 제거
   - `--workers 2` (t2.micro 1 vCPU 기준)
   - alembic upgrade head 포함

3. **.env.production.template**
   - `DATABASE_URL`: RDS endpoint 형식
   - `REDIS_URL`: EC2 로컬 Redis (`redis://redis:6379/0`)
   - `JWT_SECRET_KEY`, `ENCRYPTION_KEY`: 프로덕션 전용 랜덤 값
   - `APP_ENV=production`, `APP_DEBUG=false`

4. **EC2 설정 체크리스트**
   - OS: Amazon Linux 2023 또는 Ubuntu 22.04
   - 패키지: Docker, Docker Compose, git
   - 보안 그룹: 인바운드 8000(API), 22(SSH)
   - EC2 → RDS: PostgreSQL 5432 아웃바운드 허용

5. **RDS 설정 체크리스트**
   - 엔진: PostgreSQL 16
   - 인스턴스: db.t3.micro (프리티어)
   - 보안 그룹: EC2 SG에서 5432 인바운드만 허용
   - 퍼블릭 액세스: 비활성화 (VPC 내 통신)

6. **Alembic 마이그레이션**
   - entrypoint.prod.sh 실행 시 자동 적용 (`alembic upgrade head`)

### 제외

- Nginx 리버스 프록시 / SSL (도메인 없으면 EC2 IP 직접 접근)
- CI/CD 파이프라인 (GitHub Actions)
- ElastiCache (t2.micro 제약으로 EC2 로컬 Redis 사용)
- S3 연동 (현재 기능에서 사용 안 함)
- FCM / APNs 푸시 알림

## 현재 상태 분석

| 항목 | 현재 (로컬) | 프로덕션 목표 |
|------|------------|------------|
| `entrypoint.sh` | `--reload` 포함 | `--reload` 제거, `--workers 2` |
| `docker-compose.yml` | db/redis/api 3개 | api/redis 2개 (db → RDS) |
| DB 호스트 | `db:5432` (컨테이너) | RDS endpoint |
| `APP_ENV` | development | production |
| `APP_DEBUG` | true | false |
| 볼륨 마운트 | `./backend:/app` (hot-reload) | 없음 (이미지에 포함) |

## 구현 파일 목록

```
bridge/                             # 프로젝트 루트
├── docker-compose.prod.yml         # 프로덕션 컴포즈 (신규)
└── backend/
    ├── entrypoint.prod.sh          # 프로덕션 엔트리포인트 (신규)
    └── .env.production.template    # 환경변수 템플릿 (신규, 커밋 포함)
    # .env.production               # 실제 시크릿 (gitignore, 서버에서 생성)
```

## 핵심 제약

- `t2.micro` 1 vCPU / 1 GB RAM → uvicorn `--workers 2` 이하
- `.env.production`은 절대 git에 커밋하지 않음 (시크릿 포함)
- RDS 퍼블릭 액세스 비활성화 → EC2와 같은 VPC에 위치해야 통신 가능
- `DATABASE_URL`의 드라이버: `postgresql+asyncpg://` (asyncpg 사용 중)

## 완료 기준

- [ ] `docker-compose.prod.yml` 생성 완료
- [ ] `entrypoint.prod.sh` 생성 (`--reload` 제거, `--workers 2`)
- [ ] `.env.production.template` 생성 (모든 필수 키 포함)
- [ ] EC2에서 `docker compose -f docker-compose.prod.yml up -d` 정상 실행
- [ ] `GET /health` → `{"status": "ok"}` 응답 확인
- [ ] Alembic 마이그레이션 자동 적용 확인 (DB 테이블 생성)

## 참고 문서

- `docs/Bridge_시스템아키텍처.md` — AWS 인프라 구성도
- CLAUDE.md — 기술 스택 (AWS EC2 t2.micro, RDS PostgreSQL, S3)
