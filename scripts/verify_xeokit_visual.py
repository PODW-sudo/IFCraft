import asyncio
import json
import urllib.request
import subprocess
import time
import base64
from pathlib import Path
import websockets

async def capture():
    chrome_path = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    profile_dir = Path.home() / "AppData" / "Local" / "Temp" / "agent_qa_xeokit_verify"
    profile_dir.mkdir(parents=True, exist_ok=True)
    port = 9333

    proc = subprocess.Popen([
        chrome_path,
        '--headless=new',
        f'--remote-debugging-port={port}',
        f'--user-data-dir={profile_dir}',
        '--window-size=1600,960',
        '--disable-gpu',
        '--hide-scrollbars',
        '--disable-extensions',
        '--no-first-run',
        '--no-default-browser-check',
        'about:blank'
    ])

    ws_url = None
    for _ in range(40):
        await asyncio.sleep(0.3)
        try:
            res = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{port}/json').read().decode())
            if res and len(res) > 0:
                page_targets = [t for t in res if t.get('type') == 'page']
                target = page_targets[0] if page_targets else res[0]
                ws_url = target.get('webSocketDebuggerUrl')
                if ws_url:
                    break
        except Exception:
            pass

    if not ws_url:
        proc.kill()
        print('Could not connect to Chrome CDP')
        return

    ws = await websockets.connect(ws_url, max_size=50*1024*1024)
    msg_id = 0
    async def send(method, params=None):
        nonlocal msg_id
        msg_id += 1
        req_id = msg_id
        payload = {'id': req_id, 'method': method}
        if params:
            payload['params'] = params
        await ws.send(json.dumps(payload))
        while True:
            raw = await ws.recv()
            data = json.loads(raw)
            if data.get('id') == req_id:
                return data.get('result', {})

    await send('Page.enable')
    await send('Runtime.enable')
    await send('Page.navigate', {'url': 'http://localhost:5173'})

    # Wait for initial load
    print('Waiting for page to load...')
    await asyncio.sleep(3.5)

    # Set profile to query, switch to Xeokit
    js = '''
    (async () => {
        const queryBtn = document.querySelector('[data-qa="profile-query-btn"]');
        if (queryBtn) queryBtn.click();
        
        await new Promise(r => setTimeout(r, 600));

        const xeokitToggle = document.querySelector('[data-qa="engine-toggle-xeokit"]');
        if (xeokitToggle) xeokitToggle.click();

        await new Promise(r => setTimeout(r, 1000));

        return {
            hasXeokit: !!document.querySelector('[data-qa="xeokit-viewport-container"]'),
            hasNavCube: !!document.querySelector('[data-qa="xeokit-navcube-card"]'),
            hasTelemetry: !!document.querySelector('[data-qa="xeokit-telemetry-hud"]'),
            fps: document.querySelector('[data-qa="xeokit-telemetry-hud"]')?.textContent?.trim()
        };
    })()
    '''
    res = await send('Runtime.evaluate', {'expression': js, 'awaitPromise': True, 'returnByValue': True})
    print('Engine switch state:', res.get('result', {}).get('value'))

    # Wait for WebGL rendering to settle
    await asyncio.sleep(3.5)

    # Take screenshot
    shot = await send('Page.captureScreenshot', {'format': 'png'})
    data = base64.b64decode(shot['data'])
    out_path = Path(r'C:\Users\waleg\.gemini\antigravity-cli\brain\69f70a29-dc93-46ae-9d70-5ebc646c5a09\xeokit_fixed_verification.png')
    with open(out_path, 'wb') as f:
        f.write(data)
    print(f'Screenshot successfully saved to {out_path} ({len(data)} bytes)')

    await ws.close()
    proc.terminate()

if __name__ == '__main__':
    asyncio.run(capture())
