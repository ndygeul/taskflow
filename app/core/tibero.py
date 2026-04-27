import os
import pyodbc
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

class TiberoClient:
    def __init__(self, target="TIBERO_MAIN_TECHDATA"):
        """
        :param target: 기본값 'TIBERO_MAIN_TECHDATA' 
                       (호출 시 target="TIBERO_GW_DCUSER" 등으로 덮어쓰기 가능)
        """
        secret_key = os.getenv("TIBERO_SECRET_KEY")
        if not secret_key:
            raise ValueError("CRITICAL: .env 파일에 TIBERO_SECRET_KEY가 설정되지 않았습니다.")
        
        self.cipher = Fernet(secret_key.encode())

        target_upper = target.upper()
        
        enc_dsn = os.getenv(f"{target_upper}_DSN")
        enc_user = os.getenv(f"{target_upper}_USER")
        enc_pwd = os.getenv(f"{target_upper}_PASSWORD")

        if not all([enc_dsn, enc_user, enc_pwd]):
            raise ValueError(f"CRITICAL: .env 파일에 DB Target '{target_upper}'에 대한 접속 정보가 누락되었습니다.")

        try:
            db_str = self.cipher.decrypt(enc_dsn.encode()).decode() 
            self.user = self.cipher.decrypt(enc_user.encode()).decode()
            self.password = self.cipher.decrypt(enc_pwd.encode()).decode()
        except Exception as e:
            print(f"[{target_upper}] Tibero 자격 증명 복호화 실패: {e}")
            raise ValueError(f"[{target_upper}] 보안 자격 증명 복호화에 실패했습니다.")

        try:
            host_part, self.db_name = db_str.split('/')
            self.ip, self.port = host_part.split(':')
        except ValueError:
            raise ValueError(f"[{target_upper}] DSN 형식이 올바르지 않습니다. (요구형식: IP:Port/DB명)")

    def get_connection(self):
        """
        Tibero DSN-less 연결을 수행하고 connection 객체를 반환합니다.
        """
        conn_str = f"DRIVER={{Tibero}};SERVER={self.ip};PORT={self.port};DATABASE={self.db_name};UID={self.user};PWD={self.password}"

        try:
            conn = pyodbc.connect(conn_str)
            conn.setdecoding(pyodbc.SQL_CHAR, encoding='utf-8')
            conn.setencoding(encoding='utf-8')
            return conn
        except Exception as e:
            print(f"Tibero DB Connection Error: {e}")
            raise RuntimeError(f"티베로 데이터베이스 연결 실패: {str(e)}")