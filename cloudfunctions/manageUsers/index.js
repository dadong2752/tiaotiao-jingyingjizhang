// cloudfunctions/manageUsers/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d6gqwroxrc08ea02c' })

const db = cloud.database()
const usersCollection = db.collection('users')
const transactionsCollection = db.collection('transactions')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID || wxContext.openId
  const { action, targetUserId, newRole, permissions } = event

  try {
    // 获取当前用户信息（使用 doc 直接获取）
    const currentUserRes = await usersCollection.doc(openId).get()

    if (!currentUserRes.data) {
      return { success: false, error: '用户不存在' }
    }

    const currentUser = currentUserRes.data

    // 只有店长可以操作
    if (currentUser.role !== 'owner') {
      return { success: false, error: '只有店长可以管理员工' }
    }

    // 获取所有用户列表
    if (action === 'list') {
      const allUsers = await usersCollection.orderBy('createTime', 'desc').get()
      return {
        success: true,
        data: allUsers.data.map(u => ({
          _id: u._id,
          nickName: u.nickName,
          avatarUrl: u.avatarUrl || '',
          role: u.role || 'employee',
          status: u.status || 'enabled',
          createTime: u.createTime
        }))
      }
    }

    // 修改用户角色
    if (action === 'updateRole') {
      if (!targetUserId || !newRole) {
        return { success: false, error: '参数不完整' }
      }

      // 角色值校验
      const validRoles = ['owner', 'admin', 'reviewer', 'employee']
      if (!validRoles.includes(newRole)) {
        return { success: false, error: '非法的角色值' }
      }

      if (targetUserId === currentUser._id) {
        return { success: false, error: '不能修改自己的角色' }
      }

      // 禁止修改店长的角色
      const targetUserRes = await usersCollection.doc(targetUserId).get()
      if (targetUserRes.data?.role === 'owner') {
        return { success: false, error: '不能修改店长的角色' }
      }

      await usersCollection.doc(targetUserId).update({
        data: { role: newRole }
      })

      return { success: true, message: '角色已更新' }
    }

    // 启用/禁用员工
    if (action === 'toggleStatus') {
      if (!targetUserId) {
        return { success: false, error: '参数不完整' }
      }

      if (targetUserId === currentUser._id) {
        return { success: false, error: '不能修改自己的状态' }
      }

      const targetUserRes = await usersCollection.doc(targetUserId).get()
      if (!targetUserRes.data) {
        return { success: false, error: '用户不存在' }
      }

      const newStatus = targetUserRes.data.status === 'enabled' ? 'disabled' : 'enabled'

      await usersCollection.doc(targetUserId).update({
        data: { status: newStatus }
      })

      return {
        success: true,
        message: newStatus === 'enabled' ? '已启用' : '已禁用'
      }
    }

    // 重置员工数据（删除该员工创建的所有记录）
    if (action === 'resetEmployeeData') {
      if (!targetUserId) {
        return { success: false, error: '参数不完整' }
      }

      const targetUserRes = await usersCollection.doc(targetUserId).get()
      if (!targetUserRes.data) {
        return { success: false, error: '用户不存在' }
      }

      // 获取该员工创建的所有记录
      const records = await transactionsCollection.where({
        creatorOpenId: targetUserId
      }).get()

      // 删除所有记录
      for (const record of records.data) {
        await transactionsCollection.doc(record._id).remove()
      }

      return {
        success: true,
        message: `已删除 ${records.data.length} 条记录`,
        deletedCount: records.data.length
      }
    }

    // 设置员工权限（精细权限控制）
    if (action === 'setPermissions') {
      if (!targetUserId || !permissions) {
        return { success: false, error: '参数不完整' }
      }

      await usersCollection.doc(targetUserId).update({
        data: { permissions: permissions }
      })

      return { success: true, message: '权限已更新' }
    }

    // 删除用户
    if (action === 'remove') {
      if (!targetUserId) {
        return { success: false, error: '参数不完整' }
      }

      if (targetUserId === currentUser._id) {
        return { success: false, error: '不能删除自己' }
      }

      // 禁止删除店长
      const targetUserRes = await usersCollection.doc(targetUserId).get()
      if (targetUserRes.data?.role === 'owner') {
        return { success: false, error: '不能删除店长账号' }
      }

      // 同时删除该用户的记录
      const records = await transactionsCollection.where({
        creatorOpenId: targetUserId
      }).get()

      for (const record of records.data) {
        await transactionsCollection.doc(record._id).remove()
      }

      await usersCollection.doc(targetUserId).remove()

      return {
        success: true,
        message: '用户及关联数据已删除',
        deletedRecords: records.data.length
      }
    }

    // 转让店长权限
    if (action === 'transferOwner') {
      if (!targetUserId) {
        return { success: false, error: '参数不完整' }
      }

      if (targetUserId === currentUser._id) {
        return { success: false, error: '不能转让给自己' }
      }

      const targetUserRes = await usersCollection.doc(targetUserId).get()
      if (!targetUserRes.data) {
        return { success: false, error: '目标用户不存在' }
      }

      // 将当前店长的角色降为 admin
      await usersCollection.doc(openId).update({
        data: { role: 'admin' }
      })

      // 将目标用户升级为 owner
      await usersCollection.doc(targetUserId).update({
        data: { role: 'owner' }
      })

      return {
        success: true,
        message: '店长权限已转让，原店长降为管理员'
      }
    }

    return { success: false, error: '未知操作' }

  } catch (err) {
    return { success: false, error: err.message }
  }
}