/**
 * 订单管理视图
 */
const OrdersView = (function () {
  let currentTab = 'all';
  let currentPage = 1;
  const pageSize = 10;
  let filters = { orderNo: '', phone: '', dateFrom: '', dateTo: '' };

  function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h2>订单管理</h2>
        <div class="actions">
          <button class="btn btn-outline" onclick="OrdersView.exportExcel()">
            <span>导出 Excel</span>
          </button>
        </div>
      </div>

      <div class="segment-tabs" id="orderTabs">
        <button class="seg-tab ${currentTab === 'all' ? 'active' : ''}" onclick="OrdersView.switchTab('all')">
          全部<span class="count" id="count-all">0</span>
        </button>
        <button class="seg-tab ${currentTab === 'completed' ? 'active' : ''}" onclick="OrdersView.switchTab('completed')">
          已完成<span class="count" id="count-completed">0</span>
        </button>
        <button class="seg-tab ${currentTab === 'unpaid' ? 'active' : ''}" onclick="OrdersView.switchTab('unpaid')">
          未付款<span class="count" id="count-unpaid">0</span>
        </button>
        <button class="seg-tab ${currentTab === 'refunded' ? 'active' : ''}" onclick="OrdersView.switchTab('refunded')">
          已退款<span class="count" id="count-refunded">0</span>
        </button>
      </div>

      <div class="filter-bar">
        <div class="filter-item">
          <label>订单号</label>
          <input type="text" class="form-control" id="fOrderNo" placeholder="输入订单号" value="${filters.orderNo}">
        </div>
        <div class="filter-item">
          <label>联系方式</label>
          <input type="text" class="form-control" id="fPhone" placeholder="会员手机号" value="${filters.phone}">
        </div>
        <div class="filter-item">
          <label>开始日期</label>
          <input type="date" class="form-control" id="fDateFrom" value="${filters.dateFrom}">
        </div>
        <div class="filter-item">
          <label>结束日期</label>
          <input type="date" class="form-control" id="fDateTo" value="${filters.dateTo}">
        </div>
        <button class="btn btn-primary btn-sm" onclick="OrdersView.applyFilter()">查询</button>
        <button class="btn btn-outline btn-sm" onclick="OrdersView.resetFilter()">重置</button>
      </div>

      <div class="card">
        <div class="table-wrap">
          <table class="data-table" id="ordersTable">
            ${renderTableContent()}
          </table>
        </div>
        <div id="ordersPagination" style="padding:12px 20px;"></div>
      </div>
    `;

    // 回车搜索
    document.getElementById('fOrderNo').addEventListener('keydown', (e) => { if (e.key === 'Enter') applyFilter(); });
    document.getElementById('fPhone').addEventListener('keydown', (e) => { if (e.key === 'Enter') applyFilter(); });
  }

  function getFilteredOrders() {
    const user = Auth.currentUser();
    let orders = DB.getAll('cashierOrders');

    // 数据隔离：管理员看全部，其他角色只看本店
    if (!Auth.isAdmin() && user.storeId) {
      orders = orders.filter((o) => o.storeId === user.storeId);
    }

    // tab 过滤
    if (currentTab !== 'all') {
      orders = orders.filter((o) => (o.status || 'completed') === currentTab);
    }

    // 搜索过滤
    if (filters.orderNo) {
      const kw = filters.orderNo.trim().toLowerCase();
      orders = orders.filter((o) => o.orderNo.toLowerCase().includes(kw));
    }
    if (filters.phone) {
      const kw = filters.phone.trim();
      orders = orders.filter((o) => {
        if (!o.memberId) return false;
        const member = DB.find('members', (m) => m.id === o.memberId);
        return member && member.phone.includes(kw);
      });
    }
    if (filters.dateFrom) {
      orders = orders.filter((o) => o.createdAt >= filters.dateFrom);
    }
    if (filters.dateTo) {
      const end = filters.dateTo + 'T23:59:59';
      orders = orders.filter((o) => o.createdAt <= end);
    }

    // 按时间倒序
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return orders;
  }

  function getCounts() {
    const user = Auth.currentUser();
    let orders = DB.getAll('cashierOrders');
    if (!Auth.isAdmin() && user.storeId) {
      orders = orders.filter((o) => o.storeId === user.storeId);
    }
    return {
      all: orders.length,
      completed: orders.filter((o) => (o.status || 'completed') === 'completed').length,
      unpaid: orders.filter((o) => o.status === 'unpaid').length,
      refunded: orders.filter((o) => o.status === 'refunded').length,
    };
  }

  function renderTableContent() {
    const allOrders = getFilteredOrders();
    const counts = getCounts();

    // 更新 tab 计数
    setTimeout(() => {
      const cAll = document.getElementById('count-all');
      const cComp = document.getElementById('count-completed');
      const cUnpaid = document.getElementById('count-unpaid');
      const cRef = document.getElementById('count-refunded');
      if (cAll) cAll.textContent = counts.all;
      if (cComp) cComp.textContent = counts.completed;
      if (cUnpaid) cUnpaid.textContent = counts.unpaid;
      if (cRef) cRef.textContent = counts.refunded;
    }, 0);

    const totalPages = Math.max(1, Math.ceil(allOrders.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * pageSize;
    const pageOrders = allOrders.slice(start, start + pageSize);

    if (pageOrders.length === 0) {
      return `<tbody><tr class="empty-row"><td colspan="7">暂无订单数据</td></tr></tbody>`;
    }

    const user = Auth.currentUser();
    return `
      <thead>
        <tr>
          <th>订单号</th>
          <th>商品</th>
          <th>订单金额</th>
          <th>支付方式</th>
          <th>状态</th>
          <th>创建时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${pageOrders.map((o) => {
          const status = o.status || 'completed';
          const statusInfo = getStatusInfo(status);
          const firstItem = o.items && o.items[0] ? o.items[0] : null;
          const itemCount = o.items ? o.items.length : 0;
          const product = firstItem ? DB.find('products', (p) => p.id === firstItem.productId) : null;
          const payMethodText = getPayMethodText(o.paymentMethod);
          const storeName = o.storeId ? (DB.find('stores', (s) => s.id === o.storeId) || {}).name || '-' : '-';

          return `
            <tr>
              <td style="font-weight:500;color:var(--s800);">${o.orderNo}</td>
              <td>
                <div class="order-goods-summary">
                  <div class="goods-thumb">
                    ${product && product.image ? `<img src="${product.image}" alt="">` : `<span>${firstItem ? (firstItem.name || '商')[0] : '商'}</span>`}
                  </div>
                  <div class="goods-info">
                    <div class="goods-name">${firstItem ? firstItem.name : '-'}</div>
                    <div class="goods-count">${itemCount > 1 ? '共 ' + itemCount + ' 件商品' : firstItem ? firstItem.spec : ''}</div>
                  </div>
                </div>
              </td>
              <td style="font-weight:600;color:var(--danger);">${App.formatMoney(o.paidAmount)}</td>
              <td><span class="badge badge-gray">${payMethodText}</span></td>
              <td>
                <span class="order-status ${status}">
                  <span class="dot"></span>${statusInfo.label}
                </span>
              </td>
              <td style="color:var(--s500);">${App.formatDateTime(o.createdAt)}</td>
              <td>
                <button class="btn btn-ghost btn-sm" onclick="OrdersView.showDetail('${o.id}')">详情</button>
                ${Auth.isAdmin() || Auth.isManager() ? `
                  ${status === 'completed' ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="OrdersView.refundOrder('${o.id}')">退款</button>` : ''}
                ` : ''}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    `;
  }

  function renderPagination() {
    const allOrders = getFilteredOrders();
    const totalPages = Math.max(1, Math.ceil(allOrders.length / pageSize));
    const el = document.getElementById('ordersPagination');
    if (!el) return;

    let html = '<div class="pagination">';
    html += `<button onclick="OrdersView.goPage(1)" ${currentPage === 1 ? 'disabled' : ''}>首页</button>`;
    html += `<button onclick="OrdersView.goPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>上一页</button>`;

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="${i === currentPage ? 'active' : ''}" onclick="OrdersView.goPage(${i})">${i}</button>`;
    }

    html += `<button onclick="OrdersView.goPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>下一页</button>`;
    html += `<button onclick="OrdersView.goPage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>末页</button>`;
    html += `<span class="page-info">共 ${allOrders.length} 条 / ${totalPages} 页</span>`;
    html += '</div>';
    el.innerHTML = html;
  }

  function getStatusInfo(status) {
    switch (status) {
      case 'completed': return { label: '已完成', color: 'success' };
      case 'unpaid': return { label: '未付款', color: 'warning' };
      case 'refunded': return { label: '已退款', color: 'gray' };
      default: return { label: '已完成', color: 'success' };
    }
  }

  function getPayMethodText(method) {
    switch (method) {
      case 'wechat': return '微信';
      case 'alipay': return '支付宝';
      case 'cash': return '现金';
      case 'qrcode': return '扫码';
      default: return method || '-';
    }
  }

  function switchTab(tab) {
    currentTab = tab;
    currentPage = 1;
    refreshTable();
  }

  function goPage(page) {
    currentPage = page;
    refreshTable();
  }

  function applyFilter() {
    filters.orderNo = document.getElementById('fOrderNo').value.trim();
    filters.phone = document.getElementById('fPhone').value.trim();
    filters.dateFrom = document.getElementById('fDateFrom').value;
    filters.dateTo = document.getElementById('fDateTo').value;
    currentPage = 1;
    refreshTable();
  }

  function resetFilter() {
    filters = { orderNo: '', phone: '', dateFrom: '', dateTo: '' };
    currentPage = 1;
    refreshTable();
  }

  function refreshTable() {
    const table = document.getElementById('ordersTable');
    if (table) {
      table.innerHTML = renderTableContent();
      renderPagination();
    }
  }

  function showDetail(orderId) {
    const order = DB.find('cashierOrders', (o) => o.id === orderId);
    if (!order) { Toast.error('订单不存在'); return; }

    const user = Auth.currentUser();
    const store = order.storeId ? DB.find('stores', (s) => s.id === order.storeId) : null;
    const operator = DB.find('users', (u) => u.id === order.operator);
    const member = order.memberId ? DB.find('members', (m) => m.id === order.memberId) : null;
    const status = order.status || 'completed';
    const statusInfo = getStatusInfo(status);
    const payMethodText = getPayMethodText(order.paymentMethod);

    Modal.show({
      title: '订单详情',
      size: 'lg',
      body: `
        <div class="order-detail-section">
          <div class="section-title">基本信息</div>
          <div class="desc-list">
            <dt>订单号</dt><dd style="font-weight:600;">${order.orderNo}</dd>
            <dt>订单状态</dt><dd><span class="badge badge-${statusInfo.color}">${statusInfo.label}</span></dd>
            <dt>创建时间</dt><dd>${App.formatDateTime(order.createdAt)}</dd>
            <dt>所属门店</dt><dd>${store ? store.name : '-'}</dd>
            <dt>收银员</dt><dd>${operator ? operator.name : '-'}</dd>
            <dt>支付方式</dt><dd>${payMethodText}</dd>
            ${member ? `<dt>会员</dt><dd>${member.name} (${member.phone})</dd>` : ''}
            ${order.note ? `<dt>备注</dt><dd>${order.note}</dd>` : ''}
          </div>
        </div>

        <div class="order-detail-section">
          <div class="section-title">商品明细</div>
          <table class="order-detail-table">
            <thead>
              <tr>
                <th>序号</th>
                <th>商品名称</th>
                <th>规格</th>
                <th style="text-align:center;">数量</th>
                <th style="text-align:right;">单价</th>
                <th style="text-align:right;">小计</th>
              </tr>
            </thead>
            <tbody>
              ${(order.items || []).map((item, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${item.name}</td>
                  <td>${item.spec || '-'}</td>
                  <td style="text-align:center;">${item.qty}</td>
                  <td style="text-align:right;">${App.formatMoney(item.price)}</td>
                  <td style="text-align:right;font-weight:600;">${App.formatMoney(item.amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="order-detail-summary">
          <div class="summary-item">
            <div class="summary-label">商品总额</div>
            <div style="font-size:16px;font-weight:600;color:var(--s800);">${App.formatMoney(order.totalAmount)}</div>
          </div>
          ${order.discount > 0 ? `
          <div class="summary-item">
            <div class="summary-label">优惠减免</div>
            <div style="font-size:16px;font-weight:600;color:var(--success);">-${App.formatMoney(order.discount)}</div>
          </div>
          ` : ''}
          <div class="summary-item">
            <div class="summary-label">实付金额</div>
            <div class="summary-value">${App.formatMoney(order.paidAmount)}</div>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">关闭</button>
        ${Auth.isAdmin() || Auth.isManager() ? `
          ${status === 'completed' ? `<button class="btn btn-danger" onclick="OrdersView.refundOrder('${order.id}')">退款</button>` : ''}
        ` : ''}
        <button class="btn btn-primary" onclick="OrdersView.printOrder('${order.id}')">打印小票</button>
      `,
    });
  }

  function refundOrder(orderId) {
    const order = DB.find('cashierOrders', (o) => o.id === orderId);
    if (!order) return;
    const status = order.status || 'completed';
    if (status !== 'completed') {
      Toast.warning('只有已完成的订单可以退款');
      return;
    }

    Modal.confirm(`确定要对订单 ${order.orderNo} 进行退款吗？退款后订单状态将变更为"已退款"，且不可恢复。`, () => {
      // 更新订单状态
      DB.update('cashierOrders', orderId, { status: 'refunded' });

      // 恢复库存
      if (order.items) {
        order.items.forEach((item) => {
          const product = DB.find('products', (p) => p.id === item.productId);
          if (!product) return;
          // 找到该商品最近的批次，加回去
          const inventory = DB.filter('inventory', (i) => i.storeId === order.storeId && i.productId === item.productId);
          if (inventory.length > 0) {
            // 加到最近一个批次
            const lastBatch = inventory[inventory.length - 1];
            DB.update('inventory', lastBatch.id, { quantity: lastBatch.quantity + item.qty });
          } else {
            // 没有批次则新建
            DB.insert('inventory', {
              storeId: order.storeId,
              productId: item.productId,
              batchNo: 'REF' + Date.now(),
              quantity: item.qty,
              productionDate: new Date().toISOString().slice(0, 10),
              expiryDate: '2028-12-31',
              cost: product.cost || 0,
              supplierId: null,
            });
          }
        });
      }

      // 退还会员积分
      if (order.memberId) {
        const member = DB.find('members', (m) => m.id === order.memberId);
        if (member) {
          // 简单处理：退还按实付金额计算的积分
          const pointsRule = DB.find('pointsRules', (r) => r.storeId === order.storeId);
          if (pointsRule && pointsRule.enabled) {
            const earnedPoints = Math.floor(order.paidAmount);
            DB.update('members', member.id, {
              points: Math.max(0, member.points - earnedPoints),
            });
          }
        }
      }

      // 记录日志
      const user = Auth.currentUser();
      DB.log(user.id, order.storeId, 'order_refund', order.orderNo, { status: 'completed' }, { status: 'refunded' });

      Toast.success('退款成功');
      Modal.close();
      refreshTable();
    }, { title: '确认退款', danger: true, confirmText: '确认退款' });
  }

  function printOrder(orderId) {
    const order = DB.find('cashierOrders', (o) => o.id === orderId);
    if (!order) return;
    const store = order.storeId ? DB.find('stores', (s) => s.id === order.storeId) : null;
    const tpl = DB.find('receiptTemplates', (r) => r.storeId === order.storeId) || {};
    const operator = DB.find('users', (u) => u.id === order.operator);

    document.getElementById('modal-container').innerHTML = '';
    Modal.show({
      title: '销售小票',
      body: `
        <div class="receipt-preview" id="receiptPreview">
          ${tpl.logoUrl ? `<div class="r-center"><img src="${tpl.logoUrl}" alt="店招"></div>` : ''}
          ${tpl.showStoreName ? `<div class="r-center r-bold" style="font-size:14px;margin:4px 0;">${store ? store.name : ''}</div>` : ''}
          ${tpl.header ? `<div class="r-center">${tpl.header}</div>` : ''}
          ${tpl.showPhone && store ? `<div class="r-center">Tel: ${store.phone}</div>` : ''}
          <div style="border-top:1px dashed #000;margin:4px 0;"></div>
          ${tpl.showDateTime ? `<div class="r-row"><span>${App.formatDateTime(order.createdAt)}</span></div>` : ''}
          ${tpl.showOperator ? `<div class="r-row"><span>收银员: ${operator ? operator.name : ''}</span></div>` : ''}
          <div class="r-row"><span>单号: ${order.orderNo}</span></div>
          <div style="border-top:1px dashed #000;margin:4px 0;"></div>
          <table>
            <thead>
              <tr><td style="font-weight:bold;">序号</td><td style="font-weight:bold;">商品</td><td style="font-weight:bold;">规格</td><td style="font-weight:bold;" align="center">数量</td><td style="font-weight:bold;" align="right">单价</td><td style="font-weight:bold;" align="right">价格</td></tr>
            </thead>
            <tbody>
              ${order.items.map((item, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${item.name}</td>
                  <td>${item.spec}</td>
                  <td align="center">${item.qty}</td>
                  <td align="right">${item.price.toFixed(2)}</td>
                  <td align="right">${item.amount.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="border-top:1px dashed #000;margin:4px 0;"></div>
          <div class="r-row"><span>合计</span><span>¥${order.totalAmount.toFixed(2)}</span></div>
          ${order.discount > 0 ? `<div class="r-row"><span>优惠</span><span>-¥${order.discount.toFixed(2)}</span></div>` : ''}
          <div class="r-row r-bold"><span>实付</span><span>¥${order.paidAmount.toFixed(2)}</span></div>
          <div style="border-top:1px dashed #000;margin:4px 0;"></div>
          ${tpl.qrcodeUrl ? `<div class="r-center"><img src="${tpl.qrcodeUrl}" alt="二维码" style="max-width:80px;max-height:80px;"></div>` : ''}
          ${tpl.footer ? `<div class="r-center">${tpl.footer}</div>` : ''}
        </div>
      `,
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">关闭</button>
        <button class="btn btn-primary" onclick="OrdersView.doPrint()">打印小票</button>
      `,
    });
  }

  function doPrint() {
    const content = document.getElementById('receiptPreview');
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>打印小票</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 8px; width: 58mm; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 1px 0; }
        .r-center { text-align: center; }
        .r-bold { font-weight: bold; }
        .r-row { display: flex; justify-content: space-between; }
        img { max-width: 100%; max-height: 60px; }
      </style>
      </head><body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

  function exportExcel() {
    const orders = getFilteredOrders();
    if (orders.length === 0) {
      Toast.warning('暂无订单数据可导出');
      return;
    }

    const headers = ['订单号', '商品', '规格', '数量', '单价', '商品总额', '优惠金额', '实付金额', '支付方式', '状态', '会员', '收银员', '创建时间'];
    const rows = [];

    orders.forEach((o) => {
      const status = o.status || 'completed';
      const statusText = getStatusInfo(status).label;
      const payText = getPayMethodText(o.paymentMethod);
      const operator = DB.find('users', (u) => u.id === o.operator);
      const member = o.memberId ? DB.find('members', (m) => m.id === o.memberId) : null;

      if (o.items && o.items.length > 0) {
        o.items.forEach((item) => {
          rows.push([
            o.orderNo,
            item.name,
            item.spec || '',
            item.qty,
            item.price.toFixed(2),
            '',
            '',
            '',
            payText,
            statusText,
            member ? member.name + ' ' + member.phone : '',
            operator ? operator.name : '',
            App.formatDateTime(o.createdAt),
          ]);
        });
        // 合计行
        rows.push([
          '',
          '合计',
          '',
          '',
          '',
          o.totalAmount.toFixed(2),
          o.discount.toFixed(2),
          o.paidAmount.toFixed(2),
          '',
          '',
          '',
          '',
          '',
        ]);
      }
    });

    exportToExcel('订单列表_' + new Date().toISOString().slice(0, 10), headers, rows);
  }

  return {
    render, switchTab, goPage, applyFilter, resetFilter,
    showDetail, refundOrder, printOrder, doPrint, exportExcel,
  };
})();
