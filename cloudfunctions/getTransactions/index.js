// cloudfunctions/getTransactions/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d6gqwroxrc08ea02c' })

const db = cloud.database()
const COLLECTION = 'transactions'

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID || wxContext.openId

  // 验证用户身份
  if (!openId) {
    return { success: false, error: '无法获取用户身份' }
  }

  try {
    // 获取用户信息验证权限
    const userRes = await db.collection('users').doc(openId).get()
    const userRole = userRes.data?.role || 'employee'
    const isOwner = userRole === 'owner'
    const isAdmin = userRole === 'admin'
    const isReviewer = userRole === 'reviewer'

    // 获取所有记录（用于统计）
    if (action === 'list') {
      let query = db.collection(COLLECTION).orderBy('createTime', 'desc')

      // owner 和 admin 可以看所有记录
      if (isOwner || isAdmin) {
        // 看全部数据
      } else if (isReviewer) {
        // reviewer 看自己的 + 已审核的
        query = query.where({
          or: [
            { creatorOpenId: openId },
            { status: 'approved' }
          ]
        })
      } else {
        // employee 只能看自己的
        query = query.where({ creatorOpenId: openId })
      }

      const res = await query.limit(1000).get()
      return { success: true, data: res.data }
    }

    // 创建新记录
    if (action === 'create') {
      const { type, category, amount, date, remark, supplier } = event

      // 参数校验
      if (!['income', 'expense'].includes(type)) {
        return { success: false, error: '类型非法' }
      }
      if (typeof amount !== 'number' || amount <= 0 || amount > 99999999) {
        return { success: false, error: '金额非法' }
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { success: false, error: '日期格式错误' }
      }
      if (!category) {
        return { success: false, error: '请选择分类' }
      }

      // 获取用户昵称
      const userRes = await db.collection('users').doc(openId).get()
      const nickName = userRes.data?.nickName || '未知'

      // 生成 UUID 作为 _id
      const recordId = 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)

      await db.collection(COLLECTION).doc(recordId).set({
        data: {
          _id: recordId,
          type,
          category,
          amount: Math.round(amount),
          date,
          remark: remark || '',
          supplier: supplier || '',
          createTime: Date.now(),
          creatorOpenId: openId,
          creator: nickName,
          creatorAvatar: userRes.data?.avatarUrl || '',
          status: 'pending'  // 默认待审核状态
        }
      })

      return { success: true, message: '记账成功', data: { _id: recordId } }
    }

    // 审核通过
    if (action === 'approve') {
      const { recordId } = event

      // 只有 reviewer、admin、owner 可以审核
      if (!isOwner && !isAdmin && !isReviewer) {
        return { success: false, error: '无权审核' }
      }

      const recordRes = await db.collection(COLLECTION).doc(recordId).get()
      if (!recordRes.data) {
        return { success: false, error: '记录不存在' }
      }

      // 检查记录状态，只能审核待审核状态的记录
      if (recordRes.data.status !== 'pending') {
        return { success: false, error: '只能审核待审核状态的记录' }
      }

      await db.collection(COLLECTION).doc(recordId).update({
        data: {
          status: 'approved',
          approvedBy: openId,
          approvedTime: Date.now()
        }
      })

      return { success: true, message: '审核通过' }
    }

    // 审核驳回
    if (action === 'reject') {
      const { recordId } = event

      // 只有 reviewer、admin、owner 可以审核
      if (!isOwner && !isAdmin && !isReviewer) {
        return { success: false, error: '无权审核' }
      }

      const recordRes = await db.collection(COLLECTION).doc(recordId).get()
      if (!recordRes.data) {
        return { success: false, error: '记录不存在' }
      }

      // 检查记录状态，只能驳回待审核状态的记录
      if (recordRes.data.status !== 'pending') {
        return { success: false, error: '只能驳回待审核状态的记录' }
      }

      await db.collection(COLLECTION).doc(recordId).update({
        data: {
          status: 'rejected',
          rejectedBy: openId,
          rejectedTime: Date.now()
        }
      })

      return { success: true, message: '已驳回' }
    }

    // 统计今日和本月数据
    if (action === 'stats') {
      const { today, monthStart } = event

      // 构建查询条件
      let todayQuery = db.collection(COLLECTION).where({ date: today })
      let monthQuery = db.collection(COLLECTION).where({
        date: db.command.gte(monthStart)
      })

      // 非店长和非管理员只能看自己的记录
      if (!isOwner && !isAdmin) {
        if (isReviewer) {
          // reviewer 看自己的 + 已审核的
          todayQuery = todayQuery.where(db.command.or(
            { creatorOpenId: openId },
            { status: 'approved' }
          ))
          monthQuery = monthQuery.where(db.command.or(
            { creatorOpenId: openId },
            { status: 'approved' }
          ))
        } else {
          // employee 只能看自己的
          todayQuery = todayQuery.where({ creatorOpenId: openId })
          monthQuery = monthQuery.where({ creatorOpenId: openId })
        }
      }

      // 获取今日数据
      const todayRes = await todayQuery.get()

      // 获取本月数据
      const monthRes = await monthQuery.get()

      let todayIncome = 0, todayExpense = 0
      let monthIncome = 0, monthExpense = 0

      todayRes.data.forEach(r => {
        if (r.type === 'income') todayIncome += r.amount
        else todayExpense += r.amount
      })

      monthRes.data.forEach(r => {
        if (r.type === 'income') monthIncome += r.amount
        else monthExpense += r.amount
      })

      return {
        success: true,
        data: {
          todayIncome,
          todayExpense,
          todayProfit: todayIncome - todayExpense,
          monthIncome,
          monthExpense,
          monthProfit: monthIncome - monthExpense
        }
      }
    }

    // 更新记录
    if (action === 'update') {
      const { recordId, category, amount, date, remark, supplier } = event

      // 参数校验
      if (!category) {
        return { success: false, error: '请选择分类' }
      }
      if (typeof amount !== 'number' || amount <= 0 || amount > 99999999) {
        return { success: false, error: '金额非法' }
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { success: false, error: '日期格式错误' }
      }

      // 获取记录
      const recordRes = await db.collection(COLLECTION).doc(recordId).get()

      if (!recordRes.data) {
        return { success: false, error: '记录不存在' }
      }

      // 检查记录状态，审核通过的记录不能被修改
      if (recordRes.data.status === 'approved') {
        return { success: false, error: '已审核通过的记录不能修改' }
      }

      // 权限检查：店长/管理员可编辑所有记录，员工只能编辑自己的记录
      const canEdit = isOwner || isAdmin || recordRes.data.creatorOpenId === openId
      if (!canEdit) {
        return { success: false, error: '无权修改此记录' }
      }

      // 执行更新
      const updateData = {
        category,
        amount: Math.round(amount),
        date,
        remark: remark || '',
        updateTime: Date.now()
      }
      if (supplier !== undefined) {
        updateData.supplier = supplier
      }

      await db.collection(COLLECTION).doc(recordId).update({
        data: updateData
      })

      return { success: true, message: '更新成功' }
    }

    // 删除记录
    if (action === 'delete') {
      const { recordId } = event

      // 获取记录
      const recordRes = await db.collection(COLLECTION).doc(recordId).get()

      if (!recordRes.data) {
        return { success: false, error: '记录不存在' }
      }

      // 检查记录状态，审核通过的记录不能被删除
      if (recordRes.data.status === 'approved') {
        return { success: false, error: '已审核通过的记录不能删除' }
      }

      // 权限检查：店长/管理员可删除所有记录，员工只能删除自己的记录
      const canDelete = isOwner || isAdmin || recordRes.data.creatorOpenId === openId
      if (!canDelete) {
        return { success: false, error: '无权删除此记录' }
      }

      await db.collection(COLLECTION).doc(recordId).remove()

      return { success: true, message: '删除成功' }
    }

    return { success: false, error: '未知操作' }

  } catch (err) {
    return { success: false, error: err.message }
  }
}
