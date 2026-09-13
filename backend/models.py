from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from database import Base
# Note: pgvector integration can be added using custom column types or raw SQL triggers if needed

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="user") # anonymous, user, admin
    mfa_secret = Column(String, nullable=True)
    mfa_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Transcription(Base):
    __tablename__ = "transcriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    audio_file_path = Column(String, nullable=False)
    raw_text = Column(Text, nullable=True)
    structured_content = Column(Text, nullable=True)
    duration = Column(Float, nullable=True)
    status = Column(String, default="pending") # pending, completed, failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String, nullable=False)
    structure_prompt = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())