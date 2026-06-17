# Playwright Stealth for Claude Code

系统 Chrome + 反自动化检测，让 Claude Code 像真人一样操作浏览器。

## 快速安装

```bash
# 1. 前提：Node.js ≥ 20
node --version

# 2. 安装 Playwright MCP
npm install -g @playwright/mcp

# 3. 注册 MCP 服务器（Windows 用 npx.cmd，macOS/Linux 用 npx）
claude mcp add playwright-stealth -- npx.cmd @playwright/mcp \
  --browser chrome \
  --user-data-dir="C:\Users\你的用户名\AppData\Local\Google\Chrome\User Data\Profile 1" \
  --init-script="你克隆的项目路径\playwright-stealth-init.js"

# 4. 验证
claude mcp list  # 应显示 ✔ Connected
```

## Skills

Clone 后将 `skills/` 目录下的文件复制到 `~/.claude/skills/`：

| Skill | 用途 |
|-------|------|
| `canvas/` | 自动操作 Canvas Student（INTI），查作业查成绩 |
| `playwright-stealth-setup/` | 一键安装配置脚本，避坑指南 |

## 验证反检测

```
https://bot.sannysoft.com/   → 全部 passed
https://www.browserscan.net/ → Bot Detection: No
```
