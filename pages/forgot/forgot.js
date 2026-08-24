// pages/forgot/forgot.js
Page({
  data: {
    email: '',
    canSend: false
  },

  onLoad() {},

  // 邮箱输入
  onEmailInput(e) {
    const email = e.detail.value
    this.setData({ email })
    this.updateCanSend()
  },

  // 更新发送按钮状态
  updateCanSend() {
    const { email } = this.data
    const canSend = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    this.setData({ canSend })
  },

  // 发送重置链接
  onSendReset() {
    const { email } = this.data

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      wx.showToast({ title: '请输入正确邮箱', icon: 'none' })
      return
    }

    wx.showLoading({ title: '发送中...' })

    wx.cloud.callFunction({
      name: 'login',
      data: {
        action: 'sendResetEmail',
        email: email
      },
      success: res => {
        wx.hideLoading()
        if (res.result && res.result.success) {
          wx.showModal({
            title: '发送成功',
            content: '请登录邮箱查看重置链接',
            showCancel: false,
            success: () => {
              wx.navigateBack()
            }
          })
        } else {
          wx.showToast({ title: res.result.error || '发送失败', icon: 'none' })
        }
      },
      fail: err => {
        wx.hideLoading()
        wx.showToast({ title: '发送失败', icon: 'none' })
        console.error('发送重置邮件失败', err)
      }
    })
  }
})