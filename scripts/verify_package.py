#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
errors: list[str] = []

for chapter in range(1, 23):
    path = ROOT / "chapters" / f"chapter-{chapter:02d}"
    if not path.is_dir():
        errors.append(f"缺少章节目录: {path.relative_to(ROOT)}")
        continue
    snippets_path = path / "snippets"
    if snippets_path.exists():
        errors.append(f"不应发布正文片段目录: {snippets_path.relative_to(ROOT)}")

artifact_directory_names = {
    "target", "node_modules", "dist", "dist-electron", "release", "DerivedData",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".tox",
    ".cache", ".gradle", ".venv", "coverage", "logs", "test-results",
    "playwright-report", "xcuserdata",
}
artifact_file_names = {".DS_Store", ".coverage", ".eslintcache", ".stylelintcache"}
artifact_suffixes = {
    ".class", ".pyc", ".pyo", ".log", ".dump", ".tmp", ".temp", ".bak",
    ".old", ".orig", ".rej", ".swp", ".swo", ".xcuserstate",
}

manifest_paths: set[str] = set()
for item in manifest["files"]:
    unexpected_fields = set(item) - {"chapter", "kind", "path"}
    if unexpected_fields:
        errors.append(
            f"清单包含不应公开的字段: {item.get('path', '<unknown>')} "
            f"({', '.join(sorted(unexpected_fields))})"
        )
    if item["path"] in manifest_paths:
        errors.append(f"清单路径重复: {item['path']}")
    manifest_paths.add(item["path"])
    if item.get("kind") == "book-snippet":
        errors.append(f"清单中不应包含正文片段: {item['path']}")
    path = ROOT / item["path"]
    if not path.is_file():
        errors.append(f"缺少清单文件: {item['path']}")

forbidden_names = {
    ".env", ".p8", ".pem", ".key", ".sqlite", ".sqlite3", ".db", ".jks",
    ".keystore", "credentials.json", "service-account.json", "id_rsa", "id_dsa",
    "id_ed25519",
}
forbidden_name_patterns = (
    re.compile(r"^\.env(?:\..+)?$", re.I),
    re.compile(r"^\.(?:npmrc|pypirc|netrc)$", re.I),
    re.compile(r"^(?:credentials?|secrets?)(?:[._-].+)?$", re.I),
    re.compile(r"^AuthKey_[^/]+\.p8$", re.I),
)
local_path_markers = (
    "/" + "Users" + "/",
    "/" + "home" + "/",
    "/" + "Volumes" + "/",
    "/" + "Applications" + "/",
    "/" + "path" + "/" + "to" + "/",
    "file:" + "///" + "Users" + "/",
    "file:" + "///" + "home" + "/",
    "file:" + "///" + "Volumes" + "/",
)
windows_user_path = r"[A-Za-z]:" + re.escape("\\" + "Users" + "\\")

patterns = {
    "private-key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "aws-key": re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    "github-token": re.compile(r"\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{30,}\b"),
    "slack-token": re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b"),
    "google-api-key": re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b"),
    "openai-key": re.compile(r"\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b"),
    "anthropic-key": re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}\b"),
    "stripe-live-key": re.compile(r"\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b"),
    "aliyun-access-key": re.compile(r"\bLTAI[A-Za-z0-9]{12,}\b"),
    "npm-token": re.compile(r"\bnpm_[A-Za-z0-9]{20,}\b"),
    "gitlab-token": re.compile(r"\bglpat-[A-Za-z0-9_-]{20,}\b"),
    "huggingface-token": re.compile(r"\bhf_[A-Za-z0-9]{20,}\b"),
    "digitalocean-token": re.compile(r"\bdop_v1_[A-Fa-f0-9]{32,}\b"),
    "jwt": re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b"),
    "local-absolute-path": re.compile(
        "(?:" + "|".join(re.escape(marker) for marker in local_path_markers) + "|" + windows_user_path + ")"
    ),
    "database-url": re.compile(r"(?i)(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?)://(?!db-user:your-db-password@db-host:)"),
    "supabase-project": re.compile(r"https://(?!your-project-ref\.)[a-z0-9-]+\.supabase\.co(?:/|$)", re.I),
}
blocked_identity_markers = {
    "latin-alias": "ke" + "vin",
    "latin-name": "chen" + "kang" + "xian",
    "chinese-name": "\u9648\u5eb7\u8d24",
    "traditional-chinese-name": "\u9673\u5eb7\u8ce2",
}
patterns.update(
    {
        f"personal-identity-{label}": re.compile(re.escape(value), re.I)
        for label, value in blocked_identity_markers.items()
    }
)
credential_assignment = re.compile(
    r"(?ix)\b(?:api[_-]?key|access[_-]?key(?:[_-]?id)?|secret(?:[_-]?key)?|"
    r"client[_-]?secret|password|passwd|pwd|token|database[_-]?url|"
    r"datasource[_-]?url|dsn|private[_-]?key)\b\s*[:=]\s*[\"']([^\"'\r\n]{1,300})[\"']"
)
placeholder_markers = {
    "your", "example", "placeholder", "change-me", "changeme", "dummy", "sample",
    "test", "fake", "mock", "reader", "replace", "${", "{{", "xxx", "***",
    "redacted", "dev-", "local", "localhost", "[", "random", "generated", "$(",
    "os.getenv", "process.env", "system.getenv",
}
unquoted_config_assignment = re.compile(
    r"(?m)^[ \t]*(?:export[ \t]+)?(?:[A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|"
    r"API_KEY|ACCESS_KEY|DATABASE_URL|DATASOURCE_URL|DB_URL)[A-Z0-9_]*)[ \t]*[:=][ \t]*"
    r"([^\s#]+)"
)
config_like_suffixes = {".md", ".sh", ".yaml", ".yml", ".toml", ".properties", ".ini"}
text_suffixes = {
    ".md", ".txt", ".java", ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
    ".json", ".yaml", ".yml", ".toml", ".xml", ".sql", ".swift", ".rb", ".sh",
    ".properties", ".ini", ".html", ".css", ".gitignore", ".dockerignore", ".pbxproj",
    ".xcworkspacedata", ".lock",
}


