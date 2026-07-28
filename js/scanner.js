/**
 * 扫码枪模块 - 键盘模拟输入监听
 * 支持 USB 有线 / 蓝牙无线扫码枪
 */
const Scanner = (function () {
  let buffer = '';
  let lastTime = 0;
  const SCAN_THRESHOLD = 50; // ms 间隔阈值
  let callback = null;
  let active = false;

  function start(cb) {
    callback = cb;
    active = true;
    buffer = '';
    lastTime = 0;
    document.addEventListener('keypress', onKeyPress, true);
  }

  function stop() {
    active = false;
    callback = null;
    document.removeEventListener('keypress', onKeyPress, true);
  }

  function onKeyPress(e) {
    if (!active) return;

    // 忽略在输入框中的扫描（除非该输入框标记为扫码输入）
    const tag = e.target.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA';
    const isScanInput = e.target.getAttribute('data-scan') === 'true';

    const now = Date.now();
    if (now - lastTime > SCAN_THRESHOLD && buffer) {
      buffer = '';
    }
    lastTime = now;

    if (e.key === 'Enter') {
      if (buffer.length >= 4) {
        const code = buffer;
        buffer = '';
        if (callback) callback(code, isInput && !isScanInput ? e.target : null);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      buffer = '';
      return;
    }

    if (e.key && e.key.length === 1) {
      buffer += e.key;
    }
  }

  function isScanning() {
    return active;
  }

  return { start, stop, isScanning };
})();
