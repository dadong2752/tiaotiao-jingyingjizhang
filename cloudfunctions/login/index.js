// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d6gqwroxrc08ea02c' })

const db = cloud.database()
const usersCollection = db.collection('users')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID || wxContext.openId
  const { nickName, avatarUrl, action } = event.userInfo || event

  if (!openId) {
    return { success: false, error: '无法获取用户身份' }
  }

  // 绑定手机号
  if (action === 'bindPhone') {
    const { code } = event
    if (!code) {
      return { success: false, error: '授权码无效' }
    }

    try {
      // 调用微信接口获取手机号
      const phoneRes = await cloud.openapi.phonenumber.getPhoneNumber({ code })
      const phoneNumber = phoneRes.phone_info.phoneNumber

      // 更新用户手机号
      await usersCollection.doc(openId).update({
        data: { phone: phoneNumber }
      })

      return { success: true, data: { phoneNumber } }
    } catch (err) {
      return { success: false, error: err.message || '绑定失败' }
    }
  }

  try {
    // 查找用户
    const userRes = await usersCollection.doc(openId).get()

    if (userRes.data) {
      // 检查是否被禁用
      if (userRes.data.status === 'disabled') {
        return { success: false, error: '账号已被禁用，请联系店长' }
      }

      // 用户已存在，检查是否需要更新信息
      const updateData = {};
      if (nickName && nickName !== userRes.data.nickName) {
        updateData.nickName = nickName;
      }
      if (avatarUrl && avatarUrl !== userRes.data.avatarUrl) {
        updateData.avatarUrl = avatarUrl;
      }

      if (Object.keys(updateData).length > 0) {
        await usersCollection.doc(openId).update({ data: updateData });
        userRes.data = { ...userRes.data, ...updateData };
      }

      // 返回用户信息
      return {
        success: true,
        data: {
          _id: openId,
          openId: openId,
          nickName: userRes.data.nickName,
          avatarUrl: userRes.data.avatarUrl,
          role: userRes.data.role || 'employee',
          phone: userRes.data.phone || '',
          createTime: userRes.data.createTime
        }
      }
    }

    // 用户不存在，统一创建为录入员
    // 注意：店长权限需在云开发控制台手动设置
    const newUser = {
      _id: openId,
      nickName: nickName || '用户',
      avatarUrl: avatarUrl || '',
      role: 'employee',  // 固定为 employee，店长需在控制台设置
      status: 'enabled',
      createTime: Date.now()
    }

    await usersCollection.doc(openId).set({ data: newUser })

    return {
      success: true,
      data: {
        _id: openId,
        openId: openId,
        ...newUser
      }
    }

  } catch (err) {
    return { success: false, error: err.message }
  }
}
