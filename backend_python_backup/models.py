from sqlalchemy import Column, String, Integer, DateTime, Text
from database import Base
from datetime import datetime, timezone, timedelta

class TempEmail(Base):
    __tablename__ = "temp_emails"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    address = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    token = Column(Text, nullable=False)
    account_id = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime, nullable=False)  # Expiry time
    message_count = Column(Integer, default=0, nullable=False)
    provider = Column(String(50), default="mailtm", nullable=False)  # Provider tracking (mailtm/mailgw/1secmail)
    mailbox_id = Column(String(255), nullable=True)  # For SMTPLabs mailbox tracking (legacy)
    username = Column(String(255), nullable=True)  # Username part of email
    domain = Column(String(255), nullable=True)  # Domain part of email
    
    def to_dict(self):
        """Convert model to dictionary"""
        # Ensure created_at has timezone info (UTC) and convert to ISO format
        created_at = self.created_at
        if created_at.tzinfo is None:
            # If no timezone, assume it's UTC
            created_at = created_at.replace(tzinfo=timezone.utc)
        
        # Ensure expires_at has timezone info
        expires_at = self.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        return {
            "id": self.id,
            "address": self.address,
            "password": self.password,
            "token": self.token,
            "account_id": self.account_id,
            "created_at": created_at.isoformat(),
            "expires_at": expires_at.isoformat(),  # NEW
            "message_count": self.message_count,
            "provider": self.provider,
            "username": self.username,
            "domain": self.domain
        }


class EmailHistory(Base):
    """Store expired emails for history"""
    __tablename__ = "email_history"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    address = Column(String(255), nullable=False, index=True)
    password = Column(String(255), nullable=False)
    token = Column(Text, nullable=False)
    account_id = Column(String(255), nullable=False)
    created_at = Column(DateTime, nullable=False)
    expired_at = Column(DateTime, nullable=False)  # When it expired
    message_count = Column(Integer, default=0, nullable=False)
    
    def to_dict(self):
        """Convert model to dictionary"""
        created_at = self.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        
        expired_at = self.expired_at
        if expired_at.tzinfo is None:
            expired_at = expired_at.replace(tzinfo=timezone.utc)
        
        return {
            "id": self.id,
            "address": self.address,
            "password": self.password,
            "token": self.token,
            "account_id": self.account_id,
            "created_at": created_at.isoformat(),
            "expired_at": expired_at.isoformat(),
            "message_count": self.message_count
        }


class SavedEmail(Base):
    """Store saved/bookmarked emails"""
    __tablename__ = "saved_emails"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    email_address = Column(String(255), nullable=False, index=True)  # Which email received this
    message_id = Column(String(255), nullable=False)  # Original message ID
    subject = Column(String(500), nullable=True)
    from_address = Column(String(255), nullable=True)
    from_name = Column(String(255), nullable=True)
    html = Column(Text, nullable=True)  # HTML content
    text = Column(Text, nullable=True)  # Text content
    created_at = Column(DateTime, nullable=False)  # When message was created
    saved_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)  # When saved
    
    def to_dict(self):
        """Convert model to dictionary"""
        created_at = self.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        
        saved_at = self.saved_at
        if saved_at.tzinfo is None:
            saved_at = saved_at.replace(tzinfo=timezone.utc)
        
        return {
            "id": self.id,
            "email_address": self.email_address,
            "message_id": self.message_id,
            "subject": self.subject,
            "from": {
                "address": self.from_address,
                "name": self.from_name
            },
            "html": [self.html] if self.html else [],
            "text": [self.text] if self.text else [],
            "createdAt": created_at.isoformat(),
            "saved_at": saved_at.isoformat()
        }
