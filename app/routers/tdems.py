from fastapi import APIRouter, Request, Depends, Form, HTTPException
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, delete, func
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.tdems import Asset, AssetMemory, AssetSSD, AssetHDD
from app.core.ip_map import get_user_by_ip
from typing import Optional
from openpyxl.styles import Alignment, Border, Side, PatternFill, Font
from urllib.parse import quote
import re
import math
from datetime import datetime
import pandas as pd
import io

router = APIRouter(prefix="/tdems", tags=["TDEMS"])
templates = Jinja2Templates(directory="templates")

@router.get("/rack")
async def tdems_rack(request: Request, rack: str, id: Optional[int] = 0, db: AsyncSession = Depends(get_db)):
    match = re.match(r"([A-Za-z]+)", rack)
    prefix = match.group(1) if match else rack
    all_racks_stmt = select(Asset.rack_location).where(
        Asset.rack_location.isnot(None),
        Asset.rack_location != '',
        Asset.del_yn == 'N'
    ).distinct()
    all_racks_res = await db.execute(all_racks_stmt)
    all_racks = all_racks_res.scalars().all()
    rack_groups = sorted(list(set([
        re.match(r"([A-Za-z]+)", r).group(1).upper() for r in all_racks if re.match(r"([A-Za-z]+)", r)
    ])))

    stmt = select(Asset).where(
        Asset.rack_location.ilike(f"{prefix}%"), 
        Asset.del_yn == 'N'
    ).options(
        selectinload(Asset.memories),
        selectinload(Asset.ssds),
        selectinload(Asset.hdds)
    ).order_by(Asset.rack_location.asc())
    
    result = await db.execute(stmt)
    assets_db = result.scalars().all()

    racks = {}
    distinct_racks = sorted(list(set([a.rack_location for a in assets_db if a.rack_location])))
    for r_name in distinct_racks:
        racks[r_name] = {u: None for u in range(1, 43)}

    for asset in assets_db:
        r_name = asset.rack_location
        if not r_name or r_name not in racks: continue

        loc_str = str(asset.mounted_location).strip().upper()
        if not loc_str: continue

        ranges = []
        if loc_str == 'ALL':
            ranges.append((1, 42))
        else:
            segments = [s.strip() for s in loc_str.split(',')]
            for seg in segments:
                match_range = re.match(r'^(\d+)(?:-(\d+))?$', seg)
                if match_range:
                    start = int(match_range.group(1))
                    end = int(match_range.group(2)) if match_range.group(2) else start
                    ranges.append((min(start, end), max(start, end)))

        for bottom, top in ranges:
            bottom = max(1, bottom)
            top = min(42, top)
            rowspan = top - bottom + 1
            
            racks[r_name][top] = {
                'asset': asset,
                'rowspan': rowspan,
                'is_selected': (asset.asset_id == id)
            }
            for u in range(bottom, top):
                racks[r_name][u] = False

    return templates.TemplateResponse("tdems_rack.html", {
        "request": request,
        "group_name": prefix.upper(),
        "rack_groups": rack_groups,
        "racks": racks,
        "max_unit": 42
    })

