/**
 * 供应商管理视图
 */
const SuppliersView = (function () {
  let searchKeyword = '';

  function render(container) {
    const user = Auth.currentUser();
    const storeId = user.storeId;
    let suppliers = DB.filter('suppliers', (s) => s.storeId === storeId);
    if (searchKeyword) {
      suppliers = suppliers.filter((s) => s.name.includes(searchKeyword) || s.contact.includes(searchKeyword) || s.phone.includes(searchKeyword));
    }

    container.innerHTML = `
      <div class="page-header">
        <h2>供应商管理</h2>
        <div class="actions">
          <button class="btn btn-primary btn-sm" onclick="SuppliersView.showForm()">+ 新增供应商</button>
        </div>
      </div>
      <div class="search-bar">
        <input type="text" class="form-control" placeholder="搜索供应商名/联系人/电话" value="${searchKeyword}" oninput="SuppliersView.search(this.value)">
        <span class="spacer"></span>
        <span style="font-size:12px;color:var(--gray-500);">共 ${suppliers.length} 家供应商</span>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>供应商名称</th><th>联系人</th><th>电话</th><th>地址</th><th>关联入库</th><th>备注</th><th>操作</th></tr></thead>
            <tbody>
              ${suppliers.length === 0 ? '<tr class="empty-row"><td colspan="7">暂无供应商</td></tr>' : suppliers.map((s) => {
                const inOrders = DB.filter('stockInOrders', (o) => o.storeId === storeId && o.supplierId === s.id);
                return `
                  <tr>
                    <td style="font-weight:500;">${s.name}</td>
                    <td>${s.contact || '-'}</td>
                    <td>${s.phone || '-'}</td>
                    <td style="font-size:12px;color:var(--gray-500);">${s.address || '-'}</td>
                    <td>${inOrders.length} 次</td>
                    <td style="font-size:12px;color:var(--gray-500);">${s.note || '-'}</td>
                    <td>
                      <button class="btn btn-ghost btn-sm" onclick="SuppliersView.showForm('${s.id}')">编辑</button>
                      <button class="btn btn-ghost btn-sm" onclick="SuppliersView.remove('${s.id}')" style="color:var(--danger);">删除</button>
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
    render(document.getElementById('content'));
  }

  function showForm(id) {
    const s = id ? DB.find('suppliers', (x) => x.id === id) : {};
    Modal.show({
      title: id ? '编辑供应商' : '新增供应商',
      body: `
        <form id="supplierForm">
          <div class="form-group">
            <label>供应商名称 <span class="req">*</span></label>
            <input type="text" class="form-control" name="name" value="${s.name || ''}" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>联系人</label>
              <input type="text" class="form-control" name="contact" value="${s.contact || ''}">
            </div>
            <div class="form-group">
              <label>电话</label>
              <input type="text" class="form-control" name="phone" value="${s.phone || ''}">
            </div>
          </div>
          <div class="form-group">
            <label>地址</label>
            <input type="text" class="form-control" name="address" value="${s.address || ''}">
          </div>
          <div class="form-group">
            <label>备注</label>
            <textarea class="form-control" name="note">${s.note || ''}</textarea>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="SuppliersView.save('${id || ''}')">保存</button>
      `,
    });
  }

  function save(id) {
    const form = document.getElementById('supplierForm');
    const fd = new FormData(form);
    const user = Auth.currentUser();
    const data = {
      name: fd.get('name'),
      contact: fd.get('contact'),
      phone: fd.get('phone'),
      address: fd.get('address'),
      note: fd.get('note'),
      storeId: user.storeId,
    };
    if (id) {
      DB.update('suppliers', id, data);
      Toast.success('供应商已更新');
    } else {
      DB.insert('suppliers', data);
      Toast.success('供应商已添加');
    }
    Modal.close();
    render(document.getElementById('content'));
  }

  function remove(id) {
    Modal.confirm('确定删除该供应商？', () => {
      DB.remove('suppliers', id);
      Toast.success('已删除');
      render(document.getElementById('content'));
    }, { danger: true });
  }

  return { render, search, showForm, save, remove };
})();
