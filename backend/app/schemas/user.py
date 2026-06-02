from pydantic import BaseModel


class DeleteAccountRequest(BaseModel):
    """회원 탈퇴 — 민감정보 영구 삭제이므로 비밀번호 재확인을 요구한다."""

    password: str


class DeleteAccountData(BaseModel):
    deleted: bool
