"""
参数化布局模板系统。
模板用相对坐标（0.0~1.0）定义各槽位，由代码计算精确像素，LLM 不参与。
"""

PLATFORM_SIZES = {
    "youtube":     (1280, 720),
    "tiktok":      (1080, 1920),
    "bilibili":    (1146, 717),
    "xiaohongshu": (1080, 1440),
    "universal":   (1920, 1080),
}

# 每个 slot 字段说明：
#   x, y  = 左上角相对坐标
#   w, h  = 宽高相对值
#   fit   = "cover_top" | "contain_bottom" | "contain" | "cover_center"
#   z     = 图层 z-index（数字越大越靠前）
# 文字槽位用 title_* / subtitle_* 前缀独立定义。

TEMPLATES = {
    # -------------------------------------------------------
    # 横版：左文字 + 右人物（YouTube / Bilibili / Universal）
    # -------------------------------------------------------
    "hero-left-text": {
        "desc": "横版标准：左侧文字区 + 右侧人物大图",
        "platforms": ["youtube", "bilibili", "universal"],
        "slots": {
            "person":   {"x": 0.47, "y": 0.0,  "w": 0.53, "h": 1.0,  "fit": "cover_top",      "z": 10},
            "building": {"x": 0.01, "y": 0.50,  "w": 0.38, "h": 0.47, "fit": "contain_bottom", "z": 5},
            "vehicle":  {"x": 0.01, "y": 0.42,  "w": 0.42, "h": 0.55, "fit": "contain_bottom", "z": 5},
            "pet":      {"x": 0.02, "y": 0.52,  "w": 0.32, "h": 0.45, "fit": "contain_bottom", "z": 6},
            "animal":   {"x": 0.02, "y": 0.52,  "w": 0.32, "h": 0.45, "fit": "contain_bottom", "z": 6},
            "product":  {"x": 0.02, "y": 0.55,  "w": 0.30, "h": 0.42, "fit": "contain_bottom", "z": 5},
            "food":     {"x": 0.02, "y": 0.55,  "w": 0.30, "h": 0.42, "fit": "contain_bottom", "z": 5},
            "tech":     {"x": 0.02, "y": 0.52,  "w": 0.32, "h": 0.45, "fit": "contain_bottom", "z": 5},
            "object":   {"x": 0.02, "y": 0.58,  "w": 0.28, "h": 0.38, "fit": "contain_bottom", "z": 5},
            "logo":     {"x": 0.04, "y": 0.04,  "w": 0.12, "h": 0.12, "fit": "contain",        "z": 20},
        },
        # 文字槽位（相对坐标）
        "title_x": 0.04, "title_y": 0.04,
        "title_w": 0.43, "title_max_lines": 3,
    },

    # -------------------------------------------------------
    # 竖版：人物占右侧主体 + 顶部左侧文字（TikTok / 小红书）
    # -------------------------------------------------------
    "portrait-hero": {
        "desc": "竖版标准：人物右侧大图 + 左上角文字（文字在素材上层）",
        "platforms": ["tiktok", "xiaohongshu"],
        # text_on_top=True: 竖版文字渲染在素材之后（覆盖人物），避免被遮挡
        "text_on_top": True,
        "slots": {
            "person":   {"x": 0.30, "y": 0.0,  "w": 0.70, "h": 1.0,  "fit": "cover_top",      "z": 10},
            "building": {"x": 0.01, "y": 0.55,  "w": 0.32, "h": 0.40, "fit": "contain_bottom", "z": 5},
            "vehicle":  {"x": 0.01, "y": 0.52,  "w": 0.34, "h": 0.44, "fit": "contain_bottom", "z": 5},
            "pet":      {"x": 0.01, "y": 0.55,  "w": 0.30, "h": 0.38, "fit": "contain_bottom", "z": 6},
            "animal":   {"x": 0.01, "y": 0.55,  "w": 0.30, "h": 0.38, "fit": "contain_bottom", "z": 6},
            "product":  {"x": 0.01, "y": 0.60,  "w": 0.28, "h": 0.35, "fit": "contain_bottom", "z": 5},
            "food":     {"x": 0.01, "y": 0.60,  "w": 0.28, "h": 0.35, "fit": "contain_bottom", "z": 5},
            "tech":     {"x": 0.01, "y": 0.55,  "w": 0.32, "h": 0.40, "fit": "contain_bottom", "z": 5},
            "object":   {"x": 0.01, "y": 0.62,  "w": 0.24, "h": 0.32, "fit": "contain_bottom", "z": 5},
            "logo":     {"x": 0.04, "y": 0.04,  "w": 0.15, "h": 0.08, "fit": "contain",        "z": 20},
        },
        # 文字区：左侧 38%，最大字号 100px 避免竖屏文字过大
        "title_x": 0.04, "title_y": 0.05,
        "title_w": 0.38, "title_max_lines": 4,
        "max_font_size": 100,
    },
}


def get_template(platform: str) -> dict:
    """根据平台返回默认模板。"""
    platform = platform.lower()
    if platform in ("tiktok", "xiaohongshu"):
        return TEMPLATES["portrait-hero"]
    return TEMPLATES["hero-left-text"]
