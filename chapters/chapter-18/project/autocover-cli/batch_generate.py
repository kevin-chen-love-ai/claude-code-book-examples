import argparse
import os
import subprocess
from pathlib import Path

PLATFORMS = ["youtube", "tiktok", "bilibili", "xiaohongshu", "universal"]
PROJECT_DIR = Path(__file__).resolve().parent


def generate(ref_image: Path, person_image: Path, product_image: Path) -> None:
    env = os.environ.copy()

    for platform in PLATFORMS:
        print(f"--- 正在生成 {platform} 封面 (2.0 旗舰版)... ---")
        cmd = [
            "python3", "autocover_cli/main.py",
            "--ref-image", str(ref_image),
            "--asset-image", f"person:{person_image}",
            "--asset-image", f"product:{product_image}",
            "--title", f"{platform.upper()} 2.0 巅峰之作",
            "--subtitle", "高饱和主题色 + 影棚级轮廓光",
            "--platform", platform,
            "--theme", "vivid",
            "--no-interactive",
            "--output-name", f"cover_{platform}_v2.png"
        ]
        subprocess.run(cmd, cwd=PROJECT_DIR, env=env, check=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="批量生成多平台封面")
    parser.add_argument("--ref-image", required=True, type=Path, help="参考封面图片")
    parser.add_argument("--person-image", required=True, type=Path, help="人物素材图片")
    parser.add_argument("--product-image", required=True, type=Path, help="产品素材图片")
    args = parser.parse_args()

    if not os.environ.get("ARK_API_KEY"):
        parser.error("请先通过环境变量 ARK_API_KEY 配置 API Key")

    for image_path in (args.ref_image, args.person_image, args.product_image):
        if not image_path.is_file():
            parser.error(f"图片不存在：{image_path}")

    return args

if __name__ == "__main__":
    cli_args = parse_args()
    generate(
        cli_args.ref_image.resolve(),
        cli_args.person_image.resolve(),
        cli_args.product_image.resolve(),
    )
