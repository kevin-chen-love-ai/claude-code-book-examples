"""
Pillow-based cover compositor.
All layout math is deterministic — no LLM involvement.
"""

from __future__ import annotations

import math
import os
from typing import Optional, Union

import numpy as np
from PIL import (
    Image,
    ImageDraw,
    ImageFilter,
    ImageFont,
)

# ------------------------------------------------------------------ fonts ----

# (path, index) — index selects weight inside .ttc collections
FONT_PATHS = [
    (os.path.join(os.path.dirname(__file__), "fonts", "NotoSansSC-Bold.ttf"), 0),
    ("/System/Library/Fonts/Hiragino Sans GB.ttc", 2),   # W6 Bold — best for covers
    ("/System/Library/Fonts/Hiragino Sans GB.ttc", 1),
    ("/System/Library/Fonts/STHeiti Medium.ttc", 0),
    ("/System/Library/Fonts/PingFang.ttc", 0),
    ("/Library/Fonts/Arial Unicode MS.ttf", 0),
    ("/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc", 0),
    ("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 0),
    ("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc", 0),
]

_font_cache: dict[int, ImageFont.FreeTypeFont] = {}


def _get_font(size: int) -> ImageFont.FreeTypeFont:
    if size in _font_cache:
        return _font_cache[size]
    for path, index in FONT_PATHS:
        try:
            f = ImageFont.truetype(path, size, index=index)
            _font_cache[size] = f
            return f
        except Exception:
            continue
    f = ImageFont.load_default()
    _font_cache[size] = f
    return f


# ------------------------------------------------------------------ color ----

_HEX_FALLBACKS = {
    "none": "#000000",
    "transparent": "#000000",
    "white": "#FFFFFF",
    "black": "#000000",
}


def _parse_hex(hex_color: str) -> tuple[int, int, int]:
    if not hex_color:
        return (0, 0, 0)
    hex_color = _HEX_FALLBACKS.get(hex_color.lower().strip(), hex_color)
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = h[0] * 2 + h[1] * 2 + h[2] * 2
    if len(h) < 6:
        h = h.ljust(6, "0")
    try:
        return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    except ValueError:
        return (0, 0, 0)


def _hex_rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    r, g, b = _parse_hex(hex_color)
    return (r, g, b, alpha)


def _lerp_color(c1: tuple, c2: tuple, t: float) -> tuple[int, int, int]:
    return (
        int(c1[0] + (c2[0] - c1[0]) * t),
        int(c1[1] + (c2[1] - c1[1]) * t),
        int(c1[2] + (c2[2] - c1[2]) * t),
    )


# ---------------------------------------------------------------- gradient ----

def make_gradient_bg(
    size: tuple[int, int],
    c1: str,
    c2: str,
    direction: str = "vertical",
) -> Image.Image:
    """Smooth two-color gradient background."""
    w, h = size
    img = Image.new("RGB", (w, h))
    rgb1, rgb2 = _parse_hex(c1), _parse_hex(c2)
    draw = ImageDraw.Draw(img)

    if direction == "horizontal":
        for x in range(w):
            t = x / max(w - 1, 1)
            draw.line([(x, 0), (x, h)], fill=_lerp_color(rgb1, rgb2, t))
    elif direction == "diagonal":
        arr = np.zeros((h, w, 3), dtype=np.uint8)
        ys = np.linspace(0, 1, h)[:, None]
        xs = np.linspace(0, 1, w)[None, :]
        t = np.clip((xs + ys) / 2, 0, 1)
        for ch in range(3):
            arr[:, :, ch] = (rgb1[ch] + (rgb2[ch] - rgb1[ch]) * t).astype(np.uint8)
        return Image.fromarray(arr, "RGB")
    else:  # vertical
        for y in range(h):
            t = y / max(h - 1, 1)
            draw.line([(0, y), (w, y)], fill=_lerp_color(rgb1, rgb2, t))
    return img


def _linear_gradient_h(size: tuple[int, int], c1: str, c2: str) -> Image.Image:
    """Horizontal RGBA gradient strip (left→right)."""
    w, h = size
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    rgb1, rgb2 = _parse_hex(c1), _parse_hex(c2)
    xs = np.linspace(0, 1, w)
    for ch in range(3):
        arr[:, :, ch] = (rgb1[ch] + (rgb2[ch] - rgb1[ch]) * xs).astype(np.uint8)
    arr[:, :, 3] = 255
    return Image.fromarray(arr, "RGBA")


def _linear_gradient_v(size: tuple[int, int], c1: str, c2: str) -> Image.Image:
    """Vertical RGBA gradient strip (top→bottom). More visible on square CJK chars."""
    w, h = size
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    rgb1, rgb2 = _parse_hex(c1), _parse_hex(c2)
    ys = np.linspace(0, 1, h)
    for ch in range(3):
        arr[:, :, ch] = (rgb1[ch] + (rgb2[ch] - rgb1[ch]) * ys[:, None]).astype(np.uint8)
    arr[:, :, 3] = 255
    return Image.fromarray(arr, "RGBA")


def make_directional_gradient_overlay(
    size: tuple[int, int],
    hex_color: str,
    direction: str = "left",
    alpha_start: int = 200,
    alpha_end: int = 0,
) -> Image.Image:
    w, h = size
    r, g, b = _parse_hex(hex_color)
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    arr[:, :, 0] = r
    arr[:, :, 1] = g
    arr[:, :, 2] = b

    if direction == "left":
        ramp = np.linspace(alpha_start, alpha_end, w, dtype=np.uint8)
        arr[:, :, 3] = ramp[np.newaxis, :]
    elif direction == "right":
        ramp = np.linspace(alpha_end, alpha_start, w, dtype=np.uint8)
        arr[:, :, 3] = ramp[np.newaxis, :]
    elif direction == "top":
        ramp = np.linspace(alpha_start, alpha_end, h, dtype=np.uint8)
        arr[:, :, 3] = ramp[:, np.newaxis]
    else:  # bottom
        ramp = np.linspace(alpha_end, alpha_start, h, dtype=np.uint8)
        arr[:, :, 3] = ramp[:, np.newaxis]

    return Image.fromarray(arr, "RGBA")


# ---------------------------------------------------------------- vignette ---

def make_vignette(size: tuple[int, int], strength: float = 0.55) -> Image.Image:
    w, h = size
    cx, cy = w / 2, h / 2
    max_r = math.sqrt(cx**2 + cy**2)
    ys, xs = np.ogrid[:h, :w]
    dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    t = np.clip(dist / max_r, 0, 1)
    alpha = (t**1.8 * strength * 255).astype(np.uint8)
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    arr[:, :, 3] = alpha
    return Image.fromarray(arr, "RGBA")


# ---------------------------------------------------------------- film grain -

def add_film_grain(img: Image.Image, intensity: float = 14.0) -> Image.Image:
    w, h = img.size
    noise = np.random.normal(0, intensity, (h, w)).astype(np.int16)
    arr = np.array(img.convert("RGBA")).astype(np.int16)
    arr[:, :, 0] = np.clip(arr[:, :, 0] + noise, 0, 255)
    arr[:, :, 1] = np.clip(arr[:, :, 1] + noise, 0, 255)
    arr[:, :, 2] = np.clip(arr[:, :, 2] + noise, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


# --------------------------------------------------------- asset compositing -

def crop_to_fill(img: Image.Image, target_w: int, target_h: int, anchor: str = "top") -> Image.Image:
    src_w, src_h = img.size
    scale = max(target_w / src_w, target_h / src_h)
    new_w, new_h = int(src_w * scale), int(src_h * scale)
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - target_w) // 2
    if anchor == "top":
        top = 0
    elif anchor == "bottom":
        top = new_h - target_h
    else:
        top = (new_h - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def fit_in_box(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    src_w, src_h = img.size
    scale = min(max_w / src_w, max_h / src_h, 1.0)
    new_w = max(1, int(src_w * scale))
    new_h = max(1, int(src_h * scale))
    return img.resize((new_w, new_h), Image.LANCZOS)


def feather_edges(img: Image.Image, radius: int = 10) -> Image.Image:
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    r, g, b, a = img.split()
    a_arr = np.array(a)
    a_blurred_arr = np.array(a.filter(ImageFilter.GaussianBlur(radius=radius)))
    mask = a_arr < 200
    a_final = a_arr.copy()
    a_final[mask] = a_blurred_arr[mask]
    return Image.merge("RGBA", (r, g, b, Image.fromarray(a_final)))


def _add_rim_light(
    img: Image.Image,
    color: tuple[int, int, int] = (255, 220, 150),
    strength: float = 0.45,
) -> Image.Image:
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    r, g, b, a = img.split()
    a_arr = np.array(a)
    dilated = np.array(a.filter(ImageFilter.MaxFilter(size=9)))
    rim_mask = np.clip(dilated.astype(np.int16) - a_arr.astype(np.int16), 0, 255).astype(np.uint8)
    rim_layer = Image.new("RGBA", img.size, (color[0], color[1], color[2], 0))
    rim_layer.putalpha(Image.fromarray((rim_mask * strength).astype(np.uint8)))
    result = img.copy()
    result.alpha_composite(rim_layer)
    return result


# ---------------------------------------------------------------- text utils -

import re as _re

def _measure_text(text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int]:
    bbox = font.getbbox(text)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


# 匹配"需要放大"的 token：
#   - 纯数字：7、100
#   - 数字+中文单位：7天、3倍、100万
#   - 数字+英文单位：3x、4K
#   - 纯大写英文（2字符以上）：AI、HDR
#   - 混合数字英文：3D、4K、GPT4
_HIGHLIGHT_RE = _re.compile(
    r'(\d+[天周月年倍万亿xX%KkMmGg]+'  # 数字+单位
    r'|\d+[A-Za-z]+'                    # 数字+英文后缀（3D/4K）
    r'|[A-Z]{2,}'                       # 全大写英文（AI/HDR）
    r'|\d+)'                            # 纯数字
)


def _tokenize_line(text: str) -> list[tuple[str, bool]]:
    """
    将一行文字拆成 (token, is_highlight) 列表。
    is_highlight=True 表示该 token 需要放大渲染。
    """
    tokens: list[tuple[str, bool]] = []
    last = 0
    for m in _HIGHLIGHT_RE.finditer(text):
        if m.start() > last:
            tokens.append((text[last:m.start()], False))
        tokens.append((m.group(), True))
        last = m.end()
    if last < len(text):
        tokens.append((text[last:], False))
    return tokens if tokens else [(text, False)]


def _wrap_text(
    text: str,
    font: ImageFont.FreeTypeFont,
    max_w: int,
    max_lines: int,
    stroke_w: int = 0,
) -> list[str]:
    """
    Greedily wrap text. Only appends '…' if we genuinely hit max_lines with remaining text.
    stroke_w is accounted for in the line budget.
    """
    budget = max_w - stroke_w * 2
    lines: list[str] = []
    current = ""
    truncated = False
    chars = list(text)
    i = 0
    while i < len(chars):
        char = chars[i]
        test = current + char
        tw, _ = _measure_text(test, font)
        if tw > budget and current:
            lines.append(current)
            current = char
            if len(lines) >= max_lines:
                truncated = True
                break
        else:
            current = test
        i += 1
    if current and not truncated:
        if len(lines) < max_lines:
            lines.append(current)
        else:
            truncated = True
    if truncated and lines:
        last = lines[-1]
        tw, _ = _measure_text(last + "…", font)
        while tw > budget and len(last) > 1:
            last = last[:-1]
            tw, _ = _measure_text(last + "…", font)
        lines[-1] = last + "…"
    return lines


def calc_font_size(
    text: str,
    max_w: int,
    max_h: int,
    max_lines: int,
    size_min: int = 24,
    size_max: int = 160,
) -> int:
    """Binary-search largest font size that fits text in max_w × max_h."""
    best = size_min
    lo, hi = size_min, size_max
    while lo <= hi:
        mid = (lo + hi) // 2
        font = _get_font(mid)
        effective_stroke = max(6, int(mid * 0.12))
        lines = _wrap_text(text, font, max_w, max_lines, stroke_w=effective_stroke)
        if not lines:
            hi = mid - 1
            continue
        _, line_h = _measure_text("Hg", font)
        total_h = line_h * len(lines) + int(line_h * 0.25) * (len(lines) - 1)
        if len(lines) <= max_lines and total_h <= max_h:
            best = mid
            lo = mid + 1
        else:
            hi = mid - 1
    return best


# ============================================================ layered text ==

def _render_text_mask(
    size: tuple[int, int],
    text: str,
    xy: tuple[int, int],
    font: ImageFont.FreeTypeFont,
) -> Image.Image:
    """Render text as a white-on-black L-mode mask."""
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.text(xy, text, font=font, fill=255)
    return mask


def _render_stroke_mask(
    size: tuple[int, int],
    text: str,
    xy: tuple[int, int],
    font: ImageFont.FreeTypeFont,
    stroke_px: int,
) -> Image.Image:
    """Render text stroke as L-mode mask (dilated text footprint)."""
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.text(xy, text, font=font, fill=255, stroke_width=stroke_px, stroke_fill=255)
    return mask


def draw_premium_text(
    canvas: Image.Image,
    text: str,
    xy: tuple[int, int],
    font: ImageFont.FreeTypeFont,
    fill: Union[str, list[str]],        # hex or [hex_top, hex_bottom] gradient
    stroke_color: str,
    stroke_px: int,
    shadow_color: str = "#000000",
    shadow_offset: tuple[int, int] = (4, 6),
    shadow_blur: int = 18,
    highlight: bool = True,
    glow_color: Optional[str] = None,   # colored neon glow (None = disabled)
) -> None:
    """
    Five-layer text compositor:
      0. Neon glow halo  (optional, colored blur behind everything)
      1. Soft drop shadow (blurred)
      2. Thick stroke
      3. Vertical gradient or solid fill
      4. Top-edge highlight shimmer
    """
    W, H = canvas.size
    x, y = xy

    # ---- Layer 0: colored neon glow ----
    if glow_color:
        gr, gg, gb = _parse_hex(glow_color)
        glow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        gdraw = ImageDraw.Draw(glow_layer)
        gdraw.text(
            (x, y), text, font=font,
            fill=(gr, gg, gb, 160),
            stroke_width=stroke_px * 3,
            stroke_fill=(gr, gg, gb, 160),
        )
        glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=24))
        canvas.alpha_composite(glow_layer)

    # ---- Layer 1: drop shadow ----
    shadow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow_layer)
    sr, sg, sb = _parse_hex(shadow_color)
    sdraw.text(
        (x + shadow_offset[0], y + shadow_offset[1]),
        text, font=font,
        fill=(sr, sg, sb, 210),
        stroke_width=stroke_px // 2,
        stroke_fill=(sr, sg, sb, 190),
    )
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=shadow_blur))
    canvas.alpha_composite(shadow_layer)

    # ---- Layer 2: stroke ----
    stroke_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sdraw2 = ImageDraw.Draw(stroke_layer)
    sr2, sg2, sb2 = _parse_hex(stroke_color)
    sdraw2.text(
        (x, y), text, font=font,
        fill=(sr2, sg2, sb2, 255),
        stroke_width=stroke_px,
        stroke_fill=(sr2, sg2, sb2, 255),
    )
    canvas.alpha_composite(stroke_layer)

    # ---- Layer 3: fill (vertical gradient or solid) ----
    fill_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    if isinstance(fill, list) and len(fill) >= 2:
        # Vertical gradient fill: top color → bottom color — visible on CJK square chars
        text_mask = _render_text_mask((W, H), text, (x, y), font)
        tw, th = _measure_text(text, font)
        grad = _linear_gradient_v((tw + 4, th + 8), fill[0], fill[1])
        grad_full = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        grad_full.paste(grad, (x, y))
        fill_layer.paste(grad_full, mask=text_mask)
    else:
        color_hex = fill if isinstance(fill, str) else fill[0]
        fr, fg, fb = _parse_hex(color_hex)
        fdraw = ImageDraw.Draw(fill_layer)
        fdraw.text((x, y), text, font=font, fill=(fr, fg, fb, 255))

    canvas.alpha_composite(fill_layer)

    # ---- Layer 4: highlight shimmer (top edge) ----
    if highlight:
        hl_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        hldraw = ImageDraw.Draw(hl_layer)
        hldraw.text((x, y - 1), text, font=font, fill=(255, 255, 255, 90))
        canvas.alpha_composite(hl_layer)


