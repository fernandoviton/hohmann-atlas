import os

import uvicorn


def run():
    host = os.environ.get("HOST", "127.0.0.1")
    reload = os.environ.get("RELOAD", "true").lower() == "true"
    uvicorn.run("app.api:app", host=host, port=8000, reload=reload)


if __name__ == "__main__":
    run()
