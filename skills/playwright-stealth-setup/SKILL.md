---
name: playwright-stealth-setup
description: "Install & configure Playwright Stealth MCP — system Chrome + anti-detection. One-command full setup with all pitfalls pre-solved."
---

# Playwright Stealth MCP — 一键安装配置

为 Claude Code 安装一个**拟人化浏览器**：系统 Chrome + Profile 扩展 + 12 项反自动化检测对抗。

适用: Windows / macOS / Linux，根因分析和避坑指南在最后。

## 用法

```
/playwright-stealth-setup
```

或指定 Chrome Profile 路径：

```
/playwright-stealth-setup --profile "Profile 1"
```

---

## 安装流程

### ⚠️ 首先执行环境检查

在所有操作之前先确认环境是否满足最低要求。

```bash
node --version   # 必须 >= 20.0.0（18 的 URL.canParse 不可用！）
npm --version    # 必须 >= 9
```

如果 Node.js 版本过低，先升级 Node.js 再继续。

**禁止在环境检查通过之前执行任何安装步骤。**

---

### Step 1 — 安装 @playwright/mcp

```bash
npm install -g @playwright/mcp
```

### Step 2 — 获取 Chrome Profile 路径

找到用户的 Chrome 用户数据目录：

- **Windows**: `%LOCALAPPDATA%\Google\Chrome\User Data\`
- **macOS**: `~/Library/Application Support/Google/Chrome/`
- **Linux**: `~/.config/google-chrome/`

列出 Profile 目录，帮用户检查里面有没有 `Extensions/` 子目录以确保扩展会被加载。

如果用户不确定用哪个 Profile（Default / Profile 1 / Profile 2），列出所有 Profile 及其扩展名帮助判断。

### Step 3 — 找到 Disable Page Visibility 扩展（加分项）

在 Profile 的 `Extensions/` 子目录下搜索匹配 `manifest.json` 中包含 `Disable Page Visibility` 的扩展，确认其存在。

### Step 4 — 创建 stealth init 脚本

**⚠️ 文件必须保存到不会被删除的固定路径**（如用户项目目录 `playwright-stealth-init.js`）。

脚本设计原则（从多次试错中总结）：

1. **webdriver → 不覆盖**。`--browser chrome` 模式下原生就是 `false`
2. **userAgent / appVersion → 不覆盖**。系统 Chrome 没有 `HeadlessChrome` 标记，覆盖反而导致 JS UA 和 HTTP 请求头不一致
3. **Canvas toDataURL / getImageData → 不覆盖**。篡改 Canvas 原型会被 BrowserScan 的 Canvas Tampering 检测抓到
4. **WebGL getParameter → 不覆盖**。覆盖会导致 WebGL exception 检测。真实 GPU 信息（如 RTX 4060）是完全正常的消费级硬件
5. **plugins → 必须继承真实原型**。`Object.setPrototypeOf(pa, PluginArray.prototype)` + 每个插件 `Object.create(Plugin.prototype)`，否则 `instanceof` 检查和 `.toString()` 返回 `[object Plugin]` 都会失败

完整脚本内容见下方。此脚本已通过 bot.sannysoft.com 全部 20 项检测 + BrowserScan 75% 评分（仅时区和语言扣分，反自动化核心指标 Bot Detection = No）。

```javascript
// Playwright MCP Init Script — 反自动化检测 v6
(function() {
  'use strict';

  function applyStealth() {
    // navigator.webdriver：--browser chrome 原生 false，不覆盖

    // plugins → 继承真实 PluginArray + Plugin 原型
    try {
      if (typeof PluginArray !== 'undefined' && typeof Plugin !== 'undefined') {
        function makePlugin(name, filename, description) {
          var p = Object.create(Plugin.prototype);
          Object.defineProperty(p, 'name', { value: name, writable: false });
          Object.defineProperty(p, 'filename', { value: filename, writable: false });
          Object.defineProperty(p, 'description', { value: description, writable: false });
          Object.defineProperty(p, 'length', { value: 0, writable: false });
          return p;
        }
        var pa = [
          makePlugin('PDF Viewer', 'internal-pdf-viewer', 'Portable Document Format'),
          makePlugin('Chrome PDF Plugin', 'internal-pdf-plugin', 'Portable Document Format'),
          makePlugin('Native Client', 'internal-native-client', ''),
          makePlugin('Widevine Content Decryption Module', 'widevine.dll', 'Enables Widevine licenses'),
          makePlugin('Shockwave Flash', 'pepflashplayer.dll', 'Shockwave Flash 34.0.1')
        ];
        Object.setPrototypeOf(pa, PluginArray.prototype);
        Object.defineProperty(navigator, 'plugins', {
          get: function() { return pa; },
          configurable: true, enumerable: true
        });
      }
    } catch(e) {}

    // languages
    try {
      Object.defineProperty(navigator, 'languages', {
        get: function() { return ['zh-CN', 'zh', 'en-US', 'en']; },
        configurable: true, enumerable: true
      });
    } catch(e) {}

    // hardwareConcurrency
    try {
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: function() { return 8; },
        configurable: true, enumerable: true
      });
    } catch(e) {}

    // deviceMemory
    try {
      Object.defineProperty(navigator, 'deviceMemory', {
        get: function() { return 8; },
        configurable: true, enumerable: true
      });
    } catch(e) {}

    // chrome.runtime
    try {
      if (window.chrome) {
        if (!chrome.runtime) { chrome.runtime = {}; }
        if (!chrome.runtime.connect) {
          chrome.runtime.connect = function() {
            return {
              postMessage: function(){},
              onMessage: { addListener: function(){} },
              onDisconnect: { addListener: function(){} }
            };
          };
        }
        if (!chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage = function(msg, cb) { if (cb) cb(); };
        }
      }
    } catch(e) {}

    // permissions
    try {
      if (navigator.permissions) {
        var _query = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = async function(desc) {
          if (desc && (desc.name === 'notifications' || desc.name === 'clipboard-read')) {
            return { state: 'prompt', onchange: null };
          }
          return _query(desc);
        };
      }
    } catch(e) {}

    // Battery
    try {
      if (navigator.getBattery) {
        navigator.getBattery = async function() {
          return {
            charging: true, chargingTime: 0, dischargingTime: Infinity, level: 0.92,
            onchargingchange: null, onchargingtimechange: null,
            ondischargingtimechange: null, onlevelchange: null
          };
        };
      }
    } catch(e) {}

    // toString 保护
    try {
      var origToString = Function.prototype.toString;
      Function.prototype.toString = function() {
        var fnMap = {
          'function get plugins() { [native code] }': navigator.plugins,
          'function get languages() { [native code] }': navigator.languages,
          'function get hardwareConcurrency() { [native code] }': navigator.hardwareConcurrency,
          'function get deviceMemory() { [native code] }': navigator.deviceMemory,
        };
        for (var sig in fnMap) {
          if (this === fnMap[sig]) return sig;
        }
        return origToString.apply(this, arguments);
      };
    } catch(e) {}
  }

  applyStealth();
  document.addEventListener('DOMContentLoaded', applyStealth);
  window.addEventListener('load', applyStealth);
  setTimeout(applyStealth, 50);
  setTimeout(applyStealth, 200);
  setTimeout(applyStealth, 500);
  setTimeout(applyStealth, 1000);
})();
```

### Step 5 — 注册 MCP 服务器

**⚠️ 使用 Bash（不是 PowerShell！）执行 `claude mcp add`**。

PowerShell 会把 `--headless` 误解析为 `--header`。Bash 环境下需要用 `--` 分隔符。

```bash
claude mcp add playwright-stealth -- npx.cmd @playwright/mcp --browser chrome --user-data-dir="<Chrome Profile 路径>" --init-script="<项目路径>/playwright-stealth-init.js"
```

**Windows 注意**：命令用 `npx.cmd`；macOS/Linux 用 `npx`。

**`--browser chrome` 说明**：用系统安装的 Chrome 而不是 Playwright 自带的 Chromium。好处是：
- `navigator.webdriver` 天然为 `false`（不存在的属性，值为 undefined）
- 不需要 `--disable-blink-features=AutomationControlled`
- init 脚本里的 webdriver 覆盖也会被移除（避免留下被修改痕迹）

### Step 6 — 验证

```bash
claude mcp list
```

确认 `playwright-stealth` 状态为 ✔ Connected。

然后用 `browser_navigate` 打开 `https://bot.sannysoft.com/` 验证：
- WebDriver → missing (passed)
- Plugins is of type PluginArray → passed
- Fingerprint Scanner 全部 20 项 → ok
- 不一致（Canvas Tampering / UserAgent 不符）不应出现

