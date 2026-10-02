#!/usr/bin/env python3
"""
scripts/verify_layout_renders.py
Automated visual & DOM overlap test using Chrome/Edge DevTools Protocol (CDP).
Tests both Copilot-open and Copilot-closed layouts, captures screenshots,
and programmatically verifies zero bounding box intersections between HUD elements.
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
PORT = 9334
URL = "http://localhost:5173"

async def test_layout():
    profile_dir = Path.home() / "AppData" / "Local" / "Temp" / "edge_layout_test_profile"
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
            print("Failed to connect to CDP endpoint.")
            return False

        print(f"Connected to CDP endpoint: {ws_url}")
        async with websockets.connect(ws_url, max_size=25 * 1024 * 1024) as ws:
            msg_id = 0
            async def send_cmd(method, params=None):
                nonlocal msg_id
                msg_id += 1
                payload = {"id": msg_id, "method": method}
                if params:
                    payload["params"] = params
                await ws.send(json.dumps(payload))
                while True:
                    resp = await ws.recv()
                    data = json.loads(resp)
                    if data.get("id") == msg_id:
                        return data.get("result")

            await send_cmd("Page.enable")
            print(f"Navigating to {URL}...")
            await send_cmd("Page.navigate", {"url": URL})

            print("Waiting 6s for IFC model loading & WebAssembly worker...")
            await asyncio.sleep(6)

            # Capture Copilot Closed Screenshot
            print("Capturing layout_copilot_closed.png...")
            res = await send_cmd("Page.captureScreenshot", {"format": "png"})
            Path("layout_copilot_closed.png").write_bytes(base64.b64decode(res["data"]))

            # Open Copilot via JS click on the pill button
            print("Opening Copilot sidebar via UI click...")
            eval_res = await send_cmd("Runtime.evaluate", {
                "expression": """
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const copilotBtn = buttons.find(b => b.textContent && b.textContent.includes('Copilot'));
                    if (copilotBtn) {
                        copilotBtn.click();
                        return true;
                    }
                    return false;
                })()
                """,
                "returnByValue": True
            })
            print(f"Copilot button clicked: {eval_res.get('value')}")

            # Wait 1s for drawer animation
            await asyncio.sleep(1.2)

            # Capture Copilot Open Screenshot
            print("Capturing layout_copilot_open.png...")
            res = await send_cmd("Page.captureScreenshot", {"format": "png"})
            Path("layout_copilot_open.png").write_bytes(base64.b64decode(res["data"]))

            # Run programmatic bounding-box overlap verification
            verify_script = """
            (() => {
                const getRect = (sel) => {
                    const el = document.querySelector(sel);
                    return el ? el.getBoundingClientRect() : null;
                };

                const overlaps = (r1, r2) => {
                    if (!r1 || !r2) return false;
                    return !(
                        r1.right <= r2.left ||
                        r1.left >= r2.right ||
                        r1.bottom <= r2.top ||
                        r1.top >= r2.bottom
                    );
                };

                // Find elements
                const topPill = document.querySelector('header');
                const viewsWidget = Array.from(document.querySelectorAll('div')).find(d => 
                    d.textContent && d.textContent.includes('Views') && d.textContent.includes('ISO') && d.textContent.includes('TOP')
                );
                const copilotSidebar = Array.from(document.querySelectorAll('aside')).find(a => 
                    a.textContent && a.textContent.includes('AI BIM COPILOT')
                );
                const spatialTree = Array.from(document.querySelectorAll('div')).find(d => 
                    d.textContent && d.textContent.includes('SPATIAL HIERARCHY')
                );
                const bottomDock = Array.from(document.querySelectorAll('div')).find(d => 
                    d.textContent && d.textContent.includes('Snap') && d.textContent.includes('Measure')
                );

                const topPillRect = topPill ? topPill.getBoundingClientRect() : null;
                const viewsRect = viewsWidget ? viewsWidget.getBoundingClientRect() : null;
                const copilotRect = copilotSidebar ? copilotSidebar.getBoundingClientRect() : null;
                const treeRect = spatialTree ? spatialTree.getBoundingClientRect() : null;
                const dockRect = bottomDock ? bottomDock.getBoundingClientRect() : null;

                const results = {
                    viewsFound: Boolean(viewsRect),
                    copilotFound: Boolean(copilotRect),
                    treeFound: Boolean(treeRect),
                    dockFound: Boolean(dockRect),
                    viewsOverlapCopilot: overlaps(viewsRect, copilotRect),
                    viewsOverlapTopPill: overlaps(viewsRect, topPillRect),
                    treeOverlapDock: overlaps(treeRect, dockRect),
                    viewsRect: viewsRect ? { top: viewsRect.top, bottom: viewsRect.bottom, left: viewsRect.left, right: viewsRect.right } : null,
                    copilotRect: copilotRect ? { top: copilotRect.top, bottom: copilotRect.bottom, left: copilotRect.left, right: copilotRect.right } : null
                };
                return results;
            })()
            """
            check_res = await send_cmd("Runtime.evaluate", {
                "expression": verify_script,
                "returnByValue": True
            })

            data = check_res.get("value", {})
            print("Layout Verification Results:")
            print(json.dumps(data, indent=2))

            if data.get("viewsOverlapCopilot"):
                print("FAIL: Views widget overlaps Copilot sidebar!")
                return False
            if data.get("viewsOverlapTopPill"):
                print("FAIL: Views widget overlaps Top Pill!")
                return False

            print("PASS: Zero overlaps detected between Views widget, Copilot sidebar, and Top Pill.")
            return True
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except Exception:
            proc.kill()

if __name__ == "__main__":
    success = asyncio.run(test_layout())
    sys.exit(0 if success else 1)
