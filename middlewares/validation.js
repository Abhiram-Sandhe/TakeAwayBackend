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