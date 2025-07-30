const express = require('express');
const { auth, authorize } = require('../middlewares/auth.js');
const { uploadSingle } = require('../middlewares/upload');
const {
  submitRestaurantApplication,
  getAllApplications,
  reviewApplication,
  getApplicationById
} = require('../controllers/restaurantApplicationController');

const router = express.Router();

// ========================================
// PUBLIC ROUTES
// ========================================

// Submit restaurant application (Public route - for "Partner with Us" form)
router.post('/apply', uploadSingle('image'), submitRestaurantApplication);

// ========================================
// ADMIN ROUTES (Protected)
// ========================================

// Get all restaurant applications with filtering and pagination
router.get('/', auth, authorize('admin'), getAllApplications);

// Get specific application details
router.get('/:applicationId', auth, authorize('admin'), getApplicationById);

// Review application (approve/reject)
router.patch('/:applicationId/review', auth, authorize('admin'), reviewApplication);

// Get application statistics
// router.get('/stats/dashboard', auth, authorize('admin'), async (req, res) => {
//   try {
//     const RestaurantApplication = require('../models/RestaurantApplication');
    
//     const stats = await RestaurantApplication.aggregate([
//       {
//         $group: {
//           _id: '$status',
//           count: { $sum: 1 }
//         }
//       }
//     ]);

//     const result = {
//       total: 0,
//       pending: 0,
//       approved: 0,
//       rejected: 0
//     };

//     stats.forEach(stat => {
//       result[stat._id] = stat.count;
//       result.total += stat.count;
//     });

//     // Get recent applications
//     const recentApplications = await RestaurantApplication.find()
//       .sort({ appliedAt: -1 })
//       .limit(5)
//       .select('name ownerName ownerEmail status appliedAt');

//     res.json({
//       success: true,
//       stats: result,
//       recentApplications
//     });

//   } catch (error) {
//     console.error('Application stats error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error occurred'
//     });
//   }
// });

// // Bulk actions for applications
// router.patch('/bulk-action', auth, authorize('admin'), async (req, res) => {
//   try {
//     const { applicationIds, action, adminNotes } = req.body;
//     const adminId = req.user.id;

//     if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Please provide application IDs'
//       });
//     }

//     if (!['approved', 'rejected'].includes(action)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Action must be either approved or rejected'
//       });
//     }

//     const RestaurantApplication = require('../models/RestaurantApplication');
//     const User = require('../models/User');
//     const Restaurant = require('../models/Restaurant');
    
//     const results = {
//       success: [],
//       failed: []
//     };

//     for (const applicationId of applicationIds) {
//       try {
//         const application = await RestaurantApplication.findById(applicationId);
        
//         if (!application || application.status !== 'pending') {
//           results.failed.push({
//             applicationId,
//             reason: 'Application not found or already reviewed'
//           });
//           continue;
//         }

//         // Update application
//         application.status = action;
//         application.adminNotes = adminNotes;
//         application.reviewedAt = new Date();
//         application.reviewedBy = adminId;
//         await application.save();

//         // If approved, create restaurant and user
//         if (action === 'approved') {
//           const owner = new User({
//             name: application.ownerName,
//             email: application.ownerEmail,
//             password: application.ownerPassword, // Already hashed
//             phone: application.ownerPhone,
//             role: 'restaurant'
//           });
//           await owner.save();

//           const restaurant = new Restaurant({
//             name: application.name,
//             owner: owner._id,
//             description: application.description,
//             address: application.address,
//             phone: application.phone,
//             cuisine: application.cuisine || 'General',
//             image: application.image,
//             isOpen: true,
//             isActive: true
//           });
//           await restaurant.save();

//           application.createdRestaurant = restaurant._id;
//           application.createdUser = owner._id;
//           await application.save();
//         }

//         results.success.push(applicationId);

//       } catch (error) {
//         results.failed.push({
//           applicationId,
//           reason: error.message
//         });
//       }
//     }

//     res.json({
//       success: true,
//       message: `Bulk action completed. ${results.success.length} successful, ${results.failed.length} failed.`,
//       results
//     });

//   } catch (error) {
//     console.error('Bulk action error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error occurred'
//     });
//   }
// });

module.exports = router;