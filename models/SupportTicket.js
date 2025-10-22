const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ticketNumber: {
    type: String,
    unique: true,
    required: false
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  issueType: {
    type: String,
    required: [true, 'Issue type is required'],
    enum: [
      'Internet Connectivity',
      'Technical Support',
      'Billing Inquiry',
      'Service Request',
      'Account Issues',
      'Other'
    ]
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    isInternal: {
      type: Boolean,
      default: false
    },
    attachments: [{
      filename: String,
      url: String,
      size: Number
    }],
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  resolution: {
    description: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date
  },
  tags: [String],
  estimatedResolution: Date,
  actualResolution: Date
}, {
  timestamps: true
});

// Generate ticket number before saving
supportTicketSchema.pre('save', async function(next) {
  if (this.isNew && !this.ticketNumber) {
    try {
      // Use a more robust approach to generate unique ticket numbers
      let ticketNumber;
      let attempts = 0;
      const maxAttempts = 10;
      
      do {
        const count = await this.constructor.countDocuments();
        ticketNumber = `FR-${String(count + 1 + attempts).padStart(6, '0')}`;
        attempts++;
        
        // Check if this ticket number already exists
        const existing = await this.constructor.findOne({ ticketNumber });
        if (!existing) {
          this.ticketNumber = ticketNumber;
          break;
        }
      } while (attempts < maxAttempts);
      
      if (!this.ticketNumber) {
        // Fallback to timestamp-based ticket number
        this.ticketNumber = `FR-${Date.now().toString().slice(-6)}`;
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Index for better query performance
supportTicketSchema.index({ user: 1, status: 1 });
supportTicketSchema.index({ ticketNumber: 1 });
supportTicketSchema.index({ status: 1, priority: 1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
