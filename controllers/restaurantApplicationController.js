const RestaurantApplication = require('../models/RestaurantApplication');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const bcrypt = require('bcrypt');

// Submit Restaurant Application (Public Route)
const submitRestaurantApplication = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      address, 
      phone, 
      cuisine, 
      ownerName,
      ownerEmail,
      ownerPhone,
      ownerPassword
    } = req.body;

    // Validate required fields
    if (!name || !description || !address || !phone || !ownerName || !ownerEmail || !ownerPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, description, address, phone, ownerName, ownerEmail, ownerPassword.'
      });
    }

    // Check if application with this email already exists
    const existingApplication = await RestaurantApplication.findOne({ 
      ownerEmail,
      status: { $in: ['pending', 'approved'] }
    });
    
    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'An application with this email already exists or is already approved.'
      });
    }

    // Check if user with this email already exists
    const existingUser = await User.findOne({ email: ownerEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists.'
      });
    }

    // Hash password for security while storing in application

    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      if (req.file.path) {
        imageUrl = req.file.path;
      }
    }

    // Create restaurant application with hashed password
    const application = new RestaurantApplication({
      name,
      description,
      address,
      phone,
      cuisine: cuisine || 'General',
      ownerName,
      ownerEmail,
      ownerPhone,
      ownerPassword, // Store hashed password
      image: imageUrl
    });

    await application.save();

    const response = {
      success: true,
      message: 'Restaurant application submitted successfully! We will review your application and get back to you soon.',
      applicationId: application._id
    };

    if (req.file && !req.file.path) {
      response.warning = 'Image was uploaded but Cloudinary is not available. Image not saved to cloud storage.';
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('Submit restaurant application error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error occurred',
      error: error.message
    });
  }
};

// Get All Applications (Admin Only)
const getAllApplications = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const filter = {};
    if (status) {
      filter.status = status;
    }

    const applications = await RestaurantApplication.find(filter)
      .populate('reviewedBy', 'name')
      .populate('createdUser', 'name email')
      .populate('createdRestaurant', 'name')
      .sort({ appliedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await RestaurantApplication.countDocuments(filter);

    res.json({
      success: true,
      applications,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalApplications: total
      }
    });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred'
    });
  }
};

// Review Application (Admin Only)
const reviewApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status, adminNotes } = req.body;
    const adminId = req.user.id; // Assuming admin user is in req.user

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either approved or rejected'
      });
    }

    const application = await RestaurantApplication.findById(applicationId);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Application has already been reviewed'
      });
    }

    // If approved, create user and restaurant
    if (status === 'approved') {
      try {
        // Double-check that user doesn't exist
        const existingUser = await User.findOne({ email: application.ownerEmail });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'A user with this email already exists.'
          });
        }

        const owner = new User({
          name: application.ownerName,
          email: application.ownerEmail,
          password: application.ownerPassword, 
          phone: application.ownerPhone,
          role: 'restaurant'
        });
        await owner.save();

        // Create restaurant
        const restaurant = new Restaurant({
          name: application.name,
          owner: owner._id,
          description: application.description,
          address: application.address,
          phone: application.phone,
          cuisine: application.cuisine || 'General',
          image: application.image,
          isOpen: true,
          isActive: true
        });
        await restaurant.save();

        // Update application status with references to created entities
        application.status = status;
        application.adminNotes = adminNotes;
        application.reviewedAt = new Date();
        application.reviewedBy = adminId;
        application.createdRestaurant = restaurant._id;
        application.createdUser = owner._id;
        await application.save();

        res.json({
          success: true,
          message: 'Application approved and restaurant created successfully',
          data: {
            restaurantId: restaurant._id,
            userId: owner._id,
            restaurantName: restaurant.name,
            ownerEmail: owner.email
          }
        });

      } catch (createError) {
        console.error('Error creating restaurant after approval:', createError);
        
        // If we have specific validation errors, return them
        if (createError.name === 'ValidationError') {
          return res.status(400).json({
            success: false,
            message: 'Validation error while creating user/restaurant',
            errors: Object.keys(createError.errors).map(key => ({
              field: key,
              message: createError.errors[key].message
            }))
          });
        }

        // For duplicate key errors
        if (createError.code === 11000) {
          return res.status(400).json({
            success: false,
            message: 'A user or restaurant with this information already exists.'
          });
        }

        return res.status(500).json({
          success: false,
          message: 'Failed to create restaurant after approval. Please try again.',
          error: createError.message
        });
      }
    } else {
      // If rejected, just update the application status
      application.status = status;
      application.adminNotes = adminNotes;
      application.reviewedAt = new Date();
      application.reviewedBy = adminId;
      await application.save();

      res.json({
        success: true,
        message: 'Application rejected successfully'
      });
    }

  } catch (error) {
    console.error('Review application error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred',
      error: error.message
    });
  }
};

// Get Application Details (Admin Only)
const getApplicationById = async (req, res) => {
  try {
    const { applicationId } = req.params;
    
    const application = await RestaurantApplication.findById(applicationId)
      .populate('reviewedBy', 'name email')
      .populate('createdUser', 'name email phone role')
      .populate('createdRestaurant', 'name address phone cuisine isActive isOpen');
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    res.json({
      success: true,
      application
    });
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred'
    });
  }
};

// Get Application Status (Public Route - for applicants to check their status)
const getApplicationStatus = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const application = await RestaurantApplication.findOne({ ownerEmail: email })
      .select('status appliedAt reviewedAt adminNotes name')
      .sort({ appliedAt: -1 });
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'No application found for this email'
      });
    }

    res.json({
      success: true,
      application: {
        id: application._id,
        restaurantName: application.name,
        status: application.status,
        submittedAt: application.appliedAt,
        reviewedAt: application.reviewedAt,
        adminNotes: application.adminNotes
      }
    });
  } catch (error) {
    console.error('Get application status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred'
    });
  }
};

module.exports = {
  submitRestaurantApplication,
  getAllApplications,
  reviewApplication,
  getApplicationById,
  getApplicationStatus
};