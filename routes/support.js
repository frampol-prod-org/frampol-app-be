const express = require('express');
const { body, validationResult } = require('express-validator');
const SupportTicket = require('../models/SupportTicket');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @desc    Create support ticket
// @route   POST /api/support/tickets
// @access  Private
router.post('/tickets', protect, [
  body('subject')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Subject must be between 5 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Description must be at least 10 characters'),
  body('issueType')
    .isIn([
      'Internet Connectivity',
      'Technical Support',
      'Billing Inquiry',
      'Service Request',
      'Account Issues',
      'Other'
    ])
    .withMessage('Invalid issue type'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority level')
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

    const { subject, description, issueType, priority = 'medium' } = req.body;

    // Create ticket with initial message
    const ticket = new SupportTicket({
      user: req.user.id,
      subject,
      description,
      issueType,
      priority,
      messages: [{
        sender: req.user.id,
        message: description,
        isInternal: false
      }]
    });

    await ticket.save();

    res.status(201).json({
      status: 'success',
      ticket
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Get user's support tickets
// @route   GET /api/support/tickets
// @access  Private
router.get('/tickets', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const filter = { user: req.user.id };
    if (status) {
      filter.status = status;
    }

    const tickets = await SupportTicket.find(filter)
      .populate('user', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await SupportTicket.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      count: tickets.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      tickets
    });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Get all support tickets (Admin/Support)
// @route   GET /api/support/tickets/all
// @access  Private/Admin/Support
router.get('/tickets/all', protect, authorize('admin', 'support'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const priority = req.query.priority;

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const tickets = await SupportTicket.find(filter)
      .populate('user', 'firstName lastName email phone')
      .populate('assignedTo', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await SupportTicket.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      count: tickets.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      tickets
    });
  } catch (error) {
    console.error('Get all tickets error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Get single support ticket
// @route   GET /api/support/tickets/:id
// @access  Private
router.get('/tickets/:id', protect, async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('user', 'firstName lastName email phone')
      .populate('assignedTo', 'firstName lastName')
      .populate('messages.sender', 'firstName lastName role');

    if (!ticket) {
      return res.status(404).json({
        status: 'error',
        message: 'Ticket not found'
      });
    }

    // Users can only view their own tickets unless they're admin/support
    if (req.user.role !== 'admin' && req.user.role !== 'support' && ticket.user._id.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to view this ticket'
      });
    }

    res.status(200).json({
      status: 'success',
      ticket
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Add message to support ticket
// @route   POST /api/support/tickets/:id/messages
// @access  Private
router.post('/tickets/:id/messages', protect, [
  body('message')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Message cannot be empty'),
  body('isInternal')
    .optional()
    .isBoolean()
    .withMessage('isInternal must be a boolean')
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

    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        status: 'error',
        message: 'Ticket not found'
      });
    }

    // Check authorization
    const isAuthorized = 
      ticket.user.toString() === req.user.id || 
      req.user.role === 'admin' || 
      req.user.role === 'support';

    if (!isAuthorized) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to add messages to this ticket'
      });
    }

    const { message, isInternal = false } = req.body;

    // Only admin/support can add internal messages
    if (isInternal && req.user.role !== 'admin' && req.user.role !== 'support') {
      return res.status(403).json({
        status: 'error',
        message: 'Only staff can add internal messages'
      });
    }

    ticket.messages.push({
      sender: req.user.id,
      message,
      isInternal
    });

    // Update ticket status if it was closed
    if (ticket.status === 'closed') {
      ticket.status = 'open';
    }

    await ticket.save();

    res.status(201).json({
      status: 'success',
      message: 'Message added successfully',
      ticket
    });
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Update ticket status (Admin/Support)
// @route   PUT /api/support/tickets/:id/status
// @access  Private/Admin/Support
router.put('/tickets/:id/status', protect, authorize('admin', 'support'), [
  body('status')
    .isIn(['open', 'in_progress', 'resolved', 'closed'])
    .withMessage('Invalid status'),
  body('resolution')
    .optional()
    .trim()
    .isLength({ min: 5 })
    .withMessage('Resolution must be at least 5 characters')
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

    const { status, resolution } = req.body;

    const updateData = { status };
    
    if (status === 'resolved' && resolution) {
      updateData.resolution = {
        description: resolution,
        resolvedBy: req.user.id,
        resolvedAt: new Date()
      };
      updateData.actualResolution = new Date();
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('user', 'firstName lastName email');

    if (!ticket) {
      return res.status(404).json({
        status: 'error',
        message: 'Ticket not found'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Ticket status updated',
      ticket
    });
  } catch (error) {
    console.error('Update ticket status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Assign ticket (Admin/Support)
// @route   PUT /api/support/tickets/:id/assign
// @access  Private/Admin/Support
router.put('/tickets/:id/assign', protect, authorize('admin', 'support'), [
  body('assignedTo')
    .isMongoId()
    .withMessage('Invalid user ID')
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

    const { assignedTo } = req.body;

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { assignedTo },
      { new: true }
    ).populate('assignedTo', 'firstName lastName');

    if (!ticket) {
      return res.status(404).json({
        status: 'error',
        message: 'Ticket not found'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Ticket assigned successfully',
      ticket
    });
  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

module.exports = router;