@router.post("/save")
async def tdems_save(request: Request, db: AsyncSession = Depends(get_db)):
    form = await request.form()
    
    asset_id = form.get("asset_id")
    equip_barcode = form.get("equip_barcode", "").strip() or None
    hostname = form.get("hostname", "").strip()
    
    ips = form.getlist("ip[]")
    ip_str = ",".join([ip.strip() for ip in ips if ip.strip()])
    
    client_ip = request.client.host
    user_name = get_user_by_ip(client_ip)
    
    current_dt = datetime.now()
    current_str = current_dt.strftime('%Y-%m-%d %H:%M:%S')
    
    data = {
        "equip_barcode": equip_barcode,
        "hostname": hostname,
        "ip": ip_str,
        "rack_location": form.get("rack_location", "").strip(),
        "mounted_location": form.get("mounted_location", "").strip(),
        "asset_type": form.get("asset_type", "").strip(),
        "own_team": form.get("own_team", "").strip(),
        "manufacturer": form.get("manufacturer", "").strip(),
        "model_name": form.get("model_name", "").strip(),
        "serial_number": form.get("serial_number", "").strip(),
        "receipt_ym": form.get("receipt_ym", "").strip(),
        "os": form.get("os", "").strip(),
        "cpu_type": form.get("cpu_type", "").strip(),
        "cpu_qty": int(form.get("cpu_qty") or 0),
        "cpu_core": int(form.get("cpu_core") or 0),
        "swap_size": form.get("swap_size", "").strip(),
        "ma": form.get("ma", "").strip(),
        "status": form.get("status", "").strip() or None,
        "facility_status": form.get("facility_status", "").strip(),
        "purpose": form.get("purpose", "").strip(),
        "purpose_detail": form.get("purpose_detail", "").strip(),
        "standard_service": form.get("standard_service", "").strip(),
        "unit_service": form.get("unit_service", "").strip(),
        "updated_ip": client_ip,
        "updated_user": user_name
    }

    if asset_id and int(asset_id) > 0:
        stmt = select(Asset).where(Asset.asset_id == int(asset_id))
        result = await db.execute(stmt)
        asset = result.scalar_one()
        
        history_append = form.get("history_append", "").strip()
        if history_append:
            new_log = f"\n\n-----\n[{current_str}] {user_name}\n{history_append}"
            data["asset_history"] = (asset.asset_history or "") + new_log

        for key, val in data.items():
            setattr(asset, key, val)
        
        asset.updated_at = current_dt

        if equip_barcode:
            await db.execute(delete(AssetMemory).where(AssetMemory.equip_barcode == equip_barcode))
            await db.execute(delete(AssetSSD).where(AssetSSD.equip_barcode == equip_barcode))
            await db.execute(delete(AssetHDD).where(AssetHDD.equip_barcode == equip_barcode))

    else:
        if equip_barcode:
            exists = await db.execute(select(Asset).where(Asset.equip_barcode == equip_barcode))
            if exists.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="중복된 설비바코드입니다.")
        
        data["created_ip"] = client_ip
        data["created_user"] = user_name
        data["created_at"] = current_dt
        data["updated_at"] = current_dt
        
        initial_history = form.get("asset_history", "")
        if initial_history:
             data["asset_history"] = f"[{current_str}] {user_name} - 최초 등록\n{initial_history}"
        else:
             data["asset_history"] = ""

        asset = Asset(**data)
        db.add(asset)
        await db.commit()
        await db.refresh(asset)

    if equip_barcode:
        mem_caps = form.getlist("mem_capacity[]")
        mem_qtys = form.getlist("mem_qty[]")
        for cap, qty in zip(mem_caps, mem_qtys):
            if cap and int(qty) > 0:
                db.add(AssetMemory(equip_barcode=equip_barcode, capacity=cap, quantity=int(qty)))
        
        ssd_caps = form.getlist("ssd_capacity[]")
        ssd_units = form.getlist("ssd_unit[]")
        ssd_qtys = form.getlist("ssd_qty[]")
        for i, cap in enumerate(ssd_caps):
            if cap and i < len(ssd_qtys):
                unit = ssd_units[i] if i < len(ssd_units) else "GB"
                full_cap = f"{cap}{unit}"
                db.add(AssetSSD(equip_barcode=equip_barcode, capacity=full_cap, quantity=int(ssd_qtys[i])))
        
        hdd_caps = form.getlist("hdd_capacity[]")
        hdd_units = form.getlist("hdd_unit[]")
        hdd_qtys = form.getlist("hdd_qty[]")
        for i, cap in enumerate(hdd_caps):
            if cap and i < len(hdd_qtys):
                unit = hdd_units[i] if i < len(hdd_units) else "GB"
                full_cap = f"{cap}{unit}"
                db.add(AssetHDD(equip_barcode=equip_barcode, capacity=full_cap, quantity=int(hdd_qtys[i])))

    await db.commit()
    return RedirectResponse(url="/tdems/list", status_code=303)

