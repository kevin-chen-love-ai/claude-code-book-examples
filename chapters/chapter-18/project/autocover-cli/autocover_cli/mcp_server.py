"""
AutoCover MCP Server

Exposes cover generation as MCP tools so any MCP-compatible agent
(Claude Code, Claude Desktop, custom agents) can call them directly.

Usage:
  python -m autocover_cli.mcp_server          # stdio transport (default)
  autocover-mcp                                # after pip install -e .

Claude Desktop config (~/.claude/claude_desktop_config.json):
  {
    "mcpServers": {
      "autocover": {
        "command": "autocover-mcp",
        "env": {
          "ARK_API_KEY": "<your-key>",
          "REMOVE_BG_API_KEY": "<your-key>"
        }
      }
    }
  }
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

import mcp.server.stdio
import mcp.types as types
from mcp.server import Server

# ---------------------------------------------------------------------------
# Server setup
# ---------------------------------------------------------------------------

server = Server("autocover")

PLATFORM_SIZES = {
    "youtube":     (1280, 720),
    "tiktok":      (1080, 1920),
    "bilibili":    (1146, 717),
    "xiaohongshu": (1080, 1440),
    "universal":   (1920, 1080),
}


# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------

@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="generate_cover",
            description=(
                "Generate a social-media / video cover image using the AutoCover pipeline. "
                "Runs LLM style analysis → background removal → Pillow compositor. "
                "Returns the absolute path of the generated PNG."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Main title text (Chinese or English)",
                    },
                    "subtitle": {
                        "type": "string",
                        "description": "Subtitle / badge text (optional)",
                        "default": "",
                    },
                    "platform": {
                        "type": "string",
                        "enum": list(PLATFORM_SIZES.keys()),
                        "description": "Target platform that determines canvas size",
                        "default": "xiaohongshu",
                    },
                    "input_dir": {
                        "type": "string",
                        "description": (
                            "Directory containing source images and optional '参考文案.txt'. "
                            "All image files are used as assets; the first image is also "
                            "used as the reference style background."
                        ),
                    },
                    "asset_images": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": (
                            "Explicit list of 'type:path' strings, e.g. "
                            "'person:/abs/path/img.jpg'. "
                            "Overrides input_dir when provided. "
                            "Types: person, pet, building, vehicle, product, food, tech, object, logo"
                        ),
                        "default": [],
                    },
                    "ref_image": {
                        "type": "string",
                        "description": "Path to style reference image (used as dimmed bg layer). Optional.",
                    },
                    "theme": {
                        "type": "string",
                        "enum": [
                            "travel-luxury", "vivid-variety", "cyber-tech",
                            "fresh-life", "sakura-beauty", "business-dark", "game-dark",
                        ],
                        "description": "Force a color theme. Auto-detected from title/content when omitted.",
                    },
                    "output_path": {
                        "type": "string",
                        "description": "Absolute or relative path for the output PNG. Auto-generated when omitted.",
                    },
                    "skip_llm": {
                        "type": "boolean",
                        "description": (
                            "Skip Node 1 LLM style analysis and use a minimal style_json. "
                            "Faster, requires --theme to be set for best results."
                        ),
                        "default": False,
                    },
                },
                "required": ["title"],
            },
        ),
        types.Tool(
            name="list_themes",
            description="List all available AutoCover color themes with their descriptions.",
            inputSchema={"type": "object", "properties": {}},
        ),
        types.Tool(
            name="list_platforms",
            description="List supported platforms and their canvas sizes.",
            inputSchema={"type": "object", "properties": {}},
        ),
    ]


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------

@server.call_tool()
async def call_tool(
    name: str, arguments: dict[str, Any]
) -> list[types.TextContent]:

    if name == "list_themes":
        from autocover_cli.themes import THEMES
        result = {k: {"desc": v["desc"], "keywords": v["keywords"]} for k, v in THEMES.items()}
        return [types.TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]

    if name == "list_platforms":
        result = {k: {"width": v[0], "height": v[1]} for k, v in PLATFORM_SIZES.items()}
        return [types.TextContent(type="text", text=json.dumps(result, indent=2))]

    if name == "generate_cover":
        return await _generate_cover(arguments)

    return [types.TextContent(type="text", text=f"Unknown tool: {name}")]


async def _generate_cover(args: dict[str, Any]) -> list[types.TextContent]:
    import glob as glob_mod

    from autocover_cli import layout_templates, render_pillow, themes
    from autocover_cli.main import (
        PLATFORM_SIZES as _SIZES,
        node_1_analyze_style,
        node_2_process_assets,
    )
    from openai import OpenAI

    title      = args["title"]
    subtitle   = args.get("subtitle", "")
    platform   = args.get("platform", "xiaohongshu")
    input_dir  = args.get("input_dir", "")
    asset_list = args.get("asset_images", [])
    ref_image  = args.get("ref_image", "")
    theme_name = args.get("theme")
    output_path = args.get("output_path", "")
    skip_llm   = args.get("skip_llm", False)

    # ---- resolve output path: output/{project}/{platform}.png ----
    if not output_path:
        if input_dir:
            project = Path(input_dir).resolve().name
        else:
            project = title[:16].replace(" ", "_").replace("/", "-")
        out_dir = os.path.join("output", project)
        os.makedirs(out_dir, exist_ok=True)
        output_path = os.path.join(out_dir, f"{platform}.png")

    # ---- collect asset_images from input_dir if not explicit ----
    if not asset_list and input_dir:
        exts = ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG")
        found = []
        for ext in exts:
            found.extend(glob_mod.glob(os.path.join(input_dir, ext)))
        found = sorted(set(found))
        if found and not ref_image:
            ref_image = found[0]
        # heuristic type assignment: first image with face-like name → person, rest → object
        for i, fp in enumerate(found):
            stem = Path(fp).stem.lower()
            if any(k in stem for k in ("person", "人物", "portrait", "face", "model", "character")):
                asset_list.append(f"person:{fp}")
            elif any(k in stem for k in ("screen", "截图", "screenshot", "ui", "app", "demo", "展示")):
                asset_list.append(f"tech:{fp}")
            elif any(k in stem for k in ("logo", "brand", "icon")):
                asset_list.append(f"logo:{fp}")
            elif any(k in stem for k in ("pet", "dog", "cat", "animal", "宠物")):
                asset_list.append(f"pet:{fp}")
            else:
                asset_list.append(f"object:{fp}")

        # also check for 参考文案.txt in input_dir
        txt_path = os.path.join(input_dir, "参考文案.txt")
        if os.path.exists(txt_path) and not title:
            lines = Path(txt_path).read_text(encoding="utf-8").splitlines()
            for line in lines:
                if line.startswith("主标题"):
                    title = line.split("：", 1)[-1].strip()
                elif line.startswith("副标题") and not subtitle:
                    subtitle = line.split("：", 1)[-1].strip()

    # ---- Node 1: style analysis ----
    if skip_llm or not os.environ.get("ARK_API_KEY"):
        style_json = {"mood": "", "style_keywords": [], "bg_suggestion": "gradient"}
    else:
        client = OpenAI(
            api_key=os.environ["ARK_API_KEY"],
            base_url="https://ark.cn-beijing.volces.com/api/coding/v3",
        )
        ref_for_llm = ref_image or (asset_list[0].split(":", 1)[1] if asset_list else "")
        try:
            style_json = node_1_analyze_style(client, ref_for_llm, interactive=False)
        except Exception as e:
            style_json = {"mood": "", "style_keywords": [], "bg_suggestion": "gradient"}
            print(f"  ⚠️  Node 1 failed ({e}), using default style_json")

    # ---- Node 2: background removal ----
    raw_assets: dict[str, str] = {}
    for item in asset_list:
        if ":" in item:
            atype, apath = item.split(":", 1)
        else:
            atype, apath = "object", item
        atype = atype.strip()
        apath = apath.strip()
        if not os.path.exists(apath):
            print(f"  ⚠️  Asset not found: {apath}, skipping.")
            continue
        raw_assets[atype] = apath

    processed_assets: dict[str, str] = {}
    for idx, (atype, apath) in enumerate(raw_assets.items()):
        key = f"{atype}_{idx}"
        if atype in ("tech", "logo", "object"):
            # skip rembg for screenshots / logos — they handle white-bg themselves
            processed_assets[key] = apath
        else:
            try:
                from autocover_cli.main import _process_single_asset
                cutout = _process_single_asset(apath, f"{atype}_{idx}", cache_dir="cache")
                processed_assets[key] = cutout
            except Exception as e:
                print(f"  ⚠️  rembg failed for {apath} ({e}), using original.")
                processed_assets[key] = apath

    # ---- Node 4: Pillow render ----
    canvas_size = _SIZES.get(platform.lower(), (1080, 1440))
    template = layout_templates.get_template(platform)
    theme = themes.pick_theme(style_json, force=theme_name)

    img = render_pillow.render_cover(
        canvas_size=canvas_size,
        assets=processed_assets,
        template=template,
        theme=theme,
        title=title,
        subtitle=subtitle,
        ref_image=ref_image or None,
    )

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    img.save(output_path, format="PNG")

    abs_path = os.path.abspath(output_path)
    return [types.TextContent(
        type="text",
        text=json.dumps({
            "success": True,
            "output_path": abs_path,
            "platform": platform,
            "canvas": {"width": canvas_size[0], "height": canvas_size[1]},
            "theme": theme.get("desc", ""),
            "assets_used": list(processed_assets.keys()),
        }, ensure_ascii=False, indent=2),
    )]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def _run():
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


def main():
    asyncio.run(_run())


if __name__ == "__main__":
    main()
