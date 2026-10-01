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

            # Capture screenshot with Copilot closed
            print("Capturing viewport screenshot (Copilot closed)...")
            await ws.send(json.dumps({"id": 3, "method": "Page.captureScreenshot", "params": {"format": "png"}}))
            while True:
                resp = await ws.recv()
                data = json.loads(resp)
                if data.get("id") == 3:
                    img_bytes = base64.b64decode(data["result"]["data"])
                    OUTPUT_PNG.write_bytes(img_bytes)
                    print(f"Screenshot written to {OUTPUT_PNG} ({len(img_bytes)} bytes).")
                    break

            # Click Copilot button
            print("Opening Copilot sidebar...")
            click_code = """
            (() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const c = btns.find(b => b.textContent && b.textContent.includes('Copilot'));
                if (c) { c.click(); return true; }
                return false;
            })()
            """
            await ws.send(json.dumps({"id": 4, "method": "Runtime.evaluate", "params": {"expression": click_code, "returnByValue": True}}))
            while True:
                resp = await ws.recv()
                data = json.loads(resp)
                if data.get("id") == 4:
                    print(f"Copilot click result: {data.get('result', {}).get('result', {}).get('value')}")
                    break

            await asyncio.sleep(1.5)

            # Capture screenshot with Copilot open
            open_png = Path("edge_canvas_copilot_open.png")
            print("Capturing viewport screenshot (Copilot open)...")
            await ws.send(json.dumps({"id": 5, "method": "Page.captureScreenshot", "params": {"format": "png"}}))
            while True:
                resp = await ws.recv()
                data = json.loads(resp)
                if data.get("id") == 5:
                    img_bytes = base64.b64decode(data["result"]["data"])
                    open_png.write_bytes(img_bytes)
                    print(f"Screenshot written to {open_png} ({len(img_bytes)} bytes).")
                    break

            # Evaluate bounding box overlaps
            overlap_check_code = """
            (() => {
                const getRect = (el) => el ? el.getBoundingClientRect() : null;
                const overlaps = (r1, r2) => {
                    if (!r1 || !r2) return false;
                    return !(r1.right <= r2.left || r1.left >= r2.right || r1.bottom <= r2.top || r1.top >= r2.bottom);
                };

                const isoBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'ISO');
                const viewsWidget = isoBtn ? isoBtn.parentElement : null;

                const copilotTitle = Array.from(document.querySelectorAll('span')).find(s => s.textContent && s.textContent.includes('AI BIM Copilot'));
                const copilotSidebar = copilotTitle ? copilotTitle.closest('.fixed') : null;

                const topPill = document.querySelector('header');

                const rViews = getRect(viewsWidget);
                const rCopilot = getRect(copilotSidebar);
                const rTop = getRect(topPill);

                return {
                    viewsRect: rViews ? { top: rViews.top, bottom: rViews.bottom, left: rViews.left, right: rViews.right } : null,
                    copilotRect: rCopilot ? { top: rCopilot.top, bottom: rCopilot.bottom, left: rCopilot.left, right: rCopilot.right } : null,
                    viewsOverlapsCopilot: overlaps(rViews, rCopilot),
                    viewsOverlapsTopPill: overlaps(rViews, rTop)
                };
            })()
            """
            await ws.send(json.dumps({"id": 6, "method": "Runtime.evaluate", "params": {"expression": overlap_check_code, "returnByValue": True}}))
            while True:
                resp = await ws.recv()
                data = json.loads(resp)
                if data.get("id") == 6:
                    res = data.get("result", {}).get("result", {}).get("value", {})
                    print("Bounding Box Overlap Analysis:", json.dumps(res, indent=2))
                    assert not res.get("viewsOverlapsCopilot"), "Views overlaps Copilot!"
                    assert not res.get("viewsOverlapsTopPill"), "Views overlaps Top Pill!"
                    print("VERIFICATION SUCCESSFUL: 0 Overlaps Detected!")
                    break

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