---

## ⚠️ 根因分析 — 避坑要点

以下是安装过程中实际踩过的所有坑，按严重程度排序：

### 🔴 致命（卡死，无法工作）

| # | 问题 | 根因 | 解法 |
|---|------|------|------|
| 1 | `URL.canParse is not a function` | Node.js 18 不支持此 API | **升级到 Node.js 20+** |
| 2 | MCP 服务器注册后 `browser_navigate` 报错 | Node.js 运行时 API 缺失导致服务器内部异常 | 同上 |
| 3 | `settings.json` 加 `mcpServers` 字段被拒绝 | 该字段不在 settings.json schema 中 | **必须用 `claude mcp add` CLI** |
| 4 | PowerShell 中 `--headless` 被当成 `--header` | PowerShell 5.1 参数解析 bug | **用 Bash 执行 `claude mcp add`** |
| 5 | `claude mcp add` 中 `--args` 选项不存在 | 旧版 CLI 文档残留 | 不用 `--args`，用 `--` 分隔符 |
| 6 | Skill 文件不显示在 `/skills` 列表 | 文件格式错误：需要 `目录/SKILL.md` + YAML 头 | `mkdir skill-name && echo "---\nname: ...\n---" > SKILL.md` |

### 🟡 严重（功能残缺，检测不通过）

