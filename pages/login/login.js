// pages/login/login.js
Page({
  data: {
    phone: '',
    password: '',
    canLogin: false
  },

  onLoad(options) {
    // 检查是否已登录
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo && userInfo.openId) {
      wx.redirectTo({ url: '/pages/index/index' })
    }
  },

  // 手机号输入
  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
    this.updateCanLogin()
  },

  // 密码输入
  onPasswordInput(e) {
    this.setData({ password: e.detail.value })
    this.updateCanLogin()
  },

  // 更新登录按钮状态
  updateCanLogin() {
    const { phone, password } = this.data
    const canLogin = /^1[3-9]\d{9}$/.test(phone) && password.length >= 6
    this.setData({ canLogin })
  },

  // 手机号+密码登录
  onLogin() {
    const { phone, password } = this.data

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }
    if (!password || password.length < 6) {
      wx.showToast({ title: '密码至少6位', icon: 'none' })
      return
    }

    wx.showLoading({ title: '登录中...' })

    wx.cloud.callFunction({
      name: 'login',
      data: {
        action: 'login',
        phone: phone,
        password: password
      },
      success: res => {
        wx.hideLoading()
        if (res.result && res.result.success) {
          const user = res.result.data
          this.handleLoginSuccess(user)
        } else {
          wx.showToast({ title: res.result.error || '登录失败', icon: 'none' })
        }
      },
      fail: err => {
        wx.hideLoading()
        wx.showToast({ title: '登录失败', icon: 'none' })
        console.error('登录失败', err)
      }
    })
  },

  // 微信一键登录
  onGetPhoneNumber(e) {
    if (e.detail.errMsg && e.detail.errMsg.includes('cancel')) {
      wx.showToast({ title: '您取消了授权', icon: 'none' })
      return
    }
    if (!e.detail.cloudId) {
      wx.showToast({ title: '请允许获取手机号授权', icon: 'none' })
      return
    }

    wx.showLoading({ title: '登录中...' })

    wx.cloud.callFunction({
      name: 'login',
      data: {
        action: 'bindPhone',
        code: e.detail.code
      },
      success: res => {
        wx.hideLoading()
        if (res.result && res.result.success) {
          const user = res.result.data
          this.handleLoginSuccess(user)
        } else {
          wx.showToast({ title: res.result.error || '登录失败', icon: 'none' })
        }
      },
      fail: err => {
        wx.hideLoading()
        wx.showToast({ title: '登录失败', icon: 'none' })
        console.error('微信登录失败', err)
      }
    })
  },

  // 处理登录成功
  handleLoginSuccess(user) {
    // 保存用户信息
    wx.setStorageSync('userInfo', user)
    wx.setStorageSync('userRole', user.role || 'employee')

    // 检查是否需要绑定手机号
    if (user.needBindPhone) {
      wx.redirectTo({ url: '/pages/login/bindPhone' })
    } else {
      wx.redirectTo({ url: '/pages/index/index' })
    }
  },

  // 忘记密码
  onForgotPassword() {
    wx.navigateTo({ url: '/pages/forgot/forgot' })
  },

  // 注册账号
  onRegister() {
    wx.navigateTo({ url: '/pages/register/register' })
  }
})