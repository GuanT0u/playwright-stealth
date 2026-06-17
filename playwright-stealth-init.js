// Playwright MCP Init Script — 反自动化检测 v6
(function() {
  'use strict';

  function applyStealth() {
    // ================================================================
    // navigator.webdriver：不覆盖！
    // --browser chrome 模式 → 原生就返回 false，覆盖反而留下痕迹
    // ================================================================

    // ================================================================
    // UserAgent / appVersion：不通过 JS 覆盖！
    // --browser chrome 没有 HeadlessChrome 标记，覆盖反而导致
    // navigator.userAgent 跟 HTTP 请求头不一致，被 BrowserScan 检测到
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

    // 7. WebGL — 不覆盖！
    // 你实际显卡是 NVIDIA RTX 4060，这是正常的消费级 GPU
    // 覆盖 getParameter 反而会被 BrowserScan 检测到异常
    // 让真实 WebGL 值通过即可

    // 8. Canvas — 不替换任何原型方法！
    // toDataURL/getImageData 的 hook 会被 Canvas Tampering 检测抓到
    // 真实的 Chrome 不会修改这些方法，我们也不应该改

    // 9. Battery — 模拟电池信息
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

    // 10. mediaCapabilities — 确保正常
    try {
      if (navigator.mediaCapabilities && navigator.mediaCapabilities.decodingInfo) {
        var _dec = navigator.mediaCapabilities.decodingInfo.bind(navigator.mediaCapabilities);
        navigator.mediaCapabilities.decodingInfo = async function(cfg) {
          return await _dec(cfg);
        };
      }
    } catch(e) {}

    // 11. toString 保护 — 让自定义 getter 显示为 [native code]
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

  // 多 timing 覆盖
  applyStealth();
  document.addEventListener('DOMContentLoaded', applyStealth);
  window.addEventListener('load', applyStealth);
  setTimeout(applyStealth, 50);
  setTimeout(applyStealth, 200);
  setTimeout(applyStealth, 500);
  setTimeout(applyStealth, 1000);

  console.log('[Stealth v6] Loaded');
})();
