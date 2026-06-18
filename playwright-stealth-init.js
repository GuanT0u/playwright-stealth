// Playwright MCP Init Script — 反自动化检测 v7 (mouse trajectory + Cloudflare)
(function() {
  'use strict';

  function applyStealth() {
    // ================================================================
    // navigator.webdriver：不覆盖 — --browser chrome 原生 false
    // UserAgent / appVersion：不覆盖 — 无 HeadlessChrome 标记
    // WebGL getParameter：不覆盖 — 真实 GPU 是正常消费级硬件
    // Canvas 原型：不覆盖 — 避免 Tampering 检测
    // ================================================================

    // 1. plugins → 继承真实 PluginArray + Plugin 原型
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
          configurable: true,
          enumerable: true
        });
      }
    } catch(e) {}

    // 2. languages
    try {
      Object.defineProperty(navigator, 'languages', {
        get: function() { return ['zh-CN', 'zh', 'en-US', 'en']; },
        configurable: true,
        enumerable: true
      });
    } catch(e) {}

    // 3. hardwareConcurrency
    try {
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: function() { return 8; },
        configurable: true,
        enumerable: true
      });
    } catch(e) {}

    // 4. deviceMemory
    try {
      Object.defineProperty(navigator, 'deviceMemory', {
        get: function() { return 8; },
        configurable: true,
        enumerable: true
      });
    } catch(e) {}

    // 5. chrome.runtime — 模拟扩展 API
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

    // 6. permissions — 模拟权限状态
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

    // 7. Battery — 模拟电池信息
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

    // 8. mediaCapabilities
    try {
      if (navigator.mediaCapabilities && navigator.mediaCapabilities.decodingInfo) {
        var _dec = navigator.mediaCapabilities.decodingInfo.bind(navigator.mediaCapabilities);
        navigator.mediaCapabilities.decodingInfo = async function(cfg) {
          return await _dec(cfg);
        };
      }
    } catch(e) {}

    // 9. toString 保护
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

  // ================================================================
  // 10. 鼠标轨迹模拟 — 针对 Cloudflare Turnstile / Anna's Archive
  // 在文档中发射拟人鼠标事件，覆盖:
  //   - mousemove 轨迹（含加速度变化、方向微调、抖动噪音）
  //   - 定期微小位移（人手不可能完全静止）
  //   - scroll 行为（非匀速、有回弹）
  //   - 键盘事件 timing（随机延迟 80-300ms）
  // ================================================================

  function initMouseSpoofing() {
    // ----- Bezier 插值工具 -----
    function bezierPoint(t, p0, p1, p2, p3) {
      var mt = 1 - t;
      return {
        x: mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x,
        y: mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y
      };
    }

    // 生成拟人轨迹点数组（起点→终点，中间随机控制点）
    function generatePath(fromX, fromY, toX, toY, steps) {
      steps = steps || 35 + Math.floor(Math.random() * 30);
      // 两个控制点：偏移量带随机扰动
      var dx = toX - fromX, dy = toY - fromY;
      var cp1 = {
        x: fromX + dx * (0.25 + Math.random() * 0.2) + (Math.random() - 0.5) * 30,
        y: fromY + dy * (0.15 + Math.random() * 0.15) + (Math.random() - 0.5) * 40
      };
      var cp2 = {
        x: fromX + dx * (0.65 + Math.random() * 0.2) + (Math.random() - 0.5) * 30,
        y: fromY + dy * (0.7 + Math.random() * 0.2) + (Math.random() - 0.5) * 40
      };
      var path = [];
      for (var i = 0; i <= steps; i++) {
        var pt = bezierPoint(i / steps, {x: fromX, y: fromY}, cp1, cp2, {x: toX, y: toY});
        // 叠加高斯噪音（人手自然微颤）
        pt.x += (Math.random() - 0.5) * 1.5;
        pt.y += (Math.random() - 0.5) * 1.5;
        path.push(pt);
      }
      return path;
    }

    // 在两点之间移动鼠标（发射 mousemove 事件）
    var lastMouseX = 400 + Math.random() * 200;
    var lastMouseY = 300 + Math.random() * 300;

    function moveMouseTo(targetX, targetY, durationMs) {
      durationMs = durationMs || 300 + Math.random() * 700;
      var path = generatePath(lastMouseX, lastMouseY, targetX, targetY);
      var interval = durationMs / path.length;
      var idx = 0;
      function step() {
        if (idx >= path.length) return;
        var pt = path[idx];
        var evt = new MouseEvent('mousemove', {
          clientX: pt.x, clientY: pt.y,
          screenX: pt.x + window.screenX, screenY: pt.y + window.screenY,
          bubbles: true, cancelable: true,
          movementX: pt.x - lastMouseX, movementY: pt.y - lastMouseY
        });
        document.elementFromPoint(pt.x, pt.y)?.dispatchEvent(evt);
        document.dispatchEvent(evt);
        lastMouseX = pt.x; lastMouseY = pt.y;
        idx++;
        if (idx < path.length) setTimeout(step, interval + (Math.random() - 0.5) * 8);
      }
      step();
    }

    // 周期性微动（模拟"手没完全静止"）
    function microJitter() {
      if (document.hidden) return;
      var dx = (Math.random() - 0.5) * 5;
      var dy = (Math.random() - 0.5) * 4;
      var evt = new MouseEvent('mousemove', {
        clientX: lastMouseX + dx, clientY: lastMouseY + dy,
        screenX: lastMouseX + dx + window.screenX,
        screenY: lastMouseY + dy + window.screenY,
        bubbles: true, cancelable: true,
        movementX: dx, movementY: dy
      });
      document.dispatchEvent(evt);
      lastMouseX += dx; lastMouseY += dy;
      setTimeout(microJitter, 800 + Math.random() * 2200);
    }

    // 随机做一次跨区域鼠标移动
    function randomWander() {
      if (document.hidden) { setTimeout(randomWander, 3000 + Math.random() * 5000); return; }
      var w = window.innerWidth, h = window.innerHeight;
      var tx = 80 + Math.random() * (w - 160);
      var ty = 80 + Math.random() * (h - 160);
      moveMouseTo(tx, ty, 400 + Math.random() * 1200);
      setTimeout(randomWander, 4000 + Math.random() * 10000);
    }

    // 模拟人体工程学滚动：非匀速、有回弹
    function humanScroll(delta) {
      var total = 0, step = Math.abs(delta) / (12 + Math.floor(Math.random() * 10));
      var dir = delta > 0 ? 1 : -1;
      function tick() {
        if (Math.abs(total) >= Math.abs(delta)) {
          // 收尾回弹
          var bounce = (Math.random() - 0.5) * step * 2;
          window.scrollBy(0, bounce);
          return;
        }
        var chunk = step * (0.6 + Math.random() * 0.8);
        total += chunk;
        window.scrollBy(0, chunk * dir);
        // 模拟手指微停
        if (Math.random() < 0.12) {
          setTimeout(tick, 60 + Math.random() * 100);
        } else {
          setTimeout(tick, 25 + Math.random() * 40);
        }
      }
      tick();
    }

    // 拦截原生 scroll 事件 → 注入拟人化
    window.addEventListener('wheel', function(e) {
      e.preventDefault();
      humanScroll(e.deltaY * (0.8 + Math.random() * 0.4));
    }, { passive: false });

    // 启动微动 + 漫游
    setTimeout(microJitter, 1500);
    setTimeout(randomWander, 3000);

    // 暴露全局：允许 Playwright 侧调用 moveMouseTo 做精确点击前的预热
    window.__stealth_mouse = {
      moveTo: moveMouseTo,
      jitter: microJitter,
      wander: randomWander,
      getPos: function() { return { x: lastMouseX, y: lastMouseY }; },
      scroll: humanScroll
    };

    console.log('[Stealth v7] Mouse trajectory simulator active');
  }

  // ================================================================
  // 初始化
  // ================================================================
  applyStealth();
  document.addEventListener('DOMContentLoaded', applyStealth);
  window.addEventListener('load', applyStealth);
  setTimeout(applyStealth, 50);
  setTimeout(applyStealth, 200);
  setTimeout(applyStealth, 500);
  setTimeout(applyStealth, 1000);

  // 鼠标轨迹在 DOM 就绪后启动（需要 document.body 存在）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMouseSpoofing);
  } else {
    initMouseSpoofing();
  }

  console.log('[Stealth v7] Loaded');
})();
