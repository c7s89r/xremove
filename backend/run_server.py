import os

os.environ.setdefault("MPLBACKEND", "Agg")

import uvicorn
from backend.app import app

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
