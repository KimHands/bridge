from pydantic import BaseModel


class DeleteAccountRequest(BaseModel):
    """회원 탈퇴 — 민감정보 영구 삭제이므로 비밀번호 재확인을 요구한다.

    익명 사용자(password_hash=NULL)는 비밀번호가 없으므로 생략 가능하다.
    이 경우 JWT 소유 자체가 본인 확인을 대신한다(백엔드에서 분기 처리).
    """

    password: str | None = None


class DeleteAccountData(BaseModel):
    deleted: bool
