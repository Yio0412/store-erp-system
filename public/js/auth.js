/**
 * 认证与权限模块
 */
const Auth = (function () {
  function login(username, password) {
    const user = DB.find('users', (u) => u.username === username && u.password === password && u.status === 'active');
    if (!user) return { ok: false, msg: '用户名或密码错误，或账号已停用' };
    const role = DB.find('roles', (r) => r.id === user.roleId);
    const store = user.storeId ? DB.find('stores', (s) => s.id === user.storeId) : null;
    const session = { ...user, roleName: role ? role.name : '', permissions: role ? role.permissions : [], store };
    DB.setSession(session);
    return { ok: true, user: session };
  }

  function register(username, password, name, inviteCode, storeId) {
    // 校验邀请码
    const code = DB.find('invitationCodes', (c) => c.code === inviteCode && c.status === 'active');
    if (!code) return { ok: false, msg: '邀请码无效或已失效' };
    if (code.expiresAt && new Date(code.expiresAt) < new Date()) return { ok: false, msg: '邀请码已过期' };
    if (code.usedCount >= code.maxUses) return { ok: false, msg: '邀请码使用次数已达上限' };

    // 校验用户名
    if (DB.find('users', (u) => u.username === username)) return { ok: false, msg: '用户名已存在' };
    if (username.length < 3) return { ok: false, msg: '用户名至少 3 个字符' };
    if (password.length < 6) return { ok: false, msg: '密码至少 6 个字符' };

    // 默认员工角色
    const staffRole = DB.find('roles', (r) => r.name === '员工' && !r.isCustom);
    const user = DB.insert('users', {
      username,
      password,
      name: name || username,
      roleId: staffRole ? staffRole.id : null,
      storeId: storeId || null,
      status: 'active',
    });

    // 更新邀请码
    DB.update('invitationCodes', code.id, { usedCount: code.usedCount + 1 });

    return { ok: true, user };
  }

  function logout() {
    DB.clearSession();
  }

  function currentUser() {
    return DB.getSession();
  }

  function hasPermission(perm) {
    const user = currentUser();
    if (!user) return false;
    if (user.permissions && user.permissions.includes('*')) return true;
    return user.permissions && user.permissions.includes(perm);
  }

  function isAdmin() {
    const user = currentUser();
    return user && user.roleName === '管理员';
  }

  function isManager() {
    const user = currentUser();
    return user && user.roleName === '店长';
  }

  function currentStoreId() {
    const user = currentUser();
    return user ? user.storeId : null;
  }

  function generateInviteCode(createdBy, maxUses, expiresAt, remark) {
    const code = 'INV' + Math.random().toString(36).substring(2, 8).toUpperCase() + Date.now().toString().slice(-4);
    return DB.insert('invitationCodes', {
      code,
      createdBy,
      maxUses: maxUses || 1,
      usedCount: 0,
      expiresAt: expiresAt || '2027-12-31',
      status: 'active',
      remark: remark || '',
    });
  }

  function changePassword(oldPassword, newPassword) {
    const user = currentUser();
    if (!user) return { ok: false, msg: '未登录' };
    const dbUser = DB.find('users', (u) => u.id === user.id);
    if (!dbUser) return { ok: false, msg: '用户不存在' };
    if (dbUser.password !== oldPassword) return { ok: false, msg: '原密码错误' };
    if (newPassword.length < 6) return { ok: false, msg: '新密码至少 6 个字符' };
    DB.update('users', user.id, { password: newPassword });
    const updated = { ...user, password: newPassword };
    DB.setSession(updated);
    return { ok: true };
  }

  return { login, register, logout, currentUser, hasPermission, isAdmin, isManager, currentStoreId, generateInviteCode, changePassword };
})();
