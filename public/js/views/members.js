/**
 * 会员管理视图
 */
const MembersView = (function () {
  let currentTab = 'members';
  let searchKeyword = '';

  function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h2>会员管理</h2>
        <div class="actions">
          <button class="btn btn-primary btn-sm" onclick="MembersView.showMemberForm()">+ 新增会员</button>
        </div>
      </div>
      <div class="tabs">
        <div class="tab ${currentTab === 'members' ? 'active' : ''}" onclick="MembersView.switchTab('members')">会员列表</div>
        <div class="tab ${currentTab === 'recharge' ? 'active' : ''}" onclick="MembersView.switchTab('recharge')">储值充值</div>
        <div class="tab ${currentTab === 'points' ? 'active' : ''}" onclick="MembersView.switchTab('points')">积分规则</div>
      </div>
      <div id="memberContent"></div>
    `;
    renderTab();
  }

  function renderCoupons(container) {
    currentTab = 'coupons';
    container.innerHTML = `
      <div class="page-header">
        <h2>优惠券管理</h2>
        <div class="actions">
          <button class="btn btn-primary btn-sm" onclick="MembersView.showCouponForm()">+ 新建优惠券</button>
        </div>
      </div>
      <div id="memberContent"></div>
    `;
    renderCouponList(document.getElementById('memberContent'));
  }

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    event.target.classList.add('active');
    renderTab();
  }

  function renderTab() {
    const c = document.getElementById('memberContent');
    if (currentTab === 'members') renderMemberList(c);
    else if (currentTab === 'recharge') renderRecharge(c);
    else if (currentTab === 'points') renderPointsRules(c);
  }

  // ===== 会员列表 =====
  function renderMemberList(c) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    let members = DB.filter('members', (m) => m.storeId === storeId);
    if (searchKeyword) {
      members = members.filter((m) => m.name.includes(searchKeyword) || m.phone.includes(searchKeyword));
    }

    c.innerHTML = `
      <div class="search-bar">
        <input type="text" class="form-control" placeholder="搜索姓名/手机号" value="${searchKeyword}" oninput="MembersView.search(this.value)">
        <span class="spacer"></span>
        <span style="font-size:12px;color:var(--gray-500);">共 ${members.length} 位会员</span>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>姓名</th><th>手机号</th><th>积分</th><th>储值余额</th><th>消费次数</th><th>累计消费</th><th>注册时间</th><th>操作</th></tr></thead>
            <tbody>
              ${members.length === 0 ? '<tr class="empty-row"><td colspan="8">暂无会员</td></tr>' : members.map((m) => {
                const orders = DB.filter('cashierOrders', (o) => o.memberId === m.id);
                const totalSpent = orders.reduce((s, o) => s + o.paidAmount, 0);
                return `
                  <tr>
                    <td style="font-weight:500;">${m.name}</td>
                    <td>${m.phone}</td>
                    <td><span class="badge badge-info">${m.points}</span></td>
                    <td style="color:var(--danger);font-weight:500;">${App.formatMoney(m.balance)}</td>
                    <td>${orders.length}</td>
                    <td>${App.formatMoney(totalSpent)}</td>
                    <td>${App.formatDate(m.createdAt)}</td>
                    <td>
                      <button class="btn btn-ghost btn-sm" onclick="MembersView.showMemberForm('${m.id}')">编辑</button>
                      <button class="btn btn-ghost btn-sm" onclick="MembersView.showMemberDetail('${m.id}')">详情</button>
                      <button class="btn btn-ghost btn-sm" onclick="MembersView.removeMember('${m.id}')" style="color:var(--danger);">删除</button>
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

  function search(val) {
    searchKeyword = val;
    renderTab();
  }

  function showMemberForm(id) {
    const m = id ? DB.find('members', (x) => x.id === id) : {};
    Modal.show({
      title: id ? '编辑会员' : '新增会员',
      body: `
        <form id="memberForm">
          <div class="form-row">
            <div class="form-group">
              <label>姓名 <span class="req">*</span></label>
              <input type="text" class="form-control" name="name" value="${m.name || ''}" required>
            </div>
            <div class="form-group">
              <label>手机号 <span class="req">*</span></label>
              <input type="text" class="form-control" name="phone" value="${m.phone || ''}" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>初始积分</label>
              <input type="number" class="form-control" name="points" value="${m.points || 0}" ${id ? 'disabled' : ''}>
            </div>
            <div class="form-group">
              <label>初始储值</label>
              <input type="number" step="0.01" class="form-control" name="balance" value="${m.balance || 0}" ${id ? 'disabled' : ''}>
            </div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="MembersView.saveMember('${id || ''}')">保存</button>
      `,
    });
  }

  function saveMember(id) {
    const form = document.getElementById('memberForm');
    const fd = new FormData(form);
    const user = Auth.currentUser();
    const data = {
      name: fd.get('name'),
      phone: fd.get('phone'),
      storeId: user.storeId,
    };
    if (id) {
      DB.update('members', id, data);
      Toast.success('会员已更新');
    } else {
      data.points = parseInt(fd.get('points')) || 0;
      data.balance = parseFloat(fd.get('balance')) || 0;
      DB.insert('members', data);

      // 自动发放优惠券
      const autoCoupons = DB.filter('coupons', (c) => c.storeId === user.storeId && c.autoIssue && c.autoRule === 'register' && c.status === 'active');
      autoCoupons.forEach((c) => {
        Toast.info('自动发放优惠券：' + c.name);
      });
      Toast.success('会员已添加');
    }
    Modal.close();
    renderTab();
  }

  function removeMember(id) {
    Modal.confirm('确定删除该会员？', () => {
      DB.remove('members', id);
      Toast.success('已删除');
      renderTab();
    }, { danger: true });
  }

  function showMemberDetail(id) {
    const m = DB.find('members', (x) => x.id === id);
    if (!m) return;
    const orders = DB.filter('cashierOrders', (o) => o.memberId === id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const totalSpent = orders.reduce((s, o) => s + o.paidAmount, 0);
    Modal.show({
      title: '会员详情',
      size: 'lg',
      body: `
        <dl class="desc-list">
          <dt>姓名</dt><dd>${m.name}</dd>
          <dt>手机号</dt><dd>${m.phone}</dd>
          <dt>积分</dt><dd>${m.points}</dd>
          <dt>储值余额</dt><dd>${App.formatMoney(m.balance)}</dd>
          <dt>消费次数</dt><dd>${orders.length}</dd>
          <dt>累计消费</dt><dd>${App.formatMoney(totalSpent)}</dd>
          <dt>注册时间</dt><dd>${App.formatDate(m.createdAt)}</dd>
        </dl>
        <h4 style="margin:16px 0 8px;font-size:14px;">消费记录</h4>
        ${orders.length === 0 ? '<div class="empty-state"><div class="text">暂无消费记录</div></div>' : `
          <table class="data-table">
            <thead><tr><th>订单号</th><th>商品</th><th>金额</th><th>时间</th></tr></thead>
            <tbody>
              ${orders.slice(0, 20).map((o) => `
                <tr>
                  <td style="font-family:monospace;">${o.orderNo}</td>
                  <td style="font-size:12px;">${o.items.map((i) => i.name + '×' + i.qty).join(', ')}</td>
                  <td style="color:var(--danger);">${App.formatMoney(o.paidAmount)}</td>
                  <td>${App.formatDateTime(o.createdAt)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      `,
      footer: `<button class="btn btn-outline" onclick="Modal.close()">关闭</button>`,
    });
  }

  // ===== 储值充值 =====
  function renderRecharge(c) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const rules = DB.find('storedValueRules', (r) => r.storeId === storeId);
    const tiers = rules ? rules.tiers : [];

    c.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="card">
          <div class="card-header"><h3>线下充值</h3></div>
          <div class="card-body">
            <div class="form-group">
              <label>查询会员</label>
              <input type="text" class="form-control" id="rechargeMember" placeholder="输入手机号" onkeydown="if(event.key==='Enter')MembersView.findRechargeMember()">
            </div>
            <div id="rechargeMemberInfo"></div>
            <div class="form-group" id="rechargeForm" style="display:none;">
              <label>充值金额</label>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                ${tiers.map((t) => `<button class="btn btn-outline btn-sm" onclick="MembersView.setRechargeAmount(${t.recharge})">充${t.recharge}${t.bonus ? '(送' + t.bonus + ')' : ''}</button>`).join('')}
              </div>
              <input type="number" step="0.01" class="form-control" id="rechargeAmount" placeholder="或输入自定义金额">
              <div style="font-size:12px;color:var(--gray-500);margin-top:6px;" id="rechargeBonus"></div>
            </div>
            <button class="btn btn-success btn-block" id="rechargeBtn" style="margin-top:12px;display:none;" onclick="MembersView.doRecharge()">确认充值</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3>充值赠送规则</h3>
            <button class="btn btn-outline btn-sm" onclick="MembersView.editTiers()">编辑</button>
          </div>
          <div class="card-body">
            <table class="data-table">
              <thead><tr><th>充值金额</th><th>赠送金额</th><th>实际到账</th></tr></thead>
              <tbody>
                ${tiers.length === 0 ? '<tr class="empty-row"><td colspan="3">暂无规则</td></tr>' : tiers.map((t) => `
                  <tr>
                    <td>${App.formatMoney(t.recharge)}</td>
                    <td style="color:var(--success);">+${App.formatMoney(t.bonus)}</td>
                    <td style="font-weight:500;">${App.formatMoney(t.recharge + t.bonus)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  let rechargeMemberId = null;

  function findRechargeMember() {
    const phone = document.getElementById('rechargeMember').value.trim();
    const user = Auth.currentUser();
    const m = DB.find('members', (x) => x.storeId === user.storeId && x.phone === phone);
    if (!m) {
      Toast.error('未找到会员');
      document.getElementById('rechargeMemberInfo').innerHTML = '';
      document.getElementById('rechargeForm').style.display = 'none';
      document.getElementById('rechargeBtn').style.display = 'none';
      return;
    }
    rechargeMemberId = m.id;
    document.getElementById('rechargeMemberInfo').innerHTML = `
      <div style="background:var(--primary-light);border-radius:6px;padding:8px;margin:8px 0;font-size:13px;">
        <b>${m.name}</b> · ${m.phone}<br>
        当前余额：<b style="color:var(--danger);">${App.formatMoney(m.balance)}</b>
      </div>
    `;
    document.getElementById('rechargeForm').style.display = '';
    document.getElementById('rechargeBtn').style.display = '';
  }

  function setRechargeAmount(amount) {
    document.getElementById('rechargeAmount').value = amount;
    const user = Auth.currentUser();
    const rules = DB.find('storedValueRules', (r) => r.storeId === user.storeId);
    if (rules) {
      const tier = rules.tiers.find((t) => t.recharge === amount);
      document.getElementById('rechargeBonus').textContent = tier && tier.bonus ? `赠送 ${App.formatMoney(tier.bonus)}，实际到账 ${App.formatMoney(amount + tier.bonus)}` : '无赠送';
    }
  }

  function doRecharge() {
    const amount = parseFloat(document.getElementById('rechargeAmount').value);
    if (!amount || amount <= 0) { Toast.warning('请输入充值金额'); return; }
    const user = Auth.currentUser();
    const rules = DB.find('storedValueRules', (r) => r.storeId === user.storeId);
    let bonus = 0;
    if (rules) {
      const tier = rules.tiers.find((t) => t.recharge === amount);
      if (tier) bonus = tier.bonus || 0;
    }
    const m = DB.find('members', (x) => x.id === rechargeMemberId);
    if (!m) return;
    DB.update('members', m.id, { balance: m.balance + amount + bonus });
    DB.log(user.id, user.storeId, 'recharge', m.name, { balance: m.balance }, { balance: m.balance + amount + bonus });
    Toast.success(`充值成功：${App.formatMoney(amount)}${bonus ? ' + 赠送 ' + App.formatMoney(bonus) : ''}，到账 ${App.formatMoney(amount + bonus)}`);
    document.getElementById('rechargeMember').value = '';
    document.getElementById('rechargeMemberInfo').innerHTML = '';
    document.getElementById('rechargeForm').style.display = 'none';
    document.getElementById('rechargeBtn').style.display = 'none';
    document.getElementById('rechargeAmount').value = '';
  }

  function editTiers() {
    const user = Auth.currentUser();
    const rules = DB.find('storedValueRules', (r) => r.storeId === user.storeId);
    const tiers = rules ? rules.tiers : [];
    Modal.show({
      title: '编辑充值赠送规则',
      body: `
        <p style="font-size:12px;color:var(--gray-500);margin-bottom:12px;">设置不同充值金额的赠送规则，顾客充值对应金额时自动赠送。</p>
        <div id="tiersContainer">
          ${tiers.map((t, i) => `
            <div class="form-row" style="margin-bottom:8px;" id="tierRow${i}">
              <div class="form-group"><input type="number" class="form-control" placeholder="充值金额" value="${t.recharge}"></div>
              <div class="form-group"><input type="number" class="form-control" placeholder="赠送金额" value="${t.bonus}"></div>
              <button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()" style="color:var(--danger);">✕</button>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-outline btn-sm" onclick="MembersView.addTier()">+ 添加规则</button>
      `,
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="MembersView.saveTiers()">保存</button>
      `,
    });
  }

  function addTier() {
    const container = document.getElementById('tiersContainer');
    const idx = container.children.length;
    const div = document.createElement('div');
    div.className = 'form-row';
    div.style.marginBottom = '8px';
    div.innerHTML = `
      <div class="form-group"><input type="number" class="form-control" placeholder="充值金额"></div>
      <div class="form-group"><input type="number" class="form-control" placeholder="赠送金额"></div>
      <button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()" style="color:var(--danger);">✕</button>
    `;
    container.appendChild(div);
  }

  function saveTiers() {
    const rows = document.querySelectorAll('#tiersContainer .form-row');
    const tiers = [];
    rows.forEach((row) => {
      const inputs = row.querySelectorAll('input');
      const recharge = parseFloat(inputs[0].value);
      const bonus = parseFloat(inputs[1].value);
      if (recharge > 0) tiers.push({ recharge, bonus: bonus || 0 });
    });
    tiers.sort((a, b) => a.recharge - b.recharge);
    const user = Auth.currentUser();
    const existing = DB.find('storedValueRules', (r) => r.storeId === user.storeId);
    if (existing) {
      DB.update('storedValueRules', existing.id, { tiers });
    } else {
      DB.insert('storedValueRules', { storeId: user.storeId, tiers });
    }
    Toast.success('规则已保存');
    Modal.close();
    renderTab();
  }

  // ===== 积分规则 =====
  function renderPointsRules(c) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const rule = DB.find('pointsRules', (r) => r.storeId === storeId) || { enabled: false, ratio: 100, yuanPerPoint: 1, applicableType: 'all', expiryMonths: 12 };

    c.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>积分规则配置</h3></div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
            <label class="switch"><input type="checkbox" id="pointsEnabled" ${rule.enabled ? 'checked' : ''}></label>
            <span style="font-size:14px;font-weight:500;">启用积分功能</span>
          </div>
          <div id="pointsConfig" style="${rule.enabled ? '' : 'opacity:.5;pointer-events:none;'}">
            <div class="form-row">
              <div class="form-group">
                <label>积分抵扣比例</label>
                <div style="display:flex;align-items:center;gap:6px;">
                  <input type="number" class="form-control" id="pointsRatio" value="${rule.ratio}" style="width:80px;">
                  <span>积分 = </span>
                  <input type="number" class="form-control" id="pointsYuan" value="${rule.yuanPerPoint}" style="width:60px;">
                  <span>元</span>
                </div>
              </div>
              <div class="form-group">
                <label>积分有效期</label>
                <div style="display:flex;align-items:center;gap:6px;">
                  <input type="number" class="form-control" id="pointsExpiry" value="${rule.expiryMonths}" style="width:80px;">
                  <span>个月（默认 12 个月 = 1 年）</span>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label>积分抵扣商品范围</label>
              <select class="form-control" id="pointsApplicable" onchange="MembersView.togglePointsProducts(this.value)">
                <option value="all" ${rule.applicableType === 'all' ? 'selected' : ''}>全部商品</option>
                <option value="specified" ${rule.applicableType === 'specified' ? 'selected' : ''}>指定商品</option>
              </select>
            </div>
            <div id="pointsProducts" style="${rule.applicableType === 'specified' ? '' : 'display:none;'}">
              <p style="font-size:12px;color:var(--gray-500);">勾选支持积分抵扣的商品：</p>
              <div class="perm-grid">
                ${DB.filter('products', (p) => p.storeId === storeId).map((p) => `
                  <label class="perm-item">
                    <input type="checkbox" class="points-prod" value="${p.id}" ${(rule.applicableProductIds || []).includes(p.id) ? 'checked' : ''}>
                    ${p.name} (${p.spec})
                  </label>
                `).join('')}
              </div>
            </div>
            <div style="background:var(--warning-light);border-radius:6px;padding:10px;margin-top:12px;font-size:12px;color:var(--warning);">
              提示：收银台中已设置"积分商品"分类，该分类下的商品也支持积分兑换。积分到期后自动清零。
            </div>
            <button class="btn btn-primary" style="margin-top:16px;" onclick="MembersView.savePointsRules()">保存规则</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('pointsEnabled').addEventListener('change', (e) => {
      document.getElementById('pointsConfig').style.opacity = e.target.checked ? '1' : '.5';
      document.getElementById('pointsConfig').style.pointerEvents = e.target.checked ? '' : 'none';
    });
  }

  function togglePointsProducts(val) {
    document.getElementById('pointsProducts').style.display = val === 'specified' ? '' : 'none';
  }

  function savePointsRules() {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const enabled = document.getElementById('pointsEnabled').checked;
    const ratio = parseInt(document.getElementById('pointsRatio').value) || 100;
    const yuanPerPoint = parseInt(document.getElementById('pointsYuan').value) || 1;
    const expiryMonths = parseInt(document.getElementById('pointsExpiry').value) || 12;
    const applicableType = document.getElementById('pointsApplicable').value;
    const applicableProductIds = Array.from(document.querySelectorAll('.points-prod:checked')).map((c) => c.value);

    const existing = DB.find('pointsRules', (r) => r.storeId === storeId);
    const data = { enabled, ratio, yuanPerPoint, applicableType, applicableProductIds, expiryMonths, storeId };
    if (existing) {
      DB.update('pointsRules', existing.id, data);
    } else {
      DB.insert('pointsRules', data);
    }
    DB.log(user.id, storeId, 'update_points_rules', null, null, data);
    Toast.success('积分规则已保存');
  }

  // ===== 优惠券 =====
  function renderCouponList(c) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const coupons = DB.filter('coupons', (co) => co.storeId === storeId);

    c.innerHTML = `
      <div class="search-bar">
        <span class="spacer"></span>
        <button class="btn btn-primary btn-sm" onclick="MembersView.showCouponForm()">+ 新建优惠券</button>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>名称</th><th>类型</th><th>面额/条件</th><th>有效期</th><th>自动发放</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              ${coupons.length === 0 ? '<tr class="empty-row"><td colspan="7">暂无优惠券</td></tr>' : coupons.map((co) => {
                const typeMap = { fullCut: '满减券', voucher: '代金券', discount: '折扣券' };
                const desc = co.type === 'fullCut' ? `满${co.condition}减${co.value}` : co.type === 'voucher' ? `抵${co.value}元` : `${co.value}折`;
                return `
                  <tr>
                    <td style="font-weight:500;">${co.name}</td>
                    <td><span class="badge badge-info">${typeMap[co.type] || co.type}</span></td>
                    <td>${desc}</td>
                    <td style="font-size:12px;">${co.validFrom} ~ ${co.validTo}</td>
                    <td>${co.autoIssue ? `<span class="badge badge-success">${co.autoRule === 'register' ? '注册' : co.autoRule === 'birthday' ? '生日' : '消费满额'}自动发放</span>` : '<span class="badge badge-gray">手动发放</span>'}</td>
                    <td><span class="badge ${co.status === 'active' ? 'badge-success' : 'badge-gray'}">${co.status === 'active' ? '启用' : '停用'}</span></td>
                    <td>
                      <button class="btn btn-ghost btn-sm" onclick="MembersView.showCouponForm('${co.id}')">编辑</button>
                      <button class="btn btn-ghost btn-sm" onclick="MembersView.toggleCoupon('${co.id}')" style="color:var(--warning);">${co.status === 'active' ? '停用' : '启用'}</button>
                      <button class="btn btn-ghost btn-sm" onclick="MembersView.removeCoupon('${co.id}')" style="color:var(--danger);">删除</button>
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

  function showCouponForm(id) {
    const co = id ? DB.find('coupons', (x) => x.id === id) : {};
    Modal.show({
      title: id ? '编辑优惠券' : '新建优惠券',
      body: `
        <form id="couponForm">
          <div class="form-group">
            <label>优惠券名称 <span class="req">*</span></label>
            <input type="text" class="form-control" name="name" value="${co.name || ''}" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>类型</label>
              <select class="form-control" name="type" onchange="MembersView.onCouponTypeChange(this.value)">
                <option value="fullCut" ${co.type === 'fullCut' ? 'selected' : ''}>满减券</option>
                <option value="voucher" ${co.type === 'voucher' ? 'selected' : ''}>代金券</option>
                <option value="discount" ${co.type === 'discount' ? 'selected' : ''}>折扣券</option>
              </select>
            </div>
            <div class="form-group">
              <label>面额/折扣值 <span class="req">*</span></label>
              <input type="number" step="0.01" class="form-control" name="value" value="${co.value || ''}" required>
            </div>
          </div>
          <div class="form-group" id="conditionGroup" style="${co.type === 'fullCut' ? '' : 'display:none;'}">
            <label>满减条件（满多少元可用）</label>
            <input type="number" step="0.01" class="form-control" name="condition" value="${co.condition || 0}">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>生效日期</label>
              <input type="date" class="form-control" name="validFrom" value="${co.validFrom || new Date().toISOString().slice(0, 10)}">
            </div>
            <div class="form-group">
              <label>失效日期</label>
              <input type="date" class="form-control" name="validTo" value="${co.validTo || '2027-12-31'}">
            </div>
          </div>
          <div class="form-group">
            <label>发放方式</label>
            <div style="display:flex;align-items:center;gap:12px;">
              <label class="switch"><input type="checkbox" name="autoIssue" ${co.autoIssue ? 'checked' : ''} onchange="document.getElementById('autoRuleGroup').style.display=this.checked?'':'none'"></label>
              <span style="font-size:13px;">自动发放</span>
            </div>
          </div>
          <div class="form-group" id="autoRuleGroup" style="${co.autoIssue ? '' : 'display:none;'}">
            <label>自动发放规则</label>
            <select class="form-control" name="autoRule">
              <option value="register" ${co.autoRule === 'register' ? 'selected' : ''}>新会员注册时自动发放</option>
              <option value="birthday" ${co.autoRule === 'birthday' ? 'selected' : ''}>会员生日时自动发放</option>
              <option value="consume" ${co.autoRule === 'consume' ? 'selected' : ''}>消费满额时自动发放</option>
            </select>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="MembersView.saveCoupon('${id || ''}')">保存</button>
      `,
    });
  }

  function onCouponTypeChange(type) {
    document.getElementById('conditionGroup').style.display = type === 'fullCut' ? '' : 'none';
  }

  function saveCoupon(id) {
    const form = document.getElementById('couponForm');
    const fd = new FormData(form);
    const user = Auth.currentUser();
    const data = {
      name: fd.get('name'),
      type: fd.get('type'),
      value: parseFloat(fd.get('value')),
      condition: parseFloat(fd.get('condition')) || 0,
      validFrom: fd.get('validFrom'),
      validTo: fd.get('validTo'),
      autoIssue: fd.get('autoIssue') === 'on',
      autoRule: fd.get('autoRule'),
      storeId: user.storeId,
      status: 'active',
    };
    if (id) {
      DB.update('coupons', id, data);
      Toast.success('优惠券已更新');
    } else {
      DB.insert('coupons', data);
      Toast.success('优惠券已创建');
    }
    Modal.close();
    renderCouponList(document.getElementById('memberContent'));
  }

  function toggleCoupon(id) {
    const co = DB.find('coupons', (x) => x.id === id);
    DB.update('coupons', id, { status: co.status === 'active' ? 'inactive' : 'active' });
    Toast.success(co.status === 'active' ? '已停用' : '已启用');
    renderCouponList(document.getElementById('memberContent'));
  }

  function removeCoupon(id) {
    Modal.confirm('确定删除该优惠券？', () => {
      DB.remove('coupons', id);
      Toast.success('已删除');
      renderCouponList(document.getElementById('memberContent'));
    }, { danger: true });
  }

  return {
    render, renderCoupons, switchTab, search, showMemberForm, saveMember,
    removeMember, showMemberDetail, findRechargeMember, setRechargeAmount,
    doRecharge, editTiers, addTier, saveTiers, togglePointsProducts,
    savePointsRules, showCouponForm, onCouponTypeChange, saveCoupon,
    toggleCoupon, removeCoupon,
  };
})();
