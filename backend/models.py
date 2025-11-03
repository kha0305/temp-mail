from sqlalchemy import Column, String, Integer, DateTime, Text
from database import Base
from datetime import datetime, timezone

class TempEmail(Base):
    __tablename__ = "temp_emails"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    address = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    token = Column(Text, nullable=False)
    account_id = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    message_count = Column(Integer, default=0, nullable=False)
    
    def to_dict(self):
        """Convert model to dictionary"""
        return {
            "id": self.id,
            "address": self.address,
            "password": self.password,
            "token": self.token,
            "account_id": self.account_id,
            "created_at": self.created_at,
            "message_count": self.message_count
        }
