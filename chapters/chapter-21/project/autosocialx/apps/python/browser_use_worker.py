#!/usr/bin/env python3
"""
browser_use_worker.py — subprocess worker for browser-use integration.

Communication protocol: newline-delimited JSON over stdin/stdout.
  stdin  ← {"id": 1, "task": "...", "maxSteps": 20, "apiKey": "...", "baseUrl": "...", "model": "..."}
  stdout → {"id": 1, "success": true, "result": "...", "urls": [...], "steps": 5, "error": null}

Errors (missing deps, timeout, etc.) are always returned as JSON, never crash the process.
"""

import asyncio
import json
import os
import sys
import traceback


def write_response(response: dict) -> None:
    sys.stdout.write(json.dumps(response) + "\n")
    sys.stdout.flush()


async def run_task(task: str, max_steps: int, api_key: str, base_url: str, model: str) -> dict:
    try:
        from browser_use import Agent, Browser, ChatOpenAI  # type: ignore
    except ImportError as e:
        return {
            "success": False,
            "result": "",
            "urls": [],
            "steps": 0,
            "error": (
                f"browser-use not installed: {e}. "
                "Run: pip install browser-use langchain-openai && playwright install chromium"
            ),
        }

    try:
        llm = ChatOpenAI(
            model=model,
            base_url=base_url,
            api_key=api_key,
            temperature=0,
        )
        
        # Optionally use a browser executable supplied by the reader.
        chrome_path = os.environ.get("CHROME_EXECUTABLE_PATH")
        browser = Browser(executable_path=chrome_path) if chrome_path else None

        agent = Agent(task=task, llm=llm, max_steps=max_steps, browser=browser)
        result = await agent.run(max_steps=max_steps)

        return {
            "success": result.is_done(),
            "result": result.final_result() or "",
            "urls": result.urls() or [],
            "steps": result.number_of_steps(),
            "error": None,
        }
    except Exception:
        return {
            "success": False,
            "result": "",
            "urls": [],
            "steps": 0,
            "error": traceback.format_exc(limit=5),
        }


async def main_loop() -> None:
    # Signal ready
    write_response({"ready": True, "pid": os.getpid()})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            req = json.loads(line)
        except json.JSONDecodeError as e:
            write_response({"id": None, "success": False, "error": f"Invalid JSON: {e}"})
            continue

        req_id   = req.get("id")
        task     = req.get("task", "")
        max_steps = int(req.get("maxSteps", 20))
        api_key  = req.get("apiKey", os.environ.get("OPENAI_API_KEY", ""))
        base_url = req.get("baseUrl", os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1"))
        model    = req.get("model", "gpt-4o-mini")

        result = await run_task(task, max_steps, api_key, base_url, model)
        write_response({"id": req_id, **result})


if __name__ == "__main__":
    asyncio.run(main_loop())
