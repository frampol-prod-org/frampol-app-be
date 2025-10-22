const express = require('express');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Mock usage data - in a real app, this would come from your network monitoring system
const mockUsageData = {
  currentMonth: {
    dataUsed: 45.2, // GB
    dataLimit: 100, // GB
    daysRemaining: 12,
    averageDailyUsage: 1.5, // GB
    peakUsage: 3.2, // GB
    lastUpdated: '2024-02-03T10:30:00Z'
  },
  monthlyHistory: [
    {
      month: 'January 2024',
      dataUsed: 78.5,
      dataLimit: 100,
      days: 31,
      averageDaily: 2.5
    },
    {
      month: 'December 2023',
      dataUsed: 92.3,
      dataLimit: 100,
      days: 31,
      averageDaily: 3.0
    },
    {
      month: 'November 2023',
      dataUsed: 65.7,
      dataLimit: 100,
      days: 30,
      averageDaily: 2.2
    }
  ],
  dailyUsage: [
    { date: '2024-02-01', usage: 1.2 },
    { date: '2024-02-02', usage: 2.1 },
    { date: '2024-02-03', usage: 1.8 },
    { date: '2024-02-04', usage: 0.9 },
    { date: '2024-02-05', usage: 2.5 },
    { date: '2024-02-06', usage: 1.7 },
    { date: '2024-02-07', usage: 3.2 }
  ],
  hourlyUsage: [
    { hour: '00:00', usage: 0.1 },
    { hour: '01:00', usage: 0.05 },
    { hour: '02:00', usage: 0.03 },
    { hour: '03:00', usage: 0.02 },
    { hour: '04:00', usage: 0.08 },
    { hour: '05:00', usage: 0.15 },
    { hour: '06:00', usage: 0.3 },
    { hour: '07:00', usage: 0.8 },
    { hour: '08:00', usage: 1.2 },
    { hour: '09:00', usage: 1.5 },
    { hour: '10:00', usage: 1.8 },
    { hour: '11:00', usage: 2.1 },
    { hour: '12:00', usage: 2.3 },
    { hour: '13:00', usage: 2.0 },
    { hour: '14:00', usage: 1.9 },
    { hour: '15:00', usage: 2.2 },
    { hour: '16:00', usage: 2.5 },
    { hour: '17:00', usage: 2.8 },
    { hour: '18:00', usage: 3.0 },
    { hour: '19:00', usage: 2.7 },
    { hour: '20:00', usage: 2.4 },
    { hour: '21:00', usage: 2.1 },
    { hour: '22:00', usage: 1.5 },
    { hour: '23:00', usage: 0.8 }
  ]
};

// @desc    Get current usage data
// @route   GET /api/usage/current
// @access  Private
router.get('/current', protect, async (req, res) => {
  try {
    res.status(200).json({
      status: 'success',
      data: mockUsageData.currentMonth
    });
  } catch (error) {
    console.error('Get current usage error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Get monthly usage history
// @route   GET /api/usage/history
// @access  Private
router.get('/history', protect, async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;

    res.status(200).json({
      status: 'success',
      data: mockUsageData.monthlyHistory.slice(0, months)
    });
  } catch (error) {
    console.error('Get usage history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Get daily usage for current month
// @route   GET /api/usage/daily
// @access  Private
router.get('/daily', protect, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;

    res.status(200).json({
      status: 'success',
      data: mockUsageData.dailyUsage.slice(-days)
    });
  } catch (error) {
    console.error('Get daily usage error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Get hourly usage for today
// @route   GET /api/usage/hourly
// @access  Private
router.get('/hourly', protect, async (req, res) => {
  try {
    res.status(200).json({
      status: 'success',
      data: mockUsageData.hourlyUsage
    });
  } catch (error) {
    console.error('Get hourly usage error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Get usage summary
// @route   GET /api/usage/summary
// @access  Private
router.get('/summary', protect, async (req, res) => {
  try {
    const summary = {
      currentMonth: mockUsageData.currentMonth,
      lastMonth: mockUsageData.monthlyHistory[0],
      averageMonthlyUsage: mockUsageData.monthlyHistory.reduce((acc, month) => acc + month.dataUsed, 0) / mockUsageData.monthlyHistory.length,
      totalDataUsed: mockUsageData.monthlyHistory.reduce((acc, month) => acc + month.dataUsed, 0),
      usageTrend: 'increasing', // calculated based on recent months
      projectedUsage: 85.5, // projected usage for current month
      recommendations: [
        'Consider upgrading to a higher data plan',
        'Peak usage hours are 6-10 PM',
        'Weekend usage is typically lower'
      ]
    };

    res.status(200).json({
      status: 'success',
      data: summary
    });
  } catch (error) {
    console.error('Get usage summary error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

module.exports = router;