@router.get("/list")
async def tdems_list(
    request: Request, 
    page: int = 1, 
    q: Optional[str] = None,
    field: Optional[str] = 'all',
    sort: Optional[str] = None,
    order: Optional[str] = 'asc',
    limit: int = 10,
    s_hostname: Optional[str] = None,
    s_ip: Optional[str] = None,
    s_type: Optional[str] = None,
    s_ma: Optional[str] = None,
    s_status: Optional[str] = None,
    s_f_status: Optional[str] = None,
    s_purpose: Optional[str] = None,
    s_team: Optional[str] = None,
    s_svc_std: Optional[str] = None,
    s_svc_unit: Optional[str] = None,
    s_manuf: Optional[str] = None,
    s_model: Optional[str] = None,
    s_os: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    offset = (page - 1) * limit
    query = select(Asset).where(Asset.del_yn == 'N').options(
        selectinload(Asset.memories),
        selectinload(Asset.ssds),
        selectinload(Asset.hdds)
    )

    if q:
        if field == 'all':
            query = query.where(or_(
                Asset.equip_barcode.ilike(f"%{q}%"),
                Asset.hostname.ilike(f"%{q}%"),
                Asset.ip.ilike(f"%{q}%"),
                Asset.asset_type.ilike(f"%{q}%"),
                Asset.ma.ilike(f"%{q}%"),
                Asset.status.ilike(f"%{q}%"),
                Asset.purpose.ilike(f"%{q}%"),
                Asset.facility_status.ilike(f"%{q}%"),
                Asset.own_team.ilike(f"%{q}%"),
                Asset.standard_service.ilike(f"%{q}%"),
                Asset.unit_service.ilike(f"%{q}%"),
                Asset.manufacturer.ilike(f"%{q}%"),
                Asset.os.ilike(f"%{q}%"),
                Asset.model_name.ilike(f"%{q}%")
            ))
        else:
            column = getattr(Asset, field, None)
            if column:
                query = query.where(column.ilike(f"%{q}%"))

    if s_hostname: query = query.where(Asset.hostname.ilike(f"%{s_hostname}%"))
    if s_ip: query = query.where(Asset.ip.ilike(f"%{s_ip}%"))
    if s_type: query = query.where(Asset.asset_type.ilike(f"%{s_type}%"))
    if s_ma: query = query.where(Asset.ma == s_ma)
    if s_status: query = query.where(Asset.status == s_status)
    if s_f_status: query = query.where(Asset.facility_status.ilike(f"%{s_f_status}%"))
    if s_purpose: query = query.where(Asset.purpose.ilike(f"%{s_purpose}%"))
    if s_team: query = query.where(Asset.own_team.ilike(f"%{s_team}%"))
    if s_svc_std: query = query.where(Asset.standard_service.ilike(f"%{s_svc_std}%"))
    if s_svc_unit: query = query.where(Asset.unit_service.ilike(f"%{s_svc_unit}%"))
    if s_manuf: query = query.where(Asset.manufacturer.ilike(f"%{s_manuf}%"))
    if s_model: query = query.where(Asset.model_name.ilike(f"%{s_model}%"))
    if s_os: query = query.where(Asset.os.ilike(f"%{s_os}%"))

    if sort:
        sort_column = None
        if sort == 'power': sort_column = Asset.status            
        elif sort == 'status': sort_column = Asset.facility_status 
        elif sort == 'ma': sort_column = Asset.ma
        elif sort == 'barcode': sort_column = Asset.equip_barcode
        elif sort == 'type': sort_column = Asset.asset_type
        elif sort == 'location': sort_column = Asset.rack_location
        elif sort == 'hostname': sort_column = Asset.hostname
        elif sort == 'ip': sort_column = Asset.ip
        elif sort == 'manufacturer': sort_column = Asset.manufacturer 
        elif sort == 'model': sort_column = Asset.model_name
        elif sort == 'sn': sort_column = Asset.serial_number
        elif sort == 'receipt': sort_column = Asset.receipt_ym
        elif sort == 'os': sort_column = Asset.os
        elif sort == 'cpu_type': sort_column = Asset.cpu_type       
        elif sort == 'purpose': sort_column = Asset.purpose
        elif sort == 'team': sort_column = Asset.own_team
        elif sort == 'standard_service': sort_column = Asset.standard_service 
        elif sort == 'unit_service': sort_column = Asset.unit_service         
        elif sort == 'swap': sort_column = Asset.swap_size  
        elif sort == 'cpu_qty':
            if order == 'desc':
                query = query.order_by(Asset.cpu_qty.desc(), Asset.cpu_core.desc())
            else:
                query = query.order_by(Asset.cpu_qty.asc(), Asset.cpu_core.asc())
        elif sort == 'memory':
            query = query.outerjoin(Asset.memories).distinct()
            sort_column = AssetMemory.capacity
        elif sort == 'disk':
            query = query.outerjoin(Asset.ssds).distinct()
            sort_column = AssetSSD.capacity

        if sort_column:
            if order == 'desc':
                query = query.order_by(sort_column.desc())
            else:
                query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(Asset.rack_location.asc(), Asset.mounted_location.asc())
    
    count_query = select(func.count()).select_from(query.subquery())
    count_res = await db.execute(count_query)
    total_count = count_res.scalar() or 0

    stmt = query.offset(offset).limit(limit)
    result = await db.execute(stmt)
    assets = result.scalars().all()

    total_pages = math.ceil(total_count / limit)
    if total_pages == 0: total_pages = 1
    
    start_page = page - 5
    end_page = page + 5
    if start_page < 1:
        end_page += (1 - start_page)
        start_page = 1
    if end_page > total_pages:
        start_page -= (end_page - total_pages)
        end_page = total_pages
    if start_page < 1:
        start_page = 1

    return templates.TemplateResponse("tdems_list.html", {
        "request": request,
        "assets": assets,
        "total_count": total_count,
        "current_page": page,
        "total_pages": total_pages,
        "start_page": start_page,
        "end_page": end_page,
        "keyword": q,
        "field": field,
        "sort": sort,
        "order": order,
        "limit": limit,
        "s_hostname": s_hostname,
        "s_ip": s_ip,
        "s_type": s_type,
        "s_ma": s_ma,
        "s_status": s_status,
        "s_f_status": s_f_status,
        "s_purpose": s_purpose,
        "s_team": s_team,
        "s_svc_std": s_svc_std,
        "s_svc_unit": s_svc_unit,
        "s_manuf": s_manuf,
        "s_model": s_model,
        "s_os": s_os
    })

@router.get("/write")
async def tdems_form(request: Request, id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    asset = None
    if id:
        stmt = select(Asset).where(Asset.asset_id == id).options(
            selectinload(Asset.memories),
            selectinload(Asset.ssds),
            selectinload(Asset.hdds)
        )
        res = await db.execute(stmt)
        asset = res.scalar_one_or_none()
        
    return templates.TemplateResponse("tdems_form.html", {
        "request": request, 
        "asset": asset,
        "mode": "edit" if id else "create"
    })

@router.get("/view/{asset_id}")
async def tdems_view(request: Request, asset_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Asset).where(Asset.asset_id == asset_id).options(
        selectinload(Asset.memories),
        selectinload(Asset.ssds),
        selectinload(Asset.hdds)
    )
    result = await db.execute(stmt)
    asset = result.scalar_one_or_none()
    
    if not asset:
        raise HTTPException(status_code=404, detail="자산을 찾을 수 없습니다.")

    return templates.TemplateResponse("tdems_view.html", {
        "request": request,
        "asset": asset
    })

@router.get("/export")
async def tdems_export(
    request: Request,
    q: Optional[str] = None,
    field: Optional[str] = 'all',
    sort: Optional[str] = None,
    order: Optional[str] = 'asc',
    page: int = 1,
    limit: int = 10,
    s_hostname: Optional[str] = None,
    s_ip: Optional[str] = None,
    s_type: Optional[str] = None,
    s_ma: Optional[str] = None,
    s_status: Optional[str] = None,
    s_f_status: Optional[str] = None,
    s_purpose: Optional[str] = None,
    s_team: Optional[str] = None,
    s_svc_std: Optional[str] = None,
    s_svc_unit: Optional[str] = None,
    s_manuf: Optional[str] = None,
    s_model: Optional[str] = None,
    s_os: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Asset).where(Asset.del_yn == 'N').options(
        selectinload(Asset.memories),
        selectinload(Asset.ssds),
        selectinload(Asset.hdds)
    )

    if q:
        if field == 'all':
            query = query.where(or_(
                Asset.equip_barcode.ilike(f"%{q}%"),
                Asset.hostname.ilike(f"%{q}%"),
                Asset.ip.ilike(f"%{q}%"),
                Asset.asset_type.ilike(f"%{q}%"),
                Asset.ma.ilike(f"%{q}%"),
                Asset.status.ilike(f"%{q}%"),
                Asset.purpose.ilike(f"%{q}%"),
                Asset.facility_status.ilike(f"%{q}%"),
                Asset.own_team.ilike(f"%{q}%"),
                Asset.standard_service.ilike(f"%{q}%"),
                Asset.unit_service.ilike(f"%{q}%"),
                Asset.manufacturer.ilike(f"%{q}%"),
                Asset.os.ilike(f"%{q}%"),
                Asset.model_name.ilike(f"%{q}%")
            ))
        else:
            column = getattr(Asset, field, None)
            if column:
                query = query.where(column.ilike(f"%{q}%"))

    if s_hostname: query = query.where(Asset.hostname.ilike(f"%{s_hostname}%"))
    if s_ip: query = query.where(Asset.ip.ilike(f"%{s_ip}%"))
    if s_type: query = query.where(Asset.asset_type.ilike(f"%{s_type}%"))
    if s_ma: query = query.where(Asset.ma == s_ma)
    if s_status: query = query.where(Asset.status == s_status)
    if s_f_status: query = query.where(Asset.facility_status.ilike(f"%{s_f_status}%"))
    if s_purpose: query = query.where(Asset.purpose.ilike(f"%{s_purpose}%"))
    if s_team: query = query.where(Asset.own_team.ilike(f"%{s_team}%"))
    if s_svc_std: query = query.where(Asset.standard_service.ilike(f"%{s_svc_std}%"))
    if s_svc_unit: query = query.where(Asset.unit_service.ilike(f"%{s_svc_unit}%"))
    if s_manuf: query = query.where(Asset.manufacturer.ilike(f"%{s_manuf}%"))
    if s_model: query = query.where(Asset.model_name.ilike(f"%{s_model}%"))
    if s_os: query = query.where(Asset.os.ilike(f"%{s_os}%"))
    if sort:
        sort_column = None
        if sort == 'power': sort_column = Asset.status
        elif sort == 'status': sort_column = Asset.facility_status
        elif sort == 'ma': sort_column = Asset.ma
        elif sort == 'barcode': sort_column = Asset.equip_barcode
        elif sort == 'type': sort_column = Asset.asset_type
        elif sort == 'location': sort_column = Asset.rack_location
        elif sort == 'hostname': sort_column = Asset.hostname
        elif sort == 'ip': sort_column = Asset.ip
        elif sort == 'manufacturer': sort_column = Asset.manufacturer
        elif sort == 'model': sort_column = Asset.model_name
        elif sort == 'sn': sort_column = Asset.serial_number
        elif sort == 'receipt': sort_column = Asset.receipt_ym
        elif sort == 'os': sort_column = Asset.os
        elif sort == 'cpu_type': sort_column = Asset.cpu_type
        elif sort == 'purpose': sort_column = Asset.purpose
        elif sort == 'team': sort_column = Asset.own_team
        elif sort == 'standard_service': sort_column = Asset.standard_service
        elif sort == 'unit_service': sort_column = Asset.unit_service
        elif sort == 'swap': sort_column = Asset.swap_size
        elif sort == 'cpu_qty':
            if order == 'desc':
                query = query.order_by(Asset.cpu_qty.desc(), Asset.cpu_core.desc())
            else:
                query = query.order_by(Asset.cpu_qty.asc(), Asset.cpu_core.asc())
        elif sort == 'memory':
            query = query.outerjoin(Asset.memories).distinct()
            sort_column = AssetMemory.capacity
        elif sort == 'disk':
            query = query.outerjoin(Asset.ssds).distinct()
            sort_column = AssetSSD.capacity

        if sort_column:
            if order == 'desc':
                query = query.order_by(sort_column.desc())
            else:
                query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(Asset.rack_location.asc(), Asset.mounted_location.asc())

    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    assets = result.scalars().all()

    data_list = []
    for asset in assets:
        mem_str = "\n".join([f"{m.capacity} x {m.quantity}" for m in asset.memories])
        ssd_str = "\n".join([f"{s.capacity} x {s.quantity}" for s in asset.ssds])
        hdd_str = "\n".join([f"{h.capacity} x {h.quantity}" for h in asset.hdds])

        data_list.append({
            "설비바코드": asset.equip_barcode,
            "랙/장착": f"{asset.rack_location or ''} {asset.mounted_location or ''}".strip(),
            "호스트명": asset.hostname,
            "IP": asset.ip,
            "종류": asset.asset_type,
            "제조사": asset.manufacturer,
            "모델명": asset.model_name,
            "S/N": asset.serial_number,
            "입고년월": asset.receipt_ym,
            "OS": asset.os,
            "CPU종류": asset.cpu_type,
            "CPU수량": asset.cpu_qty,
            "CPU코어": asset.cpu_core,
            "SWAP": asset.swap_size,
            "MEMORY": mem_str,
            "SSD": ssd_str,
            "HDD": hdd_str,
            "MA": asset.ma,
            "상태": asset.facility_status,
            "전원": asset.status,
            "용도": asset.purpose,
            "상세용도": asset.purpose_detail,
            "자산보유팀": asset.own_team,
            "표준서비스": asset.standard_service,
            "단위서비스": asset.unit_service,
            "자산이력": asset.asset_history
        })

    df = pd.DataFrame(data_list)
    output = io.BytesIO()

    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='자산목록')
        worksheet = writer.sheets['자산목록']
        
        thin_border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))
        header_fill = PatternFill(start_color="E7E6E6", end_color="E7E6E6", fill_type="solid")
        header_font = Font(bold=True, size=11)

        for column_cells in worksheet.columns:
            max_length = 0
            column_letter = column_cells[0].column_letter
            
            header_val = str(column_cells[0].value) if column_cells[0].value else ""
            
            if "자산이력" in header_val:
                max_allowable_width = 150
            elif "MEMORY" in header_val or "SSD" in header_val or "HDD" in header_val:
                max_allowable_width = 80
            else:
                max_allowable_width = 60

            for cell in column_cells:
                cell.border = thin_border
                cell.alignment = Alignment(wrap_text=True, vertical='center', horizontal='left')

                if cell.row == 1:
                    cell.fill = header_fill
                    cell.font = header_font
                    cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

                try:
                    cell_value = str(cell.value) if cell.value else ""
                    lines = cell_value.split('\n')
                    for line in lines:
                        length = sum(2.0 if ord(c) > 255 else 1.1 for c in line)
                        if length > max_length:
                            max_length = length
                except:
                    pass

            adjusted_width = min(max_length + 5, max_allowable_width)
            adjusted_width = max(adjusted_width, 10)
            
            worksheet.column_dimensions[column_letter].width = adjusted_width

    output.seek(0)

    now_str = datetime.now().strftime('%Y%m%d%H%M%S')
    filename = f"장비정보현황_{now_str}.xlsx"
    encoded_filename = quote(filename)

    headers = {'Content-Disposition': f"attachment; filename*=UTF-8''{encoded_filename}"}
    return StreamingResponse(output, headers=headers)

