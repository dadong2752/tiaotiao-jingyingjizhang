// pages/expense/expense.js
const { CHART_COLORS } = require('../../utils/format.js');
const { getExpenseCategories, addExpenseCategory, getGuestExpenseCategories } = require('../../utils/category.js');
const { DEFAULT_EXPENSE_CATEGORIES } = require('../../utils/config.js');
const { generateExcelXML, downloadExcel } = require('../../utils/excel.js');
const { getMonthLastDay, getTodayDate, getMonthFirstDay, generateUUID, formatDate } = require('../../utils/common.js');

const EXPENSE_CATEGORIES = DEFAULT_EXPENSE_CATEGORIES;

Page({
  data: {
    // 支出记录列表
    expenseList: [],
    // 月份选择
    year: 0,
    month: 0,
    // 统计数据
    totalExpense: '0.00',
    categoryStats: [],
    // 日期范围
    startDate: '',
    endDate: '',
    // 分类筛选
    selectedCategories: [],
    allCategories: EXPENSE_CATEGORIES,
    // 加载状态
    loading: false,
    // 添加分类弹窗
    showAddCategoryModal: false,
    newCategoryName: '',
    // 访客模式
    isGuest: false,
    isLoggedIn: false
  },

  onLoad(options) {
    const now = new Date();
    this.setData({
      year: now.getFullYear(),
      month: now.getMonth() + 1
    });
    this.initDateRange();

    // 检查登录状态
    const userInfo = wx.getStorageSync('userInfo');
    const guestTransactions = wx.getStorageSync('guestTransactions') || [];

    if (userInfo) {
      this.setData({ isLoggedIn: true, isGuest: false });
      this.loadSavedCategories();
      this.loadExpenseData();
    } else if (guestTransactions.length > 0) {
      this.setData({ isLoggedIn: false, isGuest: true });
      const savedCategories = getGuestExpenseCategories();
      this.setData({
        allCategories: savedCategories,
        selectedCategories: savedCategories
      });
      this.loadGuestExpenseData();
    } else {
      this.setData({ isLoggedIn: false, isGuest: true });
      this.loadSavedCategories();
      this.loadGuestExpenseData();
    }
  },

  // 加载保存的分类
  loadSavedCategories() {
    const savedCategories = getExpenseCategories();
    this.setData({
      allCategories: savedCategories,
      selectedCategories: savedCategories
    });
  },

  onShow() {
    if (this.data.isGuest) {
      this.loadGuestExpenseData();
    } else if (this.data.isLoggedIn) {
      this.loadExpenseData();
    }
  },

  // 加载访客支出数据
  loadGuestExpenseData() {
    this.setData({ loading: true });
    wx.showLoading({ title: '加载中...' });

    const guestTransactions = wx.getStorageSync('guestTransactions') || [];

    wx.hideLoading();
    this.setData({ loading: false });
    this.processExpenseData(guestTransactions);
  },

  // 初始化日期范围（本月）
  initDateRange() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = this.getMonthLastDay(year, month);

    this.setData({
      startDate: firstDay,
      endDate: lastDay,
      selectedCategories: [...EXPENSE_CATEGORIES]
    });
  },

  // 获取月份最后一天
  getMonthLastDay(year, month) {
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  },

  // 加载支出数据
  loadExpenseData() {
    this.setData({ loading: true });
    wx.showLoading({ title: '加载中...' });

    wx.cloud.callFunction({
      name: 'getTransactions',
      data: { action: 'list' },
      success: res => {
        if (res.result && res.result.success) {
          const allData = res.result.data;
          this.processExpenseData(allData);
        } else {
          wx.showToast({ title: '加载失败', icon: 'none' });
        }
      },
      fail: err => {
        wx.showToast({ title: '加载失败', icon: 'none' });
      },
      complete: () => {
        wx.hideLoading();
        this.setData({ loading: false });
      }
    });
  },

  // 处理支出数据
  processExpenseData(allData) {
    const { startDate, endDate, selectedCategories, allCategories } = this.data;

    // 筛选支出记录
    let expenseData = allData.filter(item => {
      if (item.type !== 'expense') return false;
      if (item.date < startDate || item.date > endDate) return false;
      if (selectedCategories.length > 0) {
        if (!selectedCategories.includes(item.category)) return false;
      }
      return true;
    });

    // 按日期倒序排列
    expenseData.sort((a, b) => b.date.localeCompare(a.date));

    // 计算总支出
    let total = 0;
    expenseData.forEach(item => {
      total += item.amount;
    });

    // 计算分类统计
    const categoryMap = {};
    expenseData.forEach(item => {
      const key = item.category;
      if (!categoryMap[key]) {
        categoryMap[key] = { name: key, amount: 0, count: 0 };
      }
      categoryMap[key].amount += item.amount;
      categoryMap[key].count++;
    });

    const categoryStats = Object.values(categoryMap)
      .map((item, index) => ({
        ...item,
        color: CHART_COLORS[index % CHART_COLORS.length],
        amountDisplay: (item.amount / 100).toFixed(2),
        percent: total > 0 ? ((item.amount / total) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    // 处理显示数据
    const expenseList = expenseData.map(item => ({
      ...item,
      amountDisplay: (item.amount / 100).toFixed(2)
    }));

    this.setData({
      expenseList,
      totalExpense: (total / 100).toFixed(2),
      categoryStats
    });
  },

  // 上个月
  prevMonth() {
    if (this.data.loading) return;
    let { year, month } = this.data;
    if (month === 1) {
      month = 12;
      year--;
    } else {
      month--;
    }
    this.setData({ year, month });
    this.updateDateRange();
    this.loadExpenseData();
  },

  // 下个月
  nextMonth() {
    if (this.data.loading) return;
    let { year, month } = this.data;
    if (month === 12) {
      month = 1;
      year++;
    } else {
      month++;
    }
    this.setData({ year, month });
    this.updateDateRange();
    this.loadExpenseData();
  },

  // 更新日期范围
  updateDateRange() {
    const { year, month } = this.data;
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = this.getMonthLastDay(year, month);
    this.setData({
      startDate: firstDay,
      endDate: lastDay
    });
  },

  // 切换分类
  toggleCategory(e) {
    const category = e.currentTarget.dataset.category;
    const { selectedCategories } = this.data;
    const newSelectedCategories = [...selectedCategories]; // 创建副本
    const index = newSelectedCategories.indexOf(category);

    if (index > -1) {
      if (newSelectedCategories.length > 1) { // 至少保留一个分类
        newSelectedCategories.splice(index, 1);
      }
    } else {
      newSelectedCategories.push(category);
    }

    this.setData({ selectedCategories: newSelectedCategories });
    this.loadExpenseData();
  },

  // 全选/取消全选分类
  toggleAllCategories() {
    const { allCategories, selectedCategories } = this.data;
    if (selectedCategories.length === allCategories.length) {
      this.setData({ selectedCategories: [] });
    } else {
      this.setData({ selectedCategories: [...allCategories] });
    }
    this.loadExpenseData();
  },

  // 显示添加分类弹窗
  showAddCategory() {
    this.setData({
      showAddCategoryModal: true,
      newCategoryName: ''
    });
  },

  // 关闭添加分类弹窗
  closeAddCategoryModal() {
    this.setData({ showAddCategoryModal: false });
  },

  // 输入新分类名称
  onNewCategoryInput(e) {
    this.setData({ newCategoryName: e.detail.value });
  },

  // 添加分类
  addCategory() {
    const { newCategoryName, allCategories, selectedCategories, isGuest } = this.data;
    const result = addExpenseCategory(newCategoryName);

    if (!result.success) {
      wx.showToast({ title: result.error, icon: 'none' });
      return;
    }

    // 访客模式保存到独立 key
    if (isGuest) {
      wx.setStorageSync('guestExpenseCategories', result.categories);
    }

    const newAllCategories = result.categories;
    const newSelectedCategories = [...selectedCategories, newCategoryName.trim()];

    this.setData({
      allCategories: newAllCategories,
      selectedCategories: newSelectedCategories,
      showAddCategoryModal: false,
      newCategoryName: ''
    });

    wx.showToast({ title: '添加成功', icon: 'success' });
    if (isGuest) {
      this.loadGuestExpenseData();
    } else {
      this.loadExpenseData();
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  },

  // 导出支出明细
  exportExpense() {
    const { expenseList, year, month } = this.data;

    if (expenseList.length === 0) {
      wx.showToast({ title: '暂无数据', icon: 'none' });
      return;
    }

    const excelContent = generateExcelXML(expenseList, { sheetName: '支出明细' });
    const fileName = `支出明细_${year}年${month}月`;
    downloadExcel(excelContent, fileName);
  }
});
