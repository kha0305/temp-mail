from sqlalchemy import Column, String, Integer, DateTime, Text
from database import Base
from datetime import datetime, timezone
import uuid

class TempEmail(Base):
    __tablename__ = "temp_emails"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    address = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    token = Column(Text, nullable=False)
    account_id = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    message_count = Column(Integer, default=0, nullable=False)
    
    def to_dict(self):
        """Convert model to dictionary"""
        # Ensure created_at has timezone info (UTC) and convert to ISO format
        created_at = self.created_at
        if created_at.tzinfo is None:
            # If no timezone, assume it's UTC
            created_at = created_at.replace(tzinfo=timezone.utc)
        
        return {
            "id": self.id,
            "address": self.address,
            "password": self.password,
            "token": self.token,
            "account_id": self.account_id,
            "created_at": created_at.isoformat(),  # Return ISO format string with timezone
            "message_count": self.message_count
        }