@router.post("/delete")
async def tdems_delete(request: Request, db: AsyncSession = Depends(get_db)):
    form = await request.form()
    
    asset_ids = form.getlist("asset_ids[]")
    if not asset_ids and form.get("asset_id"):
        asset_ids = [form.get("asset_id")]
        
    reason = form.get("reason", "").strip()
    
    client_ip = request.client.host
    user_name = get_user_by_ip(client_ip)
    
    current_dt = datetime.now()
    current_str = current_dt.strftime('%Y-%m-%d %H:%M:%S')

    if asset_ids:
        ids_int = [int(aid) for aid in asset_ids if aid.isdigit()]
        
        stmt = select(Asset).where(Asset.asset_id.in_(ids_int))
        result = await db.execute(stmt)
        targets = result.scalars().all()

        for asset in targets:
            asset.del_yn = 'Y'
            asset.deleted_at = current_dt 
            
            asset.updated_at = current_dt
            asset.updated_user = user_name
            asset.updated_ip = client_ip

            asset.deleted_reason = reason

            history_log = f"\n\n-----\n[{current_str}] {user_name} - [삭제됨]\n사유: {reason}"
            asset.asset_history = (asset.asset_history or "") + history_log

        await db.commit()

    return RedirectResponse(url="/tdems/list", status_code=303)

