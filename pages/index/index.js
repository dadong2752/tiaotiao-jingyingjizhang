// pages/index/index.js

// 配置和工具
const { CHART_COLORS } = require('../../utils/format.js');
const { DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES } = require('../../utils/config.js');
const { generateExcelXML, downloadExcel } = require('../../utils/excel.js');

// 分类选项（从配置读取）
const INCOME_CATEGORIES = DEFAULT_INCOME_CATEGORIES;
const EXPENSE_CATEGORIES = DEFAULT_EXPENSE_CATEGORIES;

Page({
  data: {
    // Tab 切换
    currentTab: 'account',
    // 用户信息
    isLoggedIn: false,
    isGuest: false, // 是否为访客模式
    userInfo: null,
    userRole: 'employee', // owner: 店长, employee: 员工
    // 统计数据
    todayIncome: '0.00',
    todayExpense: '0.00',
    todayProfit: '0.00',
    monthIncome: '0.00',
    monthExpense: '0.00',
    monthProfit: '0.00',
    statsLoading: false,
    // 记录列表
    records: [],
    // 表单状态
    showModal: false,
    formType: 'income',
    incomeCategories: INCOME_CATEGORIES,
    expenseCategories: EXPENSE_CATEGORIES,
    selectedCategory: '',
    amount: '',
    selectedDate: '',
    remark: '',
    supplier: '',
    editingId: null,
    isValid: false,
    // 添加自定义分类
    showAddCategory: false,
    newCategoryName: '',
    currentCategories: INCOME_CATEGORIES,
    // 数据分析页面
    dataYear: 0,
    dataMonth: 0,
    dataIncome: '0.00',
    dataExpense: '0.00',
    dataProfit: '0.00',
    trendType: 'day',
    categoryData: [],
    monthData: [],
    // 设置页面
    showSettings: false,
    editNickName: '',
    profileAvatarText: '',
    profileAvatarColor: '#1890FF',
    userPhone: '',
    settings: {
      dailyReminderEnabled: true,
      reminderTime: '21:00'
    },
    expenseThreshold: '',
    lossThreshold: '',
    // 导出筛选
    showExportFilter: false,
    filterStartDate: '',
    filterEndDate: '',
    filterType: 'all',
    filterCategories: [],
    allCategories: INCOME_CATEGORIES.concat(EXPENSE_CATEGORIES),
    exportData: [],
    // 员工管理
    showUserManage: false,
    userList: [],
    roleOptions: [
      { name: '店长', value: 'owner' },
      { name: '管理员', value: 'admin' },
      { name: '审核员', value: 'reviewer' },
      { name: '录入员', value: 'employee' }
    ],
    // 默认头像颜色配置
    avatarColors: ['#1890FF', '#52C41A', '#FF4D4F', '#FAAD14', '#722ED1', '#13C2C2', '#EB2F96', '#F5222D'],
    // 明细 Tab
    detailType: 'income'
  },

  onLoad() {
    const now = new Date();
    this.setData({
      dataYear: now.getFullYear(),
      dataMonth: now.getMonth() + 1
    });
    this.initDate();
    // 开启分享菜单（非阻塞）
    wx.showShareMenu({
      menus: ['shareAppMessage', 'shareTimeline']
    });
    // 用户信息检查延迟执行，避免阻塞启动
    setTimeout(() => {
      this.checkLocalUserInfo();
    }, 500);
  },

  // 登录（button 方式）
  onGetUserInfo(e) {
    if (!e.detail.userInfo) {
      wx.showToast({ title: '请允许获取用户信息', icon: 'none' });
      return;
    }

    const that = this;

    // 已有用户信息，直接恢复登录
    const cachedUserInfo = wx.getStorageSync('userInfo');
    if (cachedUserInfo) {
      this.setData({
        isLoggedIn: true,
        isGuest: false,
        userInfo: cachedUserInfo,
        userRole: wx.getStorageSync('userRole') || 'employee'
      });
      this.loadRecords();
      return;
    }

    wx.showLoading({ title: '登录中...' });

    wx.cloud.callFunction({
      name: 'login',
      data: {
        userInfo: {
          nickName: e.detail.userInfo.nickName,
          avatarUrl: e.detail.userInfo.avatarUrl
        }
      },
      success: (res) => {
        wx.hideLoading();

        if (res.result && res.result.success) {
          const user = res.result.data;
          that.setData({
            isLoggedIn: true,
            isGuest: false,
            userInfo: {
              nickName: user.nickName || '用户',
              avatarUrl: user.avatarUrl || '',
              openId: user.openId || '',
              phone: user.phone || ''
            },
            userRole: user.role || 'employee'
          });
          // 保存到本地存储
          wx.setStorageSync('userInfo', that.data.userInfo);
          wx.setStorageSync('userRole', user.role || 'employee');
          wx.showToast({ title: '登录成功', icon: 'success' });

          // 检查是否有访客数据需要迁移
          that.checkGuestDataMigration();

          // 加载云端数据
          that.loadRecords();
        } else {
          wx.showToast({ title: '登录失败: ' + (res.result?.error || '未知错误'), icon: 'none', duration: 3000 });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '登录失败', icon: 'none' });
      }
    });
  },

  // 检查本地存储的用户信息
  checkLocalUserInfo() {
    const userInfo = wx.getStorageSync('userInfo');
    const userRole = wx.getStorageSync('userRole');
    const guestTransactions = wx.getStorageSync('guestTransactions') || [];

    if (userInfo) {
      this.setData({
        userInfo: userInfo,
        userRole: userRole || 'employee',
        isLoggedIn: true,
        isGuest: false
      });
      // 加载记录
      this.loadRecords();
    } else if (guestTransactions.length > 0) {
      // 有访客数据，恢复访客模式
      this.setData({
        isGuest: true,
        isLoggedIn: false
      });
      this.loadGuestRecords();
      this.calculateGuestStats();
    }
  },

  onShow() {
    if (this.data.isGuest) {
      this.calculateGuestStats();
      this.loadGuestRecords();
    } else if (this.data.isLoggedIn) {
      this.calculateStats();
      this.loadRecords();
    }
  },

  // 初始化日期
  initDate() {
    const today = this.formatDate(new Date());
    this.setData({ selectedDate: today });
  },

  // 格式化日期为 YYYY-MM-DD
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 获取当月第一天
  getMonthFirstDay() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  },

  // 获取今日日期字符串
  getTodayDate() {
    return this.formatDate(new Date());
  },

  // 生成 UUID
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  // 加载记录（通过云函数）
  loadRecords() {
    wx.showLoading({ title: '加载中...' });

    wx.cloud.callFunction({
      name: 'getTransactions',
      data: { action: 'list' },
      timeout: 15000,
      success: res => {
        if (res.result && res.result.success) {
          const processedRecords = res.result.data.map(r => ({
            ...r,
            amountDisplay: (r.amount / 100).toFixed(2)
          }));
          this.setData({ records: processedRecords });
          this.calculateStats();
        } else {
          wx.showToast({ title: '加载失败', icon: 'none' });
        }
      },
      fail: err => {
        console.error('加载失败', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // 计算统计数据（通过云函数）
  calculateStats() {
    this.setData({ statsLoading: true });
    const today = this.getTodayDate();
    const monthStart = this.getMonthFirstDay();

    wx.cloud.callFunction({
      name: 'getTransactions',
      data: {
        action: 'stats',
        today: today,
        monthStart: monthStart
      },
      timeout: 15000,
      success: res => {
        if (res.result && res.result.success) {
          const stats = res.result.data;
          this.setData({
            todayIncome: (stats.todayIncome / 100).toFixed(2),
            todayExpense: (stats.todayExpense / 100).toFixed(2),
            todayProfit: (stats.todayProfit / 100).toFixed(2),
            monthIncome: (stats.monthIncome / 100).toFixed(2),
            monthExpense: (stats.monthExpense / 100).toFixed(2),
            monthProfit: (stats.monthProfit / 100).toFixed(2)
          });
        }
      },
      fail: err => {
        console.error('计算统计失败', err);
      },
      complete: () => {
        this.setData({ statsLoading: false });
      }
    });
  },

  // ============ 访客模式相关 ============

  // 检查登录状态并引导
  checkLoginAndProceed(callback) {
    wx.showModal({
      title: '提示',
      content: '登录后数据会同步到云端，访客模式数据仅保存在本地，是否继续？',
      confirmText: '登录',
      cancelText: '访客模式',
      success: (res) => {
        if (res.confirm) {
          // 用户选择登录
          this.onGetUserInfo();
        } else if (res.cancel) {
          // 用户选择访客模式
          this.enterGuestMode();
        }
      }
    });
  },

  // 进入访客模式
  enterGuestMode() {
    this.setData({
      isGuest: true,
      isLoggedIn: false,
      userInfo: null
    });
    this.loadGuestRecords();
    this.calculateGuestStats();
  },

  // 加载访客记录
  loadGuestRecords() {
    const guestTransactions = wx.getStorageSync('guestTransactions') || [];
    const processedRecords = guestTransactions.map(r => ({
      ...r,
      amountDisplay: (r.amount / 100).toFixed(2)
    }));
    this.setData({ records: processedRecords });
  },

  // 计算访客统计数据
  calculateGuestStats() {
    const guestTransactions = wx.getStorageSync('guestTransactions') || [];
    const today = this.getTodayDate();
    const monthStart = this.getMonthFirstDay();

    let todayIncome = 0, todayExpense = 0;
    let monthIncome = 0, monthExpense = 0;

    guestTransactions.forEach(r => {
      if (r.type === 'income') {
        if (r.date === today) todayIncome += r.amount;
        if (r.date >= monthStart) monthIncome += r.amount;
      } else {
        if (r.date === today) todayExpense += r.amount;
        if (r.date >= monthStart) monthExpense += r.amount;
      }
    });

    this.setData({
      todayIncome: (todayIncome / 100).toFixed(2),
      todayExpense: (todayExpense / 100).toFixed(2),
      todayProfit: ((todayIncome - todayExpense) / 100).toFixed(2),
      monthIncome: (monthIncome / 100).toFixed(2),
      monthExpense: (monthExpense / 100).toFixed(2),
      monthProfit: ((monthIncome - monthExpense) / 100).toFixed(2)
    });
  },

  // 访客模式提交记录
  submitGuestRecord(recordData) {
    const { editingId, type, category, amount, date, remark, supplier } = recordData;
    let guestTransactions = wx.getStorageSync('guestTransactions') || [];

    if (editingId) {
      // 编辑模式
      const index = guestTransactions.findIndex(r => r._id === editingId);
      if (index > -1) {
        guestTransactions[index] = {
          ...guestTransactions[index],
          category,
          amount,
          date,
          remark,
          supplier: supplier || '',
          updateTime: Date.now()
        };
      }
    } else {
      // 新增模式
      guestTransactions.unshift({
        _id: this.generateUUID(),
        type,
        category,
        amount,
        date,
        remark,
        supplier: supplier || '',
        createTime: Date.now(),
        isLocal: true
      });
    }

    wx.setStorageSync('guestTransactions', guestTransactions);

    wx.hideLoading();
    this.setData({ showModal: false });
    this.loadGuestRecords();
    this.calculateGuestStats();
    wx.showToast({ title: editingId ? '修改成功' : '记账成功', icon: 'success' });
  },

  // 登录后检查访客数据迁移
  checkGuestDataMigration() {
    const guestTransactions = wx.getStorageSync('guestTransactions') || [];

    if (guestTransactions.length > 0) {
      wx.showModal({
        title: '检测到访客数据',
        content: `您有 ${guestTransactions.length} 条访客记录，是否导入到云端？`,
        confirmText: '导入',
        cancelText: '忽略',
        success: (res) => {
          if (res.confirm) {
            this.migrateGuestData(guestTransactions);
          } else {
            this.clearGuestData();
          }
        }
      });
    }
  },

  // 迁移访客数据到云端
  migrateGuestData(guestTransactions) {
    wx.showLoading({ title: '导入中...' });

    const db = wx.cloud.database();
    const batchSize = 10;
    let imported = 0;

    const importBatch = (startIndex) => {
      const batch = guestTransactions.slice(startIndex, startIndex + batchSize);
      if (batch.length === 0) {
        wx.hideLoading();
        this.clearGuestData();
        this.loadRecords();
        wx.showModal({
          title: '导入完成',
          content: `已导入 ${imported} 条记录`,
          showCancel: false
        });
        return;
      }

      const tasks = batch.map(record => {
        return db.collection('transactions').add({
          data: {
            _id: record._id,
            type: record.type,
            category: record.category,
            amount: record.amount,
            date: record.date,
            remark: record.remark || '',
            supplier: record.supplier || '',
            createTime: record.createTime,
            creator: '访客导入',
            creatorOpenId: this.data.userInfo.openId,
            creatorAvatar: this.data.userInfo.avatarUrl,
            status: 'approved',
            migratedFrom: 'guest'
          }
        });
      });

      Promise.all(tasks).then(results => {
        imported += results.length;
        importBatch(startIndex + batchSize);
      }).catch(err => {
        wx.hideLoading();
        wx.showToast({ title: '导入失败', icon: 'none' });
        console.error('导入失败', err);
      });
    };

    importBatch(0);
  },

  // 清除访客数据
  clearGuestData() {
    wx.removeStorageSync('guestTransactions');
    wx.removeStorageSync('guestIncomeCategories');
    wx.removeStorageSync('guestExpenseCategories');
  },

  // 显示收入表单
  showIncomeForm() {
    // 未登录且非访客，弹出选择
    if (!this.data.isLoggedIn && !this.data.isGuest) {
      this.checkLoginAndProceed();
      return;
    }

    // 根据模式获取分类
    const storageKey = this.data.isGuest ? 'guestIncomeCategories' : 'incomeCategories';
    const savedCategories = wx.getStorageSync(storageKey);
    const incomeCategories = savedCategories && savedCategories.length > 0 ? savedCategories : INCOME_CATEGORIES;

    this.setData({
      showModal: true,
      formType: 'income',
      incomeCategories: incomeCategories,
      currentCategories: incomeCategories,
      selectedCategory: incomeCategories[0],
      amount: '',
      remark: '',
      supplier: '',
      editingId: null,
      isValid: false
    });
    this.initDate();
  },

  // 显示支出表单
  showExpenseForm() {
    // 未登录且非访客，弹出选择
    if (!this.data.isLoggedIn && !this.data.isGuest) {
      this.checkLoginAndProceed();
      return;
    }

    // 根据模式获取分类
    const storageKey = this.data.isGuest ? 'guestExpenseCategories' : 'expenseCategories';
    const savedCategories = wx.getStorageSync(storageKey);
    const expenseCategories = savedCategories && savedCategories.length > 0 ? savedCategories : EXPENSE_CATEGORIES;

    this.setData({
      showModal: true,
      formType: 'expense',
      expenseCategories: expenseCategories,
      currentCategories: expenseCategories,
      selectedCategory: expenseCategories[0],
      amount: '',
      remark: '',
      supplier: '',
      editingId: null,
      isValid: false
    });
    this.initDate();
  },

  // 关闭弹窗
  closeModal() {
    this.setData({ showModal: false });
  },

  // 分类选择
  onCategoryChange(e) {
    const categories = this.data.formType === 'income' ? this.data.incomeCategories : this.data.expenseCategories;
    const selectedCategory = categories[e.detail.value];
    this.setData({ selectedCategory });
    this.updateValidStatus(selectedCategory, this.data.amount);
  },

  // 金额输入
  onAmountInput(e) {
    const amount = e.detail.value;
    this.setData({ amount });
    this.updateValidStatus(this.data.selectedCategory, amount);
  },

  // 日期选择
  onDateChange(e) {
    this.setData({ selectedDate: e.detail.value });
  },

  // 供应商输入
  onSupplierInput(e) {
    this.setData({ supplier: e.detail.value });
  },

  // 备注输入
  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  // 更新表单验证状态
  updateValidStatus(category, amount) {
    const amountNum = parseFloat(amount);
    const isValid = !!(category && amount && amountNum > 0 && amountNum <= 999999.99);
    this.setData({ isValid });
  },

  // 验证表单
  isValidForm() {
    const { selectedCategory, amount } = this.data;
    const amountNum = parseFloat(amount);
    return selectedCategory && amount && amountNum > 0 && amountNum <= 999999.99;
  },

  // 提交表单（通过云函数）
  submitForm() {
    if (!this.isValidForm()) {
      return;
    }

    const { formType, selectedCategory, amount, selectedDate, remark, supplier, editingId, userInfo, isGuest } = this.data;
    const amountInCents = Math.round(parseFloat(amount) * 100);

    // 访客模式
    if (isGuest) {
      this.submitGuestRecord({
        editingId,
        type: formType,
        category: selectedCategory,
        amount: amountInCents,
        date: selectedDate,
        remark,
        supplier
      });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    if (editingId) {
      // 编辑现有记录 - 通过云函数
      wx.cloud.callFunction({
        name: 'getTransactions',
        data: {
          action: 'update',
          recordId: editingId,
          category: selectedCategory,
          amount: amountInCents,
          date: selectedDate,
          remark: remark,
          supplier: supplier
        },
        success: res => {
          wx.hideLoading();
          if (res.result && res.result.success) {
            this.setData({ showModal: false });
            this.loadRecords();
            wx.showToast({ title: '修改成功', icon: 'success' });
          } else {
            wx.showToast({ title: res.result.error || '保存失败', icon: 'none' });
          }
        },
        fail: err => {
          wx.hideLoading();
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      });
    } else {
      // 新增记录 - 通过云函数
      wx.cloud.callFunction({
        name: 'getTransactions',
        data: {
          action: 'create',
          type: formType,
          category: selectedCategory,
          amount: amountInCents,
          date: selectedDate,
          remark: remark,
          supplier: supplier
        },
        success: res => {
          wx.hideLoading();
          if (res.result && res.result.success) {
            this.setData({ showModal: false });
            this.loadRecords();
            wx.showToast({ title: '记账成功', icon: 'success' });
          } else {
            wx.showToast({ title: res.result.error || '保存失败', icon: 'none' });
          }
        },
        fail: err => {
          wx.hideLoading();
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      });
    }
  },

  // 显示添加分类弹窗
  showAddCategoryModal() {
    this.setData({
      showAddCategory: true,
      newCategoryName: ''
    });
  },

  // 关闭添加分类弹窗
  closeAddCategoryModal() {
    this.setData({ showAddCategory: false });
  },

  // 输入新分类名称
  onNewCategoryInput(e) {
    this.setData({ newCategoryName: e.detail.value });
  },

  // 确认添加分类
  confirmAddCategory() {
    const { newCategoryName, formType, incomeCategories, expenseCategories, isGuest } = this.data;
    if (!newCategoryName || !newCategoryName.trim()) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' });
      return;
    }

    const trimmedName = newCategoryName.trim();
    const categories = formType === 'income' ? incomeCategories : expenseCategories;

    // 检查是否已存在
    if (categories.includes(trimmedName)) {
      wx.showToast({ title: '该分类已存在', icon: 'none' });
      return;
    }

    // 根据模式选择存储 key
    const storageKeyPrefix = isGuest ? 'guest' : '';

    // 添加到分类列表
    if (formType === 'income') {
      const newCategories = [...incomeCategories, trimmedName];
      this.setData({ incomeCategories: newCategories });
      wx.setStorageSync(storageKeyPrefix + 'incomeCategories', newCategories);
    } else {
      const newCategories = [...expenseCategories, trimmedName];
      this.setData({ expenseCategories: newCategories });
      wx.setStorageSync(storageKeyPrefix + 'expenseCategories', newCategories);
    }

    // 更新当前选中的分类
    this.setData({
      selectedCategory: trimmedName,
      showAddCategory: false,
      newCategoryName: ''
    });

    wx.showToast({ title: '添加成功', icon: 'success' });
  },

  // 编辑记录
  editRecord(e) {
    const id = e.currentTarget.dataset.id;
    const record = this.data.records.find(r => r._id === id);
    const { userRole, userInfo, isGuest } = this.data;

    // 检查记录是否存在
    if (!record) {
      wx.showToast({ title: '记录不存在', icon: 'none' });
      return;
    }

    // 访客模式：直接编辑本地记录
    if (isGuest) {
      const amount = (record.amount / 100).toFixed(2);
      this.setData({
        showModal: true,
        formType: record.type,
        selectedCategory: record.category,
        amount: amount,
        selectedDate: record.date,
        remark: record.remark || '',
        supplier: record.supplier || '',
        editingId: id,
        isValid: true
      });
      return;
    }

    // 权限检查：店长可以编辑所有记录，员工只能编辑自己的记录
    if (userRole !== 'owner' && record.creatorOpenId !== (userInfo ? userInfo.openId : '')) {
      wx.showToast({ title: '只能编辑自己的记录', icon: 'none' });
      return;
    }

    const amount = (record.amount / 100).toFixed(2);
    this.setData({
      showModal: true,
      formType: record.type,
      selectedCategory: record.category,
      amount: amount,
      selectedDate: record.date,
      remark: record.remark || '',
      supplier: record.supplier || '',
      editingId: id,
      isValid: true
    });
  },

  // 删除记录（直接使用数据库）
  deleteRecord(e) {
    const id = e.currentTarget.dataset.id;
    const { userRole, userInfo, isGuest } = this.data;

    // 访客模式：直接删除本地记录
    if (isGuest) {
      wx.showModal({
        title: '确认删除',
        content: '确定要删除这条记录吗？',
        success: (res) => {
          if (res.confirm) {
            let guestTransactions = wx.getStorageSync('guestTransactions') || [];
            guestTransactions = guestTransactions.filter(r => r._id !== id);
            wx.setStorageSync('guestTransactions', guestTransactions);
            this.loadGuestRecords();
            this.calculateGuestStats();
            wx.showToast({ title: '删除成功', icon: 'success' });
          }
        }
      });
      return;
    }

    const record = this.data.records.find(r => r._id === id);

    // 检查记录是否存在
    if (!record) {
      wx.showToast({ title: '记录不存在', icon: 'none' });
      return;
    }

    // 权限检查：店长可以删除所有记录，员工只能删除自己的记录
    if (userRole !== 'owner' && record.creatorOpenId !== (userInfo ? userInfo.openId : '')) {
      wx.showToast({ title: '只能删除自己的记录', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.cloud.callFunction({
            name: 'getTransactions',
            data: {
              action: 'delete',
              recordId: id
            },
            success: res => {
              if (res.result && res.result.success) {
                this.loadRecords();
                wx.showToast({ title: '删除成功', icon: 'success' });
              } else {
                wx.showToast({ title: res.result.error || '删除失败', icon: 'none' });
              }
            },
            fail: err => {
              wx.showToast({ title: '删除失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  // 审核通过记录
  approveRecord(e) {
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认审核',
      content: '确定要通过这条记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '审核中...' });

          wx.cloud.callFunction({
            name: 'getTransactions',
            data: {
              action: 'approve',
              recordId: id
            },
            success: res => {
              wx.hideLoading();
              if (res.result && res.result.success) {
                wx.showToast({ title: '审核通过', icon: 'success' });
                this.loadRecords();
              } else {
                wx.showToast({ title: res.result.error || '审核失败', icon: 'none' });
              }
            },
            fail: err => {
              wx.hideLoading();
              wx.showToast({ title: '审核失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  // 驳回记录
  rejectRecord(e) {
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认驳回',
      content: '确定要驳回这条记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });

          wx.cloud.callFunction({
            name: 'getTransactions',
            data: {
              action: 'reject',
              recordId: id
            },
            success: res => {
              wx.hideLoading();
              if (res.result && res.result.success) {
                wx.showToast({ title: '已驳回', icon: 'success' });
                this.loadRecords();
              } else {
                wx.showToast({ title: res.result.error || '操作失败', icon: 'none' });
              }
            },
            fail: err => {
              wx.hideLoading();
              wx.showToast({ title: '操作失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  // 分享给朋友
  onShareAppMessage(res) {
    return {
      title: '跳跳经营记账 - 实时掌握收支数据',
      path: '/pages/index/index',
      imageUrl: ''
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '跳跳经营记账 - 实时掌握收支数据',
      query: '',
      imageUrl: ''
    };
  },

  // ============ Tab 切换 ============
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    if (tab === 'data') {
      this.loadDataPage();
    }
  },

  // 跳转到支出明细页面
  goToExpenseDetail() {
    wx.navigateTo({
      url: '/pages/expense/expense'
    });
  },

  // 跳转到收入明细页面
  goToIncomeDetail() {
    wx.navigateTo({
      url: '/pages/income/income'
    });
  },

  // 切换明细类型
  switchDetailType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ detailType: type });
  },

  // 跳转到明细页面（统一）
  goToDetail() {
    const { detailType } = this.data;
    if (detailType === 'income') {
      wx.navigateTo({
        url: '/pages/income/income'
      });
    } else {
      wx.navigateTo({
        url: '/pages/expense/expense'
      });
    }
  },

  // ============ 数据分析页面 ============
  // 获取数据页月份第一天
  getDataMonthFirstDay() {
    const { dataYear, dataMonth } = this.data;
    return `${dataYear}-${String(dataMonth).padStart(2, '0')}-01`;
  },

  // 获取数据页月份最后一天
  getDataMonthLastDay() {
    const { dataYear, dataMonth } = this.data;
    const lastDay = new Date(dataYear, dataMonth, 0).getDate();
    return `${dataYear}-${String(dataMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  },

  // 加载数据页面
  loadDataPage() {
    const monthStart = this.getDataMonthFirstDay();
    const monthEnd = this.getDataMonthLastDay();

    wx.showLoading({ title: '加载中...' });

    wx.cloud.callFunction({
      name: 'getTransactions',
      data: { action: 'list' },
      success: res => {
        wx.hideLoading();

        if (res.result && res.result.success) {
          const allData = res.result.data;
          // 筛选当月数据（使用日期对象比较）
          const monthData = allData.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= new Date(monthStart) && itemDate <= new Date(monthEnd);
          });

          this.processDataPageStats(monthData);
          this.processCategoryData(monthData);
          this.setData({ monthData });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('加载失败', err);
      }
    });
  },

  // 处理数据页统计
  processDataPageStats(monthData) {
    let income = 0, expense = 0;

    monthData.forEach(item => {
      if (item.type === 'income') {
        income += item.amount;
      } else {
        expense += item.amount;
      }
    });

    const profit = income - expense;

    this.setData({
      dataIncome: (income / 100).toFixed(2),
      dataExpense: (expense / 100).toFixed(2),
      dataProfit: (profit / 100).toFixed(2)
    });
  },

  // 处理分类数据
  processCategoryData(monthData) {
    const categoryMap = {};

    monthData.forEach(item => {
      const key = item.category;
      if (!categoryMap[key]) {
        categoryMap[key] = { name: key, amount: 0, type: item.type };
      }
      categoryMap[key].amount += item.amount;
    });

    // 计算总额
    let total = 0;
    Object.values(categoryMap).forEach(item => {
      total += item.amount;
    });

    // 转换为数组并排序
    const categoryData = Object.values(categoryMap)
      .map((item, index) => ({
        ...item,
        color: CHART_COLORS[index % CHART_COLORS.length],
        percent: total > 0 ? ((item.amount / total) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    this.setData({ categoryData });
    this.drawPieChart();
    this.drawTrendChart();
  },

  // 绘制饼图
  drawPieChart() {
    const { categoryData } = this.data;
    if (categoryData.length === 0) return;

    const ctx = wx.createCanvasContext('categoryCanvas');
    const width = 300;
    const height = 200;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 70;

    let startAngle = -Math.PI / 2;
    const total = categoryData.reduce((sum, item) => sum + item.amount, 0);

    categoryData.forEach(item => {
      const sliceAngle = (item.amount / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.setFillStyle(item.color);
      ctx.fill();

      startAngle = endAngle;
    });

    ctx.draw();
  },

  // 绘制趋势图
  drawTrendChart() {
    const { monthData } = this.data;
    if (!monthData || monthData.length === 0) return;

    const ctx = wx.createCanvasContext('trendCanvas');
    const width = 320;
    const height = 180;
    const padding = 30;

    // 按日期分组统计
    const dailyData = {};
    monthData.forEach(item => {
      if (!dailyData[item.date]) {
        dailyData[item.date] = { income: 0, expense: 0 };
      }
      if (item.type === 'income') {
        dailyData[item.date].income += item.amount;
      } else {
        dailyData[item.date].expense += item.amount;
      }
    });

    // 转换为数组并排序
    const sortedDates = Object.keys(dailyData).sort();
    if (sortedDates.length === 0) return;

    // 计算最大值
    let maxValue = 0;
    sortedDates.forEach(date => {
      maxValue = Math.max(maxValue, dailyData[date].income, dailyData[date].expense);
    });
    maxValue = Math.ceil(maxValue / 10000) * 10000 || 10000;

    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const stepX = chartWidth / (sortedDates.length - 1 || 1);

    // 绘制网格线
    ctx.setStrokeStyle('#f0f0f0');
    ctx.setLineWidth(1);
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // 绘制收入折线
    ctx.setStrokeStyle('#52C41A');
    ctx.setLineWidth(2);
    sortedDates.forEach((date, index) => {
      const x = padding + stepX * index;
      const y = padding + chartHeight - (dailyData[date].income / maxValue) * chartHeight;
      if (index === 0) {
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // 绘制支出折线
    ctx.setStrokeStyle('#FF4D4F');
    ctx.setLineWidth(2);
    sortedDates.forEach((date, index) => {
      const x = padding + stepX * index;
      const y = padding + chartHeight - (dailyData[date].expense / maxValue) * chartHeight;
      if (index === 0) {
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // 绘制图例
    ctx.setFillStyle('#52C41A');
    ctx.fillRect(width - 100, 10, 12, 12);
    ctx.setFillStyle('#333');
    ctx.setFontSize(10);
    ctx.fillText('收入', width - 82, 20);

    ctx.setFillStyle('#FF4D4F');
    ctx.fillRect(width - 50, 10, 12, 12);
    ctx.setFillStyle('#333');
    ctx.fillText('支出', width - 32, 20);

    ctx.draw();
  },

  // 切换趋势图类型
  switchTrendType(e) {
    const trendType = e.currentTarget.dataset.type;
    this.setData({ trendType });
    this.drawTrendChart();
  },

  // 上一个月
  prevMonth() {
    let { dataYear, dataMonth } = this.data;
    if (dataMonth === 1) {
      dataMonth = 12;
      dataYear--;
    } else {
      dataMonth--;
    }
    this.setData({ dataYear, dataMonth });
    this.loadDataPage();
  },

  // 下一个月
  nextMonth() {
    let { dataYear, dataMonth } = this.data;
    if (dataMonth === 12) {
      dataMonth = 1;
      dataYear++;
    } else {
      dataMonth++;
    }
    this.setData({ dataYear, dataMonth });
    this.loadDataPage();
  },

  // 导出本月数据
  exportMonthData() {
    const { dataYear, dataMonth, monthData, filterCategories } = this.data;

    // 如果没有数据，先加载数据
    if (!monthData || monthData.length === 0) {
      wx.showLoading({ title: '加载中...' });
      wx.cloud.callFunction({
        name: 'getTransactions',
        data: { action: 'list' },
        success: res => {
          wx.hideLoading();
          if (res.result && res.result.success) {
            const allData = res.result.data;
            const monthStart = this.getDataMonthFirstDay();
            const monthEnd = this.getDataMonthLastDay();
            // 日期比较 + 分类筛选
            const filteredData = allData.filter(item => {
              const itemDate = new Date(item.date);
              const inMonth = itemDate >= new Date(monthStart) && itemDate <= new Date(monthEnd);
              const inCategory = filterCategories.length === 0 || filterCategories.includes(item.category);
              return inMonth && inCategory;
            });

            if (filteredData.length === 0) {
              wx.showToast({ title: '本月暂无数据', icon: 'none' });
              return;
            }

            this.doExportMonthCSV(filteredData, dataYear, dataMonth);
          } else {
            wx.showToast({ title: '加载数据失败', icon: 'none' });
          }
        },
        fail: err => {
          wx.hideLoading();
          console.error('加载数据失败', err);
          wx.showToast({ title: '加载数据失败: ' + (err.errMsg || '未知错误'), icon: 'none', duration: 3000 });
        }
      });
      return;
    }

    // 应用分类筛选
    const filteredData = monthData.filter(item => {
      return filterCategories.length === 0 || filterCategories.includes(item.category);
    });

    if (filteredData.length === 0) {
      wx.showToast({ title: '筛选后无数据', icon: 'none' });
      return;
    }

    this.doExportMonthCSV(filteredData, dataYear, dataMonth);
  },

  // 执行导出本月数据
  doExportMonthCSV(monthData, dataYear, dataMonth) {
    const excelContent = generateExcelXML(monthData, { sheetName: '记账明细' });
    const fileName = `export_${dataYear}${String(dataMonth).padStart(2, '0')}`;
    downloadExcel(excelContent, fileName);
  },

  // 导出数据 - 显示筛选弹窗
  exportData() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    // 默认日期范围为本月
    const monthStart = `${year}-${month}-01`;
    const today = `${year}-${month}-${day}`;

    this.setData({
      showExportFilter: true,
      filterStartDate: monthStart,
      filterEndDate: today,
      filterType: 'all',
      filterCategories: this.data.allCategories
    });
  },

  // 关闭导出筛选弹窗
  closeExportFilter() {
    this.setData({ showExportFilter: false });
  },

  // 设置筛选类型
  setFilterType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ filterType: type });
  },

  // 切换分类筛选
  toggleCategory(e) {
    const category = e.currentTarget.dataset.category;
    const { filterCategories } = this.data;
    const index = filterCategories.indexOf(category);

    if (index > -1) {
      filterCategories.splice(index, 1);
    } else {
      filterCategories.push(category);
    }

    this.setData({ filterCategories });
  },

  // 全选/取消全选分类
  toggleAllCategories() {
    const { allCategories, filterCategories } = this.data;
    if (filterCategories.length === allCategories.length) {
      this.setData({ filterCategories: [] });
    } else {
      this.setData({ filterCategories: [...allCategories] });
    }
  },

  // 开始日期筛选
  onFilterStartDateChange(e) {
    this.setData({ filterStartDate: e.detail.value });
  },

  // 结束日期筛选
  onFilterEndDateChange(e) {
    this.setData({ filterEndDate: e.detail.value });
  },

  // 执行导出
  doExport(exportMonthOnly) {
    wx.showLoading({ title: '导出中...' });

    const monthStart = this.getMonthFirstDay();
    const today = this.getTodayDate();

    // 获取数据
    wx.cloud.callFunction({
      name: 'getTransactions',
      data: { action: 'list' },
      success: res => {
        wx.hideLoading();

        if (res.result && res.result.success && res.result.data.length > 0) {
          let data = res.result.data;

          // 如果只导出本月数据
          if (exportMonthOnly) {
            data = data.filter(item => item.date >= monthStart);
          }

          if (data.length === 0) {
            wx.showToast({ title: '暂无数据', icon: 'none' });
            return;
          }

          // 保存到本地文件
          const fileName = `export_${today.replace(/-/g, '')}.xls`;
          const fs = wx.getFileSystemManager();
          const filePath = wx.env.USER_DATA_PATH + '/' + fileName;

          fs.writeFile({
            filePath: filePath,
            data: this.generateExcel(data),
            encoding: 'utf-8',
            success: () => {
              // 打开文档
              wx.openDocument({
                filePath: filePath,
                fileType: 'xls',
                success: () => {
                  console.log('导出成功');
                },
                fail: err => {
                  console.error('打开文档失败', err);
                  wx.showToast({ title: '导出失败: ' + (err.errMsg || '未知错误'), icon: 'none', duration: 3000 });
                }
              });
            },
            fail: err => {
              console.error('写入文件失败', err);
              wx.showToast({ title: '导出失败', icon: 'none' });
            }
          });
        } else {
          wx.showToast({ title: '暂无数据', icon: 'none' });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('获取数据失败', err);
        wx.showToast({ title: '导出失败', icon: 'none' });
      }
    });
  },

  // 生成 CSV 内容
  generateCSV(data) {
    // CSV 表头
    let csv = '﻿日期,类型,分类,金额（元）,备注\n';

    // 按日期倒序排列
    const sortedData = [...data].sort((a, b) => b.date.localeCompare(a.date));

    sortedData.forEach(item => {
      const type = item.type === 'income' ? '收入' : '支出';
      const amount = (item.amount / 100).toFixed(2);
      const remark = item.remark ? item.remark.replace(/,/g, '，').replace(/\n/g, ' ') : '';

      csv += `${item.date},${type},${item.category},${amount},${remark}\n`;
    });

    // 添加统计行
    let totalIncome = 0, totalExpense = 0;
    sortedData.forEach(item => {
      if (item.type === 'income') totalIncome += item.amount;
      else totalExpense += item.amount;
    });

    csv += `\n合计,收入,${(totalIncome / 100).toFixed(2)}\n`;
    csv += `合计,支出,${(totalExpense / 100).toFixed(2)}\n`;
    csv += `合计,利润,${((totalIncome - totalExpense) / 100).toFixed(2)}\n`;

    return csv;
  },

  // 生成 Excel 内容（HTML 格式）
  generateExcel(data) {
    return generateExcelXML(data, { sheetName: '记账明细' });
  },

  // ============ 设置功能 ============
  // 显示设置弹窗
  showSettings() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    const nickName = this.data.userInfo.nickName || 'U';
    const colorIndex = nickName.charCodeAt(0) % this.data.avatarColors.length;
    this.setData({
      editNickName: this.data.userInfo.nickName || '',
      profileAvatarText: nickName.charAt(0),
      profileAvatarColor: this.data.avatarColors[colorIndex],
      userPhone: this.data.userInfo.phone || ''
    });
    this.loadSettings();
  },

  // 加载设置
  loadSettings() {
    const { userInfo } = this.data;
    if (!userInfo || !userInfo.openId) {
      this.setData({ showSettings: true });
      return;
    }

    const db = wx.cloud.database();
    db.collection('settings').doc(userInfo.openId).get({
      success: res => {
        if (res.data) {
          this.setData({
            showSettings: true,
            settings: {
              dailyReminderEnabled: res.data.dailyReminderEnabled !== false,
              reminderTime: res.data.reminderTime || '21:00',
              templateId: res.data.templateId || ''
            },
            expenseThreshold: res.data.expenseThreshold ? (res.data.expenseThreshold / 100).toString() : '',
            lossThreshold: res.data.lossThreshold ? (res.data.lossThreshold / 100).toString() : ''
          });
        } else {
          this.setData({
            showSettings: true
          });
        }
      },
      fail: () => {
        this.setData({ showSettings: true });
      }
    });
  },

  // 关闭设置弹窗
  closeSettings() {
    this.setData({ showSettings: false });
  },

  // 昵称输入
  onNickNameInput(e) {
    this.setData({ editNickName: e.detail.value });
  },

  // 更换头像
  changeAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        wx.showLoading({ title: '上传中...' });
        // 上传到云存储
        const ext = tempFilePath.split('.').pop();
        const fileName = `avatars/${this.data.userInfo.openId}_${Date.now()}.${ext}`;
        wx.cloud.uploadFile({
          cloudPath: fileName,
          filePath: tempFilePath,
          success: (uploadRes) => {
            const avatarUrl = uploadRes.fileID;
            this.setData({ 'userInfo.avatarUrl': avatarUrl });
            wx.hideLoading();
            wx.showToast({ title: '头像已更新', icon: 'success' });
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({ title: '上传失败', icon: 'none' });
          }
        });
      }
    });
  },

  // 手机号输入（备用）
  onPhoneInput(e) {
    this.setData({ userPhone: e.detail.value });
  },

  // 获取手机号（微信授权）
  onGetPhoneNumber(e) {
    if (!e.detail.cloudId) {
      wx.showToast({ title: '请允许获取手机号', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '绑定中...' });

    wx.cloud.callFunction({
      name: 'login',
      data: {
        action: 'bindPhone',
        code: e.detail.code
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success && res.result.data) {
          this.setData({ userPhone: res.result.data.phoneNumber });
          wx.showToast({ title: '绑定成功', icon: 'success' });
        } else {
          wx.showToast({ title: res.result?.error || '绑定失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '绑定失败', icon: 'none' });
      }
    });
  },

  // 保存个人信息
  saveProfile() {
    const { editNickName, userInfo } = this.data;
    if (!editNickName || !editNickName.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    // 更新本地存储
    const updatedUserInfo = {
      ...userInfo,
      nickName: editNickName.trim()
    };
    wx.setStorageSync('userInfo', updatedUserInfo);

    // 更新全局数据
    const app = getApp();
    if (app.globalData) {
      app.globalData.userInfo = updatedUserInfo;
    }

    // 更新云数据库
    wx.cloud.callFunction({
      name: 'login',
      data: {
        userInfo: {
          nickName: editNickName.trim(),
          avatarUrl: userInfo.avatarUrl || ''
        }
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          this.setData({ userInfo: res.result.data });
          wx.setStorageSync('userInfo', res.result.data);
          if (app.globalData) {
            app.globalData.userInfo = res.result.data;
          }
          wx.showToast({ title: '保存成功', icon: 'success' });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    });
  },

  // 日结提醒开关
  onDailyReminderChange(e) {
    const dailyReminderEnabled = e.detail.value;
    this.setData({
      'settings.dailyReminderEnabled': dailyReminderEnabled
    });
    this.saveSettings();
  },

  // 提醒时间选择
  onReminderTimeChange(e) {
    const reminderTime = e.detail.value;
    this.setData({
      'settings.reminderTime': reminderTime
    });
    this.saveSettings();
  },

  // 大额支出阈值输入
  onExpenseThresholdInput(e) {
    this.setData({
      expenseThreshold: e.detail.value
    });
  },

  // 亏损阈值输入
  onLossThresholdInput(e) {
    this.setData({
      lossThreshold: e.detail.value
    });
  },

  // 模板ID输入
  onTemplateIdInput(e) {
    this.setData({
      'settings.templateId': e.detail.value
    });
  },

  // 保存设置
  saveSettings() {
    const { settings, expenseThreshold, lossThreshold, userInfo } = this.data;

    if (!userInfo || !userInfo.openId) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    const db = wx.cloud.database();
    const data = {
      dailyReminderEnabled: settings.dailyReminderEnabled,
      reminderTime: settings.reminderTime,
      templateId: settings.templateId || '',
      expenseThreshold: expenseThreshold ? Math.round(parseFloat(expenseThreshold) * 100) : 10000,
      lossThreshold: lossThreshold ? Math.round(parseFloat(lossThreshold) * 100) : 50000
    };

    // 使用 update 只更新指定字段，避免覆盖其他设置
    db.collection('settings').doc(userInfo.openId).update({
      data: data,
      success: () => {
        wx.showToast({ title: '设置已保存', icon: 'success' });
      },
      fail: err => {
        // 如果文档不存在，先创建
        if (err.errCode === -502005) {
          db.collection('settings').doc(userInfo.openId).set({
            data: { _id: userInfo.openId, ...data },
            success: () => {
              wx.showToast({ title: '设置已保存', icon: 'success' });
            },
            fail: () => {
              wx.showToast({ title: '保存失败', icon: 'none' });
            }
          });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      }
    });
  },

  // 发送测试提醒
  sendTestReminder() {
    const templateId = this.data.settings.templateId;

    // 检查是否已配置模板 ID
    if (!templateId) {
      wx.showModal({
        title: '提示',
        content: '订阅消息模板 ID 未配置，请在设置中填写模板 ID',
        showCancel: false
      });
      return;
    }

    // 请求订阅消息权限
    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success(res) {
        console.log('订阅成功', res);
        if (res[templateId] === 'accept') {
          wx.showToast({ title: '订阅成功', icon: 'success' });
        } else if (res[templateId] === 'reject') {
          wx.showToast({ title: '您拒绝了订阅', icon: 'none' });
        } else {
          wx.showToast({ title: '订阅结果: ' + res[templateId], icon: 'none' });
        }
      },
      fail(err) {
        console.log('订阅失败', err);
        if (err.errCode === 20001) {
          wx.showToast({ title: '模板 ID 不存在，请检查', icon: 'none', duration: 3000 });
        } else {
          wx.showToast({ title: '订阅失败', icon: 'none' });
        }
      }
    });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除本地存储
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('userRole');
          // 重置状态
          this.setData({
            isLoggedIn: false,
            userInfo: null,
            userRole: 'employee'
          });
          this.setData({ showSettings: false });
          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      }
    });
  },

  // 数据迁移
  migrateRecords() {
    wx.showModal({
      title: '确认执行数据迁移',
      content: '此操作将为没有 creatorOpenId 的记录补充字段。是否继续？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '迁移中...' });

          wx.cloud.callFunction({
            name: 'migrateRecords',
            data: {},
            success: (result) => {
              wx.hideLoading();
              if (result.result && result.result.success) {
                wx.showModal({
                  title: '迁移完成',
                  content: `已迁移 ${result.result.migrated} 条记录，跳过 ${result.result.skipped} 条`,
                  showCancel: false
                });
              } else {
                wx.showToast({
                  title: result.result?.error || '迁移失败',
                  icon: 'none'
                });
              }
            },
            fail: (err) => {
              wx.hideLoading();
              wx.showToast({ title: '迁移失败: ' + err.errMsg, icon: 'none' });
            }
          });
        }
      }
    });
  },

  // ============ 导出筛选功能 ============
  // 执行筛选导出
  doExportFiltered() {
    const { filterStartDate, filterEndDate, filterType, filterCategories } = this.data;

    if (!filterStartDate || !filterEndDate) {
      wx.showToast({ title: '请选择日期范围', icon: 'none' });
      return;
    }

    if (filterStartDate > filterEndDate) {
      wx.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' });
      return;
    }

    this.setData({ showExportFilter: false });
    wx.showLoading({ title: '导出中...' });

    // 获取所有数据
    wx.cloud.callFunction({
      name: 'getTransactions',
      data: { action: 'list' },
      success: res => {
        wx.hideLoading();

        if (res.result && res.result.success && res.result.data.length > 0) {
          // 应用筛选
          let filteredData = res.result.data.filter(item => {
            // 日期筛选
            if (item.date < filterStartDate || item.date > filterEndDate) {
              return false;
            }
            // 类型筛选
            if (filterType !== 'all' && item.type !== filterType) {
              return false;
            }
            // 分类筛选
            if (filterCategories.length > 0 && filterCategories.length < this.data.allCategories.length && filterCategories.indexOf(item.category) === -1) {
              return false;
            }
            return true;
          });

          if (filteredData.length === 0) {
            wx.showToast({ title: '筛选范围内无数据', icon: 'none' });
            return;
          }

          // 生成 Excel 格式
          const excelContent = this.generateExcel(filteredData);
          const today = this.getTodayDate();
          const fileName = `export_${today.replace(/-/g, '')}.xls`;
          const fs = wx.getFileSystemManager();
          const filePath = wx.env.USER_DATA_PATH + '/' + fileName;

          fs.writeFile({
            filePath: filePath,
            data: excelContent,
            encoding: 'utf-8',
            success: () => {
              wx.openDocument({
                filePath: filePath,
                fileType: 'xls',
                success: () => {
                  console.log('打开文档成功');
                },
                fail: err => {
                  console.error('打开文档失败', err);
                  wx.showToast({ title: '导出失败: ' + (err.errMsg || '未知错误'), icon: 'none', duration: 3000 });
                }
              });
            },
            fail: err => {
              console.error('写入文件失败', err);
              wx.showToast({ title: '导出失败', icon: 'none' });
            }
          });
        } else {
          wx.showToast({ title: '暂无数据', icon: 'none' });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('获取数据失败', err);
        wx.showToast({ title: '导出失败', icon: 'none' });
      }
    });
  },

  // 导出 Excel
  doExportExcel() {
    const { filterStartDate, filterEndDate, filterType, filterCategories } = this.data;

    if (!filterStartDate || !filterEndDate) {
      wx.showToast({ title: '请选择日期范围', icon: 'none' });
      return;
    }

    if (filterStartDate > filterEndDate) {
      wx.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' });
      return;
    }

    this.setData({ showExportFilter: false });
    wx.showLoading({ title: '导出中...' });

    // 调用云函数生成 Excel
    wx.cloud.callFunction({
      name: 'exportExcel',
      data: {
        startDate: filterStartDate,
        endDate: filterEndDate,
        type: filterType,
        categories: filterCategories
      },
      success: res => {
        wx.hideLoading();

        if (res.result && res.result.success) {
          // 下载文件并打开
          wx.cloud.downloadFile({
            fileID: res.result.fileID,
            success: downloadRes => {
              wx.openDocument({
                filePath: downloadRes.tempFilePath,
                fileType: 'xls',
                success: () => {
                  console.log('Excel导出成功');
                },
                fail: err => {
                  console.error('打开文档失败', err);
                  wx.showToast({ title: '导出失败: ' + (err.errMsg || '未知错误'), icon: 'none', duration: 3000 });
                }
              });
            },
            fail: err => {
              console.error('下载失败', err);
              wx.showToast({ title: '导出失败', icon: 'none' });
            }
          });
        } else {
          wx.showToast({ title: res.result.error || '导出失败', icon: 'none' });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('导出失败', err);
        wx.showToast({ title: '导出失败', icon: 'none' });
      }
    });
  },

  // ============ 员工管理 ============
  // 显示员工管理弹窗
  showUserManage() {
    if (this.data.userRole !== 'owner') {
      wx.showToast({ title: '只有店长可以管理员工', icon: 'none' });
      return;
    }
    this.setData({ showUserManage: true });
    this.loadUserList();
  },

  // 关闭员工管理弹窗
  closeUserManage() {
    this.setData({ showUserManage: false });
  },

  // 加载员工列表
  loadUserList() {
    wx.showLoading({ title: '加载中...' });

    wx.cloud.callFunction({
      name: 'manageUsers',
      data: { action: 'list' },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          // 处理头像颜色
          const processedList = res.result.data.map(user => {
            const nickName = user.nickName || 'U';
            const colorIndex = nickName.charCodeAt(0) % this.data.avatarColors.length;
            return {
              ...user,
              avatarColor: this.data.avatarColors[colorIndex]
            };
          });
          this.setData({ userList: processedList });
        } else {
          wx.showToast({ title: res.result.error || '加载失败', icon: 'none' });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('加载失败', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    });
  },

  // 修改员工角色（支持picker和button两种调用）
  changeUserRole(e) {
    // 支持picker调用（带index）
    const userId = e.currentTarget.dataset.id;
    let newRole;

    if (e.detail.value !== undefined) {
      // picker 调用
      newRole = this.data.roleOptions[e.detail.value].value;
    } else {
      // button 调用（旧方式兼容）
      newRole = e.currentTarget.dataset.role;
    }

    wx.showModal({
      title: '确认',
      content: '确定要修改该员工角色吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });

          wx.cloud.callFunction({
            name: 'manageUsers',
            data: {
              action: 'updateRole',
              targetUserId: userId,
              newRole: newRole
            },
            success: res => {
              wx.hideLoading();
              if (res.result && res.result.success) {
                wx.showToast({ title: '修改成功', icon: 'success' });
                this.loadUserList();
              } else {
                wx.showToast({ title: res.result.error || '修改失败', icon: 'none' });
              }
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({ title: '修改失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  // 启用/禁用员工
  toggleUserStatus(e) {
    const userId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认',
      content: '确定要修改该员工状态吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });

          wx.cloud.callFunction({
            name: 'manageUsers',
            data: {
              action: 'toggleStatus',
              targetUserId: userId
            },
            success: res => {
              wx.hideLoading();
              if (res.result && res.result.success) {
                wx.showToast({ title: res.result.message, icon: 'success' });
                this.loadUserList();
              } else {
                wx.showToast({ title: res.result.error || '操作失败', icon: 'none' });
              }
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({ title: '操作失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  // 重置员工数据
  resetEmployeeData(e) {
    const userId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认重置',
      content: '确定要重置该员工的全部数据吗？此操作不可恢复！',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '重置中...' });

          wx.cloud.callFunction({
            name: 'manageUsers',
            data: {
              action: 'resetEmployeeData',
              targetUserId: userId
            },
            success: res => {
              wx.hideLoading();
              if (res.result && res.result.success) {
                wx.showToast({ title: res.result.message, icon: 'success' });
                this.loadUserList();
              } else {
                wx.showToast({ title: res.result.error || '重置失败', icon: 'none' });
              }
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({ title: '重置失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  // 删除员工
  removeUser(e) {
    const userId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除该员工及其所有数据吗？此操作不可恢复！',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });

          wx.cloud.callFunction({
            name: 'manageUsers',
            data: {
              action: 'remove',
              targetUserId: userId
            },
            success: res => {
              wx.hideLoading();
              if (res.result && res.result.success) {
                wx.showToast({ title: '删除成功', icon: 'success' });
                this.loadUserList();
              } else {
                wx.showToast({ title: res.result.error || '删除失败', icon: 'none' });
              }
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({ title: '删除失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  // 转让店长权限
  transferOwner(e) {
    const userId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认转让店长',
      content: '确定要将店长权限转让给该员工吗？转让后你将成为管理员。',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });

          wx.cloud.callFunction({
            name: 'manageUsers',
            data: {
              action: 'transferOwner',
              targetUserId: userId
            },
            success: res => {
              wx.hideLoading();
              if (res.result && res.result.success) {
                wx.showToast({ title: '转让成功', icon: 'success' });
                // 更新本地角色为 admin
                this.setData({ userRole: 'admin' });
                wx.setStorageSync('userRole', 'admin');
                this.loadUserList();
              } else {
                wx.showToast({ title: res.result.error || '转让失败', icon: 'none' });
              }
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({ title: '转让失败', icon: 'none' });
            }
          });
        }
      }
    });
  }
});
