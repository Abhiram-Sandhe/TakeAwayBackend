const { body, validationResult } = require('express-validator');

const validateOrder = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),
  
  body('items.*.foodId')
    .isMongoId()
    .withMessage('Invalid food ID'),
  
  body('items.*.quantity')
    .isInt({ min: 1, max: 20 })
    .withMessage('Quantity must be between 1 and 20'),
  
  body('orderType')
    .optional()
    .isIn(['dine-in', 'takeaway', 'delivery'])
    .withMessage('Invalid order type'),

  body('tableNumber')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Table number must be between 1 and 100')
    .custom((value, { req }) => {
      if (req.body.orderType === 'dine-in' && !value) {
        throw new Error('Table number is required for dine-in orders');
      }
      return true;
    }),

  body('customerPhone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),

  body('customerAddress')
    .optional()
    .custom((value, { req }) => {
      if (req.body.orderType === 'delivery' && !value) {
        throw new Error('Address is required for delivery orders');
      }
      return true;
    }),

  body('paymentMethod')
    .optional()
    .isIn(['cash', 'card', 'upi', 'online'])
    .withMessage('Invalid payment method'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

const validateOrderStatus = [
  body('status')
    .isIn(['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'])
    .withMessage('Invalid status'),
  
  body('estimatedTime')
    .optional()
    .isInt({ min: 1, max: 180 })
    .withMessage('Estimated time must be between 1 and 180 minutes'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

module.exports = {
  validateOrder,
  validateOrderStatus
};