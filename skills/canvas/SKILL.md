---
name: canvas
description: "Automate Canvas Student (INTI) tasks — check assignments, grades, courses. Uses playwright-stealth browser. Stops and waits for credentials if login page appears."
---

# Canvas Student — INTI

用 Playwright Stealth 浏览器自动操作 INTI Canvas Student。

## 启动

```
/canvas 帮我看看 ITM3206 有没有新作业，如果没登录就等我发账号密码
```

## 核心流程

### 1. 打开 Canvas
- `browser_navigate` → `https://newinti.instructure.com/`
- 等页面加载完，截一张图

### 2. 登录检测
- **看到登录页**（SSO / Microsoft / 学校登录） → 截图，然后停住，说："看到登录页面了，请发送账号密码，我收到后继续"
- **已登录**（Dashboard / 课程列表） → 直接进第 3 步

### 3. 执行任务
按用户描述逐项操作，**每步都截图**：
- 检查作业 → 截图课程 + 作业详情
- 查看成绩 → 截图成绩页
- 下载文件 → 截图 + 说明
- 提交讨论 → 截图确认

### 4. 处理登录
- 用户发来账号密码 → 用 `browser_fill_form` / `browser_type` 填入
- 不猜测，不暴力
- 登录失败 → 截图错误，告知用户

## 注意事项
- 全程中文
- 截图到 `.playwright-mcp/`
- 页面加载中 → `browser_wait_for`
- 密码不在截图和对话中暴露
