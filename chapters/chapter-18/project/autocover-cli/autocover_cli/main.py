import os
import sys
import json
import base64
import argparse
import re
import requests
from openai import OpenAI
from PIL import Image, ImageDraw, ImageFont, ImageFilter
try:
    from playwright.sync_api import sync_playwright as _sync_playwright
except ImportError:
    _sync_playwright = None  # HTML renderer unavailable; Pillow renderer still works

# ---------------- 配置 ----------------
API_KEY = os.environ.get("ARK_API_KEY", "")
REMOVE_BG_API_KEY = os.environ.get("REMOVE_BG_API_KEY", "")
BASE_URL = "https://ark.cn-beijing.volces.com/api/coding/v3"
MODEL_ID = os.environ.get("AUTOCOVER_MODEL_ID", "doubao-seed-2.0-pro")

PLATFORM_SIZES = {
    "youtube":       (1280, 720),
    "tiktok":        (1080, 1920),
    "bilibili":      (1146, 717),
    "xiaohongshu":   (1080, 1440),
    "universal":     (1920, 1080),
}

# 字体查找顺序：项目内打包 > macOS 系统 > Linux 系统 > Pillow 默认
FONT_PATHS = [
    os.path.join(os.path.dirname(__file__), "fonts", "NotoSansSC-Bold.ttf"),
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/System/Library/Fonts/STHeiti Medium.ttc",
    "/Library/Fonts/Arial Unicode MS.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
]


def get_font(size):
    for path in FONT_PATHS:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


# ---------------- 工具函数 ----------------
def image_to_base64(img_path):
    with open(img_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def extract_json(text):
    text = text.strip()
    if "```json" in text:
        text = text.split("```json", 1)[1].split("```", 1)[0]
    elif "```" in text:
        text = text.split("```", 1)[1].split("```", 1)[0]
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start : end + 1]
    return json.loads(text.strip())


def llm_call_with_retry(client, messages, max_retries=3):
    """调用 LLM，解析 JSON 输出，失败自动重试最多 max_retries 次。"""
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=MODEL_ID,
                messages=messages,
            )
            return extract_json(response.choices[0].message.content)
        except (json.JSONDecodeError, ValueError) as e:
            if attempt == max_retries - 1:
                raise RuntimeError(f"LLM 返回 JSON 解析失败（已重试 {max_retries} 次）: {e}")
            print(f"  [重试 {attempt + 1}/{max_retries}] JSON 解析失败，重新请求...")


def human_confirm(label, data, interactive):
    """人工确认节点：展示数据，等待用户确认或手动修改。"""
    if not interactive:
        print(f"[确认点 {label}] 自动通过（--no-interactive 模式）")
        return data

    print(f"\n{'=' * 55}")
    print(f"[人工确认点 {label}]")
    print(json.dumps(data, ensure_ascii=False, indent=2))
    print("=" * 55)

    while True:
        answer = input("确认？[y=继续 / n=终止 / edit=手动修改 JSON] ").strip().lower()
        if answer == "y":
            return data
        elif answer == "n":
            print("用户终止流程。")
            sys.exit(0)
        elif answer == "edit":
            print("请粘贴修改后的 JSON，输入单独一行 END 结束：")
            lines = []
            while True:
                line = input()
                if line.strip() == "END":
                    break
                lines.append(line)
            try:
                return json.loads("\n".join(lines))
            except json.JSONDecodeError as e:
                print(f"JSON 格式错误: {e}，请重新输入。")


# ---------------- Node 1: 风格解析 ----------------
def node_1_analyze_style(client, ref_image_path, interactive):
    print(f"\n[Node 1] 解析参考封面风格: {ref_image_path}...")
    base64_image = image_to_base64(ref_image_path)
    prompt = """
你是一名视觉艺术总监。请按以下步骤深度解析参考图的视觉风格，必须严格输出指定的 JSON 结构。

【分析任务】
1. 背景深度：分析背景是纯色、渐变还是包含肌理/纹理（如噪点、帆布、金属）。
2. 文字工艺：
   - 描边：是否为高质量粗描边？是否有内外多层描边？
   - 特效：是否有内部渐变、3D 投影、或外发光？
3. 环境光效：主体人物/产品是否有边缘亮光（Rim Light）以区别于背景？
4. 装饰元素：是否有特殊的装饰层（如速度线、火花、几何块、标签）？

输出格式：
{
  "layout": "布局模式",
  "aspect_ratio": "比例",
  "color_palette": {
    "primary": "#hex",
    "secondary": "#hex",
    "text_main": "#hex",
    "text_sub": "#hex",
    "title_stroke": "#hex",
    "accent": "#hex"
  },
  "background": {
    "type": "gradient / solid / image / mesh",
    "texture": "none / noise / grain / pattern",
    "description": "描述背景细节"
  },
  "text_style": {
    "main_title": {
        "gradient": "none / linear / radial",
        "stroke_type": "thick / multi-layer / neon",
        "decoration": "3d / glow / shadow"
    }
  },
  "visual_elements": {
    "person": { "lighting": "natural / rim-light / studio" },
    "decorations": ["列表：如速度线、闪光、对话框"]
  },
  "mood": "视觉情绪",
  "style_keywords": ["关键词"]
}
"""
    result = llm_call_with_retry(
        client,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}},
                ],
            }
        ],
    )
    print(f"✅ 风格解析完毕: {result.get('style_keywords', [])} | 情绪: {result.get('mood', '')}")
    return human_confirm("① 风格解析", result, interactive)


# ---------------- Node 2: 素材准备 ----------------
def _remove_bg_removebg(image_path):
    print("  使用 remove.bg API 抠图...")
    with open(image_path, "rb") as f:
        response = requests.post(
            "https://api.remove.bg/v1.0/removebg",
            files={"image_file": f},
            data={"size": "auto"},
            headers={"X-Api-Key": REMOVE_BG_API_KEY},
        )
    if response.status_code == 200:
        return response.content
    raise Exception(f"remove.bg 返回错误 {response.status_code}: {response.text}")


def _remove_bg_rembg(image_path):
    print("  使用本地 rembg 模型抠图...")
    import rembg as _rembg
    with open(image_path, "rb") as f:
        return _rembg.remove(f.read())


def remove_background(image_path):
    """remove.bg 为主，rembg 为备用（无 API Key 时直接走备用）。"""
    if REMOVE_BG_API_KEY:
        try:
            return _remove_bg_removebg(image_path)
        except Exception as e:
            print(f"  remove.bg 失败（{e}），切换到本地 rembg...")
    return _remove_bg_rembg(image_path)


