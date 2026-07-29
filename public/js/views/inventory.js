/**
 * 库存管理视图 - 入库/出库/查询/调拨
 */
const InventoryView = (function () {
  // ===== 库存查询 =====
  function renderQuery(container) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const products = DB.filter('products', (p) => p.storeId === storeId && p.status === 'active');

    container.innerHTML = `
      <div class="page-header">
        <h2>库存查询</h2>
        <div class="actions">
          <button class="btn btn-outline btn-sm" onclick="InventoryView.printInventory()">🖨 打印库存清单</button>
        </div>
      </div>
      <div class="search-bar">
        <input type="text" class="form-control" id="invSearch" placeholder="搜索商品名/条码" oninput="InventoryView.filterQuery(this.value)">
        <select class="form-control" id="invCatFilter" onchange="InventoryView.filterQuery()">
          <option value="">全部分类</option>
          ${DB.filter('categories', (c) => c.storeId === storeId && c.type === 'product').map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
        <span class="spacer"></span>
        <span style="font-size:12px;color:var(--gray-500);">共 ${products.length} 种商品</span>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="data-table" id="invTable">
            <thead><tr><th>商品</th><th>分类</th><th>规格</th><th>条码</th><th>总库存</th><th>批次明细</th><th>状态</th></tr></thead>
            <tbody>
              ${products.map((p) => {
                const stock = App.getStockQuantity(storeId, p.id);
                const batches = DB.filter('inventory', (i) => i.storeId === storeId && i.productId === p.id && i.quantity > 0);
                const expiringBatches = batches.filter((b) => {
                  const days = App.daysBetween(new Date().toISOString(), b.expiryDate);
                  return days <= 30;
                });
                return `
                  <tr>
                    <td style="font-weight:500;">${p.name}</td>
                    <td>${App.getCategoryName(p.categoryId)}</td>
                    <td>${p.spec}</td>
                    <td style="font-family:monospace;">${p.barcode}</td>
                    <td><span class="badge ${stock === 0 ? 'badge-danger' : stock < 10 ? 'badge-warning' : 'badge-success'}" style="font-size:13px;">${stock} ${p.unit}</span></td>
                    <td>
                      ${batches.length === 0 ? '<span style="color:var(--gray-400);">无批次</span>' : batches.map((b) => {
                        const days = App.daysBetween(new Date().toISOString(), b.expiryDate);
                        return `<span class="badge ${days <= 30 ? 'badge-danger' : days <= 90 ? 'badge-warning' : 'badge-gray'}" style="margin:2px;">批次${b.batchNo.slice(-4)}: ${b.quantity} | 到期${b.expiryDate}</span>`;
                      }).join('')}
                    </td>
                    <td>${stock === 0 ? '<span class="badge badge-danger">缺货</span>' : expiringBatches.length > 0 ? '<span class="badge badge-warning">临期</span>' : '<span class="badge badge-success">正常</span>'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function filterQuery(kw) {
    const rows = document.querySelectorAll('#invTable tbody tr');
    const catFilter = document.getElementById('invCatFilter');
    const catVal = catFilter ? catFilter.value : '';
    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      const show = (!kw || text.includes(kw.toLowerCase())) && (!catVal || text.includes(App.getCategoryName(catVal)));
      row.style.display = show ? '' : 'none';
    });
  }

  function printInventory() {
    window.print();
  }

  // ===== 扫码入库 =====
  function renderStockIn(container) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const suppliers = DB.filter('suppliers', (s) => s.storeId === storeId);

    container.innerHTML = `
      <div class="page-header">
        <h2>扫码入库</h2>
        <div class="actions">
          <span style="font-size:12px;color:var(--gray-500);">将光标聚焦在扫码框，用扫码枪扫描商品条码即可自动添加</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="card">
          <div class="card-header"><h3>入库信息</h3></div>
          <div class="card-body">
            <div class="form-group">
              <label>扫码 / 搜索商品</label>
              <input type="text" class="form-control" id="stockInScan" placeholder="扫码枪扫描或输入条码" data-scan="true" autofocus>
            </div>
            <div class="form-group">
              <label>供应商</label>
              <select class="form-control" id="stockInSupplier">
                <option value="">不关联供应商</option>
                ${suppliers.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>批次号</label>
                <input type="text" class="form-control" id="stockInBatch" placeholder="留空自动生成">
              </div>
              <div class="form-group">
                <label>生产日期</label>
                <input type="date" class="form-control" id="stockInProdDate" value="${new Date().toISOString().slice(0,10)}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>到期日期</label>
                <input type="date" class="form-control" id="stockInExpDate" value="2028-12-31">
              </div>
              <div class="form-group">
                <label>备注</label>
                <input type="text" class="form-control" id="stockInNote" placeholder="可选">
              </div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3>入库明细</h3>
            <button class="btn btn-success btn-sm" onclick="InventoryView.submitStockIn()">确认入库</button>
          </div>
          <div class="card-body" style="max-height:400px;overflow-y:auto;">
            <table class="data-table" id="stockInItems">
              <thead><tr><th>商品</th><th>规格</th><th>数量</th><th>成本</th><th>小计</th><th></th></tr></thead>
              <tbody>
                <tr class="empty-row"><td colspan="6">扫描商品条码后自动添加到列表</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // 扫码监听
    const scanInput = document.getElementById('stockInScan');
    scanInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const code = scanInput.value.trim();
        if (code) {
          addStockInItem(code);
          scanInput.value = '';
        }
      }
    });
    scanInput.focus();
  }

  let stockInItems = [];

  function addStockInItem(barcode) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    let product = DB.find('products', (p) => p.storeId === storeId && p.barcode === barcode);
    if (!product) {
      // 尝试名称搜索
      product = DB.find('products', (p) => p.storeId === storeId && p.name.includes(barcode));
    }
    if (!product) {
      Toast.error('未找到条码为 ' + barcode + ' 的商品，请先在商品管理中添加');
      return;
    }
    const existing = stockInItems.find((i) => i.productId === product.id);
    if (existing) {
      existing.qty += 1;
    } else {
      stockInItems.push({
        productId: product.id,
        name: product.name,
        spec: product.spec,
        unit: product.unit,
        barcode: product.barcode,
        qty: 1,
        cost: product.cost,
      });
    }
    renderStockInItems();
    Toast.success(product.name + ' 已添加');
  }

  function renderStockInItems() {
    const tbody = document.querySelector('#stockInItems tbody');
    if (stockInItems.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6">扫描商品条码后自动添加到列表</td></tr>';
      return;
    }
    tbody.innerHTML = stockInItems.map((item, idx) => `
      <tr>
        <td style="font-weight:500;">${item.name}</td>
        <td>${item.spec}</td>
        <td>
          <div class="qty-control">
            <button onclick="InventoryView.changeQty(${idx}, -1)">-</button>
            <input type="number" class="qty-val" value="${item.qty}" onchange="InventoryView.setQty(${idx}, this.value)">
            <button onclick="InventoryView.changeQty(${idx}, 1)">+</button>
          </div>
        </td>
        <td><input type="number" step="0.01" value="${item.cost}" style="width:70px;" onchange="InventoryView.setCost(${idx}, this.value)"></td>
        <td style="font-weight:500;">${App.formatMoney(item.qty * item.cost)}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="InventoryView.removeStockInItem(${idx})" style="color:var(--danger);">✕</button></td>
      </tr>
    `).join('');
  }

  function changeQty(idx, delta) {
    stockInItems[idx].qty = Math.max(1, stockInItems[idx].qty + delta);
    renderStockInItems();
  }

  function setQty(idx, val) {
    stockInItems[idx].qty = Math.max(1, parseInt(val) || 1);
    renderStockInItems();
  }

  function setCost(idx, val) {
    stockInItems[idx].cost = parseFloat(val) || 0;
    renderStockInItems();
  }

  function removeStockInItem(idx) {
    stockInItems.splice(idx, 1);
    renderStockInItems();
  }

  function submitStockIn() {
    if (stockInItems.length === 0) { Toast.warning('请先添加入库商品'); return; }
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const supplierId = document.getElementById('stockInSupplier').value || null;
    const batchNo = document.getElementById('stockInBatch').value || 'B' + Date.now();
    const prodDate = document.getElementById('stockInProdDate').value;
    const expDate = document.getElementById('stockInExpDate').value;
    const note = document.getElementById('stockInNote').value;

    const items = [];
    let totalAmount = 0;
    stockInItems.forEach((item) => {
      DB.insert('inventory', {
        storeId,
        productId: item.productId,
        batchNo,
        quantity: item.qty,
        productionDate: prodDate,
        expiryDate: expDate,
        cost: item.cost,
        supplierId,
      });
      items.push({ ...item, amount: item.qty * item.cost });
      totalAmount += item.qty * item.cost;
    });

    DB.insert('stockInOrders', {
      storeId,
      items,
      supplierId,
      totalAmount,
      batchNo,
      productionDate: prodDate,
      expiryDate: expDate,
      operator: user.id,
      note,
    });
    DB.log(user.id, storeId, 'stock_in', '入库单 ' + batchNo, null, { itemCount: items.length, totalAmount });

    Toast.success('入库成功，共 ' + items.length + ' 种商品');
    stockInItems = [];
    App.navigate('inventory');
  }

  // ===== 扫码出库 =====
  function renderStockOut(container) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const suppliers = DB.filter('suppliers', (s) => s.storeId === storeId);

    container.innerHTML = `
      <div class="page-header">
        <h2>扫码出库</h2>
        <div class="actions">
          <span style="font-size:12px;color:var(--gray-500);">将光标聚焦在扫码框，用扫码枪扫描商品条码即可自动添加</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="card">
          <div class="card-header"><h3>出库信息</h3></div>
          <div class="card-body">
            <div class="form-group">
              <label>扫码 / 搜索商品</label>
              <input type="text" class="form-control" id="stockOutScan" placeholder="扫码枪扫描或输入条码" data-scan="true" autofocus>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>出库类型 <span class="req">*</span></label>
                <select class="form-control" id="stockOutType">
                  <option value="damage">报损</option>
                  <option value="internal">内部领用</option>
                  <option value="return">退货给供应商</option>
                </select>
              </div>
              <div class="form-group" id="returnSupplierGroup" style="display:none;">
                <label>退货供应商</label>
                <select class="form-control" id="stockOutSupplier">
                  ${suppliers.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>备注</label>
              <input type="text" class="form-control" id="stockOutNote" placeholder="可选">
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3>出库明细</h3>
            <button class="btn btn-warning btn-sm" onclick="InventoryView.submitStockOut()">确认出库</button>
          </div>
          <div class="card-body" style="max-height:400px;overflow-y:auto;">
            <table class="data-table" id="stockOutItems">
              <thead><tr><th>商品</th><th>规格</th><th>当前库存</th><th>出库数量</th><th></th></tr></thead>
              <tbody>
                <tr class="empty-row"><td colspan="5">扫描商品条码后自动添加到列表</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.getElementById('stockOutType').addEventListener('change', (e) => {
      document.getElementById('returnSupplierGroup').style.display = e.target.value === 'return' ? '' : 'none';
    });

    const scanInput = document.getElementById('stockOutScan');
    scanInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const code = scanInput.value.trim();
        if (code) {
          addStockOutItem(code);
          scanInput.value = '';
        }
      }
    });
    scanInput.focus();
  }

  let stockOutItems = [];

  function addStockOutItem(barcode) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    let product = DB.find('products', (p) => p.storeId === storeId && p.barcode === barcode);
    if (!product) {
      product = DB.find('products', (p) => p.storeId === storeId && p.name.includes(barcode));
    }
    if (!product) {
      Toast.error('未找到该商品');
      return;
    }
    const stock = App.getStockQuantity(storeId, product.id);
    if (stock === 0) {
      Toast.warning(product.name + ' 库存为 0，无法出库');
      return;
    }
    const existing = stockOutItems.find((i) => i.productId === product.id);
    if (existing) {
      if (existing.qty < stock) existing.qty += 1;
      else Toast.warning(product.name + ' 出库数量已达库存上限');
    } else {
      stockOutItems.push({
        productId: product.id,
        name: product.name,
        spec: product.spec,
        unit: product.unit,
        barcode: product.barcode,
        qty: 1,
        stock,
      });
    }
    renderStockOutItems();
    Toast.success(product.name + ' 已添加');
  }

  function renderStockOutItems() {
    const tbody = document.querySelector('#stockOutItems tbody');
    if (stockOutItems.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">扫描商品条码后自动添加到列表</td></tr>';
      return;
    }
    tbody.innerHTML = stockOutItems.map((item, idx) => `
      <tr>
        <td style="font-weight:500;">${item.name}</td>
        <td>${item.spec}</td>
        <td><span class="badge badge-info">${item.stock} ${item.unit}</span></td>
        <td>
          <div class="qty-control">
            <button onclick="InventoryView.changeOutQty(${idx}, -1)">-</button>
            <input type="number" class="qty-val" value="${item.qty}" onchange="InventoryView.setOutQty(${idx}, this.value)" max="${item.stock}">
            <button onclick="InventoryView.changeOutQty(${idx}, 1)">+</button>
          </div>
        </td>
        <td><button class="btn btn-ghost btn-sm" onclick="InventoryView.removeStockOutItem(${idx})" style="color:var(--danger);">✕</button></td>
      </tr>
    `).join('');
  }

  function changeOutQty(idx, delta) {
    const item = stockOutItems[idx];
    item.qty = Math.max(1, Math.min(item.stock, item.qty + delta));
    renderStockOutItems();
  }

  function setOutQty(idx, val) {
    const item = stockOutItems[idx];
    item.qty = Math.max(1, Math.min(item.stock, parseInt(val) || 1));
    renderStockOutItems();
  }

  function removeStockOutItem(idx) {
    stockOutItems.splice(idx, 1);
    renderStockOutItems();
  }

  function submitStockOut() {
    if (stockOutItems.length === 0) { Toast.warning('请先添加出库商品'); return; }
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const type = document.getElementById('stockOutType').value;
    const supplierId = type === 'return' ? document.getElementById('stockOutSupplier').value : null;
    const note = document.getElementById('stockOutNote').value;

    const items = [];
    for (const item of stockOutItems) {
      const res = App.deductStock(storeId, item.productId, item.qty);
      if (!res.ok) {
        Toast.error(item.name + ' 库存不足，缺口 ' + res.shortage);
        return;
      }
      items.push({ ...item });
    }

    DB.insert('stockOutOrders', {
      storeId,
      items,
      type,
      supplierId,
      operator: user.id,
      note,
    });
    DB.log(user.id, storeId, 'stock_out', type, null, { itemCount: items.length });

    const typeNames = { damage: '报损', internal: '内部领用', return: '退货给供应商' };
    Toast.success('出库成功（' + typeNames[type] + '），共 ' + items.length + ' 种商品');
    stockOutItems = [];
    App.navigate('inventory');
  }

  // ===== 调拨管理 =====
  function renderTransfers(container) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const stores = DB.filter('stores', (s) => s.id !== storeId && s.status === 'active');
    let transfers = DB.filter('transfers', (t) => t.fromStoreId === storeId || t.toStoreId === storeId);

    container.innerHTML = `
      <div class="page-header">
        <h2>调拨管理</h2>
        <div class="actions">
          <button class="btn btn-primary btn-sm" onclick="InventoryView.showTransferForm()">+ 发起调拨</button>
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>调拨单号</th><th>调出门店</th><th>调入门店</th><th>商品数</th><th>状态</th><th>发起时间</th><th>审批人</th><th>操作</th></tr></thead>
            <tbody>
              ${transfers.length === 0 ? '<tr class="empty-row"><td colspan="8">暂无调拨记录</td></tr>' : transfers.map((t) => {
                const fromStore = DB.find('stores', (s) => s.id === t.fromStoreId);
                const toStore = DB.find('stores', (s) => s.id === t.toStoreId);
                const statusMap = { pending: ['待审批', 'badge-warning'], approved: ['已批准', 'badge-info'], rejected: ['已拒绝', 'badge-danger'], completed: ['已完成', 'badge-success'] };
                const [statusText, statusClass] = statusMap[t.status] || ['未知', 'badge-gray'];
                const canApprove = t.status === 'pending' && t.toStoreId === storeId && (Auth.isManager() || Auth.isAdmin());
                return `
                  <tr>
                    <td style="font-family:monospace;">${t.id.slice(-8)}</td>
                    <td>${fromStore ? fromStore.name : '-'}</td>
                    <td>${toStore ? toStore.name : '-'}</td>
                    <td>${t.items.length} 种</td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                    <td>${App.formatDateTime(t.createdAt)}</td>
                    <td>${t.approver ? (DB.find('users', (u) => u.id === t.approver) || {}).name || '-' : '-'}</td>
                    <td>
                      <button class="btn btn-ghost btn-sm" onclick="InventoryView.viewTransfer('${t.id}')">查看</button>
                      ${canApprove ? `
                        <button class="btn btn-ghost btn-sm" onclick="InventoryView.approveTransfer('${t.id}')" style="color:var(--success);">批准</button>
                        <button class="btn btn-ghost btn-sm" onclick="InventoryView.rejectTransfer('${t.id}')" style="color:var(--danger);">拒绝</button>
                      ` : ''}
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

  function showTransferForm() {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const stores = DB.filter('stores', (s) => s.id !== storeId && s.status === 'active');
    const products = DB.filter('products', (p) => p.storeId === storeId && p.status === 'active');

    Modal.show({
      title: '发起调拨',
      size: 'lg',
      body: `
        <form id="transferForm">
          <div class="form-row">
            <div class="form-group">
              <label>调入门店 <span class="req">*</span></label>
              <select class="form-control" name="toStoreId" required>
                <option value="">请选择</option>
                ${stores.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>备注</label>
              <input type="text" class="form-control" name="note" placeholder="可选">
            </div>
          </div>
          <div class="form-group">
            <label>选择商品</label>
            <div style="max-height:300px;overflow-y:auto;border:1px solid var(--gray-200);border-radius:6px;">
              ${products.map((p) => {
                const stock = App.getStockQuantity(storeId, p.id);
                return `
                  <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--gray-100);">
                    <input type="checkbox" class="transfer-prod" value="${p.id}" data-name="${p.name}" data-spec="${p.spec}" data-stock="${stock}" ${stock === 0 ? 'disabled' : ''}>
                    <span style="flex:1;font-size:13px;">${p.name} (${p.spec})</span>
                    <span class="badge ${stock === 0 ? 'badge-danger' : 'badge-info'}">库存 ${stock}</span>
                    <input type="number" class="form-control transfer-qty" style="width:70px;" placeholder="数量" min="1" max="${stock}" ${stock === 0 ? 'disabled' : ''}>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="InventoryView.submitTransfer()">提交调拨</button>
      `,
    });
  }

  function submitTransfer() {
    const user = Auth.currentUser();
    const form = document.getElementById('transferForm');
    const fd = new FormData(form);
    const toStoreId = fd.get('toStoreId');
    if (!toStoreId) { Toast.warning('请选择调入门店'); return; }

    const items = [];
    document.querySelectorAll('.transfer-prod:checked').forEach((cb) => {
      const qtyInput = cb.parentElement.querySelector('.transfer-qty');
      const qty = parseInt(qtyInput.value) || 0;
      if (qty > 0) {
        items.push({
          productId: cb.value,
          name: cb.dataset.name,
          spec: cb.dataset.spec,
          qty,
          stock: parseInt(cb.dataset.stock),
        });
      }
    });
    if (items.length === 0) { Toast.warning('请选择商品并填写数量'); return; }

    DB.insert('transfers', {
      fromStoreId: user.storeId,
      toStoreId,
      items,
      status: 'pending',
      approver: null,
      note: fd.get('note'),
    });
    DB.log(user.id, user.storeId, 'create_transfer', toStoreId, null, { itemCount: items.length });
    Toast.success('调拨申请已提交，等待对方门店审批');
    Modal.close();
    App.renderContent();
  }

  function approveTransfer(id) {
    Modal.confirm('确认批准该调拨申请？批准后将执行库存调拨。', () => {
      const user = Auth.currentUser();
      const t = DB.find('transfers', (x) => x.id === id);
      if (!t) return;

      // 扣减调出门店库存
      for (const item of t.items) {
        const res = App.deductStock(t.fromStoreId, item.productId, item.qty);
        if (!res.ok) {
          Toast.error(item.name + ' 库存不足，无法完成调拨');
          return;
        }
        // 增加调入门店库存
        const product = DB.find('products', (p) => p.id === item.productId);
        DB.insert('inventory', {
          storeId: t.toStoreId,
          productId: item.productId,
          batchNo: 'T' + Date.now(),
          quantity: item.qty,
          productionDate: new Date().toISOString().slice(0, 10),
          expiryDate: '2028-12-31',
          cost: product ? product.cost : 0,
          supplierId: null,
        });
      }
      DB.update('transfers', id, { status: 'completed', approver: user.id });
      DB.log(user.id, user.storeId, 'approve_transfer', id);
      Toast.success('调拨已批准并执行');
      App.renderContent();
    });
  }

  function rejectTransfer(id) {
    Modal.confirm('确认拒绝该调拨申请？', () => {
      const user = Auth.currentUser();
      DB.update('transfers', id, { status: 'rejected', approver: user.id });
      DB.log(user.id, user.storeId, 'reject_transfer', id);
      Toast.success('已拒绝');
      App.renderContent();
    }, { danger: true });
  }

  function viewTransfer(id) {
    const t = DB.find('transfers', (x) => x.id === id);
    if (!t) return;
    const fromStore = DB.find('stores', (s) => s.id === t.fromStoreId);
    const toStore = DB.find('stores', (s) => s.id === t.toStoreId);
    Modal.show({
      title: '调拨详情',
      body: `
        <dl class="desc-list">
          <dt>调出门店</dt><dd>${fromStore ? fromStore.name : '-'}</dd>
          <dt>调入门店</dt><dd>${toStore ? toStore.name : '-'}</dd>
          <dt>状态</dt><dd>${t.status}</dd>
          <dt>发起时间</dt><dd>${App.formatDateTime(t.createdAt)}</dd>
          <dt>备注</dt><dd>${t.note || '-'}</dd>
        </dl>
        <h4 style="margin:16px 0 8px;font-size:14px;">商品明细</h4>
        <table class="data-table">
          <thead><tr><th>商品</th><th>规格</th><th>数量</th></tr></thead>
          <tbody>
            ${t.items.map((i) => `<tr><td>${i.name}</td><td>${i.spec}</td><td>${i.qty}</td></tr>`).join('')}
          </tbody>
        </table>
      `,
      footer: `<button class="btn btn-outline" onclick="Modal.close()">关闭</button>`,
    });
  }

  return {
    renderQuery, filterQuery, printInventory,
    renderStockIn, changeQty, setQty, setCost, removeStockInItem, submitStockIn,
    renderStockOut, changeOutQty, setOutQty, removeStockOutItem, submitStockOut,
    renderTransfers, showTransferForm, submitTransfer, approveTransfer, rejectTransfer, viewTransfer,
  };
})();
