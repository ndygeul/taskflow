from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_, func, text
from app.core.database import get_db
from fastapi.responses import StreamingResponse
from openpyxl.styles import Alignment, Border, Side, PatternFill, Font
from urllib.parse import quote
from datetime import datetime
import pandas as pd
import io

from app.models.board import FaultHistory
from app.schemas import FaultHistoryCreate

router = APIRouter(prefix="/fault", tags=["fault"])
templates = Jinja2Templates(directory="templates")

@router.get("/")
async def get_fault_history_page(request: Request):
    return templates.TemplateResponse("fault_list.html", {"request": request})

@router.get("/api/list")
async def get_fault_list(page: int = 1, limit: int = 10, search: str = "", db: AsyncSession = Depends(get_db)):
    query = select(FaultHistory)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                FaultHistory.equipment_name.ilike(search_pattern),
                FaultHistory.system.ilike(search_pattern),
                FaultHistory.field_name.ilike(search_pattern),
                FaultHistory.description.ilike(search_pattern)
            )
        )

    total_count = await db.scalar(select(func.count()).select_from(query.subquery()))
    query = query.order_by(desc(FaultHistory.fault_date), desc(FaultHistory.id))
    query = query.offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    items = result.scalars().all()
    return {"total_count": total_count, "items": items}

@router.post("/api/add")
async def add_fault(req: FaultHistoryCreate, db: AsyncSession = Depends(get_db)):
    new_ft = FaultHistory(**req.dict())
    db.add(new_ft)
    await db.commit()
    return {"message": "등록되었습니다."}

@router.put("/api/{ft_id}")
async def update_fault(ft_id: int, req: FaultHistoryCreate, db: AsyncSession = Depends(get_db)):
    ft = await db.get(FaultHistory, ft_id)
    if not ft: raise HTTPException(status_code=404)
    for key, value in req.dict().items():
        setattr(ft, key, value)
    await db.commit()
    return {"message": "수정되었습니다."}

@router.delete("/api/{ft_id}")
async def delete_fault(ft_id: int, db: AsyncSession = Depends(get_db)):
    ft = await db.get(FaultHistory, ft_id)
    if not ft: raise HTTPException(status_code=404)
    await db.delete(ft)
    await db.commit()
    return {"message": "삭제되었습니다."}

@router.get("/api/export")
async def export_fault_list(search: str = "", db: AsyncSession = Depends(get_db)):
    query = select(FaultHistory)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(or_(FaultHistory.equipment_name.ilike(search_pattern), FaultHistory.description.ilike(search_pattern)))

    query = query.order_by(desc(FaultHistory.fault_date), desc(FaultHistory.id))
    result = await db.execute(query)
    items = result.scalars().all()

    data_list = []
    total_count = len(items)
    for idx, item in enumerate(items):
        data_list.append({
            "No": total_count - idx,
            "발생일자": item.fault_date.strftime("%Y-%m-%d") if item.fault_date else "",
            "시스템": item.system,
            "분야": item.field_name,
            "장비명": item.equipment_name,
            "확인자": item.checker or "-",
            "비상출동": "O" if item.is_emergency else "",
            "장애 상세 내역": item.description or "-"
        })

    df = pd.DataFrame(data_list)
    output = io.BytesIO()

    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='장비장애발생이력')
        worksheet = writer.sheets['장비장애발생이력']
        thin_border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))
        header_fill = PatternFill(start_color="F8CBAD", end_color="F8CBAD", fill_type="solid") # 연한 붉은색 헤더
        header_font = Font(bold=True, size=11)

        for col_cells in worksheet.columns:
            header_val = str(col_cells[0].value)
            col_letter = col_cells[0].column_letter
            
            if header_val == "장애 상세 내역": worksheet.column_dimensions[col_letter].width = 65
            elif header_val == "장비명": worksheet.column_dimensions[col_letter].width = 25
            elif header_val in ["No", "비상출동"]: worksheet.column_dimensions[col_letter].width = 10
            else: worksheet.column_dimensions[col_letter].width = 15

            for cell in col_cells:
                cell.border = thin_border
                align_horz = 'left' if header_val == "장애 상세 내역" and cell.row > 1 else 'center'
                cell.alignment = Alignment(wrap_text=True, vertical='center', horizontal=align_horz)
                if cell.row == 1:
                    cell.fill = header_fill
                    cell.font = header_font
                    cell.alignment = Alignment(horizontal='center', vertical='center')

    output.seek(0)
    filename = f"장비장애발생이력_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    return StreamingResponse(output, headers={'Content-Disposition': f"attachment; filename*=UTF-8''{quote(filename)}"})

@router.get("/create-table")
async def create_fault_table(db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS fault_history (
            id SERIAL PRIMARY KEY, fault_date DATE NOT NULL,
            system VARCHAR(100) NOT NULL, field_name VARCHAR(100) NOT NULL,
            equipment_name VARCHAR(100) NOT NULL, is_emergency BOOLEAN DEFAULT FALSE,
            description TEXT
        )
    """))
    await db.commit()
    return {"msg": "Table created"}

@router.get("/api/stats")
async def get_fault_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FaultHistory))
    items = result.scalars().all()

    system_counts = {}
    field_counts = {}
    monthly_counts = {}

    for item in items:
        sys = item.system if item.system else "미분류"
        system_counts[sys] = system_counts.get(sys, 0) + 1

        fld = item.field_name if item.field_name else "기타"
        field_counts[fld] = field_counts.get(fld, 0) + 1

        if item.fault_date:
            month_str = item.fault_date.strftime("%Y-%m")
            monthly_counts[month_str] = monthly_counts.get(month_str, 0) + 1

    sorted_months = sorted(monthly_counts.keys())
    monthly_trend = {m: monthly_counts[m] for m in sorted_months[-12:]}

    return {
        "system": system_counts,
        "field": field_counts,
        "monthly": monthly_trend
    }
