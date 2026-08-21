// app.js
App({
  onLaunch() {
    // 初始化云开发
    wx.cloud.init({
      env: 'cloud1-d6gqwroxrc08ea02c',
      traceUser: true
    });

    // 测试云开发是否可用
    const db = wx.cloud.database();
    db.collection('transactions').count().then(res => {
      console.log('云开发连接成功', res.total);
    }).catch(err => {
      console.error('云开发连接失败', err);
    });
  }
})
