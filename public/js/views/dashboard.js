/**
 * 工作台视图
 */
const DashboardView = (function () {
  function render(container) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const today = new Date().toISOString().slice(0, 10);
    const yesterdayDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // 今日销售
    const todayOrders = DB.filter('cashierOrders', (o) => o.storeId === storeId && o.createdAt.startsWith(today));
    const todaySales = todayOrders.reduce((s, o) => s + o.paidAmount, 0);
    const todayCount = todayOrders.length;

    // 昨日销售
    const yesterdayOrders = DB.filter('cashierOrders', (o) => o.storeId === storeId && o.createdAt.startsWith(yesterdayDate));
    const yesterdaySales = yesterdayOrders.reduce((s, o) => s + o.paidAmount, 0);
    const yesterdayCount = yesterdayOrders.length;

    // 本月销售
    const monthPrefix = today.slice(0, 7);
    const monthOrders = DB.filter('cashierOrders', (o) => o.storeId === storeId && o.createdAt.startsWith(monthPrefix));
    const monthSales = monthOrders.reduce((s, o) => s + o.paidAmount, 0);

    // 商品数
    const productCount = DB.filter('products', (p) => p.storeId === storeId && p.status === 'active').length;

    // 会员数
    const memberCount = DB.filter('members', (m) => m.storeId === storeId).length;

    // 库存预警（低于10）
    const products = DB.filter('products', (p) => p.storeId === storeId && p.status === 'active');
    const lowStock = products.filter((p) => App.getStockQuantity(storeId, p.id) < 10);

    // 近7天销售趋势
    const trendData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const orders = DB.filter('cashierOrders', (o) => o.storeId === storeId && o.createdAt.startsWith(ds));
      const sales = orders.reduce((s, o) => s + o.paidAmount, 0);
      trendData.push({ date: ds.slice(5), sales: Math.round(sales) });
    }

    // 热销商品 top5
    const productSales = {};
    monthOrders.forEach((o) => {
      o.items.forEach((item) => {
        if (!productSales[item.productId]) productSales[item.productId] = { name: item.name, qty: 0, amount: 0 };
        productSales[item.productId].qty += item.qty;
        productSales[item.productId].amount += item.amount;
      });
    });
    const topProducts = Object.values(productSales).sort((a, b) => b.qty - a.qty).slice(0, 5);

    const maxTrend = Math.max(...trendData.map((t) => t.sales), 1);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
    const updateTime = new Date().toLocaleString('zh-CN', { hour12: false });

    // 快捷操作权限过滤
    const quickActions = [
      { route: 'cashier', label: '收银台', icon: '🛒', perm: 'cashier' },
      { route: 'products', label: '商品管理', icon: '📦', perm: 'products' },
      { route: 'stockIn', label: '扫码入库', icon: '📥', perm: 'inventory_in' },
      { route: 'orders', label: '订单管理', icon: '🧾', perm: 'orders' },
      { route: 'members', label: '会员管理', icon: '👥', perm: 'members' },
      { route: 'settings', label: '系统设置', icon: '⚙️', perm: 'settings_store' },
    ].filter((a) => Auth.hasPermission(a.perm));

    container.innerHTML = `
      <div class="db-banner">
        <div class="db-banner-content">
          <div class="db-banner-title">${greeting}，${user.name}，今天的奋斗就是明天的美好</div>
          <div class="db-banner-subtitle">数据更新时间：${updateTime}</div>
        </div>
      </div>

      <div class="db-metrics">
        <div class="db-metric-item">
          <div class="value">${todayCount}</div>
          <div class="label">今日订单</div>
        </div>
        <div class="db-metric-item">
          <div class="value">${App.formatMoney(todaySales)}</div>
          <div class="label">今日销售额</div>
        </div>
        <div class="db-metric-item">
          <div class="value">${lowStock.length}</div>
          <div class="label">库存预警</div>
        </div>
        <div class="db-metric-item">
          <div class="value">${memberCount}</div>
          <div class="label">会员总数</div>
        </div>
        <div class="db-metric-item">
          <div class="value">${productCount}</div>
          <div class="label">在售商品</div>
        </div>
      </div>

      <div style="margin-bottom:20px;">
        <div class="db-section-title">店铺数据</div>
        <div class="stat-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom:0;">
          <div class="stat-card">
            <div class="stat-icon-box bg-blue">💰</div>
            <div class="stat-label">成交金额</div>
            <div class="stat-value">${App.formatMoney(todaySales)}</div>
            <div class="stat-trend">今日实时</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon-box bg-green">📋</div>
            <div class="stat-label">订单数</div>
            <div class="stat-value">${todayCount}</div>
            <div class="stat-trend">昨日：${yesterdayCount} 笔</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon-box bg-orange">👥</div>
            <div class="stat-label">会员数</div>
            <div class="stat-value">${memberCount}</div>
            <div class="stat-trend">累计会员</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon-box bg-purple">📦</div>
            <div class="stat-label">商品数</div>
            <div class="stat-value">${productCount}</div>
            <div class="stat-trend">${lowStock.length} 个库存预警</div>
          </div>
        </div>
      </div>

      <div class="db-main-grid">
        <div>
          <div class="card">
            <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
              <h3>交易数据</h3>
              <a onclick="App.navigate('reports')" style="font-size:13px;">数据统计 →</a>
            </div>
            <div class="card-body">
              <div class="bar-chart">
                ${trendData.map((t) => `
                  <div class="bar-col">
                    <div class="bar-value">${t.sales}</div>
                    <div class="bar" style="height:${(t.sales / maxTrend * 220)}px" title="${t.date}: ¥${t.sales}"></div>
                    <div class="bar-label">${t.date}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="card" style="margin-top:16px;">
            <div class="card-header"><h3>本月热销 TOP 5</h3></div>
            <div class="card-body">
              ${topProducts.length === 0 ? '<div class="empty-state"><div class="text">暂无销售数据</div></div>' : `
                <table class="data-table">
                  <thead><tr><th>排名</th><th>商品</th><th>销量</th><th>销售额</th></tr></thead>
                  <tbody>
                    ${topProducts.map((p, i) => `
                      <tr>
                        <td><span class="badge ${i < 3 ? 'badge-info' : 'badge-gray'}">${i + 1}</span></td>
                        <td>${p.name}</td>
                        <td>${p.qty}</td>
                        <td style="color:var(--danger);font-weight:500;">${App.formatMoney(p.amount)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}
            </div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:16px;">
          <div class="card">
            <div class="card-header"><h3>快捷操作</h3></div>
            <div class="card-body">
              <div class="db-quick-actions">
                ${quickActions.map((a) => `
                  <div class="db-quick-item" onclick="App.navigate('${a.route}')">
                    <div class="icon">${a.icon}</div>
                    <div class="label">${a.label}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>店铺提醒</h3></div>
            <div class="card-body">
              ${lowStock.length === 0 ? '<div class="empty-state"><div class="text">暂无提醒</div></div>' : `
                <div class="db-reminder-list">
                  ${lowStock.slice(0, 5).map((p) => `
                    <div class="db-reminder-item">
                      <div class="icon">⚠️</div>
                      <div class="content">
                        <div class="title">库存预警</div>
                        <div class="desc">${p.name}（${p.spec}）库存仅剩 ${App.getStockQuantity(storeId, p.id)}</div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>公告</h3></div>
            <div class="card-body">
              <div class="db-notice-list">
                <div class="db-notice-item"><span class="tag">通知</span><span>请定期备份本地数据，防止浏览器缓存清理</span></div>
                <div class="db-notice-item"><span class="tag">提示</span><span>库存预警阈值默认为 10，可在系统设置中调整</span></div>
                <div class="db-notice-item"><span class="tag">功能</span><span>收银台支持管理员/店长改价，员工无此权限</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return { render };
})();
