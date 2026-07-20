from __future__ import annotations

import http.server
import socketserver
import threading
import webbrowser
from pathlib import Path

PORT = 8765
ROOT = Path(__file__).resolve().parent


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    handler = lambda *args, **kwargs: http.server.SimpleHTTPRequestHandler(
        *args, directory=str(ROOT), **kwargs
    )
    url = f"http://127.0.0.1:{PORT}"
    print(f"生命線已啟動：{url}")
    with ReusableTCPServer(("127.0.0.1", PORT), handler) as server:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\n生命線已關閉。")
