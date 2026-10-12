# Agent QA Harness — Claude Instructions

Use `AGENTS.md` as the source of truth for the Agent QA Harness in this repository.

This harness is agent-neutral — Antigravity, Claude Code, Codex, and Claude Desktop all follow the same runbook.

Start every QA run by reading `AGENTS.md`. It determines whether to run Setup Mode or Test Mode, how to execute test cases from `test_cases.jsonl`, how to append results to `test_results_YYYY-MM-DD.jsonl`, and how to maintain `DEVELOPMENT_HANDOFF.md`.

## Autonomous UI Pipeline Execution
Whenever modifying UI code in `frontend/src/` or when the user prompts `/ui-pipeline`:
Run the 3-stage UI pipeline:
```powershell
.\scripts\ui_pipeline.ps1 -Tier quick    # Fast static checks & gates
.\scripts\ui_pipeline.ps1 -Browser       # Full live browser CDP tests
```