def read_scannable_text(path: Path) -> str | None:
    if path.suffix.lower() in text_suffixes or path.name in {
        "Dockerfile", "Caddyfile", "Gemfile", "Fastfile", "Appfile", "Matchfile",
        "Deliverfile", "Snapfile", "mvnw",
    }:
        try:
            return path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            return None
    if path.suffix.lower() == ".docx":
        try:
            with zipfile.ZipFile(path) as archive:
                return "\n".join(
                    archive.read(name).decode("utf-8", errors="ignore")
                    for name in archive.namelist()
                    if name.endswith(".xml")
                )
        except (OSError, zipfile.BadZipFile):
            errors.append(f"无法检查 DOCX: {path.relative_to(ROOT)}")
    return None


for dirpath, dirnames, filenames in os.walk(ROOT):
    for dirname in dirnames:
        if dirname in artifact_directory_names:
            path = Path(dirpath) / dirname
            errors.append(f"不应发布的构建或缓存目录: {path.relative_to(ROOT)}")
    dirnames[:] = [
        name for name in dirnames
        if name != ".git" and name not in artifact_directory_names
    ]
    for filename in filenames:
        path = Path(dirpath) / filename
        if path.resolve() == Path(__file__).resolve():
            continue
        if path.name in artifact_file_names or path.suffix.lower() in artifact_suffixes:
            errors.append(f"不应发布的构建或中间文件: {path.relative_to(ROOT)}")
        if (
            path.name in forbidden_names
            or path.suffix.lower() in forbidden_names
            or any(pattern.fullmatch(path.name) for pattern in forbidden_name_patterns)
        ):
            errors.append(f"不应发布的敏感文件: {path.relative_to(ROOT)}")
        content = read_scannable_text(path)
        if content is None:
            continue
        for name, pattern in patterns.items():
            if pattern.search(content):
                errors.append(f"敏感信息命中 {name}: {path.relative_to(ROOT)}")
        for match in credential_assignment.finditer(content):
            value = match.group(1).strip()
            normalized = value.lower()
            if not value or any(marker in normalized for marker in placeholder_markers):
                continue
            if re.fullmatch(r"(?:true|false|null|none|[0-9.]+)", normalized):
                continue
            if any(marker in value for marker in ("process.env", "os.getenv", "System.getenv", "env.", "config.")):
                continue
            line = content.count("\n", 0, match.start()) + 1
            errors.append(f"疑似硬编码凭证: {path.relative_to(ROOT)}:{line}")
        if path.suffix.lower() in config_like_suffixes or path.name == "Dockerfile":
            for match in unquoted_config_assignment.finditer(content):
                value = match.group(1).strip("\"'")
                normalized = value.lower()
                if not value or any(marker in normalized for marker in placeholder_markers):
                    continue
                if normalized.startswith("sqlite://") or re.fullmatch(r"[0-9.]+", normalized):
                    continue
                line = content.count("\n", 0, match.start()) + 1
                errors.append(f"疑似未加引号的硬编码配置: {path.relative_to(ROOT)}:{line}")

if errors:
    print("验证失败：")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print(f"验证通过：{len(manifest['files'])} 个清单文件，22 个章节目录，未发现已知敏感信息。")
