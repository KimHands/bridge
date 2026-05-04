from pydantic import BaseModel


class RoutineItem(BaseModel):
    user_routine_id: str
    routine_id: int
    title: str
    description: str
    source: str
    is_completed_today: bool
    assigned_at: str


class RoutineListResponse(BaseModel):
    routines: list[RoutineItem]


class RoutineAddRequest(BaseModel):
    routine_id: int


class RoutineAddResponse(BaseModel):
    user_routine_id: str
    routine_id: int
    title: str
    source: str
    assigned_at: str


class RoutineCompleteRequest(BaseModel):
    completed: bool


class RoutineCompleteResponse(BaseModel):
    user_routine_id: str
    completed: bool
    logged_at: str


class RoutineLibraryItem(BaseModel):
    routine_id: int
    title: str
    description: str
    target_keywords: list[str]
    is_already_added: bool


class RoutineLibraryResponse(BaseModel):
    routines: list[RoutineLibraryItem]
