// pages/register/register.js
Page({
  data: {
    phone: '',
    password: '',
    email: '',
    canRegister: false
  },

  onLoad() {},

  // 手机号输入
  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
    this.updateCanRegister()
  },

  // 密码输入
  onPasswordInput(e) {
    this.setData({ password: e.detail.value })
    this.updateCanRegister()
  },

  // 邮箱输入
  onEmailInput(e) {
    this.setData({ email: e.detail.value })
  },

  // 更新注册按钮状态
  updateCanRegister() {
    const { phone, password } = this.data
    const canRegister = /^1[3-9]\d{9}$/.test(phone) && password.length >= 6
    this.setData({ canRegister })
  },

  // 注册
  onRegister() {
    const { phone, password, email } = this.data

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }
    if (!password || password.length < 6) {
      wx.showToast({ title: '密码至少6位', icon: 'none' })
      return
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      wx.showToast({ title: '邮箱格式错误', icon: 'none' })
      return
    }

    wx.showLoading({ title: '注册中...' })

    wx.cloud.callFunction({
      name: 'login',
      data: {
        action: 'register',
        phone: phone,
        password: password,
        email: email
      },
      success: res => {
        wx.hideLoading()
        if (res.result && res.result.success) {
          const user = res.result.data
          // 保存用户信息
          wx.setStorageSync('userInfo', user)
          wx.setStorageSync('userRole', user.role || 'employee')
          wx.showToast({ title: '注册成功', icon: 'success' })
          setTimeout(() => {
            wx.showModal({
              title: '注册成功',
              content: '您的账号已提交审核，请联系管理员开通',
              showCancel: false,
              success: () => {
                wx.redirectTo({ url: '/pages/login/login' })
              }
            })
          }, 1500)
        } else {
          wx.showToast({ title: res.result.error || '注册失败', icon: 'none' })
        }
      },
      fail: err => {
        wx.hideLoading()
        wx.showToast({ title: '注册失败', icon: 'none' })
        console.error('注册失败', err)
      }
    })
  },

  // 已有账号，去登录
  onGoLogin() {
    wx.navigateBack()
  }
})