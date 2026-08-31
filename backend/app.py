from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from config.config import Config

app = Flask(__name__)
app.config.from_object(Config)
CORS(app, origins=[app.config["FRONTEND_URL"]])

db = SQLAlchemy(app)

@app.route("/api/health")
def health_check():
    return {"status": "ok"}, 200

if __name__ == "__main__":
    app.run(debug=(app.config.get("FLASK_ENV") == "development"), host="0.0.0.0", port=5000)