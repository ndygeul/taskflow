import os
import oracledb
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

class OracleClient:
    def __init__(self, target="TMA"):
        """
        :param target: 'TMA' (기본값), 'DREPORT', 'WBR', 'KCUBE', 'NETADAPTER', 'OSSMASTER'
        """
        secret_key = os.getenv("ORACLE_SECRET_KEY")
        if not secret_key:
            raise ValueError("CRITICAL: .env 파일에 ORACLE_SECRET_KEY가 설정되지 않았습니다.")
        
        self.cipher = Fernet(secret_key)

        target_upper = target.upper()
        
        enc_user = os.getenv(f"{target_upper}_USER")
        enc_password = os.getenv(f"{target_upper}_PASSWORD")
        enc_dsn = os.getenv(f"{target_upper}_DSN")

        if not all([enc_user, enc_password, enc_dsn]):
            raise ValueError(f"CRITICAL: .env 파일에 DB Target '{target_upper}'에 대한 접속 정보가 누락되었습니다.")

        try:
            self.user = self.cipher.decrypt(enc_user.encode()).decode()
            self.password = self.cipher.decrypt(enc_password.encode()).decode()
            self.dsn = self.cipher.decrypt(enc_dsn.encode()).decode()
        except Exception as e:
            print(f"[{target_upper}] Oracle 자격 증명 복호화 실패: {e}")
            raise

    def get_connection(self):
        """
        환경변수 ORACLE_CLIENT_MODE에 따라 Thick/Thin 모드를 자동 전환합니다.
        """
        mode = os.getenv("ORACLE_CLIENT_MODE", "thin").lower()

        if mode == "thick":
            try:
                oracledb.init_oracle_client()
            except oracledb.DatabaseError as e:
                if "DPI-1047" in str(e):
                    pass
                pass 
            except Exception:
                pass

        return oracledb.connect(
            user=self.user,
            password=self.password,
            dsn=self.dsn
        )