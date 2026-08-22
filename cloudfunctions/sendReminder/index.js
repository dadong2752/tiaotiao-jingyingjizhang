// cloudfunctions/sendReminder/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d6gqwroxrc08ea02c' })

const db = cloud.database()
const transactionsCollection = db.collection('transactions')
const settingsCollection = db.collection('settings')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID || wxContext.openId

  // 验证用户身份
  if (!openId) {
    return { success: false, error: '无法获取用户身份' }
  }

  const { action } = event

  // 获取用户角色验证权限
  const usersCollection = db.collection('users')
  const userRes = await usersCollection.doc(openId).get()
  if (!userRes.data) {
    return { success: false, error: '用户不存在' }
  }
  const userRole = userRes.data.role || 'employee'
  const isOwner = userRole === 'owner'
  const isAdmin = userRole === 'admin'

  try {
    // 获取今日日期（北京时间 = UTC + 8小时）
    const now = new Date()
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    const todayStr = `${beijingTime.getFullYear()}-${String(beijingTime.getMonth() + 1).padStart(2, '0')}-${String(beijingTime.getDate()).padStart(2, '0')}`

    // 获取今日数据
    const todayRes = await transactionsCollection.where({
      date: todayStr
    }).get()

    let todayIncome = 0, todayExpense = 0
    todayRes.data.forEach(r => {
      if (r.type === 'income') todayIncome += r.amount
      else todayExpense += r.amount
    })
    const todayProfit = todayIncome - todayExpense

    // 日结提醒
    if (action === 'dailyReminder') {
      // 权限检查：只有 owner 和 admin 可以发送日结提醒
      if (!isOwner && !isAdmin) {
        return { success: false, error: '无权执行此操作' }
      }

      // 查询用户设置
      const settingsRes = await settingsCollection.where({
        _openid: openId
      }).get()

      const settings = settingsRes.data[0] || {}
      const reminderTime = settings.reminderTime || '21:00' // 默认21:00提醒
      const isEnabled = settings.dailyReminderEnabled !== false // 默认开启

      if (!isEnabled) {
        return { success: true, data: { enabled: false, message: '提醒已关闭' } }
      }

      // 从设置中获取模板 ID
      const templateId = settings.templateId || settings.reminderTemplateId
      if (!templateId) {
        return { success: false, error: '订阅消息模板 ID 未配置，请在设置中配置' }
      }

      try {
        await cloud.openapi.subscribeMessage.send({
          touser: openId,
          templateId: templateId,
          page: 'pages/index/index',
          data: {
            thing1: { value: '日结提醒' },
            thing2: { value: `今日收入 ${(todayIncome / 100).toFixed(2)} 元` },
            thing3: { value: `今日支出 ${(todayExpense / 100).toFixed(2)} 元` },
            thing4: { value: `利润 ${(todayProfit / 100).toFixed(2)} 元` }
          }
        })
        return { success: true, data: { enabled: true, message: '发送成功' } }
      } catch (err) {
        console.log('订阅消息发送失败', err)
        return { success: false, error: '发送失败: ' + err.message }
      }
    }

    // 异常预警检查
    if (action === 'checkAbnormal') {
      // 权限检查：只有 owner 和 admin 可以执行异常检查
      if (!isOwner && !isAdmin) {
        return { success: false, error: '无权执行此操作' }
      }

      const settingsRes = await settingsCollection.where({
        _openid: openId
      }).get()

      const settings = settingsRes.data[0] || {}
      const expenseThreshold = settings.expenseThreshold || 10000 // 默认单笔100元
      const lossThreshold = settings.lossThreshold || 50000 // 默认当日亏损500元

      const alerts = []

      // 检查是否有大额支出
      todayRes.data.forEach(r => {
        if (r.type === 'expense' && r.amount > expenseThreshold) {
          alerts.push({
            type: 'large_expense',
            message: `检测到大额支出：${r.category} ${(r.amount / 100).toFixed(2)} 元`
          })
        }
      })

      // 检查是否亏损
      if (todayProfit < -lossThreshold) {
        alerts.push({
          type: 'large_loss',
          message: `今日亏损 ${Math.abs(todayProfit / 100).toFixed(2)} 元，超过阈值`
        })
      }

      return { success: true, data: { alerts } }
    }

    return { success: false, error: '未知操作' }

  } catch (err) {
    return { success: false, error: err.message }
  }
}
