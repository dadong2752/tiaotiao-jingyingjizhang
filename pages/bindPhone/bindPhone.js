// pages/bindPhone/bindPhone.js
Page({
  data: {
    phone: '',
    password: '',
    canBind: false
  },

  onLoad() {},

  // 手机号输入
  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
    this.updateCanBind()
  },

  // 密码输入
  onPasswordInput(e) {
    this.setData({ password: e.detail.value })
    this.updateCanBind()
  },

  // 更新绑定按钮状态
  updateCanBind() {
    const { phone, password } = this.data
    const canBind = /^1[3-9]\d{9}$/.test(phone) && password.length >= 6
    this.setData({ canBind })
  },

  // 确认绑定
  onBindPhone() {
    const { phone, password } = this.data

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }
    if (!password || password.length < 6) {
      wx.showToast({ title: '密码至少6位', icon: 'none' })
      return
    }

    wx.showLoading({ title: '绑定中...' })

    wx.cloud.callFunction({
      name: 'login',
      data: {
        action: 'bindPhone',
        phone: phone,
        password: password
      },
      success: res => {
        wx.hideLoading()
        if (res.result && res.result.success) {
          // 更新本地存储的用户信息
          const userInfo = wx.getStorageSync('userInfo')
          if (userInfo) {
            userInfo.phone = res.result.data.phoneNumber
            userInfo.needBindPhone = false
            wx.setStorageSync('userInfo', userInfo)
          }
          wx.showToast({ title: '绑定成功', icon: 'success' })
          setTimeout(() => {
            wx.redirectTo({ url: '/pages/index/index' })
          }, 1500)
        } else {
          wx.showToast({ title: res.result.error || '绑定失败', icon: 'none' })
        }
      },
      fail: err => {
        wx.hideLoading()
        wx.showToast({ title: '绑定失败', icon: 'none' })
        console.error('绑定手机号失败', err)
      }
    })
  }
})