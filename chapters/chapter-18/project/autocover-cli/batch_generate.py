import subprocess
import os

PLATFORMS = ["youtube", "tiktok", "bilibili", "xiaohongshu", "universal"]
API_KEY = os.environ.get("ARK_API_KEY", "your-ark-api-key-here")  # 从火山引擎控制台获取，勿写入真实密钥

def generate():
    env = os.environ.copy()
    env["ARK_API_KEY"] = API_KEY
    
    for platform in PLATFORMS:
        print(f"--- 正在生成 {platform} 封面 (2.0 旗舰版)... ---")
        cmd = [
            "python3", "autocover_cli/main.py",
            "--ref-image", "output/cover_final.png",
            "--asset-image", "person:cache/temp_person_cutout.png",
            "--asset-image", "pet:cache/temp_product_cutout.png",
            "--title", f"{platform.upper()} 2.0 巅峰之作",
            "--subtitle", "高饱和主题色 + 影棚级轮廓光",
            "--platform", platform,
            "--theme", "vivid",
            "--no-interactive",
            "--output-name", f"cover_{platform}_v2.png"
        ]
        subprocess.run(cmd, env=env)

if __name__ == "__main__":
    generate()
