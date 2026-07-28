/**
 * 收银台视图
 */
const CashierView = (function () {
  let cart = [];
  let currentMember = null;
  let appliedCoupon = null;
  let usePoints = false;
  let useBalance = false;
  let orderDiscount = 0;

  function render(container) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const products = DB.filter('products', (p) => p.storeId === storeId && p.status === 'active');
    const cats = DB.filter('categories', (c) => c.storeId === storeId);
    const receiptTpl = DB.find('receiptTemplates', (r) => r.storeId === storeId) || {};
    const printers = DB.filter('printers', (p) => p.storeId === storeId);

    container.innerHTML = `
      <div class="pos-layout">
        <div class="pos-left">
          <div class="card pos-search-card">
            <div class="card-body" style="padding:10px;">
              <input type="text" class="form-control" id="posSearch" placeholder="扫码枪扫描或输入商品名/条码" data-scan="true" autofocus style="font-size:15px;height:38px;">
            </div>
          </div>
          <div class="card pos-products">
            <div class="card-body" style="padding:10px;">
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
                <button class="btn btn-sm ${!currentCatFilter ? 'btn-primary' : 'btn-outline'}" onclick="CashierView.filterCat('')">全部</button>
                ${cats.map((c) => `<button class="btn btn-sm ${currentCatFilter === c.id ? 'btn-primary' : 'btn-outline'}" onclick="CashierView.filterCat('${c.id}')">${c.name}</button>`).join('')}
              </div>
              <div class="product-grid" id="productGrid">
                ${renderProductCards(products)}
              </div>
            </div>
          </div>
        </div>
        <div class="pos-right">
          <div class="card" style="flex-shrink:0;">
            <div class="card-body" style="padding:10px;">
              <div style="display:flex;gap:6px;">
                <input type="text" class="form-control" id="memberSearch" placeholder="输入会员手机号查询" style="flex:1;">
                <button class="btn btn-outline btn-sm" onclick="CashierView.searchMember()">查询</button>
              </div>
              <div id="memberInfo" style="margin-top:8px;"></div>
            </div>
          </div>
          <div class="card pos-cart">
            <div class="card-header">
              <h3>购物车 (${cart.length})</h3>
              ${cart.length > 0 ? '<button class="btn btn-ghost btn-sm" onclick="CashierView.clearCart()" style="color:var(--danger);">清空</button>' : ''}
            </div>
            <div class="card-body" id="cartBody" style="padding:10px;">
              ${renderCart()}
            </div>
          </div>
          <div class="card" style="flex-shrink:0;">
            <div class="card-body" style="padding:12px;">
              <div class="cart-summary" id="cartSummary">
                ${renderSummary()}
              </div>
              <button class="btn btn-success btn-block btn-lg" style="margin-top:10px;" onclick="CashierView.checkout()" ${cart.length === 0 ? 'disabled' : ''}>结 算</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // 搜索/扫码
    const searchInput = document.getElementById('posSearch');
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = searchInput.value.trim();
        if (val) {
          addToCartByBarcode(val);
          searchInput.value = '';
        }
      } else if (e.target.value.length >= 1) {
        // 实时搜索过滤
        const filtered = filterProducts(products, e.target.value);
        document.getElementById('productGrid').innerHTML = renderProductCards(filtered);
      }
    });

    // 会员搜索回车
    document.getElementById('memberSearch').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') searchMember();
    });

    // 全局扫码监听
    Scanner.start((code) => {
      if (document.activeElement && document.activeElement.id === 'posSearch') return;
      addToCartByBarcode(code);
    });
  }

  let currentCatFilter = '';

  function renderProductCards(products) {
    if (products.length === 0) return '<div class="empty-state"><div class="text">暂无商品</div></div>';
    const user = Auth.currentUser();
    return products.map((p) => {
      const stock = App.getStockQuantity(user.storeId, p.id);
      const avatarColors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#ef4444'];
      const colorIdx = (p.name || '').charCodeAt(0) % avatarColors.length;
      const avatarColor = avatarColors[colorIdx];
      return `
        <div class="product-card" onclick="CashierView.addToCart('${p.id}')" style="${stock === 0 ? 'opacity:.4;pointer-events:none;' : ''}">
          <div class="product-avatar" style="background:${avatarColor};">
            ${p.image ? `<img src="${p.image}" alt="${p.name}">` : `<span>${(p.name || '?')[0]}</span>`}
          </div>
          <div class="product-info">
            <div class="pname">${p.name}</div>
            <div class="pspec">${p.spec}</div>
            <div class="pprice">¥${p.price}</div>
            <div class="pstock">库存 ${stock}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function filterProducts(products, keyword) {
    if (!keyword) return products;
    const kw = keyword.toLowerCase();
    let filtered = products.filter((p) => p.name.toLowerCase().includes(kw) || p.barcode.includes(kw) || p.spec.toLowerCase().includes(kw));
    if (currentCatFilter) {
      filtered = filtered.filter((p) => p.categoryId === currentCatFilter);
    }
    return filtered;
  }

  function filterCat(catId) {
    currentCatFilter = catId;
    const user = Auth.currentUser();
    const products = DB.filter('products', (p) => p.storeId === user.storeId && p.status === 'active');
    const filtered = currentCatFilter ? products.filter((p) => p.categoryId === currentCatFilter) : products;
    document.getElementById('productGrid').innerHTML = renderProductCards(filtered);
    // 更新按钮样式
    document.querySelectorAll('.pos-products .btn-sm').forEach((btn) => {
      btn.className = 'btn btn-sm ' + (btn.getAttribute('onclick').includes(`'${catId}'`) ? 'btn-primary' : 'btn-outline');
    });
  }

  function addToCart(productId) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const product = DB.find('products', (p) => p.id === productId);
    if (!product) return;
    const stock = App.getStockQuantity(storeId, productId);
    if (stock === 0) { Toast.warning(product.name + ' 库存为 0'); return; }
    const existing = cart.find((i) => i.productId === productId);
    if (existing) {
      if (existing.qty >= stock) { Toast.warning(product.name + ' 库存仅剩 ' + stock); return; }
      existing.qty += 1;
    } else {
      cart.push({
        productId,
        name: product.name,
        spec: product.spec,
        unit: product.unit,
        barcode: product.barcode,
        price: product.price,
        originalPrice: product.price,
        qty: 1,
      });
    }
    updateCart();
    Toast.success(product.name + ' 已加入');
  }

  function addToCartByBarcode(barcode) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    let product = DB.find('products', (p) => p.storeId === storeId && p.barcode === barcode);
    if (!product) {
      product = DB.find('products', (p) => p.storeId === storeId && p.name.includes(barcode));
    }
    if (!product) {
      Toast.error('未找到商品：' + barcode);
      return;
    }
    addToCart(product.id);
  }

  function changeCartQty(idx, delta) {
    const user = Auth.currentUser();
    const item = cart[idx];
    const stock = App.getStockQuantity(user.storeId, item.productId);
    const newQty = item.qty + delta;
    if (newQty < 1) { removeCartItem(idx); return; }
    if (newQty > stock) { Toast.warning('库存仅剩 ' + stock); return; }
    item.qty = newQty;
    updateCart();
  }

  function setCartQty(idx, val) {
    const user = Auth.currentUser();
    const item = cart[idx];
    const stock = App.getStockQuantity(user.storeId, item.productId);
    let qty = parseInt(val) || 1;
    qty = Math.max(1, Math.min(stock, qty));
    item.qty = qty;
    updateCart();
  }

  function removeCartItem(idx) {
    cart.splice(idx, 1);
    updateCart();
  }

  function clearCart() {
    cart = [];
    currentMember = null;
    appliedCoupon = null;
    usePoints = false;
    useBalance = false;
    orderDiscount = 0;
    updateCart();
    document.getElementById('memberInfo').innerHTML = '';
    document.getElementById('memberSearch').value = '';
  }

  function canChangePrice() {
    return Auth.isAdmin() || Auth.isManager();
  }

  function renderCart() {
    if (cart.length === 0) {
      return '<div class="empty-state"><div class="text">购物车为空</div></div>';
    }
    return cart.map((item, idx) => {
      const priceChanged = item.originalPrice && item.price !== item.originalPrice;
      return `
      <div class="cart-item">
        <div class="ci-info">
          <div class="ci-name">${item.name}</div>
          <div class="ci-spec">
            ${item.spec} ·
            <span class="ci-price-unit ${priceChanged ? 'changed' : ''}">¥${item.price}/${item.unit}</span>
            ${priceChanged ? `<span class="ci-original-price">¥${item.originalPrice}</span>` : ''}
            ${canChangePrice() ? `<button class="btn btn-ghost btn-sm" onclick="CashierView.changePrice(${idx})" title="改价">✏️</button>` : ''}
          </div>
        </div>
        <div class="qty-control">
          <button onclick="CashierView.changeCartQty(${idx}, -1)">-</button>
          <input type="number" class="qty-val" value="${item.qty}" onchange="CashierView.setCartQty(${idx}, this.value)">
          <button onclick="CashierView.changeCartQty(${idx}, 1)">+</button>
        </div>
        <div class="ci-price">${App.formatMoney(item.price * item.qty)}</div>
        <button class="btn btn-ghost btn-sm" onclick="CashierView.removeCartItem(${idx})" style="color:var(--danger);">✕</button>
      </div>
    `}).join('');
  }

  function changePrice(idx) {
    if (!canChangePrice()) { Toast.warning('无改价权限'); return; }
    const item = cart[idx];
    Modal.show({
      title: '修改单价',
      body: `
        <div class="form-group">
          <label>商品</label>
          <div class="form-control" style="background:var(--s50);color:var(--s700);">${item.name} (${item.spec})</div>
        </div>
        <div class="form-group">
          <label>原价</label>
          <div class="form-control" style="background:var(--s50);color:var(--s500);">¥${item.originalPrice}</div>
        </div>
        <div class="form-group">
          <label>新单价 <span class="req">*</span></label>
          <input type="number" class="form-control" id="newPriceInput" value="${item.price}" min="0" step="0.01" autofocus>
        </div>
      `,
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="CashierView.savePrice(${idx})">确认改价</button>
      `,
      onMount: () => {
        const input = document.getElementById('newPriceInput');
        if (input) input.select();
      },
    });
  }

  function savePrice(idx) {
    const input = document.getElementById('newPriceInput');
    const newPrice = parseFloat(input.value);
    if (isNaN(newPrice) || newPrice < 0) { Toast.warning('请输入有效金额'); return; }
    cart[idx].price = Math.round(newPrice * 100) / 100;
    Modal.close();
    updateCart();
    Toast.success('改价成功');
  }

  function renderSummary() {
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    let discount = 0;
    let pointsDeduct = 0;
    let balanceDeduct = 0;

    // 折扣
    if (currentMember) {
      const discountRules = DB.filter('discountRules', (r) => r.storeId === Auth.currentStoreId());
      discountRules.forEach((rule) => {
        if (rule.type === 'single') {
          rule.rules.forEach((r) => {
            cart.forEach((item) => {
              const product = DB.find('products', (p) => p.id === item.productId);
              if (r.productId === item.productId || (r.categoryName && product && App.getCategoryName(product.categoryId) === r.categoryName)) {
                discount += item.price * item.qty * (1 - r.discount);
              }
            });
          });
        }
      });
    }

    // 优惠券
    if (appliedCoupon) {
      if (appliedCoupon.type === 'fullCut' && subtotal >= appliedCoupon.condition) {
        discount += appliedCoupon.value;
      } else if (appliedCoupon.type === 'voucher') {
        discount += appliedCoupon.value;
      }
    }

    // 积分抵扣
    if (usePoints && currentMember && currentMember.points > 0) {
      const pointsRule = DB.find('pointsRules', (r) => r.storeId === Auth.currentStoreId());
      if (pointsRule && pointsRule.enabled) {
        const maxDeduct = Math.floor(currentMember.points / pointsRule.ratio) * pointsRule.yuanPerPoint;
        pointsDeduct = Math.min(maxDeduct, subtotal - discount);
      }
    }

    // 储值支付
    const afterDiscount = subtotal - discount - pointsDeduct;
    if (useBalance && currentMember && currentMember.balance > 0) {
      balanceDeduct = Math.min(currentMember.balance, afterDiscount);
    }

    const total = Math.max(0, subtotal - discount - pointsDeduct - balanceDeduct);
    orderDiscount = discount + pointsDeduct + balanceDeduct;

    return `
      <div class="row"><span>商品合计</span><span>${App.formatMoney(subtotal)}</span></div>
      ${discount > 0 ? `<div class="row" style="color:var(--success);"><span>优惠折扣</span><span>-${App.formatMoney(discount)}</span></div>` : ''}
      ${appliedCoupon ? `<div class="row" style="color:var(--success);"><span>优惠券：${appliedCoupon.name}</span><span></span></div>` : ''}
      ${pointsDeduct > 0 ? `<div class="row" style="color:var(--success);"><span>积分抵扣</span><span>-${App.formatMoney(pointsDeduct)}</span></div>` : ''}
      ${balanceDeduct > 0 ? `<div class="row" style="color:var(--success);"><span>储值支付</span><span>-${App.formatMoney(balanceDeduct)}</span></div>` : ''}
      <div class="row total"><span>应付</span><span>${App.formatMoney(total)}</span></div>
    `;
  }

  function updateCart() {
    document.getElementById('cartBody').innerHTML = renderCart();
    document.getElementById('cartSummary').innerHTML = renderSummary();
    // 更新购物车数量
    const header = document.querySelector('.pos-cart .card-header h3');
    if (header) header.textContent = `购物车 (${cart.length})`;
    // 更新结算按钮
    const btn = document.querySelector('.pos-right .btn-success');
    if (btn) btn.disabled = cart.length === 0;
  }

  // ===== 会员 =====
  function searchMember() {
    const phone = document.getElementById('memberSearch').value.trim();
    if (!phone) { Toast.warning('请输入会员手机号'); return; }
    const user = Auth.currentUser();
    const member = DB.find('members', (m) => m.storeId === user.storeId && m.phone === phone);
    if (!member) {
      Toast.error('未找到该会员');
      currentMember = null;
      document.getElementById('memberInfo').innerHTML = '<span style="color:var(--gray-400);font-size:12px;">未找到会员</span>';
      return;
    }
    currentMember = member;
    const pointsRule = DB.find('pointsRules', (r) => r.storeId === user.storeId);
    const pointsValue = pointsRule && pointsRule.enabled ? Math.floor(member.points / pointsRule.ratio) * pointsRule.yuanPerPoint : 0;
    document.getElementById('memberInfo').innerHTML = `
      <div style="background:var(--primary-light);border-radius:6px;padding:8px;font-size:12px;">
        <div style="font-weight:600;color:var(--primary-dark);margin-bottom:4px;">${member.name} · ${member.phone}</div>
        <div style="display:flex;gap:12px;color:var(--gray-600);">
          <span>积分: <b>${member.points}</b> (可抵 ${App.formatMoney(pointsValue)})</span>
          <span>储值: <b>${App.formatMoney(member.balance)}</b></span>
        </div>
        <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;">
          ${pointsRule && pointsRule.enabled ? `<label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" ${usePoints ? 'checked' : ''} onchange="CashierView.togglePoints(this.checked)"> 积分抵扣</label>` : ''}
          <label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" ${useBalance ? 'checked' : ''} onchange="CashierView.toggleBalance(this.checked)"> 储值支付</label>
          <button class="btn btn-ghost btn-sm" onclick="CashierView.showCouponPicker()">选优惠券</button>
          ${appliedCoupon ? `<span style="color:var(--success);font-size:12px;">已选: ${appliedCoupon.name}</span>` : ''}
        </div>
      </div>
    `;
    updateCart();
    Toast.success('已识别会员：' + member.name);
  }

  function togglePoints(val) {
    usePoints = val;
    updateCart();
  }

  function toggleBalance(val) {
    useBalance = val;
    updateCart();
  }

  function showCouponPicker() {
    if (!currentMember) { Toast.warning('请先查询会员'); return; }
    const user = Auth.currentUser();
    const coupons = DB.filter('coupons', (c) => c.storeId === user.storeId && c.status === 'active');
    const today = new Date().toISOString().slice(0, 10);
    const validCoupons = coupons.filter((c) => c.validFrom <= today && c.validTo >= today);

    Modal.show({
      title: '选择优惠券',
      body: validCoupons.length === 0 ? '<div class="empty-state"><div class="text">暂无可用优惠券</div></div>' : `
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${validCoupons.map((c) => `
            <div style="border:1px solid var(--gray-200);border-radius:8px;padding:10px;cursor:pointer;" onclick="CashierView.applyCoupon('${c.id}')">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:500;">${c.name}</span>
                <span style="color:var(--danger);font-weight:600;">${c.type === 'fullCut' ? '满' + c.condition + '减' + c.value : '抵' + c.value + '元'}</span>
              </div>
              <div style="font-size:12px;color:var(--gray-400);margin-top:4px;">有效期：${c.validFrom} ~ ${c.validTo}</div>
            </div>
          `).join('')}
          ${appliedCoupon ? `<button class="btn btn-outline btn-sm" onclick="CashierView.applyCoupon('')">取消使用优惠券</button>` : ''}
        </div>
      `,
      footer: `<button class="btn btn-outline" onclick="Modal.close()">关闭</button>`,
    });
  }

  function applyCoupon(couponId) {
    if (!couponId) {
      appliedCoupon = null;
    } else {
      appliedCoupon = DB.find('coupons', (c) => c.id === couponId);
    }
    Modal.close();
    updateCart();
  }

  // ===== 结算 =====
  function checkout() {
    if (cart.length === 0) return;
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const store = DB.find('stores', (s) => s.id === storeId) || {};
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const total = Math.max(0, subtotal - orderDiscount);

    // 计算积分获得
    let earnedPoints = 0;
    if (currentMember) {
      const pointsRule = DB.find('pointsRules', (r) => r.storeId === storeId);
      if (pointsRule && pointsRule.enabled) {
        earnedPoints = Math.floor(total);
      }
    }

    const wechatQR = store.wechatQR || '';
    const alipayQR = store.alipayQR || '';

    function buildQRArea(method) {
      if (method === 'cash') {
        return '<p style="font-size:13px;color:var(--s500);text-align:center;padding:12px;">现金收款，请确认收到顾客现金后点击"确认收款"</p>';
      }
      const label = method === 'wechat' ? '微信' : '支付宝';
      const qr = method === 'wechat' ? wechatQR : alipayQR;
      const color = method === 'wechat' ? '#07c160' : '#1677ff';
      if (qr) {
        return `
          <p style="font-size:13px;color:var(--s500);margin-bottom:12px;text-align:center;">顾客${label}扫码支付后，点击"确认收款"完成订单</p>
          <div style="display:flex;flex-direction:column;align-items:center;gap:10px;">
            <div style="width:200px;height:200px;border:1px solid var(--s200);border-radius:12px;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;">
              <img src="${qr}" alt="${label}收款码" style="width:100%;height:100%;object-fit:contain;">
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:${color};">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};"></span>
              ${label}收款码
            </div>
          </div>
        `;
      }
      return `
        <p style="font-size:13px;color:var(--s500);margin-bottom:12px;text-align:center;">顾客${label}扫码支付后，点击"确认收款"完成订单</p>
        <div style="display:flex;flex-direction:column;align-items:center;gap:10px;">
          <div style="width:200px;height:200px;border:2px dashed var(--s200);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--s50);">
            <div style="font-size:40px;opacity:.3;">📭</div>
            <div style="font-size:13px;color:var(--s400);margin-top:8px;">未上传${label}收款码</div>
          </div>
          <div style="font-size:12px;color:var(--s400);">请前往「系统设置 → 门店管理」上传${label}收款码</div>
        </div>
      `;
    }

    Modal.show({
      title: '结算',
      body: `
        <div style="text-align:center;margin-bottom:20px;">
          <div style="font-size:13px;color:var(--s500);margin-bottom:8px;">应付金额</div>
          <div style="font-size:36px;font-weight:700;color:var(--danger);">${App.formatMoney(total)}</div>
          ${currentMember ? `<div style="font-size:12px;color:var(--success);margin-top:8px;">本次获得积分 +${earnedPoints}</div>` : ''}
        </div>
        ${currentMember && usePoints ? '<div style="font-size:12px;color:var(--s500);text-align:center;margin-bottom:12px;">已勾选积分抵扣 / 储值支付</div>' : ''}
        ${!currentMember ? `
          <div style="background:var(--warning-light);border-radius:8px;padding:10px;text-align:center;font-size:12px;color:var(--warning);margin-bottom:16px;">
            未选择会员，本次消费不计入积分。如需积分请在左侧查询会员。
          </div>
        ` : ''}
        <div class="form-group">
          <label>收款方式</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <label class="pay-method-label" data-method="wechat" style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;padding:10px 16px;border:1.5px solid var(--primary);border-radius:8px;background:var(--primary-light);color:var(--primary-dark);font-weight:600;">
              <input type="radio" name="payMethod" value="wechat" checked style="accent-color:var(--primary);"> 微信收款码
            </label>
            <label class="pay-method-label" data-method="alipay" style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;padding:10px 16px;border:1.5px solid var(--s200);border-radius:8px;color:var(--s600);">
              <input type="radio" name="payMethod" value="alipay" style="accent-color:var(--primary);"> 支付宝收款码
            </label>
            <label class="pay-method-label" data-method="cash" style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;padding:10px 16px;border:1.5px solid var(--s200);border-radius:8px;color:var(--s600);">
              <input type="radio" name="payMethod" value="cash" style="accent-color:var(--primary);"> 现金
            </label>
          </div>
        </div>
        <div id="qrcodeArea" style="text-align:center;margin-top:12px;min-height:240px;display:flex;align-items:center;justify-content:center;">
          ${buildQRArea('wechat')}
        </div>
      `,
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-success" onclick="CashierView.confirmCheckout(${total}, ${earnedPoints})">确认收款</button>
      `,
      onMount: () => {
        document.querySelectorAll('input[name="payMethod"]').forEach((r) => {
          r.addEventListener('change', (e) => {
            // 更新label样式
            document.querySelectorAll('.pay-method-label').forEach((label) => {
              if (label.dataset.method === e.target.value) {
                label.style.borderColor = 'var(--primary)';
                label.style.background = 'var(--primary-light)';
                label.style.color = 'var(--primary-dark)';
                label.style.fontWeight = '600';
              } else {
                label.style.borderColor = 'var(--s200)';
                label.style.background = '#fff';
                label.style.color = 'var(--s600)';
                label.style.fontWeight = '400';
              }
            });
            document.getElementById('qrcodeArea').innerHTML = buildQRArea(e.target.value);
          });
        });
      },
    });
  }

  function confirmCheckout(total, earnedPoints) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const payMethod = document.querySelector('input[name="payMethod"]:checked').value;
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

    // 扣减库存 (FEFO)
    for (const item of cart) {
      const res = App.deductStock(storeId, item.productId, item.qty);
      if (!res.ok) {
        Toast.error(item.name + ' 库存不足');
        return;
      }
    }

    // 创建订单
    const orderNo = 'ORD' + Date.now();
    const order = DB.insert('cashierOrders', {
      storeId,
      orderNo,
      items: cart.map((i) => ({ ...i, amount: i.price * i.qty })),
      totalAmount: subtotal,
      discount: orderDiscount,
      paidAmount: total,
      memberId: currentMember ? currentMember.id : null,
      operator: user.id,
      paymentMethod: payMethod,
      status: 'completed',
      note: '',
    });

    // 更新会员
    if (currentMember) {
      const pointsRule = DB.find('pointsRules', (r) => r.storeId === storeId);
      const updates = {};
      if (earnedPoints > 0 && pointsRule && pointsRule.enabled) {
        updates.points = currentMember.points + earnedPoints;
      }
      if (usePoints) {
        const pointsDeduct = Math.floor(currentMember.points / pointsRule.ratio) * pointsRule.yuanPerPoint;
        updates.points = (updates.points || currentMember.points) - Math.ceil(pointsDeduct / pointsRule.yuanPerPoint) * pointsRule.ratio;
      }
      if (useBalance) {
        updates.balance = currentMember.balance - Math.min(currentMember.balance, subtotal - orderDiscount);
      }
      DB.update('members', currentMember.id, updates);
    }

    DB.log(user.id, storeId, 'cashier_checkout', orderNo, null, { total, itemCount: cart.length });
    Modal.close();
    Toast.success('订单完成：' + orderNo);

    // 显示小票
    showReceipt(order);
    clearCart();
  }

  function showReceipt(order) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const store = DB.find('stores', (s) => s.id === storeId);
    const tpl = DB.find('receiptTemplates', (r) => r.storeId === storeId) || {};
    const operator = DB.find('users', (u) => u.id === order.operator);

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
        <button class="btn btn-primary" onclick="CashierView.printReceipt()">🖨 打印小票</button>
      `,
    });
  }

  function printReceipt() {
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

  return {
    render, filterCat, addToCart, changeCartQty, setCartQty, removeCartItem,
    changePrice, savePrice,
    clearCart, searchMember, togglePoints, toggleBalance, showCouponPicker,
    applyCoupon, checkout, confirmCheckout, printReceipt,
  };
})();