def _crop_to_subject(data: bytes) -> bytes:
    """裁剪 PNG 到非透明像素的 bounding box，去除透明边距。"""
    import io
    import numpy as np
    img = Image.open(io.BytesIO(data)).convert("RGBA")
    arr = np.array(img)
    alpha = arr[:, :, 3]
    rows = np.any(alpha > 10, axis=1)
    cols = np.any(alpha > 10, axis=0)
    if not rows.any():
        return data  # 全透明，原样返回
    top, bottom = np.where(rows)[0][[0, -1]]
    left, right = np.where(cols)[0][[0, -1]]
    # 四周留 2px 边距，防止切边
    top = max(0, top - 2)
    bottom = min(arr.shape[0] - 1, bottom + 2)
    left = max(0, left - 2)
    right = min(arr.shape[1] - 1, right + 2)
    cropped = img.crop((left, top, right + 1, bottom + 1))
    buf = io.BytesIO()
    cropped.save(buf, format="PNG")
    return buf.getvalue()


def _process_single_asset(image_path, name, cache_dir: str = "cache"):
    data = remove_background(image_path)
    data = _crop_to_subject(data)
    os.makedirs(cache_dir, exist_ok=True)
    output_path = os.path.join(cache_dir, f"temp_{name}_cutout.png")
    with open(output_path, "wb") as f:
        f.write(data)
    print(f"  ✅ 已保存: {output_path}")
    return output_path


def node_2_process_assets(person_image_path, product_image_path, asset_images, interactive):
    print(f"\n[Node 2] 素材准备与抠图...")
    assets = {}

    # 处理旧版参数
    if person_image_path:
        print(f"  处理人物图: {person_image_path}")
        assets["person"] = _process_single_asset(person_image_path, "person")

    if product_image_path:
        print(f"  处理产品图: {product_image_path}")
        assets["product"] = _process_single_asset(product_image_path, "product")

    # 处理新版参数：--asset-image type:path
    if asset_images:
        for asset_spec in asset_images:
            if ':' not in asset_spec:
                print(f"  ⚠️  忽略无效的素材格式: {asset_spec}（应为 type:path）")
                continue
            asset_type, asset_path = asset_spec.split(':', 1)
            # 支持的物品类型
            valid_types = ["person", "vehicle", "building", "product", "object", "logo", "food", "tech", "pet", "animal"]
            if asset_type not in valid_types:
                print(f"  ⚠️  忽略未知类型: {asset_type}（支持: {', '.join(valid_types)}）")
                continue
            print(f"  处理{asset_type}图: {asset_path}")
            # 使用类型作为 ID，避免重复
            asset_id = f"{asset_type}_{len(assets)}"
            assets[asset_id] = _process_single_asset(asset_path, asset_id)

    if not assets:
        print("  未提供素材图，跳过抠图。")
        return assets

    print("✅ 抠图完成。")
    human_confirm("② 抠图预览", assets, interactive)
    return assets


