from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, text, or_, func
from app.core.database import get_db
from fastapi.responses import StreamingResponse
from openpyxl.styles import Alignment, Border, Side, PatternFill, Font
from urllib.parse import quote
from datetime import datetime
import pandas as pd
import io

from app.models.board import EquipmentHistory
from app.schemas import EquipmentHistoryCreate, EquipmentHistoryResponse
from typing import List

router = APIRouter(prefix="/equipment", tags=["equipment"])
templates = Jinja2Templates(directory="templates")

@router.get("/")
async def get_equipment_history_page(request: Request):
    return templates.TemplateResponse("equipment_list.html", {"request": request})

@router.get("/api/list")
async def get_equipment_list(
    page: int = 1,
    limit: int = 10,
    search: str = "",
    db: AsyncSession = Depends(get_db)
):
    query = select(EquipmentHistory)

    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                EquipmentHistory.equipment_name.ilike(search_pattern),
                EquipmentHistory.part_name.ilike(search_pattern),
                EquipmentHistory.vendor.ilike(search_pattern),
                EquipmentHistory.description.ilike(search_pattern)
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_count = await db.scalar(count_query)

    query = query.order_by(desc(EquipmentHistory.replace_date), desc(EquipmentHistory.id))
    query = query.offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "total_count": total_count,
        "items": items
    }

@router.post("/api/add")
async def add_equipment(req: EquipmentHistoryCreate, db: AsyncSession = Depends(get_db)):
    new_eq = EquipmentHistory(
        replace_date=req.replace_date,
        category=req.category,
        vendor=req.vendor,
        equipment_name=req.equipment_name,
        part_name=req.part_name,
        spec=req.spec,
        quantity=req.quantity,
        description=req.description
    )
    db.add(new_eq)
    await db.commit()
    return {"message": "등록되었습니다."}

@router.delete("/api/{eq_id}")
async def delete_equipment(eq_id: int, db: AsyncSession = Depends(get_db)):
    eq = await db.get(EquipmentHistory, eq_id)
    if not eq:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
    await db.delete(eq)
    await db.commit()
    return {"message": "삭제되었습니다."}

@router.put("/api/{eq_id}")
async def update_equipment(eq_id: int, req: EquipmentHistoryCreate, db: AsyncSession = Depends(get_db)):
    eq = await db.get(EquipmentHistory, eq_id)
    if not eq:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")

    eq.replace_date = req.replace_date
    eq.category = req.category
    eq.vendor = req.vendor
    eq.equipment_name = req.equipment_name
    eq.part_name = req.part_name
    eq.spec = req.spec
    eq.quantity = req.quantity
    eq.description = req.description

    await db.commit()
    return {"message": "수정되었습니다."}

@router.get("/api/export")
async def export_equipment_list(search: str = "", db: AsyncSession = Depends(get_db)):
    query = select(EquipmentHistory)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                EquipmentHistory.equipment_name.ilike(search_pattern),
                EquipmentHistory.part_name.ilike(search_pattern),
                EquipmentHistory.vendor.ilike(search_pattern),
                EquipmentHistory.description.ilike(search_pattern)
            )
        )

    query = query.order_by(desc(EquipmentHistory.replace_date), desc(EquipmentHistory.id))
    result = await db.execute(query)
    items = result.scalars().all()

    data_list = []
    total_count = len(items)
    for idx, item in enumerate(items):
        data_list.append({
            "No": total_count - idx,
            "교체일": item.replace_date.strftime("%Y-%m-%d") if item.replace_date else "",
            "구분": item.category,
            "벤더": item.vendor or "-",
            "장비명": item.equipment_name,
            "항목": item.part_name,
            "규격": item.spec or "-",
            "수량": item.quantity,
            "상세 내역": item.description or "-"
        })

    df = pd.DataFrame(data_list)
    output = io.BytesIO()

    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='장비파트교체이력')
        worksheet = writer.sheets['장비파트교체이력']

        thin_border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))
        header_fill = PatternFill(start_color="E7E6E6", end_color="E7E6E6", fill_type="solid")
        header_font = Font(bold=True, size=11)

        for column_cells in worksheet.columns:
            column_letter = column_cells[0].column_letter
            header_val = str(column_cells[0].value)

            if header_val == "상세 내역":
                worksheet.column_dimensions[column_letter].width = 60
            elif header_val == "장비명":
                worksheet.column_dimensions[column_letter].width = 25
            elif header_val == "No" or header_val == "수량":
                worksheet.column_dimensions[column_letter].width = 8
            else:
                worksheet.column_dimensions[column_letter].width = 15

            for cell in column_cells:
                cell.border = thin_border
                align_horz = 'left' if header_val == "상세 내역" and cell.row > 1 else 'center'
                cell.alignment = Alignment(wrap_text=True, vertical='center', horizontal=align_horz)

                if cell.row == 1:
                    cell.fill = header_fill
                    cell.font = header_font
                    cell.alignment = Alignment(horizontal='center', vertical='center')

    output.seek(0)

    now_str = datetime.now().strftime('%Y%m%d%H%M%S')
    filename = f"장비파트교체이력_{now_str}.xlsx"
    encoded_filename = quote(filename)

    headers = {'Content-Disposition': f"attachment; filename*=UTF-8''{encoded_filename}"}
    return StreamingResponse(output, headers=headers)

@router.get("/api/stats")
async def get_equipment_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EquipmentHistory))
    items = result.scalars().all()

    category_counts = {}
    vendor_counts = {}
    monthly_counts = {}

    for item in items:
        cat = item.category if item.category else "미분류"
        category_counts[cat] = category_counts.get(cat, 0) + 1

        ven = item.vendor if item.vendor else "기타"
        vendor_counts[ven] = vendor_counts.get(ven, 0) + 1

        if item.replace_date:
            month_str = item.replace_date.strftime("%Y-%m")
            monthly_counts[month_str] = monthly_counts.get(month_str, 0) + 1

    sorted_months = sorted(monthly_counts.keys())
    monthly_trend = {m: monthly_counts[m] for m in sorted_months[-12:]}

    return {
        "category": category_counts,
        "vendor": vendor_counts,
        "monthly": monthly_trend
    }
