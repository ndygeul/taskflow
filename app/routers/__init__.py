from fastapi import FastAPI
from . import (
    calendar, board, post, views, upload, admin, journal, alarm,
    tma, dreport, tdems, equipment, fault, schedule, otp,
    inspect, tm_except, fmtt_status, work
)

def setup_routers(app: FastAPI):
    """
    FastAPI 앱에 모든 라우터를 논리적 도메인 그룹으로 묶어 등록합니다.
    """
    app.include_router(calendar.router)
    app.include_router(schedule.router)
    app.include_router(board.router)
    app.include_router(post.router)
    app.include_router(journal.router)
    app.include_router(views.router)
    app.include_router(admin.router)
    app.include_router(inspect.router)
    app.include_router(otp.router)
    app.include_router(upload.router)
    app.include_router(alarm.router)
    app.include_router(fault.router)
    app.include_router(equipment.router)
    app.include_router(tdems.router)
    app.include_router(tma.router)
    app.include_router(dreport.router)
    app.include_router(tm_except.router)
    app.include_router(fmtt_status.router)
    app.include_router(work.router)