import threading
import time

import pytest
import uvicorn


@pytest.fixture(scope="session")
def live_server():
    """Start the FastAPI app on a random port and yield the base URL."""
    config = uvicorn.Config("app.api:app", host="127.0.0.1", port=0, log_level="warning")
    server = uvicorn.Server(config)

    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    # Wait for server to start
    while not server.started:
        time.sleep(0.1)

    # Extract the bound port
    sock = server.servers[0].sockets[0]
    port = sock.getsockname()[1]
    base_url = f"http://127.0.0.1:{port}"

    yield base_url

    server.should_exit = True
    thread.join(timeout=5)
