"""
精选调色盘主题。每个主题包含完整配色，渲染器不依赖 LLM 返回的颜色。
"""

from __future__ import annotations

# -----------------------------------------------------------------------
# 主题定义
# -----------------------------------------------------------------------
# bg_top / bg_bottom : 背景渐变两色（上→下）
# title_fill         : 主标题颜色（支持 hex 或 [hex1, hex2] 渐变）
# title_stroke       : 主标题描边颜色
# title_shadow       : 投影颜色（通常深黑/深蓝）
# sub_color          : 副标题文字色
# sub_badge          : 副标题 badge 底色
# overlay_side       : 文字侧渐变遮罩主色（帮助文字可读）
# keywords           : 匹配关键词，用于从 style_json 自动推断主题

THEMES: dict[str, dict] = {

    # --- 旅游·奢华 ---
    "travel-luxury": {
        "desc": "深蓝夜空+金色主题，适合旅游/高端探索类",
        "bg_top":      "#0D1B2A",
        "bg_bottom":   "#1A3A5C",
        "title_fill":  ["#F5D97A", "#E8A83A"],   # 金色渐变
        "title_stroke": "#0A0500",
        "title_shadow": "#000000",
        "sub_color":   "#FFFFFF",
        "sub_badge":   "#C47F17",
        "overlay_side": "#0D1B2A",
        "keywords": ["旅游", "旅行", "风光", "探索", "度假", "出行", "欧洲", "海外"],
    },

    # --- 活力·综艺 ---
    "vivid-variety": {
        "desc": "黄橙渐变背景+白色主题，综艺/Vlog 活力感",
        "bg_top":      "#FFD700",
        "bg_bottom":   "#FF6B00",
        "title_fill":  "#FFFFFF",
        "title_stroke": "#CC2200",
        "title_shadow": "#7A1100",
        "sub_color":   "#FFFFFF",
        "sub_badge":   "#CC2200",
        "overlay_side": "#FF8C00",
        "keywords": ["综艺", "Vlog", "挑战", "搞笑", "活力", "日常", "开箱"],
    },

    # --- 科技·潮酷 ---
    "cyber-tech": {
        "desc": "深蓝黑+青蓝荧光，科技/数码/AI 类",
        "bg_top":      "#020B18",
        "bg_bottom":   "#041E3A",
        "title_fill":  ["#60F4FF", "#00B8D9"],   # 亮青→深青渐变（竖向，上亮下暗）
        "title_stroke": "#001830",
        "title_shadow": "#000A18",
        "sub_color":   "#FFFFFF",
        "sub_badge":   "#005599",
        "overlay_side": "#020B18",
        "keywords": ["科技", "AI", "数码", "手机", "电脑", "评测", "极客", "未来", "设计", "动效", "字体", "工具"],
    },

    # --- 清新·生活 ---
    "fresh-life": {
        "desc": "白绿清新，生活/美食/家居类",
        "bg_top":      "#E8F5E9",
        "bg_bottom":   "#A5D6A7",
        "title_fill":  "#1B5E20",
        "title_stroke": "#FFFFFF",
        "title_shadow": "#2E7D32",
        "sub_color":   "#FFFFFF",
        "sub_badge":   "#388E3C",
        "overlay_side": "#C8E6C9",
        "keywords": ["美食", "生活", "家居", "健康", "清新", "烹饪", "种草"],
    },

    # --- 美妆·心动 ---
    "sakura-beauty": {
        "desc": "粉红浪漫，美妆/时尚/情感类",
        "bg_top":      "#FF9A9E",
        "bg_bottom":   "#FECFEF",
        "title_fill":  "#880050",
        "title_stroke": "#FFFFFF",
        "title_shadow": "#AA0066",
        "sub_color":   "#FFFFFF",
        "sub_badge":   "#D81B60",
        "overlay_side": "#FF9A9E",
        "keywords": ["美妆", "护肤", "时尚", "穿搭", "情感", "恋爱", "少女"],
    },

    # --- 商务·沉稳 ---
    "business-dark": {
        "desc": "深灰黑+白字，商业/知识/财经类",
        "bg_top":      "#1C1C1E",
        "bg_bottom":   "#2C2C2E",
        "title_fill":  "#FFFFFF",
        "title_stroke": "#000000",
        "title_shadow": "#000000",
        "sub_color":   "#AAAAAA",
        "sub_badge":   "#3A3A3C",
        "overlay_side": "#1C1C1E",
        "keywords": ["商业", "财经", "职场", "知识", "教程", "干货", "投资"],
    },

    # --- 游戏·暗黑 ---
    "game-dark": {
        "desc": "深紫黑+橙红高亮，游戏/电竞类",
        "bg_top":      "#0D0015",
        "bg_bottom":   "#200030",
        "title_fill":  ["#FF6B00", "#FF0044"],   # 橙红渐变
        "title_stroke": "#1A0030",
        "title_shadow": "#000000",
        "sub_color":   "#FFFFFF",
        "sub_badge":   "#7B00CC",
        "overlay_side": "#0D0015",
        "keywords": ["游戏", "电竞", "直播", "攻略", "王者", "LOL", "射击"],
    },
}

# 默认主题（无法匹配关键词时使用）
DEFAULT_THEME = "travel-luxury"


# -----------------------------------------------------------------------
# 自动推断主题
# -----------------------------------------------------------------------

def pick_theme(style_json: dict, force: str | None = None) -> dict:
    """
    返回选定的主题 dict。
    force: 强制指定主题名（来自 --theme 参数）。
    style_json: Node 1 的解析结果，包含 mood / style_keywords。
    """
    if force and force in THEMES:
        print(f"  [主题] 使用强制主题: {force} — {THEMES[force]['desc']}")
        return THEMES[force]

    # 从 style_json 提取关键词
    keywords_raw = style_json.get("style_keywords", [])
    mood = style_json.get("mood", "")
    combined = " ".join(keywords_raw) + " " + mood

    best_theme = DEFAULT_THEME
    best_score = 0
    for name, theme in THEMES.items():
        score = sum(1 for kw in theme["keywords"] if kw in combined)
        if score > best_score:
            best_score = score
            best_theme = name

    print(f"  [主题] 自动选择: {best_theme} (匹配得分 {best_score}) — {THEMES[best_theme]['desc']}")
    return THEMES[best_theme]