def draw_subtitle_badge(
    canvas: Image.Image,
    text: str,
    x: int,
    y: int,
    font: ImageFont.FreeTypeFont,
    text_color: str = "#FFFFFF",
    badge_color: str = "#CC0000",
    pad_x: int = 18,
    pad_y: int = 9,
    radius: int = 8,
    max_w: int = 600,
) -> None:
    """
    双色 badge：左侧 accent 色竖块 + 右侧半透明底 + 白字。
    视觉层次比单色 pill 更清晰。
    """
    tw, th = _measure_text(text, font)
    tw = min(tw, max_w)

    accent_block_w = max(6, th // 2)          # 左侧色块宽度，随字号缩放
    total_w = accent_block_w + pad_x + tw + pad_x
    bx1, by1 = x, y - pad_y
    bx2, by2 = x + total_w, y + th + pad_y
    bh = by2 - by1

    # 投影
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [bx1 + 3, by1 + 4, bx2 + 3, by2 + 4], radius=radius, fill=(0, 0, 0, 90)
    )
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(radius=5)))

    draw = ImageDraw.Draw(canvas)

    # 右侧主体（半透明深色背景）
    br, bg_, bb = _parse_hex(badge_color)
    draw.rounded_rectangle([bx1, by1, bx2, by2], radius=radius, fill=(br, bg_, bb, 210))

    # 左侧 accent 色块（稍亮/对比色，用 sub_badge 加亮处理）
    ar, ag, ab = _parse_hex(badge_color)
    # 左色块比主体亮 60 个亮度单位
    ar_light = min(255, ar + 60)
    ag_light = min(255, ag + 60)
    ab_light = min(255, ab + 60)
    # 圆角只做左侧
    acc_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(acc_layer).rounded_rectangle(
        [bx1, by1, bx1 + accent_block_w + radius, by2],
        radius=radius, fill=(ar_light, ag_light, ab_light, 240)
    )
    # 右侧盖掉圆角（保持左圆右直）
    ImageDraw.Draw(acc_layer).rectangle(
        [bx1 + accent_block_w, by1, bx1 + accent_block_w + radius, by2],
        fill=(ar_light, ag_light, ab_light, 240)
    )
    canvas.alpha_composite(acc_layer)

    # 顶部高光线
    draw.rounded_rectangle(
        [bx1 + accent_block_w + 2, by1 + 2, bx2 - 2, by1 + max(3, bh // 4)],
        radius=radius - 2, fill=(255, 255, 255, 28)
    )

    # 文字（在 accent 块右侧开始）
    tr, tg, tb = _parse_hex(text_color)
    draw.text((bx1 + accent_block_w + pad_x, y), text, font=font, fill=(tr, tg, tb, 255))


# ---- multi-line wrapper around draw_premium_text ----

def draw_title_block(
    canvas: Image.Image,
    text: str,
    x: int,
    y: int,
    font: ImageFont.FreeTypeFont,
    fill: Union[str, list[str]],
    stroke_color: str,
    stroke_px: int,
    shadow_color: str,
    max_w: int,
    max_lines: int = 3,
    line_spacing: float = 1.28,
    glow_color: Optional[str] = None,
) -> int:
    """
    Render multi-line title with per-token highlight scaling.
    Numbers, uppercase abbreviations and digit+unit combos are rendered
    ~28% larger in the accent color for visual punch.
    Returns y-coordinate below last line.
    """
    lines = _wrap_text(text, font, max_w, max_lines, stroke_w=stroke_px)
    base_size = font.size
    hl_size = int(base_size * 1.28)
    hl_font = _get_font(hl_size)
    hl_stroke = max(5, int(hl_size * 0.11))
    # accent color: first gradient color or fill itself
    accent_fill: Union[str, list[str]] = fill[0] if isinstance(fill, list) else fill

    _, line_h = _measure_text("Hg", font)
    _, hl_line_h = _measure_text("Hg", hl_font)
    gap = int(line_h * (line_spacing - 1.0))
    cur_y = y

    for line in lines:
        tokens = _tokenize_line(line)
        has_highlight = any(is_hl for _, is_hl in tokens)

        if not has_highlight:
            # Fast path: no highlights, render whole line normally
            draw_premium_text(
                canvas, line, (x, cur_y), font,
                fill=fill, stroke_color=stroke_color,
                stroke_px=stroke_px, shadow_color=shadow_color,
                glow_color=glow_color,
            )
        else:
            # Mixed rendering: walk tokens left to right
            # Align baselines: normal text baseline = cur_y + (hl_line_h - line_h)
            baseline_offset = hl_line_h - line_h
            cur_x = x
            for token_text, is_hl in tokens:
                if not token_text:
                    continue
                if is_hl:
                    tok_y = cur_y  # highlight sits higher (taller)
                    draw_premium_text(
                        canvas, token_text, (cur_x, tok_y), hl_font,
                        fill=accent_fill, stroke_color=stroke_color,
                        stroke_px=hl_stroke, shadow_color=shadow_color,
                        glow_color=glow_color if isinstance(accent_fill, str) else accent_fill,
                    )
                    tw, _ = _measure_text(token_text, hl_font)
                else:
                    tok_y = cur_y + baseline_offset
                    draw_premium_text(
                        canvas, token_text, (cur_x, tok_y), font,
                        fill=fill, stroke_color=stroke_color,
                        stroke_px=stroke_px, shadow_color=shadow_color,
                        glow_color=None,
                    )
                    tw, _ = _measure_text(token_text, font)
                cur_x += tw
            # row height driven by highlight font
            line_h = hl_line_h

        cur_y += line_h + gap

    return cur_y


# ---------------------------------------------------------- main compositor --

def render_cover(
    canvas_size: tuple[int, int],
    assets: dict[str, str],
    template: dict,
    theme: dict,                          # from themes.THEMES[name]
    title: str,
    subtitle: str = "",
    ref_image: Optional[str] = None,
    grain: float = 10.0,
    vignette: float = 0.45,
) -> Image.Image:
    """
    Deterministic Pillow compositor.

    Layer order (bottom → top):
      0. Gradient background
      1. (optional) ref_image dimmed overlay + gradient mask
      2. Title (4-layer: shadow / stroke / fill / shimmer)   ← text BEHIND assets
      3. Subtitle badge                                       ← badge BEHIND assets
      4. Asset slots (non-person: building/pet/object)        ← float over text
      5. Asset slots (person)                                 ← person topmost
      6. Vignette
      7. Film grain
    """
    c_w, c_h = canvas_size
    is_portrait = c_h > c_w

    # ---- layer 0: gradient background ----
    canvas = make_gradient_bg(
        (c_w, c_h),
        theme["bg_top"],
        theme["bg_bottom"],
        "vertical",
    ).convert("RGBA")

    # ---- layer 1: ref_image atmospheric background ----
    if ref_image and os.path.exists(ref_image):
        bg_img = Image.open(ref_image).convert("RGBA")
        bg_img = crop_to_fill(bg_img, c_w, c_h, anchor="center")

        # Subtle desaturate: blend with grayscale to reduce color competition
        bg_gray = bg_img.convert("L").convert("RGBA")
        bg_img = Image.blend(bg_img, bg_gray, alpha=0.25)

        # Dim
        bg_arr = np.array(bg_img).astype(np.float32)
        bg_arr[:, :, :3] *= 0.40
        canvas.alpha_composite(Image.fromarray(bg_arr.astype(np.uint8), "RGBA"))

        # Directional gradient: text side gets heavier coverage
        overlay_color = theme.get("overlay_side", theme["bg_top"])
        if is_portrait:
            overlay = make_directional_gradient_overlay((c_w, c_h), overlay_color, "top", 230, 40)
        else:
            overlay = make_directional_gradient_overlay((c_w, c_h), overlay_color, "left", 240, 30)
        canvas.alpha_composite(overlay)

    slots = template.get("slots", {})
    # text_on_top: portrait templates render text AFTER assets (text visible over person)
    # landscape templates render text BEFORE assets (assets float over text for depth)
    text_on_top = template.get("text_on_top", False)

    tx = int(template.get("title_x", 0.04) * c_w)
    ty = int(template.get("title_y", 0.04) * c_h)
    t_max_w = int(template.get("title_w", 0.44) * c_w)
    t_max_lines = int(template.get("title_max_lines", 3))
    t_max_h = int(c_h * 0.48)
    font_size_cap = template.get("max_font_size", 160)

    t_size = calc_font_size(title, t_max_w, t_max_h, t_max_lines,
                            size_min=32, size_max=font_size_cap)
    title_font = _get_font(t_size)
    stroke_px = max(5, int(t_size * 0.11))

    def _draw_text_layers() -> None:
        nonlocal canvas
        title_fill = theme["title_fill"]
        glow = title_fill[0] if isinstance(title_fill, list) else None
        accent_color = title_fill[0] if isinstance(title_fill, list) else title_fill

        # ---- accent 竖线：标题左侧 ----
        bar_w = max(4, int(c_w * 0.004))      # ~4px on 1080
        bar_x = tx - bar_w - max(8, int(c_w * 0.01))
        # 预估标题块高度（用于竖线长度）
        _lines_est = _wrap_text(title, title_font, t_max_w, t_max_lines, stroke_w=stroke_px)
        _, _lh = _measure_text("Hg", title_font)
        _gap = int(_lh * 0.28)
        bar_h = _lh * len(_lines_est) + _gap * (len(_lines_est) - 1)
        bar_y = ty + int(_lh * 0.1)
        if bar_x >= 0:
            bar_layer = Image.new("RGBA", (c_w, c_h), (0, 0, 0, 0))
            ar, ag, ab = _parse_hex(accent_color)
            ImageDraw.Draw(bar_layer).rounded_rectangle(
                [bar_x, bar_y, bar_x + bar_w, bar_y + bar_h],
                radius=bar_w // 2,
                fill=(ar, ag, ab, 230),
            )
            canvas.alpha_composite(bar_layer)

        bottom_y = draw_title_block(
            canvas, title, tx, ty, title_font,
            fill=title_fill,
            stroke_color=theme["title_stroke"],
            stroke_px=stroke_px,
            shadow_color=theme["title_shadow"],
            max_w=t_max_w,
            max_lines=t_max_lines,
            glow_color=glow,
        )
        if subtitle:
            sub_gap = max(12, int(t_size * 0.18))
            sub_size = max(22, int(t_size * 0.44))
            sub_font = _get_font(sub_size)
            sub_y = bottom_y + sub_gap
            _, sub_line_h = _measure_text("Hg", sub_font)
            if sub_y + sub_line_h + 24 > c_h:
                sub_y = c_h - sub_line_h - 28
            draw_subtitle_badge(
                canvas, subtitle, tx + 4, sub_y, sub_font,
                text_color=theme["sub_color"],
                badge_color=theme["sub_badge"],
                max_w=t_max_w - 8,
            )

    # ---- landscape: text behind assets ----
    if not text_on_top:
        _draw_text_layers()

    person_ids = [aid for aid in assets if aid.split("_")[0] == "person"]
    other_ids  = [aid for aid in assets if aid.split("_")[0] != "person"]

    def _composite_asset(asset_id: str) -> None:
        base_type = asset_id.split("_")[0] if "_" in asset_id else asset_id
        slot = slots.get(base_type) or slots.get("object", {
            "x": 0.02, "y": 0.55, "w": 0.28, "h": 0.40, "fit": "contain_bottom",
        })
        file_path = assets[asset_id]
        if not os.path.exists(file_path):
            print(f"  ⚠️  素材文件不存在: {file_path}，跳过。")
            return

        # 白底检测：超过 40% 的不透明像素亮度 > 220 → 视为截图类素材，特殊处理为 UI 预览卡片
        is_screenshot = False
        if base_type not in ("person", "logo"):
            _probe = Image.open(file_path)
            _rgba_arr = np.array(_probe.convert("RGBA")).astype(np.float32)
            _alpha_arr = _rgba_arr[:, :, 3]
            _opaque_mask = _alpha_arr > 10
            if _opaque_mask.sum() > 0:
                _rgb_mean = _rgba_arr[:, :, :3].mean(axis=2)
                _bright_ratio = float((_rgb_mean[_opaque_mask] > 220).mean())
                if _bright_ratio > 0.40:
                    is_screenshot = True
                    print(f"  📱 {asset_id} 白底截图（亮像素 {_bright_ratio:.1%}），以 UI 预览卡片方式合成。")

        sx = int(slot["x"] * c_w)
        sy = int(slot["y"] * c_h)
        sw = int(slot["w"] * c_w)
        sh = int(slot["h"] * c_h)

        asset_img = Image.open(file_path).convert("RGBA")
        fit_mode = slot.get("fit", "contain_bottom")

        if fit_mode.startswith("cover"):
            anchor = "top" if "top" in fit_mode else ("bottom" if "bottom" in fit_mode else "center")
            asset_img = crop_to_fill(asset_img, sw, sh, anchor=anchor)
            paste_x, paste_y = sx, sy
        else:
            asset_img = fit_in_box(asset_img, sw, sh)
            if "bottom" in fit_mode:
                paste_y = sy + sh - asset_img.height
            elif "top" in fit_mode:
                paste_y = sy
            else:
                paste_y = sy + (sh - asset_img.height) // 2
            paste_x = sx + (sw - asset_img.width) // 2

        if is_screenshot:
            # UI 预览卡片：圆角裁切 + 投影 + 细边框，不加暗色蒙层，保持原始内容清晰可读
            iw, ih = asset_img.size
            # 投影
            shadow_card = Image.new("RGBA", (iw + 20, ih + 20), (0, 0, 0, 0))
            sdraw_c = ImageDraw.Draw(shadow_card)
            sdraw_c.rounded_rectangle([6, 8, iw + 14, ih + 16], radius=18, fill=(0, 0, 0, 140))
            shadow_card = shadow_card.filter(ImageFilter.GaussianBlur(radius=10))
            canvas.alpha_composite(shadow_card, (paste_x - 10, paste_y - 10))
            # 圆角遮罩
            mask_r = Image.new("L", (iw, ih), 0)
            ImageDraw.Draw(mask_r).rounded_rectangle([0, 0, iw - 1, ih - 1], radius=14, fill=255)
            asset_img.putalpha(mask_r)
            canvas.alpha_composite(asset_img, (paste_x, paste_y))
            # 边框（主题 accent 色）
            border_frame = Image.new("RGBA", (iw + 6, ih + 6), (0, 0, 0, 0))
            accent_rgb = _parse_hex(theme.get("sub_badge", "#0055AA"))
            ImageDraw.Draw(border_frame).rounded_rectangle(
                [0, 0, iw + 5, ih + 5], radius=16, outline=(*accent_rgb, 220), width=3
            )
            canvas.alpha_composite(border_frame, (paste_x - 3, paste_y - 3))
            return

        if base_type != "logo":
            asset_img = feather_edges(asset_img, radius=8)
            rim_rgb = _parse_hex(theme.get("sub_badge", "#FFFFFF"))
            asset_img = _add_rim_light(asset_img, color=rim_rgb, strength=0.40)

        # ---- 人物脚下软投影 ----
        if base_type == "person":
            iw, ih = asset_img.size
            sh_w = int(iw * 0.70)
            sh_h = max(20, int(ih * 0.05))
            sh_layer = Image.new("RGBA", (c_w, c_h), (0, 0, 0, 0))
            sh_cx = paste_x + iw // 2
            sh_cy = paste_y + ih - sh_h // 2
            sh_x0 = sh_cx - sh_w // 2
            sh_y0 = sh_cy - sh_h // 2
            ImageDraw.Draw(sh_layer).ellipse(
                [sh_x0, sh_y0, sh_x0 + sh_w, sh_y0 + sh_h],
                fill=(0, 0, 0, 130),
            )
            sh_layer = sh_layer.filter(ImageFilter.GaussianBlur(radius=22))
            canvas.alpha_composite(sh_layer)

        canvas.alpha_composite(asset_img, (paste_x, paste_y))

    for aid in other_ids:
        _composite_asset(aid)
    for aid in person_ids:
        _composite_asset(aid)

    # ---- portrait: text on top of assets ----
    if text_on_top:
        _draw_text_layers()

    # ---- cinematic bottom gradient ----
    _bot_h = int(c_h * 0.28)
    _bot_arr = np.zeros((c_h, c_w, 4), dtype=np.uint8)
    _ramp = np.linspace(0, 160, _bot_h, dtype=np.uint8)
    _bot_arr[c_h - _bot_h:, :, 3] = _ramp[:, np.newaxis]
    canvas.alpha_composite(Image.fromarray(_bot_arr, "RGBA"))

    # ---- vignette ----
    if vignette > 0:
        canvas.alpha_composite(make_vignette((c_w, c_h), strength=vignette))

    # ---- film grain ----
    if grain > 0:
        canvas = add_film_grain(canvas, intensity=grain)

    return canvas.convert("RGB")
