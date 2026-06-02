from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.auth import SuccessResponse
from app.schemas.chat import (
    ChatMessageRequest,
    ChatMessageResponse,
    MemoryItem,
    MemoryListResponse,
)
from app.services import chat as chat_service
from app.services import chat_memory

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/messages", response_model=SuccessResponse[ChatMessageResponse])
async def post_message(
    body: ChatMessageRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await chat_service.handle_message(
        db=db,
        user_id=current_user.id,
        message=body.message,
        background=background_tasks,
    )
    return SuccessResponse(data=ChatMessageResponse(**result))


@router.get("/memories", response_model=SuccessResponse[MemoryListResponse])
async def list_memories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contents = await chat_memory.load_memories(db, current_user.id)
    return SuccessResponse(
        data=MemoryListResponse(memories=[MemoryItem(content=c) for c in contents])
    )


@router.delete("/memories", response_model=SuccessResponse[None])
async def delete_memories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await chat_memory.clear_memories(db, current_user.id)
    return SuccessResponse(message="삭제되었습니다")
