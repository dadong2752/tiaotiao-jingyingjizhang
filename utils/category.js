// utils/category.js

const { DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES } = require('./config.js');

/**
 * 获取保存的收入分类
 */
function getIncomeCategories() {
  const saved = wx.getStorageSync('incomeCategories');
  return saved && saved.length > 0 ? saved : DEFAULT_INCOME_CATEGORIES;
}

/**
 * 保存收入分类
 */
function saveIncomeCategories(categories) {
  wx.setStorageSync('incomeCategories', categories);
}

/**
 * 添加收入分类
 */
function addIncomeCategory(name) {
  const categories = getIncomeCategories();
  const trimmedName = name.trim();

  if (!trimmedName) {
    return { success: false, error: '分类名称不能为空' };
  }

  if (categories.includes(trimmedName)) {
    return { success: false, error: '该分类已存在' };
  }

  const newCategories = [...categories, trimmedName];
  saveIncomeCategories(newCategories);
  return { success: true, categories: newCategories };
}

/**
 * 获取保存的支出分类
 */
function getExpenseCategories() {
  const saved = wx.getStorageSync('expenseCategories');
  return saved && saved.length > 0 ? saved : DEFAULT_EXPENSE_CATEGORIES;
}

/**
 * 保存支出分类
 */
function saveExpenseCategories(categories) {
  wx.setStorageSync('expenseCategories', categories);
}

/**
 * 添加支出分类
 */
function addExpenseCategory(name) {
  const categories = getExpenseCategories();
  const trimmedName = name.trim();

  if (!trimmedName) {
    return { success: false, error: '分类名称不能为空' };
  }

  if (categories.includes(trimmedName)) {
    return { success: false, error: '该分类已存在' };
  }

  const newCategories = [...categories, trimmedName];
  saveExpenseCategories(newCategories);
  return { success: true, categories: newCategories };
}

// ============ 访客分类函数 ============

/**
 * 获取访客收入分类
 */
function getGuestIncomeCategories() {
  const saved = wx.getStorageSync('guestIncomeCategories');
  return saved && saved.length > 0 ? saved : DEFAULT_INCOME_CATEGORIES;
}

/**
 * 保存访客收入分类
 */
function saveGuestIncomeCategories(categories) {
  wx.setStorageSync('guestIncomeCategories', categories);
}

/**
 * 获取访客支出分类
 */
function getGuestExpenseCategories() {
  const saved = wx.getStorageSync('guestExpenseCategories');
  return saved && saved.length > 0 ? saved : DEFAULT_EXPENSE_CATEGORIES;
}

/**
 * 保存访客支出分类
 */
function saveGuestExpenseCategories(categories) {
  wx.setStorageSync('guestExpenseCategories', categories);
}

/**
 * 检查是否有未迁移的访客数据
 */
function hasGuestData() {
  const guestTransactions = wx.getStorageSync('guestTransactions') || [];
  return guestTransactions.length > 0;
}

module.exports = {
  getIncomeCategories,
  saveIncomeCategories,
  addIncomeCategory,
  getExpenseCategories,
  saveExpenseCategories,
  addExpenseCategory,
  // 访客分类
  getGuestIncomeCategories,
  saveGuestIncomeCategories,
  getGuestExpenseCategories,
  saveGuestExpenseCategories,
  hasGuestData
};
