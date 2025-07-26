// middleware/upload.js - Clean version with proper error handling
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

let storage;

try {
  // Validate Cloudinary configuration
  const config = cloudinary.config();
  if (!config.cloud_name || !config.api_key || !config.api_secret) {
    throw new Error('Cloudinary configuration is incomplete');
  }

  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'restaurants',
      allowed_formats: ['jpg', 'png', 'jpeg'],
      // transformation: [{ width: 500, height: 500, crop: 'limit' }],
    },
  });
} catch (error) {
  console.error('CloudinaryStorage creation failed:', error.message);
  // Fallback to memory storage
  storage = multer.memoryStorage();
}

const upload = multer({
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

const uploadSingle = (fieldName) => {
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

module.exports = { upload, uploadSingle };
