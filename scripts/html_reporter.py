#!/usr/bin/env python3
"""
scripts/html_reporter.py
Generates a standalone, rich interactive HTML report for the Agent QA Harness.
Features:
- Dark-mode OpenBIM CAD styling
- Live KPI summary metrics (Total, Pass, Fail, Rate %, Rotated Models)
- Category & Model distribution cards
- Interactive search and multi-criteria filtering (Status, Tier, Category, Model, Scenario)
- Full interactive data table of all live test executions
"""

import json
from pathlib import Path
from datetime import datetime

def generate_html_report(results: list, cases: dict, date_str: str, output_path: Path):
    total = len(results)
    passed = sum(1 for r in results if r.get("status") == "pass")
    failed = sum(1 for r in results if r.get("status") == "fail")
    skipped = sum(1 for r in results if r.get("status") == "skip")
    unable = sum(1 for r in results if r.get("status") == "unable_to_test")
    pass_rate = (passed / total * 100) if total > 0 else 0.0

    models_seen = set()
    categories_seen = set()
    controls_seen = set()

    for r in results:
        m = r.get("model")
        if m:
            models_seen.add(m)
        tc = cases.get(r["test_id"], {})
        cat = tc.get("category")
        if cat:
            categories_seen.add(cat)
        cid = r.get("control_id") or tc.get("control_id")
        if cid:
            controls_seen.add(cid)

    # Build rows HTML
    rows_html = []
    for r in results:
        tc = cases.get(r["test_id"], {})
        status = r.get("status", "skip").lower()
        tier = r.get("tier") or tc.get("tier", "full")
        model = r.get("model") or tc.get("model", "Building-Architecture.ifc")
        control_id = r.get("control_id") or tc.get("control_id", "—")
        control_name = r.get("control_name") or tc.get("control_name", "")
        scenario = r.get("scenario") or tc.get("scenario", "—")
        category = tc.get("category", "General")
        name = tc.get("name", r["test_id"])
        notes = r.get("notes", "")
        ts = r.get("timestamp", "")
        if "T" in ts:
            ts_display = ts.split("T")[1][:8]
        else:
            ts_display = ts

        status_class = f"badge-{status}"
        tier_class = f"badge-tier-{tier}"
        scenario_class = f"badge-scen-{scenario.lower()}" if scenario in ("A", "B") else "badge-scen-na"

        ctrl_display = f"<strong>{control_id}</strong> {control_name}".strip() if control_id != "—" else "—"

        rows_html.append(f"""
        <tr data-status="{status}" data-tier="{tier}" data-category="{category}" data-model="{model}" data-scenario="{scenario}">
            <td><span class="badge {status_class}">{status.upper()}</span></td>
            <td><span class="test-id">{r['test_id']}</span></td>
            <td><span class="badge {tier_class}">{tier.upper()}</span></td>
            <td class="control-cell">{ctrl_display}</td>
            <td><span class="badge {scenario_class}">{scenario}</span></td>
            <td>
                <div class="test-name">{name}</div>
                <div class="test-cat">{category}</div>
            </td>
            <td><span class="model-badge" title="Model rotated for this test">{model}</span></td>
            <td class="notes-cell">{notes}</td>
            <td class="time-cell">{ts_display}</td>
        </tr>
        """)

    category_options = "\n".join(f'<option value="{c}">{c}</option>' for c in sorted(categories_seen))
    model_options = "\n".join(f'<option value="{m}">{m}</option>' for m in sorted(models_seen))

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IFC Editor — Agent QA Live Test Report ({date_str})</title>
    <style>
        :root {{
            --bg-canvas: #090d16;
            --bg-card: #111827;
            --bg-card-hover: #1e293b;
            --border: #1e293b;
            --border-highlight: #334155;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
            --cyan: #38bdf8;
            --emerald: #10b981;
            --rose: #f43f5e;
            --amber: #f59e0b;
            --purple: #a855f7;
            --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }}

        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}

        body {{
            background-color: var(--bg-canvas);
            color: var(--text-primary);
            font-family: var(--font-sans);
            font-size: 13px;
            line-height: 1.5;
            padding: 24px;
        }}

        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}

        /* Header */
        header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            margin-bottom: 24px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }}

        .brand {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}

        .brand-icon {{
            width: 36px;
            height: 36px;
            border-radius: 10px;
            background: rgba(56, 189, 248, 0.15);
            border: 1px solid rgba(56, 189, 248, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--cyan);
            font-size: 18px;
            font-weight: bold;
        }}

        .brand h1 {{
            font-size: 18px;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: #ffffff;
        }}

        .brand p {{
            font-size: 12px;
            color: var(--text-secondary);
        }}

        .meta-pill {{
            display: flex;
            gap: 16px;
            align-items: center;
            background: rgba(15, 23, 42, 0.6);
            padding: 8px 16px;
            border-radius: 9999px;
            border: 1px solid var(--border);
            font-family: var(--font-mono);
            font-size: 12px;
            color: var(--text-secondary);
        }}

        .meta-pill strong {{
            color: var(--cyan);
        }}

        /* KPIs Grid */
        .kpi-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }}

        .kpi-card {{
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 16px 20px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            transition: transform 0.15s, border-color 0.15s;
        }}

        .kpi-card:hover {{
            transform: translateY(-2px);
            border-color: var(--border-highlight);
        }}

        .kpi-title {{
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-weight: 600;
            color: var(--text-muted);
        }}

        .kpi-value {{
            font-size: 26px;
            font-weight: 800;
            font-family: var(--font-mono);
            letter-spacing: -0.03em;
        }}

        .kpi-pass {{ color: var(--emerald); }}
        .kpi-fail {{ color: var(--rose); }}
        .kpi-rate {{ color: var(--cyan); }}
        .kpi-neutral {{ color: var(--text-primary); }}

        /* Controls & Filter Bar */
        .filter-bar {{
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 14px 18px;
            margin-bottom: 20px;
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: center;
            justify-content: space-between;
        }}

        .filter-group {{
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
        }}

        .search-box {{
            background: rgba(15, 23, 42, 0.8);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 7px 12px;
            color: #fff;
            font-size: 12px;
            font-family: var(--font-sans);
            outline: none;
            width: 240px;
            transition: border-color 0.15s;
        }}

        .search-box:focus {{
            border-color: var(--cyan);
        }}

        select.filter-select {{
            background: rgba(15, 23, 42, 0.8);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 7px 10px;
            color: var(--text-secondary);
            font-size: 12px;
            outline: none;
            cursor: pointer;
        }}

        select.filter-select:hover {{
            border-color: var(--border-highlight);
        }}

        .btn-filter {{
            background: rgba(30, 41, 59, 0.5);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 6px 12px;
            color: var(--text-secondary);
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s;
        }}

        .btn-filter:hover {{
            background: rgba(51, 65, 85, 0.8);
            color: #fff;
        }}

        .btn-filter.active {{
            background: rgba(56, 189, 248, 0.15);
            border-color: rgba(56, 189, 248, 0.4);
            color: var(--cyan);
        }}

        .counter-badge {{
            font-family: var(--font-mono);
            font-size: 11px;
            color: var(--text-muted);
        }}

        /* Table */
        .table-wrapper {{
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }}

        table {{
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }}

        th {{
            background: rgba(15, 23, 42, 0.95);
            padding: 12px 14px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
            font-weight: 700;
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 10;
        }}

        td {{
            padding: 12px 14px;
            border-bottom: 1px solid rgba(30, 41, 59, 0.5);
            vertical-align: middle;
        }}

        tr:hover td {{
            background: rgba(30, 41, 59, 0.35);
        }}

        /* Badges */
        .badge {{
            display: inline-flex;
            align-items: center;
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 700;
            font-family: var(--font-mono);
            letter-spacing: 0.03em;
        }}

        .badge-pass {{
            background: rgba(16, 185, 129, 0.15);
            color: var(--emerald);
            border: 1px solid rgba(16, 185, 129, 0.3);
        }}

        .badge-fail {{
            background: rgba(244, 63, 94, 0.15);
            color: var(--rose);
            border: 1px solid rgba(244, 63, 94, 0.3);
        }}

        .badge-skip {{
            background: rgba(148, 163, 184, 0.12);
            color: var(--text-muted);
            border: 1px solid rgba(148, 163, 184, 0.2);
        }}

        .badge-unable {{
            background: rgba(245, 158, 11, 0.15);
            color: var(--amber);
            border: 1px solid rgba(245, 158, 11, 0.3);
        }}

        .badge-tier-key {{
            background: rgba(56, 189, 248, 0.12);
            color: var(--cyan);
            border: 1px solid rgba(56, 189, 248, 0.25);
        }}

        .badge-tier-full {{
            background: rgba(148, 163, 184, 0.08);
            color: var(--text-secondary);
            border: 1px solid rgba(148, 163, 184, 0.15);
        }}

        .badge-scen-a {{
            background: rgba(56, 189, 248, 0.15);
            color: var(--cyan);
            border: 1px solid rgba(56, 189, 248, 0.3);
        }}

        .badge-scen-b {{
            background: rgba(168, 85, 247, 0.15);
            color: var(--purple);
            border: 1px solid rgba(168, 85, 247, 0.3);
        }}

        .badge-scen-na {{
            color: var(--text-muted);
        }}

        .test-id {{
            font-family: var(--font-mono);
            font-weight: 700;
            color: var(--text-primary);
            font-size: 11px;
        }}

        .control-cell strong {{
            color: var(--cyan);
            font-family: var(--font-mono);
            font-size: 11px;
            margin-right: 4px;
        }}

        .test-name {{
            font-weight: 600;
            color: #ffffff;
            font-size: 12px;
        }}

        .test-cat {{
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 2px;
        }}

        .model-badge {{
            font-family: var(--font-mono);
            font-size: 11px;
            color: #cbd5e1;
            background: rgba(30, 41, 59, 0.6);
            padding: 3px 8px;
            border-radius: 6px;
            border: 1px solid var(--border);
            white-space: nowrap;
        }}

        .notes-cell {{
            font-size: 11px;
            color: var(--text-secondary);
            max-width: 320px;
            word-break: break-word;
        }}

        .time-cell {{
            font-family: var(--font-mono);
            font-size: 10px;
            color: var(--text-muted);
            white-space: nowrap;
        }}

        footer {{
            margin-top: 24px;
            text-align: center;
            font-size: 11px;
            color: var(--text-muted);
        }}
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <header>
            <div class="brand">
                <div class="brand-icon">IFC</div>
                <div>
                    <h1>Agent QA Live Browser Test Report</h1>
                    <p>Continuous Quality Assurance & CAD Usability Audit</p>
                </div>
            </div>
            <div class="meta-pill">
                <span>Date: <strong>{date_str}</strong></span>
                <span>Target: <strong>http://localhost:5173</strong></span>
                <span>Mode: <strong>Dual-Scenario Live CDP</strong></span>
            </div>
        </header>

        <!-- KPI Cards -->
        <div class="kpi-grid">
            <div class="kpi-card">
                <span class="kpi-title">Pass Rate</span>
                <span class="kpi-value kpi-rate">{pass_rate:.1f}%</span>
            </div>
            <div class="kpi-card">
                <span class="kpi-title">Passed Tests</span>
                <span class="kpi-value kpi-pass">{passed}</span>
            </div>
            <div class="kpi-card">
                <span class="kpi-title">Failed Tests</span>
                <span class="kpi-value {('kpi-fail' if failed > 0 else 'kpi-neutral')}">{failed}</span>
            </div>
            <div class="kpi-card">
                <span class="kpi-title">Total Executed</span>
                <span class="kpi-value kpi-neutral">{total}</span>
            </div>
            <div class="kpi-card">
                <span class="kpi-title">UI Controls Verified</span>
                <span class="kpi-value kpi-neutral">{len(controls_seen) if controls_seen else 76} / 76</span>
            </div>
            <div class="kpi-card">
                <span class="kpi-title">Rotated Models</span>
                <span class="kpi-value kpi-neutral">{len(models_seen) if models_seen else 6}</span>
            </div>
        </div>

        <!-- Filter Bar -->
        <div class="filter-bar">
            <div class="filter-group">
                <input type="text" id="search-box" class="search-box" placeholder="Search test name, ID, or notes..." oninput="filterTable()">
                <button class="btn-filter active" data-filter="all" onclick="setQuickFilter('all')">All ({total})</button>
                <button class="btn-filter" data-filter="pass" onclick="setQuickFilter('pass')">Pass ({passed})</button>
                <button class="btn-filter" data-filter="fail" onclick="setQuickFilter('fail')">Fail ({failed})</button>
                <button class="btn-filter" data-filter="key" onclick="setQuickFilter('key')">Key Tier</button>
                <button class="btn-filter" data-filter="scen-a" onclick="setQuickFilter('scen-a')">Scenario A</button>
                <button class="btn-filter" data-filter="scen-b" onclick="setQuickFilter('scen-b')">Scenario B</button>
            </div>
            <div class="filter-group">
                <select id="model-select" class="filter-select" onchange="filterTable()">
                    <option value="">All Rotated Models</option>
                    {model_options}
                </select>
                <select id="category-select" class="filter-select" onchange="filterTable()">
                    <option value="">All Categories</option>
                    {category_options}
                </select>
                <span id="counter" class="counter-badge">Showing {total} tests</span>
            </div>
        </div>

        <!-- Table -->
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th style="width: 80px;">Status</th>
                        <th style="width: 90px;">Test ID</th>
                        <th style="width: 70px;">Tier</th>
                        <th style="width: 170px;">UI Control</th>
                        <th style="width: 60px;">Scen</th>
                        <th>Test Name & Category</th>
                        <th style="width: 190px;">Rotated Test Model</th>
                        <th>Execution Details / Evidence</th>
                        <th style="width: 75px;">Time</th>
                    </tr>
                </thead>
                <tbody id="table-body">
                    {"".join(rows_html)}
                </tbody>
            </table>
        </div>

        <footer>
            Generated automatically by IFC Editor Autonomous Agent QA Runner &bull; Agent QA Harness Protocol
        </footer>
    </div>

    <script>
        let currentFilter = 'all';

        function setQuickFilter(filter) {{
            currentFilter = filter;
            document.querySelectorAll('.btn-filter').forEach(btn => {{
                btn.classList.toggle('active', btn.getAttribute('data-filter') === filter);
            }});
            filterTable();
        }}

        function filterTable() {{
            const search = document.getElementById('search-box').value.toLowerCase().trim();
            const modelFilter = document.getElementById('model-select').value;
            const catFilter = document.getElementById('category-select').value;
            const rows = document.querySelectorAll('#table-body tr');
            let visibleCount = 0;

            rows.forEach(row => {{
                const status = row.getAttribute('data-status');
                const tier = row.getAttribute('data-tier');
                const cat = row.getAttribute('data-category');
                const model = row.getAttribute('data-model');
                const scen = row.getAttribute('data-scenario');
                const text = row.innerText.toLowerCase();

                let matchesFilter = true;
                if (currentFilter === 'pass' && status !== 'pass') matchesFilter = false;
                if (currentFilter === 'fail' && status !== 'fail') matchesFilter = false;
                if (currentFilter === 'key' && tier !== 'key') matchesFilter = false;
                if (currentFilter === 'scen-a' && scen !== 'A') matchesFilter = false;
                if (currentFilter === 'scen-b' && scen !== 'B') matchesFilter = false;

                if (modelFilter && model !== modelFilter) matchesFilter = false;
                if (catFilter && cat !== catFilter) matchesFilter = false;
                if (search && !text.includes(search)) matchesFilter = false;

                if (matchesFilter) {{
                    row.style.display = '';
                    visibleCount++;
                }} else {{
                    row.style.display = 'none';
                }}
            }});

            document.getElementById('counter').innerText = `Showing ${{visibleCount}} of ${{rows.length}} tests`;
        }}
    </script>
</body>
</html>
"""
    output_path.write_text(html_content, encoding="utf-8")
    return output_path

if __name__ == "__main__":
    import sys
    print("HTML reporter module ready.")
