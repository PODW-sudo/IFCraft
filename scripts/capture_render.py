#!/usr/bin/env python3
"""
scripts/capture_render.py
Automates high-resolution screenshot capture of the IFC Editor spatial canvas
using Chrome/Edge headless DevTools Protocol over WebSockets.
"""

import sys
import json
import base64
import time
import subprocess
import urllib.request
import asyncio
from pathlib import Path
import websockets

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 9333
URL = "http://localhost:5173"
OUTPUT_PNG = Path("edge_canvas_full.png")

async def capture():
    # 1. Launch Edge headless with remote debugging on PORT
    profile_dir = Path.home() / "AppData" / "Local" / "Temp" / "edge_cdp_profile"
    cmd = [
        EDGE_PATH,
        "--headless=new",
        f"--user-data-dir={profile_dir}",
        f"--remote-debugging-port={PORT}",
        "--window-size=1440,900",
        "--disable-gpu",
        "--hide-scrollbars",
        "about:blank"
    ]
    proc = subprocess.Popen(cmd)
    try:
        # Wait for devtools port
        ws_url = None
        for _ in range(30):
            time.sleep(0.3)
            try:
                res = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json").read().decode())
                if res and len(res) > 0:
                    ws_url = res[0].get("webSocketDebuggerUrl")
                    if ws_url:
                        break
            except Exception:
                pass

        if not ws_url:
            print("Failed to connect to browser CDP endpoint.")
            return False

        print(f"Connected to CDP endpoint: {ws_url}")
        async with websockets.connect(ws_url, max_size=20 * 1024 * 1024) as ws:
            # Enable Page
            await ws.send(json.dumps({"id": 1, "method": "Page.enable"}))
            await ws.recv()

            # Navigate to URL
            print(f"Navigating to {URL}...")
            await ws.send(json.dumps({"id": 2, "method": "Page.navigate", "params": {"url": URL}}))
            await ws.recv()

            # Wait 6 seconds for WebAssembly worker to fetch, parse, and render geometries
            print("Waiting 6s for IFC model loading & WebAssembly worker...")
            await asyncio.sleep(6)

            # Capture screenshot
            print("Capturing viewport screenshot...")
            await ws.send(json.dumps({"id": 3, "method": "Page.captureScreenshot", "params": {"format": "png"}}))
            while True:
                resp = await ws.recv()
                data = json.loads(resp)
                if data.get("id") == 3:
                    img_b64 = data["result"]["data"]
                    img_bytes = base64.b64decode(img_b64)
                    OUTPUT_PNG.write_bytes(img_bytes)
                    print(f"Screenshot written to {OUTPUT_PNG} ({len(img_bytes)} bytes).")
                    return True
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except Exception:
            proc.kill()

if __name__ == "__main__":
    success = asyncio.run(capture())
    sys.exit(0 if success else 1)
