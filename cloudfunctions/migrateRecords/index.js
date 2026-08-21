// cloudfunctions/migrateRecords/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d6gqwroxrc08ea02c' })

const db = cloud.database()
const transactionsCollection = db.collection('transactions')
const usersCollection = db.collection('users')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID || wxContext.openId

  try {
    // 获取当前用户信息，验证权限
    const currentUserRes = await usersCollection.where({
      _id: openId
    }).get()

    if (!currentUserRes.data || currentUserRes.data.length === 0) {
      return { success: false, error: '用户不存在' }
    }

    const currentUser = currentUserRes.data[0]

    // 只有店长可以执行迁移
    if (currentUser.role !== 'owner') {
      return { success: false, error: '只有店长可以执行数据迁移' }
    }

    // 获取所有用户，用于昵称到 openId 的映射
    const allUsersRes = await usersCollection.get()
    const userMap = {}
    allUsersRes.data.forEach(u => {
      if (u.nickName) {
        // 昵称可能重复，取第一个匹配的用户
        if (!userMap[u.nickName]) {
          userMap[u.nickName] = u._id
        }
      }
    })

    // 获取所有需要迁移的记录（没有 creatorOpenId 的记录）
    let offset = 0
    let totalMigrated = 0
    let totalSkipped = 0
    const batchSize = 100

    while (true) {
      const recordsRes = await transactionsCollection
        .where({
          creatorOpenId: db.command.exists(false)
        })
        .skip(offset)
        .limit(batchSize)
        .get()

      const records = recordsRes.data

      if (records.length === 0) {
        break
      }

      // 批量更新
      for (const record of records) {
        if (record.creator && userMap[record.creator]) {
          await transactionsCollection.doc(record._id).update({
            data: {
              creatorOpenId: userMap[record.creator]
            }
          })
          totalMigrated++
        } else {
          // 标记为已尝试迁移，避免重复查询
          await transactionsCollection.doc(record._id).update({
            data: {
              creatorOpenId: 'unknown',
              migrateSkipped: true
            }
          })
          totalSkipped++
        }
      }

      offset += records.length

      // 如果返回的记录数小于批次大小，说明已经处理完
      if (records.length < batchSize) {
        break
      }
    }

    return {
      success: true,
      message: '迁移完成',
      migrated: totalMigrated,
      skipped: totalSkipped
    }

  } catch (err) {
    return { success: false, error: err.message }
  }
}
