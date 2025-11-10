const express = require('express');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
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
// @access  Public
router.post('/request', [
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

    // Check if SMTP is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('SMTP credentials not configured');
      return res.status(500).json({
        status: 'error',
        message: 'Email service not configured. Please contact support directly.'
      });
    }

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
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.status(200).json({
      status: 'success',
      message: 'Quote request submitted successfully. We will contact you soon.'
    });
  } catch (error) {
    console.error('Quote request error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to submit quote request. Please try again later.'
    });
  }
});

module.exports = router;

