// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk')
const crypto = require('crypto')
cloud.init({ env: 'cloud1-d6gqwroxrc08ea02c' })

const db = cloud.database()
const usersCollection = db.collection('users')

// 密码哈希
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

// 生成随机 token
function generateToken() {
  return crypto.randomBytes(32).toString('hex')
}

// 验证手机号格式
function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone)
}

// 验证邮箱格式
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID || wxContext.openId
  const { action } = event

  // 通用：获取用户身份
  if (!openId) {
    return { success: false, error: '无法获取用户身份' }
  }

  try {
    // ========== register - 手机号+密码注册 ==========
    if (action === 'register') {
      const { phone, password, nickName, avatarUrl, email } = event

      // 参数校验
      if (!phone || !isValidPhone(phone)) {
        return { success: false, error: '手机号格式错误' }
      }
      if (!password || password.length < 6) {
        return { success: false, error: '密码至少6位' }
      }
      if (email && !isValidEmail(email)) {
        return { success: false, error: '邮箱格式错误' }
      }

      // 检查手机号是否已注册（通过 phone 字段查询）
      const existingByPhone = await usersCollection.where({ phone: phone }).get()
      if (existingByPhone.data && existingByPhone.data.length > 0) {
        return { success: false, error: '该手机号已注册' }
      }

      // 创建新用户（待审核状态）
      const newUser = {
        _id: openId,
        phone: phone,
        password: hashPassword(password),
        email: email || '',
        nickName: nickName || '用户',
        avatarUrl: avatarUrl || '',
        role: 'employee',
        status: 'pending',  // 待审核状态
        needBindPhone: false,
        createTime: Date.now()
      }

      await usersCollection.doc(openId).set({ data: newUser })

      // 返回用户信息（脱敏手机号）
      const maskedPhone = phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
      return {
        success: true,
        data: {
          _id: openId,
          openId: openId,
          phone: maskedPhone,
          nickName: newUser.nickName,
          avatarUrl: newUser.avatarUrl,
          role: newUser.role,
          needBindPhone: false
        }
      }
    }

    // ========== login - 手机号+密码登录 ==========
    if (action === 'login') {
      const { phone, password } = event

      // 参数校验
      if (!phone || !isValidPhone(phone)) {
        return { success: false, error: '手机号格式错误' }
      }
      if (!password) {
        return { success: false, error: '请输入密码' }
      }

      // 通过手机号查找用户
      const userRes = await usersCollection.where({ phone: phone }).get()
      if (!userRes.data || userRes.data.length === 0) {
        return { success: false, error: '该手机号未注册' }
      }

      const user = userRes.data[0]

      // 验证密码
      if (user.password !== hashPassword(password)) {
        return { success: false, error: '密码错误' }
      }

      // 检查账号状态
      if (user.status === 'disabled') {
        return { success: false, error: '账号已被禁用' }
      }
      if (user.status === 'pending') {
        return { success: false, error: '账号待审核，请联系管理员' }
      }

      // 更新昵称头像（如有变化，且通过微信登录）
      const updateData = {}
      if (event.nickName && event.nickName !== user.nickName) {
        updateData.nickName = event.nickName
      }
      if (event.avatarUrl && event.avatarUrl !== user.avatarUrl) {
        updateData.avatarUrl = event.avatarUrl
      }
      if (Object.keys(updateData).length > 0) {
        await usersCollection.doc(user._id).update({ data: updateData })
        user = { ...user, ...updateData }
      }

      // 返回用户信息
      const maskedPhone = user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : ''
      return {
        success: true,
        data: {
          _id: user._id,
          openId: user._id,
          phone: maskedPhone,
          nickName: user.nickName,
          avatarUrl: user.avatarUrl,
          role: user.role || 'employee',
          needBindPhone: user.needBindPhone || false
        }
      }
    }

    // ========== checkPhone - 检查手机号是否已注册 ==========
    if (action === 'checkPhone') {
      const { phone } = event

      if (!phone || !isValidPhone(phone)) {
        return { success: false, error: '手机号格式错误' }
      }

      const userRes = await usersCollection.where({ phone: phone }).get()
      return {
        success: true,
        data: { exists: userRes.data && userRes.data.length > 0 }
      }
    }

    // ========== sendResetEmail - 发送密码重置邮件 ==========
    if (action === 'sendResetEmail') {
      const { email } = event

      if (!email || !isValidEmail(email)) {
        return { success: false, error: '邮箱格式错误' }
      }

      // 查找用户
      const userRes = await usersCollection.where({ email: email }).get()
      if (!userRes.data || userRes.data.length === 0) {
        // 为防止邮箱枚举攻击，返回成功
        return { success: true, message: '如果邮箱已注册，将收到重置链接' }
      }

      const user = userRes.data[0]

      // 生成重置 token（24小时有效）
      const resetToken = generateToken()
      const resetExpire = Date.now() + 24 * 60 * 60 * 1000

      await usersCollection.doc(user._id).update({
        data: {
          resetToken: resetToken,
          resetExpire: resetExpire
        }
      })

      // TODO: 发送邮件（需要配置邮件服务）
      // 这里先记录日志，实际发送需要配置邮件 API
      console.log(`密码重置链接: https://example.com/reset?token=${resetToken}`)

      return {
        success: true,
        message: '如果邮箱已注册，将收到重置链接'
      }
    }

    // ========== resetPassword - 重置密码 ==========
    if (action === 'resetPassword') {
      const { token, newPassword } = event

      if (!token) {
        return { success: false, error: '无效的 token' }
      }
      if (!newPassword || newPassword.length < 6) {
        return { success: false, error: '密码至少6位' }
      }

      // 通过 resetToken 查找用户
      const userRes = await usersCollection.where({ resetToken: token }).get()
      if (!userRes.data || userRes.data.length === 0) {
        return { success: false, error: '无效的 token' }
      }

      const user = userRes.data[0]

      // 检查 token 是否过期
      if (user.resetExpire < Date.now()) {
        return { success: false, error: 'token 已过期，请重新获取' }
      }

      // 更新密码并清除 token
      await usersCollection.doc(user._id).update({
        data: {
          password: hashPassword(newPassword),
          resetToken: '',
          resetExpire: 0
        }
      })

      return { success: true, message: '密码重置成功' }
    }

    // ========== bindPhone - 绑定手机号（微信登录后） ==========
    if (action === 'bindPhone') {
      const { code, phone, password } = event

      let phoneNumber = phone

      // 如果有 code，通过微信 API 获取手机号
      if (code) {
        try {
          const phoneRes = await cloud.openapi.phonenumber.getPhoneNumber({ code })
          phoneNumber = phoneRes.phone_info.phoneNumber
        } catch (err) {
          return { success: false, error: '获取手机号失败: ' + err.message }
        }
      }

      if (!phoneNumber || !isValidPhone(phoneNumber)) {
        return { success: false, error: '手机号格式错误' }
      }
      if (!password || password.length < 6) {
        return { success: false, error: '密码至少6位' }
      }

      // 获取当前用户
      const userRes = await usersCollection.doc(openId).get()
      if (!userRes.data) {
        return { success: false, error: '用户不存在' }
      }

      const user = userRes.data

      // 检查手机号是否已被他人使用
      const existingByPhone = await usersCollection.where({ phone: phoneNumber }).get()
      if (existingByPhone.data && existingByPhone.data.length > 0) {
        const existing = existingByPhone.data[0]
        if (existing._id !== openId) {
          return { success: false, error: '该手机号已被其他账号使用' }
        }
      }

      // 更新用户手机号和密码
      await usersCollection.doc(openId).update({
        data: {
          phone: phoneNumber,
          password: hashPassword(password),
          needBindPhone: false
        }
      })

      const maskedPhone = phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
      return { success: true, data: { phoneNumber: maskedPhone } }
    }

    // ========== 微信登录（原有逻辑简化） ==========
    // 微信登录只需要 OpenID，自动创建/登录用户
    const userRes = await usersCollection.doc(openId).get()

    if (userRes.data) {
      // 用户已存在
      if (userRes.data.status === 'disabled') {
        return { success: false, error: '账号已被禁用' }
      }

      // 更新昵称头像
      const updateData = {}
      if (event.nickName && event.nickName !== userRes.data.nickName) {
        updateData.nickName = event.nickName
      }
      if (event.avatarUrl && event.avatarUrl !== userRes.data.avatarUrl) {
        updateData.avatarUrl = event.avatarUrl
      }
      if (Object.keys(updateData).length > 0) {
        await usersCollection.doc(openId).update({ data: updateData })
        userRes.data = { ...userRes.data, ...updateData }
      }

      const user = userRes.data
      const maskedPhone = user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : ''

      return {
        success: true,
        data: {
          _id: openId,
          openId: openId,
          phone: maskedPhone,
          nickName: user.nickName,
          avatarUrl: user.avatarUrl,
          role: user.role || 'employee',
          needBindPhone: user.needBindPhone && !user.phone
        }
      }
    }

    // 用户不存在，创建一个新用户（微信登录）
    const newUser = {
      _id: openId,
      phone: '',
      password: '',
      email: '',
      nickName: event.nickName || '用户',
      avatarUrl: event.avatarUrl || '',
      role: 'employee',
      status: 'enabled',
      needBindPhone: true,  // 需要绑定手机号
      createTime: Date.now()
    }

    await usersCollection.doc(openId).set({ data: newUser })

    return {
      success: true,
      data: {
        _id: openId,
        openId: openId,
        phone: '',
        nickName: newUser.nickName,
        avatarUrl: newUser.avatarUrl,
        role: newUser.role,
        needBindPhone: true
      }
    }

  } catch (err) {
    return { success: false, error: err.message }
  }
}