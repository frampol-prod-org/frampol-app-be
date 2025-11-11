const express = require('express');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const QuoteRequest = require('../models/QuoteRequest');
const { optionalAuth, protect, authorize } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

// Configure nodemailer transporter
const createTransporter = () => {
  // For development, you can use Gmail or other SMTP services
  // For production, configure with your actual SMTP settings
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// @desc    Request quote
// @route   POST /api/quotes/request
// @access  Public (optionally authenticated)
router.post('/request', optionalAuth, [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .trim()
    .isLength({ min: 5, max: 20 })
    .withMessage('Phone number must be between 5 and 20 characters'),
  body('service')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Service name is required'),
  body('message')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Message cannot exceed 1000 characters')
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

    const { name, email, phone, service, message } = req.body;
    
    // Get user ID if authenticated (optional)
    const userId = req.user ? req.user.id : null;

    // Save quote request to database
    const quoteRequest = new QuoteRequest({
      name,
      email,
      phone,
      service,
      message: message || undefined,
      user: userId || undefined,
      status: 'pending'
    });

    await quoteRequest.save();

    // Try to send email (but don't fail if email fails - we've saved to DB)
    let emailSent = false;
    try {
      // Check if SMTP is configured
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        // Create transporter
        const transporter = createTransporter();

        // Email content
        const mailOptions = {
          from: process.env.SMTP_USER,
          to: 'dev3@frampolafrica.com',
          subject: `Quote Request: ${service}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #550000;">New Quote Request</h2>
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Service:</strong> ${service}</p>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Phone:</strong> ${phone}</p>
                ${message ? `<p><strong>Message:</strong></p><p style="background-color: white; padding: 10px; border-radius: 4px;">${message}</p>` : ''}
              </div>
              <p style="color: #666; font-size: 12px;">This quote request was submitted through the Frampol mobile app.</p>
              <p style="color: #666; font-size: 12px;">Quote Request ID: ${quoteRequest._id}</p>
            </div>
          `,
          text: `
            New Quote Request
            
            Service: ${service}
            Name: ${name}
            Email: ${email}
            Phone: ${phone}
            ${message ? `Message: ${message}` : ''}
            
            This quote request was submitted through the Frampol mobile app.
            Quote Request ID: ${quoteRequest._id}
          `
        };

        // Send email
        await transporter.sendMail(mailOptions);
        emailSent = true;
        
        // Update quote request with email sent status
        quoteRequest.emailSent = true;
        quoteRequest.emailSentAt = new Date();
        await quoteRequest.save();
      } else {
        console.warn('SMTP credentials not configured - email not sent, but quote request saved to database');
      }
    } catch (emailError) {
      console.error('Error sending email (quote request saved to database):', emailError);
      // Don't fail the request if email fails - we've saved to DB
    }

    res.status(200).json({
      status: 'success',
      message: 'Quote request submitted successfully. We will contact you soon.',
      quoteRequestId: quoteRequest._id,
      emailSent
    });
  } catch (error) {
    console.error('Quote request error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to submit quote request. Please try again later.'
    });
  }
});

// @desc    Get all quote requests (Admin/Support)
// @route   GET /api/quotes
// @access  Private/Admin/Support
router.get('/', protect, authorize('admin', 'support'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const service = req.query.service;

    const filter = {};
    if (status) filter.status = status;
    if (service) filter.service = { $regex: service, $options: 'i' };

    const quoteRequests = await QuoteRequest.find(filter)
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await QuoteRequest.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      count: quoteRequests.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      quoteRequests
    });
  } catch (error) {
    console.error('Get quote requests error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Get single quote request (Admin/Support)
// @route   GET /api/quotes/:id
// @access  Private/Admin/Support
router.get('/:id', protect, authorize('admin', 'support'), async (req, res) => {
  try {
    const quoteRequest = await QuoteRequest.findById(req.params.id)
      .populate('user', 'firstName lastName email phone');

    if (!quoteRequest) {
      return res.status(404).json({
        status: 'error',
        message: 'Quote request not found'
      });
    }

    res.status(200).json({
      status: 'success',
      quoteRequest
    });
  } catch (error) {
    console.error('Get quote request error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Update quote request status (Admin/Support)
// @route   PUT /api/quotes/:id/status
// @access  Private/Admin/Support
router.put('/:id/status', protect, authorize('admin', 'support'), [
  body('status')
    .isIn(['pending', 'contacted', 'quoted', 'closed'])
    .withMessage('Invalid status'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
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

    const { status, notes } = req.body;

    const quoteRequest = await QuoteRequest.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        ...(notes && { notes })
      },
      { new: true }
    ).populate('user', 'firstName lastName email');

    if (!quoteRequest) {
      return res.status(404).json({
        status: 'error',
        message: 'Quote request not found'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Quote request status updated',
      quoteRequest
    });
  } catch (error) {
    console.error('Update quote request status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

module.exports = router;

