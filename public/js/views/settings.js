/**
 * 系统设置视图
 */
const SettingsView = (function () {
  let currentTab = 'store';

  function render(container) {
    const user = Auth.currentUser();
    let tabs = [
      { id: 'store', label: '门店管理', perm: true },
      { id: 'users', label: '用户与角色', perm: true },
      { id: 'invite', label: '邀请码', perm: Auth.isAdmin() },
      { id: 'printers', label: '打印机', perm: true },
      { id: 'receipt', label: '小票模板', perm: true },
      { id: 'discount', label: '组合优惠', perm: true },
      { id: 'logs', label: '操作日志', perm: Auth.isManager() || Auth.isAdmin() },
    ].filter((t) => t.perm);

    container.innerHTML = `
      <div class="page-header">
        <h2>系统设置</h2>
      </div>
      <div class="tabs">
        ${tabs.map((t) => `<div class="tab ${currentTab === t.id ? 'active' : ''}" onclick="SettingsView.switchTab('${t.id}')">${t.label}</div>`).join('')}
      </div>
      <div id="settingsContent"></div>
    `;
    renderTab();
  }

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    event.target.classList.add('active');
    renderTab();
  }

  function renderTab() {
    const c = document.getElementById('settingsContent');
    switch (currentTab) {
      case 'store': renderStore(c); break;
      case 'users': renderUsers(c); break;
      case 'invite': renderInvite(c); break;
      case 'printers': renderPrinters(c); break;
      case 'receipt': renderReceipt(c); break;
      case 'discount': renderDiscount(c); break;
      case 'logs': renderLogs(c); break;
    }
  }

  // ===== 门店管理 =====
  function renderStore(c) {
    const user = Auth.currentUser();
    const isAdmin = Auth.isAdmin();
    const isManager = Auth.isManager();
    let stores = DB.getAll('stores');
    // 店长只能看到自己门店
    if (!isAdmin) {
      stores = stores.filter((s) => s.id === user.storeId);
    }
    c.innerHTML = `
      <div class="search-bar">
        <span class="spacer"></span>
        ${isAdmin ? '<button class="btn btn-primary btn-sm" onclick="SettingsView.showStoreForm()">+ 新增门店</button>' : ''}
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>门店名称</th><th>地址</th><th>电话</th><th>商品数</th><th>员工数</th><th>营业状态</th><th>门店状态</th><th>操作</th></tr></thead>
            <tbody>
              ${stores.map((s) => {
                const productCount = DB.filter('products', (p) => p.storeId === s.id).length;
                const staffCount = DB.filter('users', (u) => u.storeId === s.id).length;
                const canEdit = isAdmin || (isManager && s.id === user.storeId);
                const isOpen = s.businessStatus !== 'closed';
                return `
                  <tr>
                    <td style="font-weight:500;">${s.name}</td>
                    <td style="font-size:12px;">${s.address || '-'}</td>
                    <td>${s.phone || '-'}</td>
                    <td>${productCount}</td>
                    <td>${staffCount}</td>
                    <td>
                      <label class="switch">
                        <input type="checkbox" ${isOpen ? 'checked' : ''} onchange="SettingsView.toggleBusinessStatus('${s.id}')">
                        <span class="switch-slider"></span>
                      </label>
                      <span style="font-size:12px;margin-left:6px;color:${isOpen ? 'var(--success)' : 'var(--s400)'};">${isOpen ? '营业中' : '休息中'}</span>
                    </td>
                    <td><span class="badge ${s.status === 'active' ? 'badge-success' : 'badge-gray'}">${s.status === 'active' ? '正常' : '已停业'}</span></td>
                    <td>
                      ${canEdit ? `<button class="btn btn-ghost btn-sm" onclick="SettingsView.showStoreForm('${s.id}')">编辑</button>` : '-'}
                      ${isAdmin ? `<button class="btn btn-ghost btn-sm" onclick="SettingsView.toggleStore('${s.id}')" style="color:var(--warning);">${s.status === 'active' ? '停业' : '恢复'}</button>` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function toggleBusinessStatus(id) {
    const s = DB.find('stores', (x) => x.id === id);
    const newStatus = s.businessStatus === 'closed' ? 'open' : 'closed';
    DB.update('stores', id, { businessStatus: newStatus });
    Toast.success(newStatus === 'open' ? '已切换为营业中' : '已切换为休息中');
    renderTab();
  }

  function showStoreForm(id) {
    const s = id ? DB.find('stores', (x) => x.id === id) : {};
    Modal.show({
      title: id ? '编辑门店' : '新增门店',
      body: `
        <form id="storeForm">
          <div class="form-group">
            <label>门店名称 <span class="req">*</span></label>
            <input type="text" class="form-control" name="name" value="${s.name || ''}" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>联系电话</label>
              <input type="text" class="form-control" name="phone" value="${s.phone || ''}">
            </div>
            <div class="form-group">
              <label>状态</label>
              <select class="form-control" name="status">
                <option value="active" ${s.status !== 'inactive' ? 'selected' : ''}>营业中</option>
                <option value="inactive" ${s.status === 'inactive' ? 'selected' : ''}>停业</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>地址</label>
            <input type="text" class="form-control" name="address" value="${s.address || ''}">
          </div>
          <div style="border-top:1px solid var(--s100);margin:16px 0;padding-top:16px;">
            <label style="display:block;font-weight:700;color:var(--s700);font-size:13px;margin-bottom:12px;">收款二维码（PNG 格式，≤2M）</label>
            <div class="form-row">
              <div class="form-group">
                <label>微信收款码</label>
                <div class="img-upload-area">
                  <div class="img-preview" id="wechatQRPreview">
                    ${s.wechatQR ? `<img src="${s.wechatQR}" alt="微信收款码">` : '<div class="img-placeholder">未上传</div>'}
                  </div>
                  <div style="display:flex;flex-direction:column;gap:6px;">
                    <input type="file" accept="image/png" onchange="SettingsView.uploadStoreQR(this, 'wechatQR', '${id || ''}')" style="font-size:12px;">
                    ${s.wechatQR ? `<button type="button" class="img-clear-btn" onclick="SettingsView.clearStoreQR('wechatQR', '${id || ''}')">清除</button>` : ''}
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label>支付宝收款码</label>
                <div class="img-upload-area">
                  <div class="img-preview" id="alipayQRPreview">
                    ${s.alipayQR ? `<img src="${s.alipayQR}" alt="支付宝收款码">` : '<div class="img-placeholder">未上传</div>'}
                  </div>
                  <div style="display:flex;flex-direction:column;gap:6px;">
                    <input type="file" accept="image/png" onchange="SettingsView.uploadStoreQR(this, 'alipayQR', '${id || ''}')" style="font-size:12px;">
                    ${s.alipayQR ? `<button type="button" class="img-clear-btn" onclick="SettingsView.clearStoreQR('alipayQR', '${id || ''}')">清除</button>` : ''}
                  </div>
                </div>
              </div>
            </div>
            <p style="font-size:12px;color:var(--s400);margin-top:4px;">收银台结算时展示收款二维码供顾客扫码支付</p>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="SettingsView.saveStore('${id || ''}')">保存</button>
      `,
    });
  }

  function uploadStoreQR(input, field, storeId) {
    const file = input.files[0];
    if (!file) return;
    if (file.type !== 'image/png') { Toast.error('仅支持 PNG 格式'); input.value = ''; return; }
    if (file.size > 2 * 1024 * 1024) { Toast.error('图片大小不能超过 2M'); input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (storeId) {
        DB.update('stores', storeId, { [field]: e.target.result });
      } else {
        if (!window._tempStoreQR) window._tempStoreQR = {};
        window._tempStoreQR[field] = e.target.result;
      }
      const preview = document.getElementById(field + 'Preview');
      if (preview) preview.innerHTML = `<img src="${e.target.result}" alt="${field}">`;
      Toast.success('收款码已上传');
    };
    reader.readAsDataURL(file);
  }

  function clearStoreQR(field, storeId) {
    if (storeId) {
      DB.update('stores', storeId, { [field]: '' });
    } else {
      if (window._tempStoreQR) delete window._tempStoreQR[field];
    }
    const preview = document.getElementById(field + 'Preview');
    if (preview) preview.innerHTML = '<div class="img-placeholder">未上传</div>';
    Toast.success('已清除');
    renderTab();
  }

  function saveStore(id) {
    const form = document.getElementById('storeForm');
    const fd = new FormData(form);
    const data = { name: fd.get('name'), phone: fd.get('phone'), address: fd.get('address'), status: fd.get('status') };
    // 合并临时收款二维码
    if (window._tempStoreQR) {
      if (window._tempStoreQR.wechatQR) data.wechatQR = window._tempStoreQR.wechatQR;
      if (window._tempStoreQR.alipayQR) data.alipayQR = window._tempStoreQR.alipayQR;
    }
    if (id) {
      DB.update('stores', id, data);
      Toast.success('门店已更新');
    } else {
      if (!data.wechatQR) data.wechatQR = '';
      if (!data.alipayQR) data.alipayQR = '';
      data.businessStatus = 'open';
      const store = DB.insert('stores', data);
      // 为新门店初始化基础数据
      const cats = ['卫浴', '厨具', '油烟机', '集成灶', '五金配件', '开关电线', '积分商品'];
      cats.forEach((cn) => {
        DB.insert('categories', { name: cn, storeId: store.id, type: cn === '积分商品' ? 'points' : 'product' });
      });
      DB.insert('printers', { storeId: store.id, type: 'A4', name: 'A4打印机', status: 'inactive' });
      DB.insert('printers', { storeId: store.id, type: 'thermal58', name: '热敏小票打印机', status: 'inactive' });
      DB.insert('receiptTemplates', { storeId: store.id, logoUrl: '', qrcodeUrl: '', header: '欢迎光临', footer: '感谢惠顾', fields: ['index', 'product', 'spec', 'qty', 'price', 'amount'], showStoreName: true, showPhone: true, showDateTime: true, showOperator: true });
      DB.insert('pointsRules', { storeId: store.id, enabled: false, ratio: 100, yuanPerPoint: 1, applicableType: 'all', applicableProductIds: [], expiryMonths: 12 });
      DB.insert('storedValueRules', { storeId: store.id, tiers: [] });
      Toast.success('门店已创建，已初始化基础配置');
    }
    window._tempStoreQR = null;
    Modal.close();
    renderTab();
  }

  function toggleStore(id) {
    const s = DB.find('stores', (x) => x.id === id);
    DB.update('stores', id, { status: s.status === 'active' ? 'inactive' : 'active' });
    Toast.success(s.status === 'active' ? '已停业' : '已恢复营业');
    renderTab();
  }

  // ===== 用户与角色 =====
  function renderUsers(c) {
    const user = Auth.currentUser();
    const isAdmin = Auth.isAdmin();
    let users = DB.getAll('users');
    // 店长无权管理超级管理员
    if (!isAdmin) {
      users = users.filter((u) => {
        const role = DB.find('roles', (r) => r.id === u.roleId);
        return !role || role.name !== '管理员';
      });
    }
    const roles = DB.getAll('roles');
    const stores = DB.getAll('stores');

    c.innerHTML = `
      <div class="tabs" style="margin-bottom:16px;">
        <div class="tab active" onclick="document.getElementById('userPanel').style.display='';document.getElementById('rolePanel').style.display='none';this.classList.add('active');this.nextElementSibling.classList.remove('active');">用户列表</div>
        <div class="tab" onclick="document.getElementById('userPanel').style.display='none';document.getElementById('rolePanel').style.display='';this.classList.add('active');this.previousElementSibling.classList.remove('active');">角色权限</div>
      </div>
      <div id="userPanel">
        <div class="search-bar">
          <span class="spacer"></span>
          <button class="btn btn-primary btn-sm" onclick="SettingsView.showUserForm()">+ 添加用户</button>
        </div>
        <div class="card">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>用户名</th><th>姓名</th><th>角色</th><th>所属门店</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                ${users.map((u) => {
                  const role = roles.find((r) => r.id === u.roleId);
                  const store = stores.find((s) => s.id === u.storeId);
                  return `
                    <tr>
                      <td style="font-family:monospace;">${u.username}</td>
                      <td style="font-weight:500;">${u.name}</td>
                      <td><span class="badge badge-info">${role ? role.name : '-'}</span></td>
                      <td>${store ? store.name : '<span style="color:var(--gray-400);">全部门店</span>'}</td>
                      <td><span class="badge ${u.status === 'active' ? 'badge-success' : 'badge-gray'}">${u.status === 'active' ? '正常' : '停用'}</span></td>
                      <td>
                        <button class="btn btn-ghost btn-sm" onclick="SettingsView.showUserForm('${u.id}')">编辑</button>
                        ${u.username !== 'admin' ? `<button class="btn btn-ghost btn-sm" onclick="SettingsView.toggleUser('${u.id}')" style="color:var(--warning);">${u.status === 'active' ? '停用' : '启用'}</button>` : ''}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div id="rolePanel" style="display:none;">
        <div class="search-bar">
          <span class="spacer"></span>
          <button class="btn btn-primary btn-sm" onclick="SettingsView.showRoleForm()">+ 自定义角色</button>
        </div>
        <div class="card">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>角色名称</th><th>类型</th><th>权限数</th><th>操作</th></tr></thead>
              <tbody>
                ${roles.map((r) => `
                  <tr>
                    <td style="font-weight:500;">${r.name}</td>
                    <td><span class="badge ${r.isCustom ? 'badge-info' : 'badge-gray'}">${r.isCustom ? '自定义' : '系统'}</span></td>
                    <td>${r.permissions.includes('*') ? '全部权限' : r.permissions.length + ' 项'}</td>
                    <td>
                      <button class="btn btn-ghost btn-sm" onclick="SettingsView.showRoleForm('${r.id}')">查看/编辑</button>
                      ${r.isCustom ? `<button class="btn btn-ghost btn-sm" onclick="SettingsView.removeRole('${r.id}')" style="color:var(--danger);">删除</button>` : ''}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function showUserForm(id) {
    const u = id ? DB.find('users', (x) => x.id === id) : {};
    const isAdmin = Auth.isAdmin();
    let roles = DB.getAll('roles');
    // 店长不能分配管理员角色
    if (!isAdmin) {
      roles = roles.filter((r) => r.name !== '管理员');
    }
    const stores = DB.getAll('stores').filter((s) => s.status === 'active');
    Modal.show({
      title: id ? '编辑用户' : '添加用户',
      body: `
        <form id="userForm">
          <div class="form-row">
            <div class="form-group">
              <label>用户名 <span class="req">*</span></label>
              <input type="text" class="form-control" name="username" value="${u.username || ''}" ${id ? 'disabled' : 'required'}>
            </div>
            <div class="form-group">
              <label>姓名 <span class="req">*</span></label>
              <input type="text" class="form-control" name="name" value="${u.name || ''}" required>
            </div>
          </div>
          ${!id ? `<div class="form-group"><label>密码 <span class="req">*</span></label><input type="password" class="form-control" name="password" required></div>` : ''}
          <div class="form-row">
            <div class="form-group">
              <label>角色</label>
              <select class="form-control" name="roleId">
                ${roles.map((r) => `<option value="${r.id}" ${u.roleId === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>所属门店</label>
              <select class="form-control" name="storeId">
                <option value="">全部门店</option>
                ${stores.map((s) => `<option value="${s.id}" ${u.storeId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
              </select>
            </div>
          </div>
          ${id ? `<div class="form-group"><label>重置密码（留空不修改）</label><input type="password" class="form-control" name="password" placeholder="输入新密码可重置"></div>` : ''}
        </form>
      `,
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="SettingsView.saveUser('${id || ''}')">保存</button>
      `,
    });
  }

  function saveUser(id) {
    const form = document.getElementById('userForm');
    const fd = new FormData(form);
    const data = {
      username: fd.get('username'),
      name: fd.get('name'),
      roleId: fd.get('roleId'),
      storeId: fd.get('storeId') || null,
      status: 'active',
    };
    const password = fd.get('password');
    if (password) data.password = password;
    if (id) {
      DB.update('users', id, data);
      Toast.success('用户已更新');
    } else {
      if (DB.find('users', (u) => u.username === data.username)) { Toast.error('用户名已存在'); return; }
      DB.insert('users', data);
      Toast.success('用户已添加');
    }
    Modal.close();
    renderTab();
  }

  function toggleUser(id) {
    const u = DB.find('users', (x) => x.id === id);
    DB.update('users', id, { status: u.status === 'active' ? 'inactive' : 'active' });
    Toast.success(u.status === 'active' ? '已停用' : '已启用');
    renderTab();
  }

  // 角色权限
  const ALL_PERMS = [
    { key: 'dashboard', label: '工作台' },
    { key: 'cashier', label: '收银台' },
    { key: 'orders', label: '订单管理' },
    { key: 'products', label: '商品管理' },
    { key: 'inventory_in', label: '入库' },
    { key: 'inventory_out', label: '出库' },
    { key: 'inventory_query', label: '库存查询' },
    { key: 'suppliers', label: '供应商管理' },
    { key: 'transfers', label: '调拨管理' },
    { key: 'members', label: '会员管理' },
    { key: 'settings_coupons', label: '优惠券' },
    { key: 'reports', label: '数据统计' },
    { key: 'settings_store', label: '门店设置' },
    { key: 'settings_roles', label: '角色管理' },
    { key: 'settings_printers', label: '打印机' },
    { key: 'settings_receipt', label: '小票模板' },
    { key: 'settings_points', label: '积分规则' },
    { key: 'settings_stored_value', label: '储值规则' },
    { key: 'settings_discount', label: '组合优惠' },
    { key: 'operation_logs', label: '操作日志' },
    { key: 'templates', label: '商品模板库' },
  ];

  function showRoleForm(id) {
    const r = id ? DB.find('roles', (x) => x.id === id) : {};
    const isSystem = r && !r.isCustom;
    Modal.show({
      title: id ? (isSystem ? '查看角色' : '编辑角色') : '创建自定义角色',
      body: `
        <form id="roleForm">
          <div class="form-group">
            <label>角色名称 <span class="req">*</span></label>
            <input type="text" class="form-control" name="name" value="${r.name || ''}" ${isSystem ? 'disabled' : 'required'}>
          </div>
          <div class="form-group">
            <label>权限配置</label>
            <div class="perm-grid">
              ${ALL_PERMS.map((p) => `
                <label class="perm-item">
                  <input type="checkbox" name="perms" value="${p.key}" ${(r.permissions || []).includes(p.key) || (r.permissions || []).includes('*') ? 'checked' : ''} ${isSystem ? 'disabled' : ''}>
                  ${p.label}
                </label>
              `).join('')}
            </div>
          </div>
        </form>
      `,
      footer: isSystem ? `<button class="btn btn-outline" onclick="Modal.close()">关闭</button>` : `
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="SettingsView.saveRole('${id || ''}')">保存</button>
      `,
    });
  }

  function saveRole(id) {
    const form = document.getElementById('roleForm');
    const fd = new FormData(form);
    const name = fd.get('name');
    const perms = fd.getAll('perms');
    const user = Auth.currentUser();
    if (id) {
      DB.update('roles', id, { name, permissions: perms });
    } else {
      DB.insert('roles', { name, permissions: perms, isCustom: true, storeId: user.storeId });
    }
    Toast.success('角色已保存');
    Modal.close();
    renderTab();
  }

  function removeRole(id) {
    Modal.confirm('确定删除该角色？已分配该角色的用户需重新分配。', () => {
      DB.remove('roles', id);
      Toast.success('已删除');
      renderTab();
    }, { danger: true });
  }

  // ===== 邀请码 =====
  function renderInvite(c) {
    const user = Auth.currentUser();
    const codes = DB.filter('invitationCodes', (co) => co.createdBy === user.id || Auth.isAdmin());

    c.innerHTML = `
      <div class="search-bar">
        <span class="spacer"></span>
        <button class="btn btn-primary btn-sm" onclick="SettingsView.showInviteForm()">+ 生成邀请码</button>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>邀请码</th><th>创建人</th><th>已用/上限</th><th>过期日期</th><th>状态</th><th>备注</th><th>操作</th></tr></thead>
            <tbody>
              ${codes.length === 0 ? '<tr class="empty-row"><td colspan="7">暂无邀请码</td></tr>' : codes.map((co) => {
                const creator = DB.find('users', (u) => u.id === co.createdBy);
                const expired = co.expiresAt && new Date(co.expiresAt) < new Date();
                const usedUp = co.usedCount >= co.maxUses;
                const status = co.status === 'inactive' ? '已作废' : expired ? '已过期' : usedUp ? '已用完' : '可用';
                const statusClass = co.status === 'inactive' ? 'badge-gray' : expired || usedUp ? 'badge-warning' : 'badge-success';
                return `
                  <tr>
                    <td style="font-family:monospace;font-weight:600;">${co.code}</td>
                    <td>${creator ? creator.name : '-'}</td>
                    <td>${co.usedCount} / ${co.maxUses}</td>
                    <td>${co.expiresAt || '-'}</td>
                    <td><span class="badge ${statusClass}">${status}</span></td>
                    <td style="font-size:12px;">${co.remark || '-'}</td>
                    <td>
                      <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${co.code}');Toast.success('已复制到剪贴板')">复制</button>
                      ${co.status === 'active' ? `<button class="btn btn-ghost btn-sm" onclick="SettingsView.revokeInvite('${co.id}')" style="color:var(--danger);">作废</button>` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function showInviteForm() {
    Modal.show({
      title: '生成邀请码',
      body: `
        <form id="inviteForm">
          <div class="form-row">
            <div class="form-group">
              <label>可用次数</label>
              <input type="number" class="form-control" name="maxUses" value="1" min="1">
            </div>
            <div class="form-group">
              <label>过期日期</label>
              <input type="date" class="form-control" name="expiresAt" value="2027-12-31">
            </div>
          </div>
          <div class="form-group">
            <label>备注</label>
            <input type="text" class="form-control" name="remark" placeholder="如：给新员工小王">
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="SettingsView.saveInvite()">生成</button>
      `,
    });
  }

  function saveInvite() {
    const form = document.getElementById('inviteForm');
    const fd = new FormData(form);
    const user = Auth.currentUser();
    const code = Auth.generateInviteCode(user.id, parseInt(fd.get('maxUses')), fd.get('expiresAt'), fd.get('remark'));
    Toast.success('邀请码已生成：' + code.code);
    Modal.close();
    renderTab();
  }

  function revokeInvite(id) {
    Modal.confirm('确定作废该邀请码？作废后不可恢复。', () => {
      DB.update('invitationCodes', id, { status: 'inactive' });
      Toast.success('已作废');
      renderTab();
    }, { danger: true });
  }

  // ===== 打印机 =====
  function renderPrinters(c) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const printers = DB.filter('printers', (p) => p.storeId === storeId);

    c.innerHTML = `
      <div class="card">
        <div class="card-body">
          <p style="font-size:13px;color:var(--gray-500);margin-bottom:16px;">
            配置本地 USB 打印机连接。点击"连接"后系统将尝试与打印机建立连接。A4 打印机用于打印入库单/出库单/库存清单/报表，热敏小票打印机用于打印销售小票。
          </p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            ${printers.map((p) => {
              const typeMap = { A4: { name: 'A4 打印机', icon: '🖨', desc: '打印入库单/出库单/库存清单/报表' }, thermal58: { name: '热敏小票打印机 (58mm)', icon: '🧾', desc: '打印销售小票' } };
              const info = typeMap[p.type] || typeMap.A4;
              return `
                <div class="card" style="border:2px solid ${p.status === 'active' ? 'var(--success)' : 'var(--gray-200)'};">
                  <div class="card-body" style="text-align:center;padding:20px;">
                    <div style="font-size:36px;margin-bottom:8px;">${info.icon}</div>
                    <div style="font-weight:600;font-size:15px;margin-bottom:4px;">${info.name}</div>
                    <div style="font-size:12px;color:var(--gray-500);margin-bottom:12px;">${info.desc}</div>
                    <div style="margin-bottom:12px;">
                      <span class="badge ${p.status === 'active' ? 'badge-success' : 'badge-gray'}">${p.status === 'active' ? '已连接' : '未连接'}</span>
                    </div>
                    <input type="text" class="form-control" value="${p.name}" onchange="SettingsView.updatePrinterName('${p.id}', this.value)" placeholder="打印机名称" style="margin-bottom:8px;text-align:center;">
                    <button class="btn ${p.status === 'active' ? 'btn-danger' : 'btn-success'} btn-block btn-sm" onclick="SettingsView.togglePrinter('${p.id}')">
                      ${p.status === 'active' ? '断开连接' : '连接打印机'}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          <div style="margin-top:16px;padding:12px;background:var(--warning-light);border-radius:8px;font-size:12px;color:var(--warning);">
            注意：浏览器环境下打印机连接为模拟状态。实际部署时需要安装本地打印服务插件（如 USB 打印中间件）才能实现静默打印。当前版本支持通过浏览器打印对话框打印。
          </div>
        </div>
      </div>
    `;
  }

  function togglePrinter(id) {
    const p = DB.find('printers', (x) => x.id === id);
    DB.update('printers', id, { status: p.status === 'active' ? 'inactive' : 'active' });
    Toast.success(p.status === 'active' ? '已断开' : '已连接');
    renderTab();
  }

  function updatePrinterName(id, name) {
    DB.update('printers', id, { name });
  }

  // ===== 小票模板 =====
  function renderReceipt(c) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const store = DB.find('stores', (s) => s.id === storeId);
    const tpl = DB.find('receiptTemplates', (r) => r.storeId === storeId) || {};
    const fields = [
      { key: 'index', label: '序号' },
      { key: 'product', label: '商品' },
      { key: 'spec', label: '规格' },
      { key: 'qty', label: '数量' },
      { key: 'price', label: '单价' },
      { key: 'amount', label: '价格' },
    ];
    const showFields = tpl.fields || ['index', 'product', 'spec', 'qty', 'price', 'amount'];

    c.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 320px;gap:16px;">
        <div class="card">
          <div class="card-header"><h3>小票模板配置</h3></div>
          <div class="card-body">
            <div class="form-group">
              <label>店招图片（PNG 格式，≤2M）</label>
              <div class="img-upload-area">
                <div class="img-preview">
                  ${tpl.logoUrl ? `<img src="${tpl.logoUrl}" alt="店招">` : '<div class="img-placeholder">未上传</div>'}
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;">
                  <input type="file" accept="image/png" onchange="SettingsView.uploadImage(this, 'logoUrl')" style="font-size:12px;">
                  ${tpl.logoUrl ? `<button type="button" class="img-clear-btn" onclick="SettingsView.clearImage('logoUrl')">清除图片</button>` : ''}
                </div>
              </div>
            </div>
            <div class="form-group">
              <label>二维码图片（PNG 格式，≤2M，用于关注公众号/扫码取餐等）</label>
              <div class="img-upload-area">
                <div class="img-preview">
                  ${tpl.qrcodeUrl ? `<img src="${tpl.qrcodeUrl}" alt="二维码">` : '<div class="img-placeholder">未上传</div>'}
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;">
                  <input type="file" accept="image/png" onchange="SettingsView.uploadImage(this, 'qrcodeUrl')" style="font-size:12px;">
                  ${tpl.qrcodeUrl ? `<button type="button" class="img-clear-btn" onclick="SettingsView.clearImage('qrcodeUrl')">清除图片</button>` : ''}
                </div>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>小票头部文字</label>
                <input type="text" class="form-control" id="tplHeader" value="${tpl.header || ''}" placeholder="如：欢迎光临">
              </div>
              <div class="form-group">
                <label>小票底部文字</label>
                <input type="text" class="form-control" id="tplFooter" value="${tpl.footer || ''}" placeholder="如：感谢惠顾">
              </div>
            </div>
            <div class="form-group">
              <label>小票字段（核心字段不可取消）</label>
              <div class="perm-grid">
                ${fields.map((f) => `
                  <label class="perm-item">
                    <input type="checkbox" class="tpl-field" value="${f.key}" ${showFields.includes(f.key) ? 'checked' : ''}>
                    ${f.label}
                  </label>
                `).join('')}
              </div>
            </div>
            <div class="form-group">
              <label>显示选项</label>
              <div style="display:flex;gap:16px;flex-wrap:wrap;">
                <label class="perm-item"><input type="checkbox" id="showStoreName" ${tpl.showStoreName ? 'checked' : ''}>显示门店名称</label>
                <label class="perm-item"><input type="checkbox" id="showPhone" ${tpl.showPhone ? 'checked' : ''}>显示门店电话</label>
                <label class="perm-item"><input type="checkbox" id="showDateTime" ${tpl.showDateTime ? 'checked' : ''}>显示日期时间</label>
                <label class="perm-item"><input type="checkbox" id="showOperator" ${tpl.showOperator ? 'checked' : ''}>显示收银员</label>
              </div>
            </div>
            <button class="btn btn-primary" onclick="SettingsView.saveReceipt()">保存模板</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>预览</h3></div>
          <div class="card-body">
            <div class="receipt-preview">
              ${tpl.logoUrl ? `<div class="r-center"><img src="${tpl.logoUrl}" alt="店招"></div>` : '<div class="r-center" style="color:var(--gray-400);font-size:11px;">[店招图片位置]</div>'}
              ${tpl.showStoreName !== false ? `<div class="r-center r-bold" style="font-size:14px;margin:4px 0;">${store ? store.name : '门店名称'}</div>` : ''}
              ${tpl.showPhone && store ? `<div class="r-center">Tel: ${store.phone}</div>` : ''}
              <div style="border-top:1px dashed #000;margin:4px 0;"></div>
              ${tpl.showDateTime !== false ? '<div class="r-row"><span>2026-07-28 12:00</span></div>' : ''}
              ${tpl.showOperator !== false ? '<div class="r-row"><span>收银员: 张店长</span></div>' : ''}
              <div class="r-row"><span>单号: ORD1234567890</span></div>
              <div style="border-top:1px dashed #000;margin:4px 0;"></div>
              <table>
                <thead><tr>
                  ${showFields.includes('index') ? '<td style="font-weight:bold;">序号</td>' : ''}
                  ${showFields.includes('product') ? '<td style="font-weight:bold;">商品</td>' : ''}
                  ${showFields.includes('spec') ? '<td style="font-weight:bold;">规格</td>' : ''}
                  ${showFields.includes('qty') ? '<td style="font-weight:bold;" align="center">数量</td>' : ''}
                  ${showFields.includes('price') ? '<td style="font-weight:bold;" align="right">单价</td>' : ''}
                  ${showFields.includes('amount') ? '<td style="font-weight:bold;" align="right">价格</td>' : ''}
                </tr></thead>
                <tbody>
                  <tr>
                    ${showFields.includes('index') ? '<td>1</td>' : ''}
                    ${showFields.includes('product') ? '<td>水龙头</td>' : ''}
                    ${showFields.includes('spec') ? '<td>单把冷热</td>' : ''}
                    ${showFields.includes('qty') ? '<td align="center">2</td>' : ''}
                    ${showFields.includes('price') ? '<td align="right">99.00</td>' : ''}
                    ${showFields.includes('amount') ? '<td align="right">198.00</td>' : ''}
                  </tr>
                </tbody>
              </table>
              <div style="border-top:1px dashed #000;margin:4px 0;"></div>
              <div class="r-row"><span>合计</span><span>¥198.00</span></div>
              <div class="r-row r-bold"><span>实付</span><span>¥198.00</span></div>
              <div style="border-top:1px dashed #000;margin:4px 0;"></div>
              ${tpl.qrcodeUrl ? `<div class="r-center"><img src="${tpl.qrcodeUrl}" alt="二维码"></div>` : '<div class="r-center" style="color:var(--gray-400);font-size:11px;">[二维码图片位置]</div>'}
              ${tpl.footer ? `<div class="r-center">${tpl.footer}</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function uploadImage(input, field) {
    const file = input.files[0];
    if (!file) return;
    if (file.type !== 'image/png') { Toast.error('仅支持 PNG 格式'); input.value = ''; return; }
    if (file.size > 2 * 1024 * 1024) { Toast.error('图片大小不能超过 2M'); input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const user = Auth.currentUser();
      const storeId = user.storeId;
      let tpl = DB.find('receiptTemplates', (r) => r.storeId === storeId);
      if (tpl) {
        DB.update('receiptTemplates', tpl.id, { [field]: e.target.result });
      } else {
        DB.insert('receiptTemplates', { storeId, [field]: e.target.result, header: '欢迎光临', footer: '感谢惠顾', fields: ['index', 'product', 'spec', 'qty', 'price', 'amount'], showStoreName: true, showPhone: true, showDateTime: true, showOperator: true });
      }
      Toast.success('图片已上传');
      renderTab();
    };
    reader.readAsDataURL(file);
  }

  function clearImage(field) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    let tpl = DB.find('receiptTemplates', (r) => r.storeId === storeId);
    if (tpl) {
      DB.update('receiptTemplates', tpl.id, { [field]: '' });
    }
    Toast.success('图片已清除');
    renderTab();
  }

  function saveReceipt() {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const fields = Array.from(document.querySelectorAll('.tpl-field:checked')).map((c) => c.value);
    const data = {
      header: document.getElementById('tplHeader').value,
      footer: document.getElementById('tplFooter').value,
      fields,
      showStoreName: document.getElementById('showStoreName').checked,
      showPhone: document.getElementById('showPhone').checked,
      showDateTime: document.getElementById('showDateTime').checked,
      showOperator: document.getElementById('showOperator').checked,
    };
    let tpl = DB.find('receiptTemplates', (r) => r.storeId === storeId);
    if (tpl) {
      DB.update('receiptTemplates', tpl.id, data);
    } else {
      DB.insert('receiptTemplates', { storeId, ...data });
    }
    Toast.success('小票模板已保存');
  }

  // ===== 组合优惠 =====
  function renderDiscount(c) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    let rules = DB.filter('discountRules', (r) => r.storeId === storeId);
    const products = DB.filter('products', (p) => p.storeId === storeId);
    const cats = DB.filter('categories', (c) => c.storeId === storeId && c.type === 'product');

    c.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>组合优惠配置</h3>
          <button class="btn btn-primary btn-sm" onclick="SettingsView.showDiscountForm()">+ 添加优惠规则</button>
        </div>
        <div class="card-body">
          <p style="font-size:13px;color:var(--gray-500);margin-bottom:16px;">
            配置单品折扣、品类折扣和组合叠加/互斥规则。收银台结算时自动按规则计算最优价格。
          </p>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:10px;background:var(--gray-50);border-radius:8px;">
            <span style="font-size:13px;font-weight:500;">叠加模式：</span>
            <select class="form-control" id="combinationMode" style="width:auto;" onchange="SettingsView.saveCombinationMode(this.value)">
              <option value="exclusive" ${rules[0] && rules[0].combinationMode === 'exclusive' ? 'selected' : ''}>互斥（仅取最大优惠）</option>
              <option value="stack" ${rules[0] && rules[0].combinationMode === 'stack' ? 'selected' : ''}>叠加（优惠累加计算）</option>
            </select>
          </div>
          <table class="data-table">
            <thead><tr><th>类型</th><th>适用对象</th><th>折扣</th><th>操作</th></tr></thead>
            <tbody>
              ${rules.length === 0 || rules.flatMap((r) => r.rules).length === 0 ? '<tr class="empty-row"><td colspan="4">暂无优惠规则</td></tr>' : rules.flatMap((r) =>
                r.rules.map((rule, i) => `
                  <tr>
                    <td><span class="badge badge-info">${r.type === 'single' ? '单品/品类折扣' : r.type}</span></td>
                    <td>${rule.productId ? '商品: ' + (DB.find('products', (p) => p.id === rule.productId) || {}).name : rule.categoryName ? '品类: ' + rule.categoryName : '全部商品'}</td>
                    <td style="color:var(--danger);font-weight:500;">${(rule.discount * 10).toFixed(1)}折</td>
                    <td><button class="btn btn-ghost btn-sm" onclick="SettingsView.removeDiscountRule('${r.id}', ${i})" style="color:var(--danger);">删除</button></td>
                  </tr>
                `)
              ).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function showDiscountForm() {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const products = DB.filter('products', (p) => p.storeId === storeId);
    const cats = DB.filter('categories', (c) => c.storeId === storeId && c.type === 'product');

    Modal.show({
      title: '添加优惠规则',
      body: `
        <form id="discountForm">
          <div class="form-group">
            <label>优惠类型</label>
            <select class="form-control" name="targetType" onchange="SettingsView.onDiscountTargetChange(this.value)">
              <option value="all">全部商品</option>
              <option value="category">按品类</option>
              <option value="product">按单品</option>
            </select>
          </div>
          <div class="form-group" id="categorySelect" style="display:none;">
            <label>选择品类</label>
            <select class="form-control" name="categoryName">
              ${cats.map((c) => `<option value="${c.name}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" id="productSelect" style="display:none;">
            <label>选择商品</label>
            <select class="form-control" name="productId">
              ${products.map((p) => `<option value="${p.id}">${p.name} (${p.spec})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>折扣（如 8.5 = 八五折）</label>
            <input type="number" step="0.1" class="form-control" name="discount" value="9.5" min="0.1" max="10">
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="SettingsView.saveDiscountRule()">保存</button>
      `,
    });
  }

  function onDiscountTargetChange(type) {
    document.getElementById('categorySelect').style.display = type === 'category' ? '' : 'none';
    document.getElementById('productSelect').style.display = type === 'product' ? '' : 'none';
  }

  function saveDiscountRule() {
    const form = document.getElementById('discountForm');
    const fd = new FormData(form);
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const targetType = fd.get('targetType');
    const discount = parseFloat(fd.get('discount')) / 10;
    let rule = { discount };

    if (targetType === 'category') {
      rule.categoryName = fd.get('categoryName');
      rule.productId = null;
    } else if (targetType === 'product') {
      rule.productId = fd.get('productId');
      rule.categoryName = null;
    } else {
      rule.productId = null;
      rule.categoryName = null;
    }

    let existing = DB.find('discountRules', (r) => r.storeId === storeId);
    if (existing) {
      existing.rules.push(rule);
      DB.update('discountRules', existing.id, { rules: existing.rules });
    } else {
      DB.insert('discountRules', { storeId, type: 'single', rules: [rule], combinationMode: 'exclusive' });
    }
    Toast.success('优惠规则已添加');
    Modal.close();
    renderTab();
  }

  function removeDiscountRule(ruleId, index) {
    Modal.confirm('确定删除该优惠规则？', () => {
      const rule = DB.find('discountRules', (r) => r.id === ruleId);
      if (rule) {
        rule.rules.splice(index, 1);
        DB.update('discountRules', ruleId, { rules: rule.rules });
      }
      Toast.success('已删除');
      renderTab();
    }, { danger: true });
  }

  function saveCombinationMode(mode) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const rules = DB.filter('discountRules', (r) => r.storeId === storeId);
    rules.forEach((r) => DB.update('discountRules', r.id, { combinationMode: mode }));
    Toast.success('叠加模式已更新');
  }

  // ===== 操作日志 =====
  function renderLogs(c) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    let logs = DB.filter('operationLogs', (l) => l.storeId === storeId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    c.innerHTML = `
      <div class="search-bar">
        <span class="spacer"></span>
        <span style="font-size:12px;color:var(--gray-500);">共 ${logs.length} 条日志</span>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>时间</th><th>操作人</th><th>操作</th><th>目标</th><th>详情</th></tr></thead>
            <tbody>
              ${logs.length === 0 ? '<tr class="empty-row"><td colspan="5">暂无日志</td></tr>' : logs.slice(0, 200).map((l) => {
                const opUser = DB.find('users', (u) => u.id === l.userId);
                const actionMap = {
                  stock_in: '入库', stock_out: '出库', cashier_checkout: '收银结算',
                  create_product: '新增商品', update_product: '修改商品',
                  create_transfer: '发起调拨', approve_transfer: '批准调拨', reject_transfer: '拒绝调拨',
                  recharge: '会员充值', update_points_rules: '修改积分规则',
                };
                return `
                  <tr>
                    <td style="font-size:12px;">${App.formatDateTime(l.timestamp)}</td>
                    <td>${opUser ? opUser.name : '-'}</td>
                    <td><span class="badge badge-info">${actionMap[l.action] || l.action}</span></td>
                    <td style="font-size:12px;">${l.target || '-'}</td>
                    <td style="font-size:12px;color:var(--gray-500);max-width:300px;">${l.afterValue ? l.afterValue.substring(0, 100) : '-'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        ${logs.length > 200 ? '<p style="text-align:center;color:var(--gray-400);margin-top:8px;font-size:12px;">仅显示最近 200 条</p>' : ''}
      </div>
    `;
  }

  // ===== 全部门店管理（管理员） =====
  function renderAllStores(container) {
    const stores = DB.getAll('stores');
    container.innerHTML = `
      <div class="page-header">
        <h2>全部门店管理</h2>
        <div class="actions">
          <button class="btn btn-primary btn-sm" onclick="SettingsView.showStoreForm()">+ 新增门店</button>
        </div>
      </div>
      <div class="stat-grid" style="margin-bottom:20px;">
        <div class="stat-card">
          <div class="stat-icon">🏬</div>
          <div class="stat-label">门店总数</div>
          <div class="stat-value">${stores.length}</div>
          <div class="stat-trend">营业中 ${stores.filter(s => s.status === 'active').length} 家</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📦</div>
          <div class="stat-label">商品总数</div>
          <div class="stat-value">${stores.reduce((sum, s) => sum + DB.filter('products', p => p.storeId === s.id).length, 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-label">员工总数</div>
          <div class="stat-value">${stores.reduce((sum, s) => sum + DB.filter('users', u => u.storeId === s.id).length, 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💰</div>
          <div class="stat-label">本月销售总额</div>
          <div class="stat-value">${App.formatMoney(stores.reduce((sum, s) => {
            const now = new Date();
            const orders = DB.filter('cashierOrders', o => o.storeId === s.id && new Date(o.createdAt).getMonth() === now.getMonth() && new Date(o.createdAt).getFullYear() === now.getFullYear());
            return sum + orders.reduce((s2, o) => s2 + o.paidAmount, 0);
          }, 0))}</div>
        </div>
      </div>
      <div class="store-overview-grid">
        ${stores.map((s) => {
          const productCount = DB.filter('products', (p) => p.storeId === s.id).length;
          const staffCount = DB.filter('users', (u) => u.storeId === s.id).length;
          const memberCount = DB.filter('members', (m) => m.storeId === s.id).length;
          const now = new Date();
          const monthOrders = DB.filter('cashierOrders', (o) => o.storeId === s.id && new Date(o.createdAt).getMonth() === now.getMonth() && new Date(o.createdAt).getFullYear() === now.getFullYear());
          const monthRevenue = monthOrders.reduce((sum, o) => sum + o.paidAmount, 0);
          const supplierCount = DB.filter('suppliers', (sp) => sp.storeId === s.id).length;
          return `
            <div class="store-overview-card">
              <div class="so-header">
                <div>
                  <div class="so-name">${s.name}</div>
                  <div style="font-size:12px;color:var(--s400);margin-top:2px;">${s.address || '地址未设置'}</div>
                </div>
                <span class="badge ${s.status === 'active' ? 'badge-success' : 'badge-gray'}">${s.status === 'active' ? '正常' : '已停业'}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                <label class="switch">
                  <input type="checkbox" ${s.businessStatus !== 'closed' ? 'checked' : ''} onchange="SettingsView.toggleBusinessStatus('${s.id}')">
                  <span class="switch-slider"></span>
                </label>
                <span style="font-size:12px;color:${s.businessStatus !== 'closed' ? 'var(--success)' : 'var(--s400)'};">${s.businessStatus !== 'closed' ? '营业中' : '休息中'}</span>
              </div>
              <div class="so-stats">
                <div class="so-stat">
                  <div class="sos-label">商品数</div>
                  <div class="sos-value">${productCount}</div>
                </div>
                <div class="so-stat">
                  <div class="sos-label">员工数</div>
                  <div class="sos-value">${staffCount}</div>
                </div>
                <div class="so-stat">
                  <div class="sos-label">会员数</div>
                  <div class="sos-value">${memberCount}</div>
                </div>
                <div class="so-stat">
                  <div class="sos-label">供应商</div>
                  <div class="sos-value">${supplierCount}</div>
                </div>
              </div>
              <div class="so-footer">
                <span>📞 ${s.phone || '未设置'}</span>
                <span style="font-weight:700;color:var(--danger);">本月: ${App.formatMoney(monthRevenue)}</span>
              </div>
              <div style="display:flex;gap:8px;margin-top:12px;">
                <button class="btn btn-outline btn-sm" onclick="SettingsView.showStoreForm('${s.id}')" style="flex:1;">编辑门店</button>
                <button class="btn btn-outline btn-sm" onclick="SettingsView.toggleStore('${s.id}')" style="flex:1;">${s.status === 'active' ? '停业' : '恢复'}</button>
              </div>
              ${s.wechatQR || s.alipayQR ? `
                <div class="pay-qr-preview">
                  ${s.wechatQR ? `<div class="pay-qr-item"><div class="qr-img"><img src="${s.wechatQR}" alt="微信"></div><div class="qr-label">微信收款</div></div>` : ''}
                  ${s.alipayQR ? `<div class="pay-qr-item"><div class="qr-img"><img src="${s.alipayQR}" alt="支付宝"></div><div class="qr-label">支付宝收款</div></div>` : ''}
                </div>
              ` : '<div style="margin-top:10px;font-size:12px;color:var(--s400);">⚠️ 未上传收款二维码</div>'}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  return {
    render, switchTab, showStoreForm, saveStore, toggleStore, toggleBusinessStatus,
    showUserForm, saveUser, toggleUser, showRoleForm, saveRole, removeRole,
    showInviteForm, saveInvite, revokeInvite,
    togglePrinter, updatePrinterName,
    uploadImage, clearImage, saveReceipt,
    uploadStoreQR, clearStoreQR,
    showDiscountForm, onDiscountTargetChange, saveDiscountRule, removeDiscountRule, saveCombinationMode,
    renderAllStores,
  };
})();
