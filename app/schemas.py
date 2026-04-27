from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional, List

class EventCreate(BaseModel):
    title: str
    start: datetime
    end: Optional[datetime] = None
    all_day: bool = False
    description: Optional[str] = None
    password: str
    color: Optional[str] = "#3788d8"
    group_id: Optional[str] = None

class EventResponse(EventCreate):
    id: int
    class Config:
        from_attributes = True

class EventAuth(BaseModel):
    password: str

class RecurringEventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    color: Optional[str] = "#3788d8"
    password: str
    all_day: bool = False
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    recurrence_type: str 
    recurrence_value: int 
    recurrence_week: Optional[int] = None
    start_date: str 
    end_date: str
    is_lunar: Optional[bool] = False 

class HolidayCreate(BaseModel):
    year: int
    password: str

class MenuCreate(BaseModel):
    name: str
    code: str

class MenuUpdateOrder(BaseModel):
    menu_ids: List[int]

class MenuResponse(BaseModel):
    id: int
    name: str
    code: str
    order_no: int
    class Config:
        from_attributes = True

class MenuUrlCreateRequest(BaseModel):
    name: str
    url: str
    parent_id: Optional[int] = None
    is_external: bool = False
    is_sidebar: bool = False

class MenuUrlUpdateRequest(BaseModel):
    name: str
    url: str
    is_external: bool
    is_sidebar: bool = False

class BoardCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    category_list: Optional[str] = None

class BoardUpdateMenu(BaseModel):
    menu_id: Optional[int] = None

class BoardUpdateOrder(BaseModel):
    board_ids: List[int]

class BoardUpdateVisibility(BaseModel):
    is_visible: bool

class BoardUpdate(BaseModel):
    name: str
    description: Optional[str] = None
    category_list: Optional[str] = None

class BoardBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    is_visible: bool = True
    category_list: Optional[str] = None
    type: str = "board"
    url: Optional[str] = None
    icon: Optional[str] = None
    is_external: bool = False
    is_sidebar: bool = False

class BoardResponse(BoardBase):
    id: int
    menu_id: Optional[int] = None
    order_no: int
    class Config:
        from_attributes = True

class PostMoveCopyRequest(BaseModel):
    post_ids: List[int]
    target_board_id: int

class PostBulkDeleteRequest(BaseModel):
    post_ids: List[int]

class MenuWithBoardsResponse(MenuResponse):
    boards: List[BoardResponse] = []
    class Config:
        from_attributes = True

class MenuStructureResponse(BaseModel):
    menus: List[MenuWithBoardsResponse]
    orphans: List[BoardResponse]

class PostCreate(BaseModel):
    title: str
    content: str
    writer: str
    password: str
    is_secret: bool = False
    is_notice: bool = False
    category: Optional[str] = None

class PostResponse(BaseModel):
    id: int
    board_id: int
    title: str
    content: str
    writer: str
    view_count: int
    is_secret: bool
    is_notice: bool
    category: Optional[str] = None
    created_at: datetime
    ip_address: Optional[str] = None
    class Config:
        from_attributes = True

class PostListResponse(BaseModel):
    id: int
    title: str
    writer: str
    view_count: int
    created_at: datetime
    is_notice: bool
    is_secret: bool
    category: Optional[str] = None
    ip_address: Optional[str] = None
    class Config:
        from_attributes = True

class PostAuth(BaseModel):
    password: str

class EquipmentHistoryBase(BaseModel):
    replace_date: date
    category: str
    vendor: str
    equipment_name: str
    part_name: str
    spec: Optional[str] = None
    quantity: int
    description: Optional[str] = None

class EquipmentHistoryCreate(EquipmentHistoryBase):
    pass

class EquipmentHistoryResponse(EquipmentHistoryBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class EquipmentHistoryListResponse(BaseModel):
    total_count: int
    items: List[EquipmentHistoryResponse]

class FaultHistoryBase(BaseModel):
    fault_date: date
    system: str
    field_name: str
    equipment_name: str
    checker: Optional[str] = None
    is_emergency: bool = False
    description: Optional[str] = None

class FaultHistoryCreate(FaultHistoryBase):
    pass

class FaultHistoryResponse(FaultHistoryBase):
    id: int
    class Config:
        orm_mode = True