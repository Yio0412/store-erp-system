/**
 * 数据层 - localStorage 持久化
 * 线下门店 ERP 管理系统
 */
const DB = (function () {
  const PREFIX = 'erp_';
  const KEYS = {
    users: PREFIX + 'users',
    stores: PREFIX + 'stores',
    roles: PREFIX + 'roles',
    invitationCodes: PREFIX + 'invitationCodes',
    products: PREFIX + 'products',
    productTemplates: PREFIX + 'productTemplates',
    categories: PREFIX + 'categories',
    inventory: PREFIX + 'inventory',
    stockInOrders: PREFIX + 'stockInOrders',
    stockOutOrders: PREFIX + 'stockOutOrders',
    transfers: PREFIX + 'transfers',
    cashierOrders: PREFIX + 'cashierOrders',
    members: PREFIX + 'members',
    pointsRules: PREFIX + 'pointsRules',
    storedValueRules: PREFIX + 'storedValueRules',
    coupons: PREFIX + 'coupons',
    memberCoupons: PREFIX + 'memberCoupons',
    discountRules: PREFIX + 'discountRules',
    suppliers: PREFIX + 'suppliers',
    printers: PREFIX + 'printers',
    receiptTemplates: PREFIX + 'receiptTemplates',
    operationLogs: PREFIX + 'operationLogs',
    session: PREFIX + 'session',
    seq: PREFIX + 'seq',
  };

  function read(key, def) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : def;
    } catch (e) {
      return def;
    }
  }

  function write(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
    return val;
  }

  function nextId(model) {
    const seqs = read(KEYS.seq, {});
    seqs[model] = (seqs[model] || 0) + 1;
    write(KEYS.seq, seqs);
    return model + '_' + Date.now() + '_' + seqs[model];
  }

  function now() {
    return new Date().toISOString();
  }

  // ---- 通用 CRUD ----
  function getAll(model) {
    return read(KEYS[model], []);
  }

  function find(model, predicate) {
    return getAll(model).find(predicate);
  }

  function filter(model, predicate) {
    return getAll(model).filter(predicate);
  }

  function insert(model, obj) {
    const list = getAll(model);
    obj.id = obj.id || nextId(model);
    obj.createdAt = obj.createdAt || now();
    obj.updatedAt = now();
    list.push(obj);
    write(KEYS[model], list);
    return obj;
  }

  function update(model, id, patch) {
    const list = getAll(model);
    const idx = list.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch, updatedAt: now() };
    write(KEYS[model], list);
    return list[idx];
  }

  function remove(model, id) {
    const list = getAll(model);
    const filtered = list.filter((x) => x.id !== id);
    write(KEYS[model], filtered);
    return filtered.length !== list.length;
  }

  function save(model, list) {
    write(KEYS[model], list);
    return list;
  }

  // ---- 操作日志 ----
  function log(userId, storeId, action, target, before, after) {
    insert('operationLogs', {
      userId,
      storeId,
      action,
      target,
      beforeValue: before ? JSON.stringify(before) : null,
      afterValue: after ? JSON.stringify(after) : null,
      timestamp: now(),
    });
  }

  // ---- 会话 ----
  function getSession() {
    return read(KEYS.session, null);
  }

  function setSession(user) {
    return write(KEYS.session, user);
  }

  function clearSession() {
    localStorage.removeItem(KEYS.session);
  }

  // ---- 重置所有数据 ----
  function resetAll() {
    Object.values(KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
  }

  // ---- 初始化基础数据 ----
  function init() {
    if (read(KEYS.users, null)) return; // 已初始化

    // 默认门店
    const store1 = insert('stores', {
      name: '总店',
      address: '',
      phone: '',
      status: 'active',
      businessStatus: 'open',
      wechatQR: '',
      alipayQR: '',
    });

    // 默认角色
    const adminRole = insert('roles', {
      name: '管理员',
      permissions: ['*'],
      isCustom: false,
      storeId: null,
    });
    const managerRole = insert('roles', {
      name: '店长',
      permissions: [
        'dashboard', 'products', 'inventory_in', 'inventory_out', 'inventory_query',
        'cashier', 'orders', 'members', 'suppliers', 'reports', 'settings_store',
        'settings_roles', 'settings_printers', 'settings_receipt', 'settings_points',
        'settings_stored_value', 'settings_coupons', 'settings_discount',
        'transfers', 'operation_logs', 'templates',
      ],
      isCustom: false,
      storeId: null,
    });
    const staffRole = insert('roles', {
      name: '员工',
      permissions: ['dashboard', 'cashier', 'orders', 'inventory_in', 'inventory_out', 'inventory_query'],
      isCustom: false,
      storeId: null,
    });

    // 默认管理员
    const admin = insert('users', {
      username: 'admin',
      password: 'admin123',
      name: '超级管理员',
      roleId: adminRole.id,
      storeId: null,
      status: 'active',
    });

    // 邀请码
    insert('invitationCodes', {
      code: 'INVITE001',
      createdBy: admin.id,
      maxUses: 10,
      usedCount: 0,
      expiresAt: '2027-12-31',
      status: 'active',
      remark: '通用邀请码',
    });
  }

  return {
    KEYS,
    read,
    write,
    nextId,
    now,
    getAll,
    find,
    filter,
    insert,
    update,
    remove,
    save,
    log,
    getSession,
    setSession,
    clearSession,
    init,
    resetAll,
  };
})();
