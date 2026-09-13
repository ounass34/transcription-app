from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from database import engine, Base, get_db
import models

# Création automatique des tables au démarrage
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Transcription & Knowledge Base API", version="1.0.0")

@app.get("/")
def read_root():
    return {"message": "Bienvenue sur l'API de Transcription et Restitution Intelligente ! 🚀"}

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    return {"status": "healthy", "database": "connected"}