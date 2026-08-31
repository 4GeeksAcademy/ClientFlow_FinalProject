import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    FLASK_ENV = os.getenv("FLASK_ENV", "production")

    if not SECRET_KEY:
        raise ValueError(
            "SECRET_KEY no está definida en las variables de entorno")
    if not SQLALCHEMY_DATABASE_URI:
        raise ValueError(
            "DATABASE_URL no está definida en las variables de entorno")
