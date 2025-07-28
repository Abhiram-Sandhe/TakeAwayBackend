// middleware/upload.js - Enhanced version with dynamic folder support
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// Create storage with dynamic folder
const createStorage = (folderName) => {
  try {
    // Validate Cloudinary configuration
    const config = cloudinary.config();
    if (!config.cloud_name || !config.api_key || !config.api_secret) {
      throw new Error('Cloudinary configuration is incomplete');
    }

    return new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: folderName,
        allowed_formats: ['jpg', 'png', 'jpeg'],
        // transformation: [{ width: 500, height: 500, crop: 'limit' }],
      },
    });
  } catch (error) {
    console.error('CloudinaryStorage creation failed:', error.message);
    // Fallback to memory storage
    return multer.memoryStorage();
  }
};

// Generic upload function
const createUpload = (folderName) => {
  const storage = createStorage(folderName);
  
  return multer({
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed!'), false);
      }
    }
  });
};

// Generic upload middleware
const uploadSingle = (fieldName, folderName = 'uploads') => {
  const upload = createUpload(folderName);
  
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (error) => {
      if (error) {
        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File too large. Maximum size is 5MB.'
          });
        }

        return res.status(400).json({
          success: false,
          message: 'File upload error',
          error: error.message
        });
      }

      next();
    });
  };
};

// Specific upload functions for different use cases
const uploadRestaurantImage = (fieldName) => uploadSingle(fieldName, 'restaurants');
const uploadFoodImage = (fieldName) => uploadSingle(fieldName, 'food-items');
const uploadUserAvatar = (fieldName) => uploadSingle(fieldName, 'user-avatars');

// Legacy support - keep the original upload for backward compatibility
const upload = createUpload('uploads');

module.exports = { 
  upload,
  uploadSingle, 
  uploadRestaurantImage, 
  uploadFoodImage, 
  uploadUserAvatar 
};