@router.get("/view_content/{asset_id}")
async def tdems_view_content(request: Request, asset_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Asset).where(Asset.asset_id == asset_id).options(
        selectinload(Asset.memories),
        selectinload(Asset.ssds),
        selectinload(Asset.hdds)
    )
    result = await db.execute(stmt)
    asset = result.scalar_one_or_none()

    if not asset:
        return "데이터를 찾을 수 없습니다."

    return templates.TemplateResponse("tdems_view_modal.html", {
        "request": request,
        "asset": asset
    })

@router.get("/api/stats")
async def get_tdems_stats(db: AsyncSession = Depends(get_db)):
    stmt = select(Asset).where(Asset.del_yn == 'N')
    result = await db.execute(stmt)
    assets = result.scalars().all()

    type_counts = {}
    manuf_counts = {}
    status_counts = {}

    for asset in assets:
        a_type = asset.asset_type if asset.asset_type else "미분류"
        type_counts[a_type] = type_counts.get(a_type, 0) + 1

        manuf = asset.manufacturer if asset.manufacturer else "기타"
        manuf_counts[manuf] = manuf_counts.get(manuf, 0) + 1

        status = asset.facility_status if asset.facility_status else "미지정"
        status_counts[status] = status_counts.get(status, 0) + 1

    type_counts = dict(sorted(type_counts.items(), key=lambda item: item[1], reverse=True))
    manuf_counts = dict(sorted(manuf_counts.items(), key=lambda item: item[1], reverse=True))
    status_counts = dict(sorted(status_counts.items(), key=lambda item: item[1], reverse=True))

    return {
        "type": type_counts,
        "manufacturer": manuf_counts,
        "status": status_counts
    }