| # | 问题 | 根因 | 解法 |
|---|------|------|------|
| 7 | 修改 init 脚本后生效不了 | **MCP 服务器启动时一次性加载 init-script，内容被缓存** | `claude mcp remove` + `claude mcp add` 重启服务器 |
| 8 | `Plugins is of type PluginArray → failed` | `instanceof PluginArray` 检查要求继承真实原型；`.toString()` 必须返回 `[object Plugin]` | `Object.setPrototypeOf(pa, PluginArray.prototype)` + `Object.create(Plugin.prototype)` |
| 9 | `WebDriver (New) → present (failed)` | `__defineGetter__` 覆盖虽然让值为 false，但保留了自定义 getter 痕迹 | 不覆盖，`--browser chrome` 模式下原生就干净 |
| 10 | Canvas Tampering 检测 | `HTMLCanvasElement.prototype.toDataURL` 被替换 | 不覆盖 Canvas 任何方法 |
| 11 | UserAgent is different（BrowserScan） | JS getter 覆盖的 UA 和 HTTP 请求头不一致 | 不覆盖 UA（系统 Chrome 无 HeadlessChrome） |
| 12 | WebGL exception 检测 | 覆盖 `getParameter` 在某些边界条件抛异常 | 不覆盖 WebGL |

### 🟢 一般（易用性）

| # | 问题 | 根因 | 解法 |
|---|------|------|------|
| 13 | `npx` 在 Windows PowerShell 中不能用 | PowerShell 用 `npx.cmd` | 脚本中写 `npx.cmd`（Windows）/ `npx`（其他） |
| 14 | `--user-data-dir` 路径格式 | 带空格的 Windows 路径需要引号 | 双引号包裹完整路径 |
| 15 | `--init-script` 路径格式 | 必须是绝对路径 | 用项目目录下的绝对路径，不依赖 cwd |

---

## 测试验证清单

安装完成后逐项确认：

- [ ] `claude mcp list` 显示 `playwright-stealth` ✔ Connected
- [ ] `bot.sannysoft.com` — WebDriver: missing (passed)
- [ ] `bot.sannysoft.com` — Plugins is of type PluginArray: passed
- [ ] `bot.sannysoft.com` — Fingerprint Scanner 20项全部 ok
- [ ] `browserscan.net` — Bot Detection: No
- [ ] `browserscan.net` — Canvas Tampering 不出现
- [ ] `browserscan.net` — UserAgent is different 不出现
- [ ] `browserscan.net` — WebGL exception 不出现
