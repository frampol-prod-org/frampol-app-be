const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Mock bill data - in a real app, this would come from your billing system
const mockBills = [
  {
    id: '1',
    billNumber: 'FR-2024-001',
    amount: 45.00,
    dueDate: '2024-02-15',
    status: 'paid',
    service: 'Internet - 10Mbps',
    period: 'January 2024',
    createdAt: '2024-01-01',
    paidAt: '2024-01-10'
  },
  {
    id: '2',
    billNumber: 'FR-2024-002',
    amount: 45.00,
    dueDate: '2024-03-15',
    status: 'pending',
    service: 'Internet - 10Mbps',
    period: 'February 2024',
    createdAt: '2024-02-01'
  }
];

// @desc    Get user's bills
// @route   GET /api/bills
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;

    let bills = [...mockBills];

    // Filter by status if provided
    if (status) {
      bills = bills.filter(bill => bill.status === status);
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedBills = bills.slice(startIndex, endIndex);

    res.status(200).json({
      status: 'success',
      count: paginatedBills.length,
      total: bills.length,
      page,
      pages: Math.ceil(bills.length / limit),
      bills: paginatedBills
    });
  } catch (error) {
    console.error('Get bills error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Get single bill
// @route   GET /api/bills/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const bill = mockBills.find(b => b.id === req.params.id);

    if (!bill) {
      return res.status(404).json({
        status: 'error',
        message: 'Bill not found'
      });
    }

    res.status(200).json({
      status: 'success',
      bill
    });
  } catch (error) {
    console.error('Get bill error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Pay bill
// @route   POST /api/bills/:id/pay
// @access  Private
router.post('/:id/pay', protect, [
  body('paymentMethod')
    .isIn(['ecocash', 'paynow', 'bank_transfer', 'cash'])
    .withMessage('Invalid payment method'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('reference')
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage('Reference must be at least 3 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const bill = mockBills.find(b => b.id === req.params.id);

    if (!bill) {
      return res.status(404).json({
        status: 'error',
        message: 'Bill not found'
      });
    }

    if (bill.status === 'paid') {
      return res.status(400).json({
        status: 'error',
        message: 'Bill has already been paid'
      });
    }

    const { paymentMethod, amount, reference } = req.body;

    // Simulate payment processing
    const payment = {
      id: `PAY-${Date.now()}`,
      billId: bill.id,
      amount,
      paymentMethod,
      reference: reference || `REF-${Date.now()}`,
      status: 'completed',
      processedAt: new Date().toISOString(),
      userId: req.user.id
    };

    // Update bill status
    bill.status = 'paid';
    bill.paidAt = new Date().toISOString();

    res.status(200).json({
      status: 'success',
      message: 'Payment processed successfully',
      payment,
      bill
    });
  } catch (error) {
    console.error('Pay bill error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Get payment history
// @route   GET /api/bills/payments
// @access  Private
router.get('/payments', protect, async (req, res) => {
  try {
    // Mock payment history
    const payments = [
      {
        id: 'PAY-001',
        billNumber: 'FR-2024-001',
        amount: 45.00,
        paymentMethod: 'ecocash',
        reference: 'EC123456789',
        status: 'completed',
        processedAt: '2024-01-10T10:30:00Z'
      }
    ];

    res.status(200).json({
      status: 'success',
      payments
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

module.exports = router;
