from __future__ import annotations

import http.server
import socketserver
import threading
import webbrowser
from pathlib import Path

from scripts.build_site import main as build_site

PORT = 8765
SOURCE_ROOT = Path(__file__).resolve().parent


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def prepare_site() -> Path:
    try:
        build_site()
        return SOURCE_ROOT / "_site"
    except Exception as error:
        print(f"建置新版頁面失敗，改為直接啟動原始檔案：{error}")
        return SOURCE_ROOT


if __name__ == "__main__":
    root = prepare_site()
    handler = lambda *args, **kwargs: http.server.SimpleHTTPRequestHandler(
        *args, directory=str(root), **kwargs
    )
    url = f"http://127.0.0.1:{PORT}"
    print(f"生命線已啟動：{url}")
    with ReusableTCPServer(("127.0.0.1", PORT), handler) as server:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\n生命線已關閉。")
