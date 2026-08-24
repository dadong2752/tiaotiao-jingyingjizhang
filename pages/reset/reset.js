// pages/reset/reset.js
Page({
  data: {
    token: '',
    newPassword: '',
    confirmPassword: '',
    canReset: false
  },

  onLoad(options) {
    // 从 URL 参数获取 token
    if (options.token) {
      this.setData({ token: options.token })
    }
  },

  // 新密码输入
  onNewPasswordInput(e) {
    this.setData({ newPassword: e.detail.value })
    this.updateCanReset()
  },

  // 确认密码输入
  onConfirmPasswordInput(e) {
    this.setData({ confirmPassword: e.detail.value })
    this.updateCanReset()
  },

  // 更新重置按钮状态
  updateCanReset() {
    const { newPassword, confirmPassword } = this.data
    const canReset = newPassword.length >= 6 && newPassword === confirmPassword
    this.setData({ canReset })
  },

  // 确认重置
  onResetPassword() {
    const { token, newPassword, confirmPassword } = this.data

    if (!newPassword || newPassword.length < 6) {
      wx.showToast({ title: '密码至少6位', icon: 'none' })
      return
    }
    if (newPassword !== confirmPassword) {
      wx.showToast({ title: '两次密码不一致', icon: 'none' })
      return
    }

    wx.showLoading({ title: '重置中...' })

    wx.cloud.callFunction({
      name: 'login',
      data: {
        action: 'resetPassword',
        token: token,
        newPassword: newPassword
      },
      success: res => {
        wx.hideLoading()
        if (res.result && res.result.success) {
          wx.showModal({
            title: '重置成功',
            content: '请使用新密码登录',
            showCancel: false,
            success: () => {
              wx.redirectTo({ url: '/pages/login/login' })
            }
          })
        } else {
          wx.showToast({ title: res.result.error || '重置失败', icon: 'none' })
        }
      },
      fail: err => {
        wx.hideLoading()
        wx.showToast({ title: '重置失败', icon: 'none' })
        console.error('重置密码失败', err)
      }
    })
  }
})