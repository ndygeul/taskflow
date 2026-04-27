# app/core/ip_map.py

# IP : 사용자명 매핑 정보
IP_USER_MAP = {
    "127.0.0.1": "관리자"
}

def get_user_by_ip(ip: str) -> str:
    """IP를 입력받아 매핑된 사용자 이름을 반환. 없으면 관리자 반환"""
    return IP_USER_MAP.get(ip, "관리자")
