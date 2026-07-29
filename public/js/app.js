/**
 * 主应用 - 路由、布局、工具函数
 */
const App = (function () {
  const NAV_CONFIG = [
    {
      group: '核心功能',
      items: [
        { id: 'dashboard', label: '工作台', icon: '📊', perm: 'dashboard' },
        { id: 'cashier', label: '收银台', icon: '🛒', perm: 'cashier' },
        { id: 'orders', label: '订单管理', icon: '🧾', perm: 'orders' },
        { id: 'products', label: '商品管理', icon: '📦', perm: 'products' },
        { id: 'inventory', label: '库存管理', icon: '📋', perm: 'inventory_query' },
      ],
    },
    {
      group: '进销存',
      items: [
        { id: 'stockIn', label: '扫码入库', icon: '📥', perm: 'inventory_in' },
        { id: 'stockOut', label: '扫码出库', icon: '📤', perm: 'inventory_out' },
        { id: 'suppliers', label: '供应商', icon: '🚚', perm: 'suppliers' },
        { id: 'transfers', label: '调拨管理', icon: '🔄', perm: 'transfers' },
      ],
    },
    {
      group: '会员营销',
      items: [
        { id: 'members', label: '会员管理', icon: '👥', perm: 'members' },
        { id: 'coupons', label: '优惠券', icon: '🎫', perm: 'settings_coupons' },
      ],
    },
    {
      group: '数据与设置',
      items: [
        { id: 'allStores', label: '全部门店', icon: '🏬', perm: 'all_stores' },
        { id: 'reports', label: '数据统计', icon: '📈', perm: 'reports' },
        { id: 'settings', label: '系统设置', icon: '⚙️', perm: 'settings_store' },
      ],
    },
  ];

  let currentRoute = 'dashboard';

  function init() {
    DB.init();
    const user = Auth.currentUser();
    if (!user) {
      renderAuth();
    } else {
      renderApp();
    }
    window.addEventListener('hashchange', handleRoute);
  }

  function handleRoute() {
    const hash = location.hash.slice(1) || 'dashboard';
    currentRoute = hash;
    renderApp();
  }

  function navigate(route) {
    location.hash = route;
  }

  // ===== 登录/注册页 =====
  function renderAuth() {
    const el = document.getElementById('app');
    el.innerHTML = `
      <div class="auth-page">
        <div class="auth-left">
          <div class="auth-brand">
            <div class="auth-brand-logo">ERP</div>
            <span class="auth-brand-name">门店 ERP</span>
          </div>
          <div class="auth-center">
            <div class="auth-card" id="authCard">
              <div class="auth-header">
                <h1>欢迎使用门店 ERP</h1>
                <span class="auth-tag">商家登录</span>
              </div>
              <div class="auth-tabs">
                <div class="auth-tab active">账号登录</div>
              </div>
              <div id="authForm"></div>
            </div>
          </div>
          <div class="auth-footer">
            Copyright © 门店 ERP All Rights Reserved
          </div>
        </div>
        <div class="auth-right">
          <div class="auth-hero">
            <h2>线下零售进销存一体化</h2>
            <p>收银、库存、会员、订单全流程管理，助力门店数字化经营</p>
            <div class="auth-hero-illustration">
              ${authHeroIllustration()}
            </div>
          </div>
        </div>
      </div>
    `;
    showLoginForm();
  }

  function authHeroIllustration() {
    return `
      <svg viewBox="0 0 320 260" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:rgba(255,255,255,.18);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(255,255,255,.05);stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect x="40" y="30" width="240" height="180" rx="16" fill="url(#bgGrad)" />
        <circle cx="260" cy="60" r="24" fill="rgba(255,255,255,.2)" />
        <rect x="70" y="130" width="80" height="60" rx="8" fill="#fff" opacity=".9" />
        <rect x="75" y="140" width="50" height="6" rx="3" fill="#165dff" opacity=".6" />
        <rect x="75" y="152" width="36" height="6" rx="3" fill="#165dff" opacity=".3" />
        <rect x="75" y="164" width="44" height="6" rx="3" fill="#165dff" opacity=".3" />
        <rect x="165" y="100" width="90" height="90" rx="10" fill="#fff" opacity=".95" />
        <circle cx="210" cy="135" r="18" fill="#4080ff" opacity=".2" />
        <path d="M200 135 L208 143 L222 128" stroke="#165dff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        <rect x="180" y="165" width="60" height="6" rx="3" fill="#165dff" opacity=".4" />
        <rect x="190" y="177" width="40" height="6" rx="3" fill="#165dff" opacity=".25" />
        <path d="M60 210 Q100 180 150 200 T260 190" stroke="rgba(255,255,255,.4)" stroke-width="2" fill="none" stroke-linecap="round" />
        <circle cx="70" cy="205" r="6" fill="#fff" opacity=".7" />
        <circle cx="150" cy="198" r="6" fill="#fff" opacity=".7" />
        <circle cx="250" cy="192" r="6" fill="#fff" opacity=".7" />
      </svg>
    `;
  }

  function showLoginForm() {
    document.getElementById('authForm').innerHTML = `
      <form id="loginForm">
        <div class="form-group">
          <label>用户名</label>
          <div class="input-with-icon">
            <span class="input-icon">👤</span>
            <input type="text" class="form-control" name="username" placeholder="请输入用户名" required autofocus>
          </div>
        </div>
        <div class="form-group">
          <label>密码</label>
          <div class="input-with-icon">
            <span class="input-icon">🔒</span>
            <input type="password" class="form-control" name="password" placeholder="请输入密码" required>
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-block btn-lg">立即登录</button>
      </form>
      <div class="auth-extra" style="justify-content:center;">
        还没有账号？<a onclick="App.showRegisterForm()">邀请码注册</a>
      </div>
    `;
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const res = Auth.login(fd.get('username'), fd.get('password'));
      if (res.ok) {
        Toast.success('登录成功');
        renderApp();
      } else {
        Toast.error(res.msg);
      }
    });
  }

  function showRegisterForm() {
    const stores = DB.getAll('stores').filter((s) => s.status === 'active');
    document.getElementById('authForm').innerHTML = `
      <form id="registerForm">
        <div class="form-group">
          <label>邀请码 <span class="req">*</span></label>
          <div class="input-with-icon">
            <span class="input-icon">🎫</span>
            <input type="text" class="form-control" name="inviteCode" placeholder="请输入管理员发放的邀请码" required>
          </div>
        </div>
        <div class="form-group">
          <label>用户名 <span class="req">*</span></label>
          <div class="input-with-icon">
            <span class="input-icon">👤</span>
            <input type="text" class="form-control" name="username" placeholder="至少3个字符" required>
          </div>
        </div>
        <div class="form-group">
          <label>姓名 <span class="req">*</span></label>
          <div class="input-with-icon">
            <span class="input-icon">📝</span>
            <input type="text" class="form-control" name="name" placeholder="请输入真实姓名" required>
          </div>
        </div>
        <div class="form-group">
          <label>密码 <span class="req">*</span></label>
          <div class="input-with-icon">
            <span class="input-icon">🔒</span>
            <input type="password" class="form-control" name="password" placeholder="至少6个字符" required>
          </div>
        </div>
        <div class="form-group">
          <label>所属门店</label>
          <select class="form-control" name="storeId">
            <option value="">请选择门店</option>
            ${stores.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <button type="submit" class="btn btn-primary btn-block btn-lg">立即注册</button>
      </form>
      <div class="auth-extra" style="justify-content:center;">
        已有账号？<a onclick="App.showLoginForm()">返回登录</a>
      </div>
    `;
    document.getElementById('registerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const res = Auth.register(
        fd.get('username'),
        fd.get('password'),
        fd.get('name'),
        fd.get('inviteCode'),
        fd.get('storeId')
      );
      if (res.ok) {
        Toast.success('注册成功，请登录');
        showLoginForm();
        document.querySelector('#loginForm [name="username"]').value = fd.get('username');
      } else {
        Toast.error(res.msg);
      }
    });
  }

  // ===== 主应用布局 =====
  function renderApp() {
    const user = Auth.currentUser();
    if (!user) {
      renderAuth();
      return;
    }
    const route = location.hash.slice(1) || 'dashboard';
    currentRoute = route;

    // 检查权限
    const navItem = findNavItem(route);
    if (navItem && !Auth.hasPermission(navItem.perm)) {
      currentRoute = 'dashboard';
    }

    const el = document.getElementById('app');
    el.innerHTML = `
      <div class="layout">
        ${renderSidebar()}
        <div class="main-area">
          ${renderTopbar()}
          <div class="content" id="content"></div>
        </div>
      </div>
    `;

    // 导航点击
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.addEventListener('click', () => navigate(item.dataset.route));
    });

    // 点击外部关闭用户下拉
    document.addEventListener('click', (e) => {
      const wrapper = document.querySelector('.user-menu-wrapper');
      const dropdown = document.getElementById('userDropdown');
      if (dropdown && wrapper && !wrapper.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    });

    renderContent();
  }

  function findNavItem(route) {
    for (const g of NAV_CONFIG) {
      const item = g.items.find((i) => i.id === route);
      if (item) return item;
    }
    return null;
  }

  function renderSidebar() {
    const user = Auth.currentUser();
    let html = '<div class="sidebar">';
    html += `
      <div class="sidebar-header">
        <div class="logo">E</div>
        <div class="title">门店 ERP</div>
      </div>
      <nav class="sidebar-nav">
    `;
    for (const group of NAV_CONFIG) {
      const visibleItems = group.items.filter((i) => Auth.hasPermission(i.perm));
      if (visibleItems.length === 0) continue;
      html += `<div class="nav-group-title">${group.group}</div>`;
      for (const item of visibleItems) {
        const active = currentRoute === item.id ? 'active' : '';
        html += `<div class="nav-item ${active}" data-route="${item.id}"><span class="icon">${item.icon}</span><span>${item.label}</span></div>`;
      }
    }
    html += '</nav></div>';
    return html;
  }

  function renderTopbar() {
    const user = Auth.currentUser();
    const navItem = findNavItem(currentRoute);
    const pageTitle = navItem ? navItem.label : '工作台';
    const storeName = user.store ? user.store.name : '全部门店';
    return `
      <div class="topbar">
        <div class="topbar-left">
          <span class="page-title">${pageTitle}</span>
        </div>
        <div class="topbar-right">
          <span class="store-badge">🏪 ${storeName}</span>
          <div class="user-menu-wrapper">
            <div class="user-menu" onclick="App.toggleUserDropdown()">
              <div class="avatar">${(user.name || '?')[0]}</div>
              <div>
                <div class="uname">${user.name}</div>
                <div class="urole">${user.roleName}</div>
              </div>
            </div>
            <div class="user-dropdown" id="userDropdown">
              <div class="user-dropdown-item" onclick="App.showChangePassword()">
                <span class="di-icon">🔑</span> 修改密码
              </div>
              <div class="user-dropdown-divider"></div>
              <div class="user-dropdown-item" onclick="App.logout()" style="color:var(--danger);">
                <span class="di-icon">🚪</span> 退出登录
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderContent() {
    const container = document.getElementById('content');
    if (!container) return;

    // 停止扫码枪监听（收银台会自行启动）
    Scanner.stop();

    const route = currentRoute;
    switch (route) {
      case 'dashboard':
        DashboardView.render(container);
        break;
      case 'cashier':
        CashierView.render(container);
        break;
      case 'orders':
        OrdersView.render(container);
        break;
      case 'products':
        ProductsView.render(container);
        break;
      case 'inventory':
        InventoryView.renderQuery(container);
        break;
      case 'stockIn':
        InventoryView.renderStockIn(container);
        break;
      case 'stockOut':
        InventoryView.renderStockOut(container);
        break;
      case 'suppliers':
        SuppliersView.render(container);
        break;
      case 'transfers':
        InventoryView.renderTransfers(container);
        break;
      case 'members':
        MembersView.render(container);
        break;
      case 'coupons':
        MembersView.renderCoupons(container);
        break;
      case 'reports':
        ReportsView.render(container);
        break;
      case 'allStores':
        SettingsView.renderAllStores(container);
        break;
      case 'settings':
        SettingsView.render(container);
        break;
      default:
        DashboardView.render(container);
    }
  }

  // ===== 工具函数 =====
  function formatMoney(n) {
    return '¥' + (Number(n) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatNumber(n) {
    return (Number(n) || 0).toLocaleString('zh-CN');
  }

  function formatDate(dt) {
    if (!dt) return '-';
    const d = new Date(dt);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function formatDateTime(dt) {
    if (!dt) return '-';
    const d = new Date(dt);
    return formatDate(dt) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function daysBetween(d1, d2) {
    return Math.ceil((new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24));
  }

  function getProductName(productId) {
    const p = DB.find('products', (x) => x.id === productId);
    return p ? p.name : '已删除商品';
  }

  function getCategoryName(categoryId) {
    const c = DB.find('categories', (x) => x.id === categoryId);
    return c ? c.name : '-';
  }

  function getStockQuantity(storeId, productId) {
    return DB.filter('inventory', (i) => i.storeId === storeId && i.productId === productId)
      .reduce((sum, i) => sum + i.quantity, 0);
  }

  // 获取某商品在门店的库存批次（按近效期排序）
  function getBatchesByExpiry(storeId, productId) {
    const batches = DB.filter('inventory', (i) => i.storeId === storeId && i.productId === productId && i.quantity > 0);
    return batches.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  }

  // FEFO 出库扣减
  function deductStock(storeId, productId, qty) {
    const batches = getBatchesByExpiry(storeId, productId);
    let remaining = qty;
    const deductions = [];
    for (const batch of batches) {
      if (remaining <= 0) break;
      const deduct = Math.min(batch.quantity, remaining);
      DB.update('inventory', batch.id, { quantity: batch.quantity - deduct });
      deductions.push({ batchId: batch.id, qty: deduct });
      remaining -= deduct;
    }
    return { ok: remaining <= 0, deductions, shortage: remaining };
  }

  // ===== 用户菜单操作 =====
  function toggleUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) dropdown.classList.toggle('show');
  }

  function logout() {
    Modal.confirm('确定退出登录？', () => {
      Auth.logout();
      renderAuth();
    });
  }

  function showChangePassword() {
    document.getElementById('userDropdown')?.classList.remove('show');
    Modal.show({
      title: '修改密码',
      body: `
        <form id="pwdForm">
          <div class="form-group">
            <label>原密码 <span class="req">*</span></label>
            <input type="password" class="form-control" name="oldPassword" required autofocus>
          </div>
          <div class="form-group">
            <label>新密码 <span class="req">*</span></label>
            <input type="password" class="form-control" name="newPassword" placeholder="至少6个字符" required>
          </div>
          <div class="form-group">
            <label>确认新密码 <span class="req">*</span></label>
            <input type="password" class="form-control" name="confirmPassword" required>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="App.submitChangePassword()">确认修改</button>
      `,
    });
  }

  function submitChangePassword() {
    const form = document.getElementById('pwdForm');
    const fd = new FormData(form);
    const oldPwd = fd.get('oldPassword');
    const newPwd = fd.get('newPassword');
    const confirmPwd = fd.get('confirmPassword');
    if (newPwd !== confirmPwd) { Toast.error('两次输入的新密码不一致'); return; }
    const res = Auth.changePassword(oldPwd, newPwd);
    if (res.ok) {
      Toast.success('密码修改成功');
      Modal.close();
    } else {
      Toast.error(res.msg);
    }
  }

  function resetSystem() {
    if (confirm('确定要重置所有系统数据吗？\n\n这将清空所有商品、订单、会员、设置等数据，恢复到初始状态，不可恢复！')) {
      DB.resetAll();
      Toast.success('系统数据已重置，即将刷新…');
      setTimeout(() => location.reload(), 1000);
    }
  }

  return {
    init,
    navigate,
    renderApp,
    showLoginForm,
    showRegisterForm,
    renderContent,
    formatMoney,
    formatNumber,
    formatDate,
    formatDateTime,
    daysBetween,
    getProductName,
    getCategoryName,
    getStockQuantity,
    getBatchesByExpiry,
    deductStock,
    toggleUserDropdown,
    showChangePassword,
    submitChangePassword,
    logout,
    resetSystem,
    get currentRoute() { return currentRoute; },
  };
})();

// ===== Toast 通知 =====
const Toast = {
  show(msg, type = 'info', duration = 2500) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type] || ''}</span><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(100%)'; setTimeout(() => el.remove(), 250); }, duration);
  },
  success(msg, d) { this.show(msg, 'success', d); },
  error(msg, d) { this.show(msg, 'error', d); },
  warning(msg, d) { this.show(msg, 'warning', d); },
  info(msg, d) { this.show(msg, 'info', d); },
};

// ===== Modal 弹窗 =====
const Modal = {
  show(opts) {
    const container = document.getElementById('modal-container');
    const sizeClass = opts.size === 'lg' ? 'modal-lg' : opts.size === 'xl' ? 'modal-xl' : '';
    container.innerHTML = `
      <div class="modal-overlay" id="modalOverlay">
        <div class="modal ${sizeClass}" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>${opts.title || ''}</h3>
            <button class="close-btn" onclick="Modal.close()">&times;</button>
          </div>
          <div class="modal-body">${opts.body || ''}</div>
          ${opts.footer ? `<div class="modal-footer">${opts.footer}</div>` : ''}
        </div>
      </div>
    `;
    document.getElementById('modalOverlay').addEventListener('click', () => Modal.close());
    if (opts.onMount) opts.onMount();
  },
  close() {
    document.getElementById('modal-container').innerHTML = '';
  },
  confirm(msg, onConfirm, opts = {}) {
    this.show({
      title: opts.title || '确认操作',
      body: `<p style="font-size:14px;line-height:1.6;color:var(--gray-700);">${msg}</p>`,
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">${opts.cancelText || '取消'}</button>
        <button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" id="modalConfirmBtn">${opts.confirmText || '确定'}</button>
      `,
      onMount: () => {
        document.getElementById('modalConfirmBtn').addEventListener('click', () => {
          Modal.close();
          onConfirm();
        });
      },
    });
  },
};

// ===== Excel 导出 =====
function exportToExcel(filename, headers, rows) {
  let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
  html += '<head><meta charset="UTF-8"><style>td{mso-number-format:"\\@";}</style></head><body><table border="1">';
  html += '<tr>' + headers.map((h) => `<th style="background:#4472C4;color:#fff;font-weight:bold;padding:6px;">${h}</th>`).join('') + '</tr>';
  for (const row of rows) {
    html += '<tr>' + row.map((cell) => `<td style="padding:4px 6px;">${cell !== null && cell !== undefined ? String(cell).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''}</td>`).join('') + '</tr>';
  }
  html += '</table></body></html>';

  const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename + '.xls';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  Toast.success('已导出 ' + filename + '.xls');
}

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', () => App.init());
