/**
 * 数据统计视图
 */
const ReportsView = (function () {
  let period = 'daily';
  let customStart = '';
  let customEnd = '';
  let currentTab = 'sales';

  function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h2>数据统计</h2>
        <div class="actions">
          <button class="btn btn-success btn-sm" onclick="ReportsView.exportExcel()">📥 导出 Excel</button>
        </div>
      </div>
      <div class="tabs">
        <div class="tab ${currentTab === 'sales' ? 'active' : ''}" onclick="ReportsView.switchTab('sales')">销售统计</div>
        <div class="tab ${currentTab === 'product' ? 'active' : ''}" onclick="ReportsView.switchTab('product')">商品销量</div>
        <div class="tab ${currentTab === 'category' ? 'active' : ''}" onclick="ReportsView.switchTab('category')">品类分析</div>
        <div class="tab ${currentTab === 'orders' ? 'active' : ''}" onclick="ReportsView.switchTab('orders')">订单明细</div>
      </div>
      <div class="search-bar">
        <label style="font-size:13px;color:var(--gray-600);">统计周期：</label>
        <select class="form-control" id="periodSelect" onchange="ReportsView.changePeriod(this.value)" style="width:auto;">
          <option value="daily" ${period === 'daily' ? 'selected' : ''}>按日</option>
          <option value="weekly" ${period === 'weekly' ? 'selected' : ''}>按周</option>
          <option value="monthly" ${period === 'monthly' ? 'selected' : ''}>按月</option>
          <option value="quarterly" ${period === 'quarterly' ? 'selected' : ''}>按季</option>
          <option value="yearly" ${period === 'yearly' ? 'selected' : ''}>按年</option>
        </select>
        <span style="font-size:13px;color:var(--gray-500);">或</span>
        <input type="date" class="form-control" id="customStart" value="${customStart}" style="width:auto;" onchange="ReportsView.setCustomRange()">
        <span style="font-size:13px;">至</span>
        <input type="date" class="form-control" id="customEnd" value="${customEnd}" style="width:auto;" onchange="ReportsView.setCustomRange()">
      </div>
      <div id="reportContent"></div>
    `;
    renderTab();
  }

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    event.target.classList.add('active');
    renderTab();
  }

  function changePeriod(p) {
    period = p;
    customStart = '';
    customEnd = '';
    document.getElementById('customStart').value = '';
    document.getElementById('customEnd').value = '';
    renderTab();
  }

  function setCustomRange() {
    customStart = document.getElementById('customStart').value;
    customEnd = document.getElementById('customEnd').value;
    if (customStart && customEnd) renderTab();
  }

  function getDateRange() {
    if (customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    let start;
    switch (period) {
      case 'daily':
        start = today;
        break;
      case 'weekly':
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);
        start = weekStart.toISOString().slice(0, 10);
        break;
      case 'monthly':
        start = now.toISOString().slice(0, 8) + '01';
        break;
      case 'quarterly':
        const q = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), q * 3, 1).toISOString().slice(0, 10);
        break;
      case 'yearly':
        start = now.getFullYear() + '-01-01';
        break;
      default:
        start = today;
    }
    return { start, end: today };
  }

  function getOrders() {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const { start, end } = getDateRange();
    return DB.filter('cashierOrders', (o) => o.storeId === storeId && o.createdAt >= start && o.createdAt <= end + 'T23:59:59');
  }

  function renderTab() {
    const c = document.getElementById('reportContent');
    if (currentTab === 'sales') renderSales(c);
    else if (currentTab === 'product') renderProductSales(c);
    else if (currentTab === 'category') renderCategoryAnalysis(c);
    else renderOrders(c);
  }

  // ===== 销售统计 =====
  function renderSales(c) {
    const orders = getOrders();
    const totalSales = orders.reduce((s, o) => s + o.paidAmount, 0);
    const totalDiscount = orders.reduce((s, o) => s + (o.discount || 0), 0);
    const avgOrder = orders.length > 0 ? totalSales / orders.length : 0;

    // 按日期分组
    const dailyMap = {};
    orders.forEach((o) => {
      const day = o.createdAt.slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { sales: 0, count: 0 };
      dailyMap[day].sales += o.paidAmount;
      dailyMap[day].count++;
    });
    const dailyData = Object.entries(dailyMap).sort((a, b) => a[0].localeCompare(b[0]));
    const maxSales = Math.max(...dailyData.map((d) => d[1].sales), 1);

    const { start, end } = getDateRange();

    c.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-icon">💰</div>
          <div class="stat-label">总销售额</div>
          <div class="stat-value">${App.formatMoney(totalSales)}</div>
          <div class="stat-trend">${start} ~ ${end}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📋</div>
          <div class="stat-label">订单数</div>
          <div class="stat-value">${orders.length}</div>
          <div class="stat-trend">笔订单</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-label">客单价</div>
          <div class="stat-value">${App.formatMoney(avgOrder)}</div>
          <div class="stat-trend">平均每单</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🏷️</div>
          <div class="stat-label">优惠总额</div>
          <div class="stat-value">${App.formatMoney(totalDiscount)}</div>
          <div class="stat-trend">折扣/券/积分</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>销售趋势</h3></div>
        <div class="card-body">
          ${dailyData.length === 0 ? '<div class="empty-state"><div class="text">暂无数据</div></div>' : `
            <div class="bar-chart" style="height:260px;">
              ${dailyData.map(([day, d]) => `
                <div class="bar-col">
                  <div class="bar-value">¥${Math.round(d.sales)}</div>
                  <div class="bar" style="height:${(d.sales / maxSales * 220)}px" title="${day}: ¥${d.sales.toFixed(2)} (${d.count}笔)"></div>
                  <div class="bar-label">${day.slice(5)}</div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
      <div class="card" style="margin-top:16px;">
        <div class="card-header"><h3>每日明细</h3></div>
        <div class="card-body">
          <table class="data-table">
            <thead><tr><th>日期</th><th>订单数</th><th>销售额</th><th>优惠</th><th>客单价</th></tr></thead>
            <tbody>
              ${dailyData.length === 0 ? '<tr class="empty-row"><td colspan="5">暂无数据</td></tr>' : dailyData.reverse().map(([day, d]) => `
                <tr>
                  <td>${day}</td>
                  <td>${d.count}</td>
                  <td style="color:var(--danger);font-weight:500;">${App.formatMoney(d.sales)}</td>
                  <td>-</td>
                  <td>${App.formatMoney(d.sales / d.count)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ===== 商品销量 =====
  function renderProductSales(c) {
    const orders = getOrders();
    const productMap = {};
    orders.forEach((o) => {
      o.items.forEach((item) => {
        const key = item.productId;
        if (!productMap[key]) {
          const product = DB.find('products', (p) => p.id === item.productId);
          productMap[key] = {
            productId: item.productId,
            name: item.name,
            spec: item.spec,
            category: product ? App.getCategoryName(product.categoryId) : '-',
            qty: 0,
            amount: 0,
            orderCount: 0,
          };
        }
        productMap[key].qty += item.qty;
        productMap[key].amount += item.amount;
        productMap[key].orderCount++;
      });
    });
    const sorted = Object.values(productMap).sort((a, b) => b.amount - a.amount);

    c.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>商品销量排行</h3></div>
        <div class="card-body">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>排名</th><th>商品</th><th>规格</th><th>品类</th><th>销量</th><th>销售额</th><th>订单次数</th></tr></thead>
              <tbody>
                ${sorted.length === 0 ? '<tr class="empty-row"><td colspan="7">暂无数据</td></tr>' : sorted.map((p, i) => `
                  <tr>
                    <td><span class="badge ${i < 3 ? 'badge-info' : 'badge-gray'}">${i + 1}</span></td>
                    <td style="font-weight:500;">${p.name}</td>
                    <td>${p.spec}</td>
                    <td>${p.category}</td>
                    <td>${p.qty}</td>
                    <td style="color:var(--danger);font-weight:500;">${App.formatMoney(p.amount)}</td>
                    <td>${p.orderCount}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ===== 品类分析 =====
  function renderCategoryAnalysis(c) {
    const orders = getOrders();
    const catMap = {};
    orders.forEach((o) => {
      o.items.forEach((item) => {
        const product = DB.find('products', (p) => p.id === item.productId);
        const catName = product ? App.getCategoryName(product.categoryId) : '未分类';
        if (!catMap[catName]) catMap[catName] = { qty: 0, amount: 0, count: 0 };
        catMap[catName].qty += item.qty;
        catMap[catName].amount += item.amount;
        catMap[catName].count++;
      });
    });
    const sorted = Object.entries(catMap).sort((a, b) => b[1].amount - a[1].amount);
    const totalAmount = sorted.reduce((s, [_, d]) => s + d.amount, 0);

    c.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>品类销售分析</h3></div>
        <div class="card-body">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>品类</th><th>销量</th><th>销售额</th><th>占比</th><th>订单次数</th></tr></thead>
              <tbody>
                ${sorted.length === 0 ? '<tr class="empty-row"><td colspan="5">暂无数据</td></tr>' : sorted.map(([cat, d]) => `
                  <tr>
                    <td style="font-weight:500;">${cat}</td>
                    <td>${d.qty}</td>
                    <td style="color:var(--danger);font-weight:500;">${App.formatMoney(d.amount)}</td>
                    <td>${totalAmount > 0 ? (d.amount / totalAmount * 100).toFixed(1) : 0}%</td>
                    <td>${d.count}</td>
                  </tr>
                `).join('')}
              </tbody>
              ${sorted.length > 0 ? `
                <tfoot>
                  <tr style="font-weight:600;background:var(--gray-50);">
                    <td>合计</td>
                    <td>${sorted.reduce((s, [_, d]) => s + d.qty, 0)}</td>
                    <td style="color:var(--danger);">${App.formatMoney(totalAmount)}</td>
                    <td>100%</td>
                    <td>-</td>
                  </tr>
                </tfoot>
              ` : ''}
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ===== 订单明细 =====
  function renderOrders(c) {
    const orders = getOrders().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    c.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>订单明细 (${orders.length} 笔)</h3></div>
        <div class="card-body">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>订单号</th><th>商品</th><th>数量</th><th>原价</th><th>优惠</th><th>实付</th><th>支付方式</th><th>会员</th><th>收银员</th><th>时间</th></tr></thead>
              <tbody>
                ${orders.length === 0 ? '<tr class="empty-row"><td colspan="10">暂无订单</td></tr>' : orders.slice(0, 100).map((o) => {
                  const operator = DB.find('users', (u) => u.id === o.operator);
                  const member = o.memberId ? DB.find('members', (m) => m.id === o.memberId) : null;
                  const payMap = { wechat: '微信', alipay: '支付宝', cash: '现金', balance: '储值' };
                  return `
                    <tr>
                      <td style="font-family:monospace;font-size:12px;">${o.orderNo}</td>
                      <td style="font-size:12px;max-width:200px;">${o.items.map((i) => i.name + '×' + i.qty).join(', ')}</td>
                      <td>${o.items.reduce((s, i) => s + i.qty, 0)}</td>
                      <td>${App.formatMoney(o.totalAmount)}</td>
                      <td style="color:var(--success);">${o.discount > 0 ? '-' + App.formatMoney(o.discount) : '-'}</td>
                      <td style="color:var(--danger);font-weight:500;">${App.formatMoney(o.paidAmount)}</td>
                      <td><span class="badge badge-gray">${payMap[o.paymentMethod] || o.paymentMethod}</span></td>
                      <td>${member ? member.name : '<span style="color:var(--gray-400);">散客</span>'}</td>
                      <td>${operator ? operator.name : '-'}</td>
                      <td style="font-size:12px;">${App.formatDateTime(o.createdAt)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          ${orders.length > 100 ? '<p style="text-align:center;color:var(--gray-400);margin-top:8px;font-size:12px;">仅显示最近 100 条，如需完整数据请导出 Excel</p>' : ''}
        </div>
      </div>
    `;
  }

  // ===== 导出 Excel =====
  function exportExcel() {
    const orders = getOrders();
    if (orders.length === 0) { Toast.warning('当前没有可导出的数据'); return; }

    const { start, end } = getDateRange();
    const productMap = {};
    orders.forEach((o) => {
      o.items.forEach((item) => {
        const key = item.productId + '_' + item.spec;
        if (!productMap[key]) {
          const product = DB.find('products', (p) => p.id === item.productId);
          productMap[key] = {
            name: item.name,
            spec: item.spec,
            category: product ? App.getCategoryName(product.categoryId) : '-',
            qty: 0,
            amount: 0,
          };
        }
        productMap[key].qty += item.qty;
        productMap[key].amount += item.amount;
      });
    });

    // 商品销量明细
    const headers = ['商品', '品类', '规格', '销量', '销售额'];
    const rows = Object.values(productMap).sort((a, b) => b.amount - a.amount).map((p) => [
      p.name, p.category, p.spec, p.qty, p.amount.toFixed(2),
    ]);

    // 汇总行
    rows.push(['合计', '', '', rows.reduce((s, r) => s + r[3], 0), rows.reduce((s, r) => s + parseFloat(r[4]), 0).toFixed(2)]);

    // 订单明细 sheet
    const orderHeaders = ['订单号', '商品', '规格', '数量', '单价', '小计', '原价', '优惠', '实付', '支付方式', '会员', '收银员', '时间'];
    const orderRows = [];
    orders.forEach((o) => {
      const operator = DB.find('users', (u) => u.id === o.operator);
      const member = o.memberId ? DB.find('members', (m) => m.id === o.memberId) : null;
      const payMap = { wechat: '微信', alipay: '支付宝', cash: '现金', balance: '储值' };
      o.items.forEach((item) => {
        orderRows.push([
          o.orderNo, item.name, item.spec, item.qty, item.price.toFixed(2),
          item.amount.toFixed(2), o.totalAmount.toFixed(2), (o.discount || 0).toFixed(2),
          o.paidAmount.toFixed(2), payMap[o.paymentMethod] || o.paymentMethod,
          member ? member.name : '散客', operator ? operator.name : '-', App.formatDateTime(o.createdAt),
        ]);
      });
    });

    // 合并到两个 sheet 的数据，先导出商品销量
    exportToExcel(`销量报表_${start}_${end}`, headers, rows);
    setTimeout(() => {
      exportToExcel(`订单明细_${start}_${end}`, orderHeaders, orderRows);
    }, 500);
  }

  return {
    render, switchTab, changePeriod, setCustomRange, exportExcel,
  };
})();
