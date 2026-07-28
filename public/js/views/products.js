/**
 * 商品管理视图
 */
const ProductsView = (function () {
  let currentTab = 'products';
  let searchKeyword = '';

  function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h2>商品管理</h2>
        <div class="actions">
          <button class="btn btn-primary btn-sm" onclick="ProductsView.showProductForm()">+ 新增商品</button>
        </div>
      </div>
      <div class="tabs">
        <div class="tab ${currentTab === 'products' ? 'active' : ''}" onclick="ProductsView.switchTab('products')">商品列表</div>
        <div class="tab ${currentTab === 'categories' ? 'active' : ''}" onclick="ProductsView.switchTab('categories')">分类管理</div>
        <div class="tab ${currentTab === 'templates' ? 'active' : ''}" onclick="ProductsView.switchTab('templates')">商品模板库</div>
      </div>
      <div id="productContent"></div>
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
    const c = document.getElementById('productContent');
    if (currentTab === 'products') renderProductList(c);
    else if (currentTab === 'categories') renderCategories(c);
    else renderTemplates(c);
  }

  // ===== 商品列表 =====
  function renderProductList(c) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    let products = DB.filter('products', (p) => p.storeId === storeId);
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      products = products.filter((p) => p.name.toLowerCase().includes(kw) || p.barcode.includes(kw) || p.spec.toLowerCase().includes(kw));
    }

    c.innerHTML = `
      <div class="search-bar">
        <input type="text" class="form-control" placeholder="搜索商品名/条码/规格" value="${searchKeyword}" oninput="ProductsView.search(this.value)">
        <span class="spacer"></span>
        <span style="font-size:12px;color:var(--gray-500);">共 ${products.length} 个商品</span>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>商品名</th><th>分类</th><th>规格</th><th>条码</th><th>单位</th><th>售价</th><th>成本</th><th>库存</th><th>状态</th><th>操作</th></tr>
            </thead>
            <tbody>
              ${products.length === 0 ? '<tr class="empty-row"><td colspan="10">暂无商品，点击右上角新增</td></tr>' : products.map((p) => {
                const stock = App.getStockQuantity(storeId, p.id);
                return `
                  <tr>
                    <td style="font-weight:500;">${p.name}</td>
                    <td>${App.getCategoryName(p.categoryId)}</td>
                    <td>${p.spec}</td>
                    <td style="font-family:monospace;">${p.barcode}</td>
                    <td>${p.unit}</td>
                    <td style="color:var(--danger);font-weight:500;">${App.formatMoney(p.price)}</td>
                    <td style="color:var(--gray-500);">${App.formatMoney(p.cost)}</td>
                    <td><span class="badge ${stock === 0 ? 'badge-danger' : stock < 10 ? 'badge-warning' : 'badge-success'}">${stock}</span></td>
                    <td><span class="badge ${p.status === 'active' ? 'badge-success' : 'badge-gray'}">${p.status === 'active' ? '在售' : '停售'}</span></td>
                    <td>
                      <button class="btn btn-ghost btn-sm" onclick="ProductsView.showProductForm('${p.id}')">编辑</button>
                      <button class="btn btn-ghost btn-sm" onclick="ProductsView.toggleStatus('${p.id}')" style="color:var(--warning);">${p.status === 'active' ? '停售' : '启用'}</button>
                      <button class="btn btn-ghost btn-sm" onclick="ProductsView.remove('${p.id}')" style="color:var(--danger);">删除</button>
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

  function showProductForm(id) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const cats = DB.filter('categories', (c) => c.storeId === storeId && c.type === 'product');
    const p = id ? DB.find('products', (x) => x.id === id) : {};

    Modal.show({
      title: id ? '编辑商品' : '新增商品',
      body: `
        <form id="productForm">
          <div class="form-group">
            <label>商品图片</label>
            <div class="img-upload-area">
              <div class="img-preview" id="productImgPreview">
                ${p.image ? `<img src="${p.image}" alt="${p.name}">` : '<div class="img-placeholder">未上传</div>'}
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;">
                <input type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp" onchange="ProductsView.uploadImage(this)" style="font-size:12px;">
                ${p.image ? `<button type="button" class="img-clear-btn" onclick="ProductsView.clearImage()">清除图片</button>` : ''}
              </div>
            </div>
            <p style="font-size:12px;color:var(--s400);margin-top:4px;">收银台商品头像默认取商品名首字，上传后显示图片</p>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>商品名称 <span class="req">*</span></label>
              <input type="text" class="form-control" name="name" value="${p.name || ''}" required>
            </div>
            <div class="form-group">
              <label>条码</label>
              <input type="text" class="form-control" name="barcode" value="${p.barcode || ''}" placeholder="扫码枪可自动填入">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>分类</label>
              <select class="form-control" name="categoryId">
                <option value="">请选择</option>
                ${cats.map((c) => `<option value="${c.id}" ${p.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>规格 <span class="req">*</span></label>
              <input type="text" class="form-control" name="spec" value="${p.spec || ''}" placeholder="如：单把冷热" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>单位 <span class="req">*</span></label>
              <input type="text" class="form-control" name="unit" value="${p.unit || '个'}" required>
            </div>
            <div class="form-group">
              <label>售价 <span class="req">*</span></label>
              <input type="number" step="0.01" class="form-control" name="price" value="${p.price || ''}" required>
            </div>
            <div class="form-group">
              <label>成本价</label>
              <input type="number" step="0.01" class="form-control" name="cost" value="${p.cost || ''}">
            </div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="ProductsView.saveProduct('${id || ''}')">保存</button>
      `,
    });
  }

  function saveProduct(id) {
    const form = document.getElementById('productForm');
    const fd = new FormData(form);
    const user = Auth.currentUser();
    const data = {
      name: fd.get('name'),
      barcode: fd.get('barcode'),
      categoryId: fd.get('categoryId'),
      spec: fd.get('spec'),
      unit: fd.get('unit'),
      price: parseFloat(fd.get('price')),
      cost: parseFloat(fd.get('cost')) || 0,
      storeId: user.storeId,
      status: 'active',
    };
    // 合并临时图片
    if (window._tempProductImage !== undefined) {
      data.image = window._tempProductImage;
    } else if (id) {
      const existing = DB.find('products', (x) => x.id === id);
      data.image = existing ? existing.image || '' : '';
    } else {
      data.image = '';
    }
    window._tempProductImage = undefined;
    if (id) {
      DB.update('products', id, data);
      DB.log(user.id, user.storeId, 'update_product', data.name);
      Toast.success('商品已更新');
    } else {
      DB.insert('products', data);
      DB.log(user.id, user.storeId, 'create_product', data.name);
      Toast.success('商品已添加');
    }
    Modal.close();
    renderTab();
  }

  function uploadImage(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { Toast.error('图片大小不能超过 2M'); input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      window._tempProductImage = e.target.result;
      const preview = document.getElementById('productImgPreview');
      if (preview) preview.innerHTML = `<img src="${e.target.result}" alt="商品图片">`;
      Toast.success('图片已上传');
    };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    window._tempProductImage = '';
    const preview = document.getElementById('productImgPreview');
    if (preview) preview.innerHTML = '<div class="img-placeholder">未上传</div>';
    Toast.success('已清除');
  }

  function toggleStatus(id) {
    const p = DB.find('products', (x) => x.id === id);
    DB.update('products', id, { status: p.status === 'active' ? 'inactive' : 'active' });
    Toast.success(p.status === 'active' ? '已停售' : '已启用');
    renderTab();
  }

  function remove(id) {
    Modal.confirm('确定删除该商品？删除后不可恢复。', () => {
      DB.remove('products', id);
      Toast.success('已删除');
      renderTab();
    }, { danger: true });
  }

  // ===== 分类管理 =====
  function renderCategories(c) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    const cats = DB.filter('categories', (cat) => cat.storeId === storeId);

    c.innerHTML = `
      <div class="search-bar">
        <span class="spacer"></span>
        <button class="btn btn-primary btn-sm" onclick="ProductsView.showCategoryForm()">+ 新增分类</button>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>分类名称</th><th>类型</th><th>商品数</th><th>操作</th></tr></thead>
            <tbody>
              ${cats.length === 0 ? '<tr class="empty-row"><td colspan="4">暂无分类</td></tr>' : cats.map((cat) => {
                const count = DB.filter('products', (p) => p.storeId === storeId && p.categoryId === cat.id).length;
                return `
                  <tr>
                    <td style="font-weight:500;">${cat.name}</td>
                    <td><span class="badge ${cat.type === 'points' ? 'badge-info' : 'badge-gray'}">${cat.type === 'points' ? '积分商品' : '普通商品'}</span></td>
                    <td>${count}</td>
                    <td>
                      <button class="btn btn-ghost btn-sm" onclick="ProductsView.showCategoryForm('${cat.id}')">编辑</button>
                      <button class="btn btn-ghost btn-sm" onclick="ProductsView.removeCategory('${cat.id}')" style="color:var(--danger);">删除</button>
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

  function showCategoryForm(id) {
    const user = Auth.currentUser();
    const cat = id ? DB.find('categories', (x) => x.id === id) : {};
    Modal.show({
      title: id ? '编辑分类' : '新增分类',
      body: `
        <form id="categoryForm">
          <div class="form-group">
            <label>分类名称 <span class="req">*</span></label>
            <input type="text" class="form-control" name="name" value="${cat.name || ''}" required>
          </div>
          <div class="form-group">
            <label>类型</label>
            <select class="form-control" name="type">
              <option value="product" ${cat.type !== 'points' ? 'selected' : ''}>普通商品</option>
              <option value="points" ${cat.type === 'points' ? 'selected' : ''}>积分商品</option>
            </select>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="ProductsView.saveCategory('${id || ''}')">保存</button>
      `,
    });
  }

  function saveCategory(id) {
    const form = document.getElementById('categoryForm');
    const fd = new FormData(form);
    const user = Auth.currentUser();
    const data = { name: fd.get('name'), type: fd.get('type'), storeId: user.storeId };
    if (id) {
      DB.update('categories', id, data);
      Toast.success('分类已更新');
    } else {
      DB.insert('categories', data);
      Toast.success('分类已添加');
    }
    Modal.close();
    renderTab();
  }

  function removeCategory(id) {
    Modal.confirm('确定删除该分类？', () => {
      DB.remove('categories', id);
      Toast.success('已删除');
      renderTab();
    }, { danger: true });
  }

  // ===== 商品模板库 =====
  function renderTemplates(c) {
    const templates = DB.getAll('productTemplates');

    c.innerHTML = `
      <div class="search-bar">
        <span style="font-size:13px;color:var(--gray-500);">从模板库批量导入商品到当前门店，导入后可独立修改价格和信息。</span>
        <span class="spacer"></span>
        <button class="btn btn-primary btn-sm" onclick="ProductsView.showTemplateForm()">+ 新增模板</button>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th><input type="checkbox" id="selectAllTpl" onchange="ProductsView.toggleAll(this)"></th><th>商品名</th><th>分类</th><th>规格</th><th>单位</th><th>参考条码</th><th>参考价</th><th>操作</th></tr></thead>
            <tbody>
              ${templates.length === 0 ? '<tr class="empty-row"><td colspan="8">暂无模板</td></tr>' : templates.map((t) => `
                <tr>
                  <td><input type="checkbox" class="tpl-check" value="${t.id}"></td>
                  <td style="font-weight:500;">${t.name}</td>
                  <td>${t.category}</td>
                  <td>${t.spec}</td>
                  <td>${t.unit}</td>
                  <td style="font-family:monospace;">${t.barcode}</td>
                  <td>${App.formatMoney(t.referencePrice)}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm" onclick="ProductsView.importTemplate('${t.id}')">导入</button>
                    <button class="btn btn-ghost btn-sm" onclick="ProductsView.showTemplateForm('${t.id}')">编辑</button>
                    <button class="btn btn-ghost btn-sm" onclick="ProductsView.removeTemplate('${t.id}')" style="color:var(--danger);">删除</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ${templates.length > 0 ? `
        <div style="margin-top:12px;text-align:right;">
          <button class="btn btn-success btn-sm" onclick="ProductsView.batchImport()">批量导入选中项</button>
        </div>
      ` : ''}
    `;
  }

  function toggleAll(cb) {
    document.querySelectorAll('.tpl-check').forEach((c) => { c.checked = cb.checked; });
  }

  function importTemplate(id) {
    const user = Auth.currentUser();
    const t = DB.find('productTemplates', (x) => x.id === id);
    if (!t) return;
    const cats = DB.filter('categories', (c) => c.storeId === user.storeId);
    const cat = cats.find((c) => c.name === t.category);
    DB.insert('products', {
      name: t.name,
      barcode: t.barcode,
      categoryId: cat ? cat.id : null,
      spec: t.spec,
      unit: t.unit,
      price: t.referencePrice,
      cost: 0,
      storeId: user.storeId,
      status: 'active',
    });
    Toast.success(`"${t.name}" 已导入到商品列表`);
  }

  function batchImport() {
    const ids = Array.from(document.querySelectorAll('.tpl-check:checked')).map((c) => c.value);
    if (ids.length === 0) { Toast.warning('请先勾选要导入的模板'); return; }
    ids.forEach((id) => importTemplate(id));
    Toast.success(`已批量导入 ${ids.length} 个商品`);
  }

  function showTemplateForm(id) {
    const t = id ? DB.find('productTemplates', (x) => x.id === id) : {};
    Modal.show({
      title: id ? '编辑模板' : '新增模板',
      body: `
        <form id="templateForm">
          <div class="form-row">
            <div class="form-group">
              <label>商品名 <span class="req">*</span></label>
              <input type="text" class="form-control" name="name" value="${t.name || ''}" required>
            </div>
            <div class="form-group">
              <label>分类 <span class="req">*</span></label>
              <input type="text" class="form-control" name="category" value="${t.category || ''}" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>规格 <span class="req">*</span></label>
              <input type="text" class="form-control" name="spec" value="${t.spec || ''}" required>
            </div>
            <div class="form-group">
              <label>单位 <span class="req">*</span></label>
              <input type="text" class="form-control" name="unit" value="${t.unit || '个'}" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>参考条码</label>
              <input type="text" class="form-control" name="barcode" value="${t.barcode || ''}">
            </div>
            <div class="form-group">
              <label>参考价</label>
              <input type="number" step="0.01" class="form-control" name="referencePrice" value="${t.referencePrice || ''}">
            </div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="ProductsView.saveTemplate('${id || ''}')">保存</button>
      `,
    });
  }

  function saveTemplate(id) {
    const form = document.getElementById('templateForm');
    const fd = new FormData(form);
    const data = {
      name: fd.get('name'),
      category: fd.get('category'),
      spec: fd.get('spec'),
      unit: fd.get('unit'),
      barcode: fd.get('barcode'),
      referencePrice: parseFloat(fd.get('referencePrice')) || 0,
    };
    if (id) {
      DB.update('productTemplates', id, data);
      Toast.success('模板已更新');
    } else {
      DB.insert('productTemplates', data);
      Toast.success('模板已添加');
    }
    Modal.close();
    renderTab();
  }

  function removeTemplate(id) {
    Modal.confirm('确定删除该模板？', () => {
      DB.remove('productTemplates', id);
      Toast.success('已删除');
      renderTab();
    }, { danger: true });
  }

  return {
    render, switchTab, search, showProductForm, saveProduct, uploadImage, clearImage,
    toggleStatus, remove, showCategoryForm, saveCategory, removeCategory,
    showTemplateForm, saveTemplate, removeTemplate, importTemplate,
    batchImport, toggleAll,
  };
})();