# ---------------- Node 3: 蓝图规划 ----------------
def node_3_plan_layout(client, style_json, assets, title, subtitle, badge, platform="youtube", theme=None, interactive=True):
    print(f"\n[Node 3] 规划画布排版（平台: {platform}）...")
    width, height = PLATFORM_SIZES.get(platform.lower(), (1280, 720))
    asset_manifest = {k: f"{k}_cutout.png" for k in assets}
    
    # 强制主题色字典 (2.0 旗舰版)
    THEME_MAP = {
        "vivid":  {"bg": ["#FFE000", "#FFA500"], "title": "#FFFFFF", "stroke": "#FF4400"},
        "cyber":  {"bg": ["#000428", "#004e92"], "title": "#00F2FF", "stroke": "#7A04EB"},
        "mint":   {"bg": ["#D4FC79", "#96E6A1"], "title": "#1B5E20", "stroke": "#FFFFFF"},
        "luxury": {"bg": ["#141E30", "#243B55"], "title": "#D4AF37", "stroke": "#000000"},
        "sakura": {"bg": ["#FF9A9E", "#FAD0C4"], "title": "#D81B60", "stroke": "#FFFFFF"},
    }

    # 1. 基础色值（来自分析）
    palette = style_json.get("color_palette", {})
    bg_primary   = palette.get("primary", "#e5e5e5")
    bg_secondary = palette.get("secondary", "#f0f0f0")
    title_stroke = palette.get("title_stroke", "#ff4400")
    title_color = palette.get("text_main", "#ffffff")
    subtitle_color = palette.get("text_sub", "#ffffff")
    bg_direction = "vertical"

    # 2. 综艺/灰色修正（如果没设 theme 且分析到了灰色，则修正为系统默认）
    keywords_str = " ".join(style_json.get("style_keywords", []))
    is_variety = any(kw in keywords_str for kw in ["综艺", "短视频", "醒目"])
    if not theme and (is_variety or "灰色" in str(style_json.get("background", {}))):
        bg_primary, bg_secondary = "#e5e5e5", "#f0f0f0"
        title_stroke, title_color = "#e63946", "#ffffff"

    # 3. 终极覆盖：如果有显式 theme，则暴力锁死色值
    if theme in THEME_MAP:
        tc = THEME_MAP[theme]
        bg_primary, bg_secondary = tc["bg"]
        title_color = tc["title"]
        title_stroke = tc["stroke"]
        print(f"  [注入] 正在强制启用美学主题: {theme}")

    # 根据平台方向决定推荐尺寸
    is_portrait = height > width  # 竖版（tiktok/小红书）

    # 物品类型尺寸配置
    # 格式: "类型名": (横版_宽度%, 横版_高度%, 竖版_宽度%, 竖版_高度%, x_hint%, y_hint%, min_width, min_height)
    ASSET_SIZE_CONFIG = {
        "person": {
            "landscape_w": 0.50, "landscape_h": 1.0,
            "portrait_w": 0.65, "portrait_h": 0.90,
            "landscape_x": 0.45, "landscape_y": 0.0,
            "portrait_x": 0.25, "portrait_y": 0.10,
            "h_max": 1.0, "portrait_h_max": 0.95,
            "desc": "人物"
        },
        "vehicle": {
            "landscape_w": 0.60, "landscape_h": 0.50, # 调大汽车
            "portrait_w": 0.80, "portrait_h": 0.45,
            "landscape_x": 0.25, "landscape_y": 0.50,
            "portrait_x": 0.10, "portrait_y": 0.55,
            "h_max": 0.70, "portrait_h_max": 0.60,
            "desc": "汽车/车辆"
        },
        "pet": {
            "landscape_w": 0.35, "landscape_h": 0.45, # 调大宠物
            "portrait_w": 0.45, "portrait_h": 0.40,
            "landscape_x": 0.05, "landscape_y": 0.55,
            "portrait_x": 0.05, "portrait_y": 0.65,
            "h_max": 0.50, "portrait_h_max": 0.45,
            "desc": "宠物/小狗/小猫"
        },
        "building": {
            "landscape_w": 0.55, "landscape_h": 0.75,
            "portrait_w": 0.70, "portrait_h": 0.60,
            "landscape_x": 0.40, "landscape_y": 0.20,
            "portrait_x": 0.15, "portrait_y": 0.35,
            "h_max": 0.85, "portrait_h_max": 0.80,
            "desc": "建筑"
        },
        "product": {
            "landscape_w": 0.30, "landscape_h": 0.35,
            "portrait_w": 0.45, "portrait_h": 0.30,
            "landscape_x": 0.05, "landscape_y": 0.60,
            "portrait_x": 0.05, "portrait_y": 0.65,
            "h_max": 0.45, "portrait_h_max": 0.40,
            "desc": "产品"
        },
        "object": {
            "landscape_w": 0.20, "landscape_h": 0.25,
            "portrait_w": 0.35, "portrait_h": 0.20,
            "landscape_x": 0.05, "landscape_y": 0.65,
            "portrait_x": 0.05, "portrait_y": 0.70,
            "h_max": 0.35, "portrait_h_max": 0.30,
            "desc": "小物品"
        },
        "logo": {
            "landscape_w": 0.12, "landscape_h": 0.12,
            "portrait_w": 0.18, "portrait_h": 0.10,
            "landscape_x": 0.05, "landscape_y": 0.05,
            "portrait_x": 0.05, "portrait_y": 0.05,
            "h_max": 0.18, "portrait_h_max": 0.15,
            "desc": "标志"
        },
        "food": {
            "landscape_w": 0.35, "landscape_h": 0.35,
            "portrait_w": 0.50, "portrait_h": 0.30,
            "landscape_x": 0.05, "landscape_y": 0.55,
            "portrait_x": 0.05, "portrait_y": 0.60,
            "h_max": 0.45, "portrait_h_max": 0.40,
            "desc": "食物"
        },
        "tech": {
            "landscape_w": 0.40, "landscape_h": 0.40,
            "portrait_w": 0.55, "portrait_h": 0.35,
            "landscape_x": 0.05, "landscape_y": 0.50,
            "portrait_x": 0.05, "portrait_y": 0.55,
            "h_max": 0.50, "portrait_h_max": 0.45,
            "desc": "科技产品"
        },
    }

    # 兼容旧版本：如果没有指定类型，person 用原逻辑
    if "person" in assets and "person" not in ASSET_SIZE_CONFIG:
        ASSET_SIZE_CONFIG["person"] = {
            "landscape_w": 0.30, "landscape_h": 0.70,
            "portrait_w": 0.55, "portrait_h": 0.65,
            "landscape_x": 0.55, "landscape_y": 0.05,
            "portrait_x": 0.35, "portrait_y": 0.28,
            "h_max": 0.90, "portrait_h_max": 0.80,
            "desc": "人物"
        }

    # 根据实际可用素材和文案，动态构建层模板描述
    layers_hint = []
    used_positions = []

    # z-index 分配策略：人物最高 > 文字 > 其他素材
    # 这样人物不会被文字遮挡，文字也不会被车辆等遮挡
    person_count = sum(1 for k in assets if k.split('_')[0] == 'person')
    other_asset_count = len(assets) - person_count
    z_person = 10  # 人物层最高
    z_text = 5     # 文字层中等
    z_other = 3    # 其他素材层较低

    for asset_id, asset_path in assets.items():
        # 从 asset_id 中提取类型（如 "person_0" → "person"）
        base_type = asset_id.split('_')[0] if '_' in asset_id else asset_id
        # 获取素材配置，默认使用 object 类型
        config = ASSET_SIZE_CONFIG.get(base_type, ASSET_SIZE_CONFIG["object"])

        if is_portrait:
            asset_w_min = int(width * config["portrait_w"])
            asset_h_min = int(height * config["portrait_h"])
            asset_h_max = int(height * config["portrait_h_max"])
            asset_x = int(width * config["portrait_x"])
            asset_y = int(height * config["portrait_y"])
        else:
            asset_w_min = int(width * config["landscape_w"])
            asset_h_min = int(height * config["landscape_h"])
            asset_h_max = int(height * config["h_max"])
            asset_x = int(width * config["landscape_x"])
            asset_y = int(height * config["landscape_y"])

        # 防止位置重叠
        offset = used_positions.count(asset_x) * 30
        asset_y += offset

        effects_list = ['"white_stroke:5"', '"drop_shadow"', '"rim_light"']
        if base_type in ["product", "object"]:
            effects_list.append('"slight_rotation:-5deg"')

        # z-index: 人物最高
        layer_z = z_person if base_type == "person" else z_other

        layers_hint.append(
            f'{{"id": "{asset_id}", "type": "image", "asset": "{asset_id}", '
            f'"x": {asset_x}, "y": {asset_y}, '
            f'"width": {asset_w_min}, "height": {asset_h_min}, '
            f'"zIndex": {layer_z}, "effects": [{", ".join(effects_list)}]}}'
        )
        used_positions.append(asset_x)
    # 标题：竖版放左上角，横版放左侧
    title_x = int(width * 0.05)
    title_y = int(height * 0.05)
    title_fs = max(72, int(width * 0.09))
    layers_hint.append(
        f'{{"id": "title", "type": "text", "content": "{title}", '
        f'"x": {title_x}, "y": {title_y}, "font_size": {title_fs}, "color": "{title_color}", '
        f'"fontWeight": "bold", "stroke_width": 12, "stroke_color": "{title_stroke}", "zIndex": {z_text}, '
        f'"effects": ["svg_thick_stroke", "drop_shadow", "text_gradient"]}}'
    )
    if subtitle:
        # 估算标题行数（横版受人物 x 限制，竖版受画布宽度限制）
        if is_portrait:
            avail_title_w = int(width * 0.70)
        else:
            # 人物约在右半侧，左侧可用宽度
            person_approx_x = int(width * 0.50)
            avail_title_w = person_approx_x - title_x - 20
        approx_char_w = int(title_fs * 1.05)
        chars_per_line = max(1, avail_title_w // approx_char_w)
        title_lines = max(1, -(-len(title) // chars_per_line))  # ceiling div
        sub_y = title_y + int(title_lines * title_fs * 1.15) + 24
        layers_hint.append(
            f'{{"id": "subtitle", "type": "text", "content": "{subtitle}", '
            f'"x": {title_x + 20}, "y": {sub_y}, "font_size": {int(title_fs * 0.55)}, '
            f'"color": "{subtitle_color}", "fontWeight": "bold", "stroke_width": 6, "stroke_color": "{title_stroke}", "zIndex": {z_text}, '
            f'"effects": ["text_badge"]}}'
        )
    # badge参数已禁用，不再生成角标
    # 参考图风格不包含角标元素

    prompt = f"""
你是殿堂级视觉排版大师，请根据以下信息生成高质感排版蓝图 JSON（不含注释）。

参考风格: {json.dumps(style_json, ensure_ascii=False)}
可用素材: {json.dumps(asset_manifest, ensure_ascii=False)}
目标画布: width={width}, height={height}
【执行指令】: {f"用户强制要求使用主题: {theme}，请忽略参考图的色彩倾向，严格应用该审美主题配色。" if theme else "请基于参考图色彩进行美工升华，若参考图偏灰暗，请尝试从配色库中选择亮色。"}

【审美配色库 —— 必须从中选择一个符合 Mood 的组合，或极致升华】
  - "Vivid Energy" (综艺/活力): 背景 #FFE000 -> #FFA500, 主标题 #FFFFFF (渐变底衬 #FF4400), 副标题 #000000 (白底Badge)
  - "Cyber Pop" (科技/潮流): 背景 #000428 -> #004e92, 主标题 #00F2FF (底衬 #1a0033), 副标题 #39FF14 (黑底Badge)
  - "Fresh Mint" (清新/生活): 背景 #D4FC79 -> #96E6A1, 主标题 #1B5E20 (白底衬), 副标题 #FFFFFF (绿底Badge)
  - "Sakura Pink" (美妆/心动): 背景 #FF9A9E -> #FAD0C4, 主标题 #D81B60 (白底衬), 副标题 #FFFFFF (红底Badge)
  - "Luxury Gold" (高端/商务): 背景 #141E30 -> #243B55, 主标题 #D4AF37 (极简黑底衬), 副标题 #FFFFFF (金底Badge)

【配色与环境锁定 —— 必须严格遵守】
  背景主色: {bg_primary}，辅色: {bg_secondary}，纹理: {style_json.get('background', {}).get('texture', 'noise')}
  渐变方向: {bg_direction}
  主标题颜色: {title_color}，描边色: {title_stroke}

【高级排版原则 —— 必须遵守】
1. **视觉平衡**：主素材（如人物）与副素材（如宠物/物品）及文字应形成视觉平衡。避免局部过于拥挤或空旷。
2. **唯一性原则**：每个素材 ID 独立，禁止重复。
3. **拒绝迷你化**：宠物或物品素材严禁设置过小（建议占据 25%~35% 画面高度）。
4. **人脸避让原则**：在竖屏布局下，严禁文字层与主人物的面部区域重叠。请合理调整文字的 y 轴坐标。
5. **氛围打磨**：
   - 标题层必须包含 "text_banner" 或 "text_glow"。
   - 副标题强烈建议使用 "text_badge"。
   - 保证文字绝对易读，配色必须高饱和或高对比。

【构图与素材】
  - 标题：在显著位置（x < 20%），主副标题应有大小对比并使用装饰效果。
  - 主人物：大比例展示，通常占据一侧并底部对齐。
  - 副素材：作为构图平衡点，加大尺寸（25%~35% 高度）放在人物对侧。

【重要约束 —— 防止遮脸】
  - decoration 装饰层（如横幅/色块）严禁放在人物面部所在区域（横版: 画布右半部分顶端 y < 30%；竖版: 画布下半部分 y > 40%）。
  - decoration 的 zIndex 必须低于素材图层（image）。

输出格式示例：
{{
  "canvas": {{"width": {width}, "height": {height}}},
  "background": {{"type": "gradient", "colors": ["{bg_primary}", "{bg_secondary}"]}},
  "layers": [
    {{"id": "title", "type": "text", "content": "{title}", "x": {title_x}, "y": {title_y}, "effects": ["svg_thick_stroke", "text_banner", "text_glow"]}},
    {{"id": "asset_0", "type": "image", "asset": "asset_0", "x": 50, "y": 400, "width": 300, "height": 400, "zIndex": 10}}
  ]
}}
"""
    blueprint = llm_call_with_retry(client, messages=[{"role": "user", "content": prompt}])

    # ---- 后处理：锁定背景颜色，防止 LLM 替换 ----
    blueprint.setdefault("background", {})
    blueprint["background"]["colors"] = [bg_primary, bg_secondary]
    blueprint["background"]["direction"] = bg_direction
    blueprint["background"]["type"] = "gradient"
    # 清除 LLM 可能添加的干扰字段
    blueprint["background"].pop("texture", None)
    blueprint["background"].pop("vignette", None)
    blueprint["background"].pop("description", None)

    # ---- 后处理：修正 image 层越界 + 强制素材尺寸和位置 ----
    # 先扫描所有层的最大 z-index，确保人物层在最上面
    max_z = 0
    for layer in blueprint.get("layers", []):
        max_z = max(max_z, int(layer.get("zIndex", 0)))
    person_z = max_z + 2  # 人物 z-index = 最高层 + 2

    for layer in blueprint.get("layers", []):
        l_type = layer.get("type")

        if l_type == "image":
            layer_id = layer.get("id", "")
            base_type = layer_id.split('_')[0] if '_' in layer_id else layer_id
            lx = int(layer.get("x", 0))
            ly = int(layer.get("y", 0))
            lw = int(layer.get("width", 100))
            lh = int(layer.get("height", 100))
            if lx + lw > width:
                layer["width"] = width - lx
            if ly + lh > height:
                layer["height"] = height - ly

            # 获取素材类型配置
            config = ASSET_SIZE_CONFIG.get(base_type, ASSET_SIZE_CONFIG.get("object"))

            # 人物特殊处理：强制右侧 + 底部对齐 + 高 z-index
            if base_type == "person":
                person_w_min = int(width * (config["landscape_w"] if not is_portrait else config["portrait_w"]))
                person_h_min = int(height * (config["landscape_h"] if not is_portrait else config["portrait_h"]))
                if layer["width"] < person_w_min:
                    layer["width"] = person_w_min
                if layer["height"] < person_h_min:
                    layer["height"] = person_h_min
                # 强制人物在右侧
                layer["x"] = max(0, width - int(layer["width"]))
                # 人物 z-index 必须最高（比所有其他层都高）
                layer["zIndex"] = person_z

            # 所有素材类型：统一强制最小尺寸（包含 vehicle、pet、food、tech、object 等）
            else:
                asset_w_min = int(width * (config["landscape_w"] if not is_portrait else config["portrait_w"]))
                asset_h_min = int(height * (config["landscape_h"] if not is_portrait else config["portrait_h"]))
                if layer["width"] < asset_w_min:
                    layer["width"] = asset_w_min
                if layer["height"] < asset_h_min:
                    layer["height"] = asset_h_min

        # 文字层后处理：确保标题足够大、描边颜色正确、内容不被 LLM 篡改
        elif l_type == "text":
            layer_id = layer.get("id", "")
            # 主标题：强制字号范围、描边、内容
            if "title" in layer_id and "sub" not in layer_id:
                title_fs_max = int(title_fs * 1.3)  # 上限：避免字体过大换行
                fs_clamped = max(title_fs, min(int(layer.get("font_size", title_fs)), title_fs_max))
                layer["font_size"] = fs_clamped
                layer["stroke_color"] = title_stroke
                layer["stroke_width"] = max(int(layer.get("stroke_width", 0)), 12)
                layer["color"] = title_color
                layer["content"] = title  # 强制使用用户指定的标题
            # 副标题：确保字号不太小，同样有描边，内容不被替换，y 坐标不与标题重叠
            elif "sub" in layer_id:
                sub_min_fs = max(40, int(title_fs * 0.45))
                if int(layer.get("font_size", 0)) < sub_min_fs:
                    layer["font_size"] = sub_min_fs
                layer["stroke_color"] = title_stroke
                layer["stroke_width"] = max(int(layer.get("stroke_width", 0)), 6)
                layer["color"] = subtitle_color
                if subtitle:
                    layer["content"] = subtitle  # 强制使用用户指定的副标题
                # 强制 y 坐标：必须在标题下方（估算标题占用高度后留出间距）
                if not is_portrait:
                    avail_w = max(200, int(width * 0.50) - title_x - 20)
                else:
                    avail_w = int(width * 0.70)
                chars_per_line = max(1, avail_w // int(title_fs * 1.05))
                title_lines = max(1, -(-len(title) // chars_per_line))
                min_sub_y = title_y + int(title_lines * title_fs * 1.2) + 16
                if int(layer.get("y", 0)) < min_sub_y:
                    layer["y"] = min_sub_y
                # 确保有 text_badge 效果
                effects = layer.get("effects", [])
                if "text_badge" not in effects:
                    layer["effects"] = effects + ["text_badge"]
    print("✅ 获得排版蓝图。")

    # 文字版线框图预览
    bg = blueprint.get("background", {})
    print(f"\n--- 线框图预览 (背景: {bg.get('type')} {bg.get('colors')} {bg.get('direction')}) ---")
    for layer in blueprint.get("layers", []):
        extra = f" font_size={layer['font_size']}" if "font_size" in layer else f" size={layer.get('width')}x{layer.get('height')}"
        print(
            f"  [{layer.get('type', '?'):12s}] id={layer.get('id', '?'):10s} "
            f"x={layer.get('x', '?'):<6} y={layer.get('y', '?'):<6} "
            f"zIndex={layer.get('zIndex', '?')}{extra}"
        )
    print("------------------")

    return human_confirm("③ 排版蓝图", blueprint, interactive)


# ---------------- Node 4 渲染辅助 (HTML + Playwright) ----------------

def _generate_svg_filters():
    """生成高级商业级描边与人像打光滤镜。"""
    return """
    <svg style="position: absolute; width: 0; height: 0;">
        <!-- 超级描边：利用 feMorphology 扩张并结合 feFlood 填充，确保描边厚实无空白 -->
        <filter id="svg_thick_stroke" x="-100%" y="-100%" width="300%" height="300%">
            <feMorphology operator="dilate" radius="10" in="SourceAlpha" result="dilated" />
            <feFlood flood-color="currentColor" result="flood" />
            <feComposite in="flood" in2="dilated" operator="in" result="stroke" />
            <feMerge>
                <feMergeNode in="stroke" />
                <feMergeNode in="SourceGraphic" />
            </feMerge>
        </filter>
        <!-- 旗舰版轮廓光 (Rim Light 2.0)：赋予人物金属/影棚质感 -->
        <filter id="rim_light" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur" />
            <feSpecularLighting surfaceScale="8" specularConstant="1.2" specularExponent="35" lighting-color="#fff" in="blur" result="spec">
                <fePointLight x="-1000" y="-800" z="400" />
            </feSpecularLighting>
            <feComposite in="spec" in2="SourceGraphic" operator="in" />
            <feComposite in="SourceGraphic" operator="over" />
        </filter>
        <filter id="text_glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur" />
            <feFlood flood-color="gold" opacity="0.4" result="color" />
            <feComposite in="color" in2="blur" operator="in" />
            <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
            </feMerge>
        </filter>
    </svg>
    """


def _get_css_gradient(colors, direction):
    """将蓝图渐变配置转为 CSS gradient 字符串。"""
    c1, c2 = colors[0], colors[1]
    if direction == "horizontal":
        return f"linear-gradient(to right, {c1}, {c2})"
    elif direction == "diagonal":
        return f"linear-gradient(135deg, {c1}, {c2})"
    else:  # vertical
        return f"linear-gradient(to bottom, {c1}, {c2})"


def _hex_to_rgba(hex_color, alpha):
    """将 #RRGGBB 转为 rgba(r,g,b,alpha)。"""
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"rgba({r},{g},{b},{alpha})"


def _build_html_cover(blueprint, assets, ref_image=None):
    """根据排版蓝图和素材，生成完整的 HTML 封面页面。"""
    c_w, c_h = blueprint["canvas"]["width"], blueprint["canvas"]["height"]
    is_portrait = c_h > c_w

    # 预扫描：找到人物层的 x 位置（用于限制文字不侵入人物区域）
    person_x_boundary = c_w  # 默认不限制
    if not is_portrait:
        for layer in blueprint.get("layers", []):
            if layer.get("type") == "image":
                lid = layer.get("id", "")
                base = lid.split("_")[0] if "_" in lid else lid
                if base == "person":
                    person_x_boundary = min(person_x_boundary, int(layer.get("x", c_w)))

    # 构建素材查找表
    asset_lookup = {k: v for k, v in assets.items()}
    for key, path in assets.items():
        asset_lookup[f"{key}_cutout.png"] = path
        asset_lookup[f"temp_{key}_cutout.png"] = path
        asset_lookup[os.path.join("cache", f"temp_{key}_cutout.png")] = path

    # 背景样式与特效
    bg_info = blueprint.get("background", {})
    colors = bg_info.get("colors", ["#1a1a2e", "#16213e"])
    bg_direction = bg_info.get("direction", "vertical")
    bg_css = f"background: {_get_css_gradient(colors, bg_direction)};" if bg_info.get("type") == "gradient" and len(colors) >= 2 else f"background: {colors[0] if colors else '#1a1a2e'};"

    noise_css = """
    body::after {
        content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
        opacity: 0.1; pointer-events: none; z-index: 999;
    }
    """ if bg_info.get("texture") == "noise" else ""

    vignette_css = """
    body::before {
        content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: radial-gradient(circle, transparent 40%, rgba(0,0,0,0.4) 100%);
        pointer-events: none; z-index: 998;
    }
    """ if bg_info.get("vignette") else ""

    # 字体
    font_path = next((fp for fp in FONT_PATHS if os.path.exists(fp)), None)
    font_css = f"@font-face {{ font-family: 'CoverFont'; src: url('file://{os.path.abspath(font_path)}') format('truetype'); font-weight: bold; }}" if font_path else ""

    # 构建层
    layers = sorted(blueprint.get("layers", []), key=lambda x: x.get("zIndex", 0))
    html_parts = [_generate_svg_filters()]

    # === 参考图背景层（如果提供了 ref_image）===
    # 将参考图全屏铺底，叠加主题色渐变蒙版统一色调，让封面有真实照片质感
    if ref_image and os.path.exists(ref_image):
        c1 = colors[0] if colors else "#141E30"
        c2 = colors[1] if len(colors) > 1 else "#243B55"
        c1_75 = _hex_to_rgba(c1, 0.75)
        c1_50 = _hex_to_rgba(c1, 0.50)
        c2_20 = _hex_to_rgba(c2, 0.20)
        # 全画幅背景照片（50% 不透明度）
        html_parts.append(
            f'<img src="file://{os.path.abspath(ref_image)}" '
            f'style="position: absolute; left: 0; top: 0; width: {c_w}px; height: {c_h}px; '
            f'object-fit: cover; object-position: center; opacity: 0.55; z-index: 0;" />'
        )
        # 主题色渐变蒙版：左侧遮深保证文字可读，右侧轻遮保留照片细节
        html_parts.append(
            f'<div style="position: absolute; left: 0; top: 0; width: {c_w}px; height: {c_h}px; '
            f'background: linear-gradient(to right, {c1_75} 0%, {c1_50} 45%, {c2_20} 100%); '
            f'z-index: 1;"></div>'
        )
        # 四角暗角增强质感
        html_parts.append(
            f'<div style="position: absolute; left: 0; top: 0; width: {c_w}px; height: {c_h}px; '
            f'background: radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.45) 100%); '
            f'z-index: 2; pointer-events: none;"></div>'
        )

    for layer in layers:
        l_type, l_id, z = layer.get("type"), layer.get("id", ""), layer.get("zIndex", 1)
        lx, ly = int(layer.get("x", 0)), int(layer.get("y", 0))
        effects = layer.get("effects", [])

        if l_type == "image":
            asset_key = layer.get("asset") or l_id
            path = asset_lookup.get(asset_key)
            if not path: continue

            w, h = int(layer.get("width", 200)), int(layer.get("height", 200))
            base_type = l_id.split('_')[0] if '_' in l_id else l_id
            f_css = ""
            if "drop_shadow" in effects: f_css += "drop-shadow(10px 10px 15px rgba(0,0,0,0.5)) "
            if "rim_light" in effects: f_css += "url(#rim_light) "
            if "white_stroke" in effects: f_css += "url(#svg_thick_stroke) "

            if base_type == "person":
                # 人物：底部对齐，cover 模式裁切底部（脚部），保留上半身
                # 综艺封面标准做法：人物上半身为主视觉
                style = (
                    f"position: absolute; left: {lx}px; bottom: 0; "
                    f"width: {w}px; height: {h}px; "
                    f"object-fit: cover; object-position: top center; "
                    f"z-index: {z}; filter: {f_css.strip()};"
                )
            else:
                # 其他素材：保持比例，contain
                style = (
                    f"position: absolute; left: {lx}px; top: {ly}px; "
                    f"width: {w}px; height: {h}px; "
                    f"object-fit: contain; "
                    f"z-index: {z}; filter: {f_css.strip()};"
                )
            html_parts.append(f'<img id="{l_id}" src="file://{os.path.abspath(path)}" style="{style}" />')

        elif l_type == "text":
            fs, color, stroke_color = int(layer.get("font_size", 40)), layer.get("color", "#ffffff"), layer.get("stroke_color", "#000000")
            stroke_width = int(layer.get("stroke_width", 0))
            content = layer.get("content", "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

            # ---- 综艺封面文字描边：CSS text-shadow 多方向多层 ----
            # 关键：用 16 方向 + 密集层叠，确保描边无间隙、厚实圆润
            text_shadow_parts = []
            if stroke_width > 0:
                sw = max(stroke_width, 12)  # 综艺封面描边至少 12px
                # 16 方向（8 正方向 + 8 对角补间），消除间隙
                dirs_16 = [
                    (1, 0), (0, 1), (-1, 0), (0, -1),       # 十字
                    (1, 1), (-1, 1), (-1, -1), (1, -1),      # 对角
                    (2, 1), (1, 2), (-1, 2), (-2, 1),        # 对角补间
                    (-2, -1), (-1, -2), (1, -2), (2, -1),    # 对角补间
                ]
                for i in range(1, sw + 1):
                    for dx, dy in dirs_16:
                        # 归一化方向向量，使描边均匀
                        mag = (dx*dx + dy*dy) ** 0.5
                        ndx, ndy = dx / mag, dy / mag
                        text_shadow_parts.append(f"{ndx*i:.1f}px {ndy*i:.1f}px 0 {stroke_color}")

            # 额外阴影增强立体感
            if "drop_shadow" in effects:
                text_shadow_parts.append("5px 5px 10px rgba(0,0,0,0.5)")
                text_shadow_parts.append("3px 3px 5px rgba(0,0,0,0.3)")

            text_shadow_css = f"text-shadow: {', '.join(text_shadow_parts)};" if text_shadow_parts else ""

            # 渐变填充（仅当明确指定 text_gradient 时）
            fill_css = f"color: {color};"
            if "text_gradient" in effects:
                fill_css = (
                    f"background: linear-gradient(to bottom, {color}, #cccccc); "
                    f"-webkit-background-clip: text; -webkit-text-fill-color: transparent; "
                )

            # 底衬样式 (Banner/Badge)
            banner_css = ""
            if "text_banner" in effects:
                banner_css = f"background: linear-gradient(135deg, {stroke_color}, #111); padding: 16px 32px; border-radius: 4px; border-left: 8px solid {color}; box-shadow: 15px 15px 30px rgba(0,0,0,0.6);"
            elif "text_badge" in effects:
                banner_css = f"background: {stroke_color}; color: {color} !important; border: 2px solid {color}; padding: 6px 14px; border-radius: 99px; font-size: 0.85em; font-weight: 800; box-shadow: 5px 5px 15px rgba(0,0,0,0.3);"

            # 文字宽度：横版限制在人物左边界内（标题完整可见），竖版限 70%
            if not is_portrait and person_x_boundary < c_w:
                max_w = max(200, person_x_boundary - lx - 20)
            else:
                max_w = int(c_w * 0.70)
            style = (
                f"position: absolute; left: {lx}px; top: {ly}px; z-index: {z}; "
                f"font-family: 'CoverFont', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif; "
                f"font-size: {fs}px; font-weight: bold; "
                f"{fill_css} "
                f"{text_shadow_css} "
                f"{banner_css} "
                f"max-width: {max_w}px; "
                f"white-space: normal; "
                f"word-break: break-word; "
                f"line-height: 1.1; "
                f"letter-spacing: 2px; "
                f"-webkit-font-smoothing: antialiased; "
            )

            html_parts.append(f'<div id="{l_id}" style="{style}">{content}</div>')

        elif l_type == "decoration":
            style_type, d_color = layer.get("style", ""), layer.get("color", "#ffffff")
            d_opacity = layer.get("opacity", 0.3)
            w, h = int(layer.get("width", 100)), int(layer.get("height", 100))

            if style_type == "speed_lines" or style_type == "radiate_lines" or style_type == "radial_lines":
                # 速度线/放射线装饰
                lines = "".join([f'<div style="width: {80+i*8}px; height: 3px; background: {d_color}; margin: 10px 0; opacity: {d_opacity};"></div>' for i in range(14)])
                html_parts.append(f'<div style="position: absolute; right: -30px; top: 12%; z-index: {z}; transform: rotate(-5deg);">{lines}</div>')

            elif style_type == "yellow_circle" or style_type == "circle":
                # 装饰性圆形
                html_parts.append(f'<div style="position: absolute; left: {lx}px; top: {ly}px; width: {w}px; height: {h}px; background: {d_color}; opacity: {d_opacity}; border-radius: 50%; z-index: {z};"></div>')

            elif style_type == "glass":
                # 玻璃态装饰
                html_parts.append(f'<div style="position: absolute; left: {lx}px; top: {ly}px; width: {w}px; height: {h}px; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); z-index: {z}; border-radius: 15px;"></div>')

            elif style_type == "mute_icon" or style_type == "icon":
                # 禁止/静音图标 — 红色圆+斜线
                r = min(w, h) // 2
                html_parts.append(f'''
                <div style="position: absolute; left: {lx}px; top: {ly}px; width: {w}px; height: {h}px; z-index: {z};">
                    <div style="width: {r*2}px; height: {r*2}px; border: {r//4}px solid {d_color}; border-radius: 50%; position: relative; opacity: {d_opacity};">
                        <div style="position: absolute; top: 50%; left: 50%; width: {r}px; height: {max(3, r//8)}px; background: {d_color}; transform: translate(-50%, -50%) rotate(-45deg);"></div>
                    </div>
                </div>''')

            elif "banner" in style_type or "bg" in style_type:
                # 装饰性横幅/色块底衬
                html_parts.append(f'<div style="position: absolute; left: {lx}px; top: {ly}px; width: {w}px; height: {h}px; background: {d_color}; opacity: {d_opacity}; z-index: {z}; border-radius: 4px;"></div>')

    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    {font_css} {noise_css} {vignette_css}
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{ width: {c_w}px; height: {c_h}px; overflow: hidden; {bg_css} position: relative; }}
    </style></head><body>{''.join(html_parts)}</body></html>"""



# ---------------- Node 4-A: Pillow 渲染（新架构，确定性排版）----------------
def node_4_render_pillow(style_json, assets, title, subtitle, platform, output_path,
                         ref_image=None, theme_name=None):
    """
    用 render_pillow 模块直接合成封面，不依赖 LLM 坐标，不依赖 Playwright。
    theme_name: 可选强制主题名（来自 --theme 参数）。
    """
    from autocover_cli import render_pillow, layout_templates, themes

    print("\n[Node 4-P] 开始 Pillow 渲染（参数化模板）...")
    canvas_size = PLATFORM_SIZES.get(platform.lower(), (1280, 720))
    template = layout_templates.get_template(platform)
    theme = themes.pick_theme(style_json, force=theme_name)

    img = render_pillow.render_cover(
        canvas_size=canvas_size,
        assets=assets,
        template=template,
        theme=theme,
        title=title,
        subtitle=subtitle,
        ref_image=ref_image,
        grain=10.0,
        vignette=0.45,
    )

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    img.save(output_path, format="PNG", optimize=False)
    print(f"✅ Pillow 渲染完成，输出至: {output_path}")
    return output_path


# ---------------- Node 4-B: 图像合成 (HTML + Playwright) ----------------
def node_4_render(blueprint, assets, output_path="cover_final.png", ref_image=None):
    print("\n[Node 4] 开始 HTML 渲染...")
    c_w = blueprint["canvas"]["width"]
    c_h = blueprint["canvas"]["height"]

    html_content = _build_html_cover(blueprint, assets, ref_image=ref_image)

    # 保存临时 HTML
    tmp_html = os.path.join(os.path.dirname(os.path.abspath(output_path)), "_cover_tmp.html")
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(tmp_html, "w", encoding="utf-8") as f:
        f.write(html_content)

    # Playwright 截图
    if _sync_playwright is None:
        raise RuntimeError("playwright 未安装，请运行: pip install playwright && playwright install chromium")
    with _sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(
            viewport={"width": c_w, "height": c_h},
            device_scale_factor=2,  # 2x DPI，精细输出
        )
        page.goto(f"file://{os.path.abspath(tmp_html)}")
        # 等待图片和字体加载完成
        page.wait_for_load_state("networkidle")
        # 额外等待确保字体渲染完成
        page.wait_for_timeout(500)
        page.screenshot(path=output_path, full_page=False)
        browser.close()

    # 清理临时 HTML
    try:
        os.remove(tmp_html)
    except Exception:
        pass

    print(f"✅ 渲染完成，成品输出至: {output_path}")
    return output_path


# ---------------- Node 5: 质量评估 ----------------
def node_5_quality_eval(client, final_image_path, style_json, interactive):
    print(f"\n[Node 5] 质量评估: {final_image_path}...")
    base64_image = image_to_base64(final_image_path)
    prompt = f"""
你是严格的视觉质量评审员，请对以下封面图按四个维度打分并输出 JSON（不含注释）。

参考风格关键词：{style_json.get('style_keywords', [])}

评分维度（综合满分 100）：
- 风格相似度（权重 30%）：整体视觉感受与参考风格的吻合程度
- 文字可读性（权重 25%）：标题在背景上的对比度与清晰度
- 构图平衡  （权重 25%）：视觉重心是否稳定，元素分布是否合理
- 素材完整性（权重 20%）：所有素材是否正确呈现、无明显残缺

输出格式：
{{
  "score": 整数（0~100），
  "pass": true 或 false（>=75 分为通过）,
  "feedback": ["观察1", "观察2", "观察3"],
  "suggestions": {{
    "字段路径（如 product.y）": "调整建议（如 +20px）"
  }}
}}
"""
    result = llm_call_with_retry(
        client,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}},
                ],
            }
        ],
    )

    score = result.get("score", 0)
    passed = result.get("pass", score >= 75)
    print(f"✅ 评估得分: {score} 分 | 达标: {'是' if passed else '否'}")
    for fb in result.get("feedback", []):
        print(f"  - {fb}")
    if result.get("suggestions"):
        print(f"  改进建议: {json.dumps(result['suggestions'], ensure_ascii=False)}")

    human_confirm("④ 质量评估（终点）", result, interactive)
    return result


# ---------------- 主流水线 ----------------
def main():
    parser = argparse.ArgumentParser(description="Autocover Agent CLI — 视频封面生成流水线")
    parser.add_argument("--ref-image", required=True, help="参考风格封面图（JPG/PNG）")
    parser.add_argument("--person-image", help="人物素材图（自动抠图）【旧版参数，推荐用 --asset-image】")
    parser.add_argument("--product-image", help="产品素材图（自动去背景）【旧版参数，推荐用 --asset-image】")
    parser.add_argument(
        "--asset-image",
        action="append",
        dest="asset_images",
        help="素材图（格式：type:path，如 --asset-image person:photo.jpg）\n"
             "支持类型: person, vehicle, building, product, object, logo, food, tech"
    )
    parser.add_argument("--title", required=True, help="主标题文字")
    parser.add_argument("--subtitle", default="", help="副标题文字")
    parser.add_argument("--badge", default="", help="角标文字（可选）")
    parser.add_argument(
        "--platform",
        default="youtube",
        choices=list(PLATFORM_SIZES.keys()),
        help="目标平台: " + " / ".join(PLATFORM_SIZES.keys()),
    )
    parser.add_argument(
        "--no-interactive",
        action="store_true",
        help="跳过所有人工确认节点（自动化/测试用）",
    )
    parser.add_argument(
        "--output-dir",
        default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "output"),
        help="封面图输出目录（默认: ../output/）",
    )
    parser.add_argument(
        "--output-name",
        default="cover_final.png",
        help="输出文件名（默认: cover_final.png）",
    )
    parser.add_argument(
        "--theme",
        default=None,
        choices=["travel-luxury", "vivid-variety", "cyber-tech",
                 "fresh-life", "sakura-beauty", "business-dark", "game-dark"],
        help="强制主题（不指定则自动推断）: travel-luxury / vivid-variety / cyber-tech / fresh-life / sakura-beauty / business-dark / game-dark",
    )
    parser.add_argument(
        "--renderer",
        default="pillow",
        choices=["pillow", "html"],
        help="渲染引擎：pillow（新，确定性）| html（旧，Playwright）",
    )
    args = parser.parse_args()

    if not API_KEY:
        print("[错误] 请设置环境变量 ARK_API_KEY")
        sys.exit(1)

    client = OpenAI(api_key=API_KEY, base_url=BASE_URL)
    interactive = not args.no_interactive

    print("\n========== Autocover AI Pipeline ==========\n")

    try:
        style_json = node_1_analyze_style(client, args.ref_image, interactive)
        assets = node_2_process_assets(args.person_image, args.product_image, args.asset_images, interactive)
        blueprint = node_3_plan_layout(
            client, style_json, assets,
            args.title, args.subtitle, args.badge,
            args.platform, theme=args.theme, interactive=interactive,
        )
        output_path = os.path.join(args.output_dir, args.output_name)
        if args.renderer == "pillow":
            final_img_path = node_4_render_pillow(
                style_json, assets,
                title=args.title, subtitle=args.subtitle,
                platform=args.platform,
                output_path=output_path,
                ref_image=os.path.abspath(args.ref_image),
                theme_name=args.theme,
            )
        else:
            final_img_path = node_4_render(blueprint, assets, output_path=output_path,
                                           ref_image=os.path.abspath(args.ref_image))
        node_5_quality_eval(client, final_img_path, style_json, interactive)
        print("\n========== 流程完成 ==========\n")
    except KeyboardInterrupt:
        print("\n用户中断。")
    except Exception as e:
        print(f"\n[错误] Pipeline 异常: {e}")
        raise


if __name__ == "__main__":
    main()
