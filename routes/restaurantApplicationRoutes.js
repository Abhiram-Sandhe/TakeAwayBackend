const express = require('express');
const { auth, authorize } = require('../middlewares/auth.js');
const { uploadSingle } = require('../middlewares/upload');
const {
  submitRestaurantApplication,
  getAllApplications,
  reviewApplication,
  getApplicationById,
  getApplicationStatus
} = require('../controllers/restaurantApplicationController');

const router = express.Router();


// PUBLIC ROUTES
// Submit restaurant application (Public route - for "Partner with Us" form)
router.post('/apply', uploadSingle('image'), submitRestaurantApplication);

// Get application status by email (public route for applicants to check status)
router.get('/status', getApplicationStatus);

// ADMIN ROUTES (Protected)
// Get all restaurant applications with filtering and pagination
router.get('/', auth, authorize('admin'), getAllApplications);

// Get specific application details
router.get('/:applicationId', auth, authorize('admin'), getApplicationById);

// Review application (approve/reject)
router.patch('/:applicationId/review', auth, authorize('admin'), reviewApplication);

module.exports = router;