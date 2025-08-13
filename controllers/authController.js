const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const User = require('../models/User.js');
const Restaurant = require('../models/Restaurant.js');
const {sendEmail} = require('../config/email.js');

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map();

const register = async (req, res) => {
  try {
    const { name, email, password, role, phone, address } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    const tempUserId = uuidv4();
    otpStore.set(tempUserId, {
      name,
      email,
      password,
      role,
      phone,
      address,
      otp,
      otpExpiry,
      verified: false
    });

    const emailHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Email Verification</h2>
        <p>Hello ${name},</p>
        <p>Thank you for registering! Please use the following OTP to verify your email address:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #2563eb; font-size: 32px; margin: 0;">${otp}</h1>
        </div>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't create an account, please ignore this email.</p>
      </div>
    `;

    const emailSent = await sendEmail(email, 'Verify Your Email - OTP', emailHTML);
    
    if (!emailSent) {
      otpStore.delete(tempUserId);
      return res.status(500).json({ message: 'Failed to send verification email' });
    }

    res.status(200).json({
      message: 'Registration initiated. Please check your email for OTP verification.',
      tempUserId,
      email // You might want to hide this in production
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const sendSuccessEmail = async (user) => {
  const successEmailHTML = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 0;">
      <div style="background: white; margin: 0 20px; border-radius: 10px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 40px;">✓</span>
          </div>
          <h1 style="color: #333; margin: 0; font-size: 28px;">Account Created Successfully!</h1>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0;">
          <h2 style="color: #333; margin-top: 0; font-size: 20px;">Welcome to our platform, ${user.name}!</h2>
          <p style="color: #666; margin: 15px 0; line-height: 1.6;">
            🎉 Congratulations! Your account has been successfully created and verified. You're now ready to explore all the amazing features we have to offer.
          </p>
        </div>

        <div style="margin: 25px 0;">
          <h3 style="color: #333; margin-bottom: 15px;">Account Details:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666; font-weight: bold;">Name:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${user.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666; font-weight: bold;">Email:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${user.email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666; font-weight: bold;">Role:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333; text-transform: capitalize;">${user.role}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: bold;">Status:</td>
              <td style="padding: 8px 0; color: #4CAF50; font-weight: bold;">✓ Verified</td>
            </tr>
          </table>
        </div>

        <div style="background-color: #e3f2fd; border-left: 4px solid #2196F3; padding: 20px; margin: 25px 0;">
          <h3 style="color: #1976D2; margin-top: 0; font-size: 18px;">What's Next?</h3>
          <ul style="color: #666; margin: 0; padding-left: 20px; line-height: 1.6;">
            <li>Complete your profile setup</li>
            <li>Explore our features and services</li>
            <li>Connect with other users</li>
            <li>Start your journey with us!</li>
          </ul>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #666; margin: 10px 0;">Need help? Contact our support team</p>
          <p style="color: #999; font-size: 14px; margin: 5px 0;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      </div>
    </div>
  `;

  return await sendEmail(
    user.email, 
    '🎉 Welcome! Your Account is Ready',
    successEmailHTML
  );
};

const verifyOTP = async (req, res) => {
  try {
    const { tempUserId, otp } = req.body;

    // Get temporary user data
    const tempUserData = otpStore.get(tempUserId);
    
    if (!tempUserData) {
      return res.status(400).json({ message: 'Invalid or expired verification session' });
    }

    // Check if OTP has expired
    if (Date.now() > tempUserData.otpExpiry) {
      otpStore.delete(tempUserId);
      return res.status(400).json({ message: 'OTP has expired. Please register again.' });
    }

    // Verify OTP
    if (tempUserData.otp !== otp.toString()) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Create user in database
    const user = new User({
      name: tempUserData.name,
      email: tempUserData.email,
      password: tempUserData.password,
      role: tempUserData.role,
      phone: tempUserData.phone,
      address: tempUserData.address,
      emailVerified: true
    });

    await user.save();

    // Clean up temporary data
    otpStore.delete(tempUserId);

    // Send success email
    try {
      await sendSuccessEmail(user);
    } catch (emailError) {
      console.error('Failed to send success email:', emailError);
      // Don't fail the registration if success email fails
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Email verified and account created successfully! A confirmation email has been sent.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const resendOTP = async (req, res) => {
  try {
    const { tempUserId } = req.body;

    const tempUserData = otpStore.get(tempUserId);
    
    if (!tempUserData) {
      return res.status(400).json({ message: 'Invalid verification session. Please register again.' });
    }

    // Generate new OTP
    const newOTP = generateOTP();
    const newOtpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Update stored data
    tempUserData.otp = newOTP;
    tempUserData.otpExpiry = newOtpExpiry;
    otpStore.set(tempUserId, tempUserData);

    // Send new OTP email
    const emailHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Email Verification - New OTP</h2>
        <p>Hello ${tempUserData.name},</p>
        <p>Here's your new OTP for email verification:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #2563eb; font-size: 32px; margin: 0;">${newOTP}</h1>
        </div>
        <p>This OTP will expire in 10 minutes.</p>
      </div>
    `;

    const emailSent = await sendEmail(tempUserData.email, 'New Verification OTP', emailHTML);
    
    if (!emailSent) {
      return res.status(500).json({ message: 'Failed to send verification email' });
    }

    res.status(200).json({
      message: 'New OTP sent successfully to your email.'
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

     if (!user.emailVerified) {
      return res.status(400).json({ 
        message: 'Please verify your email address before logging in.',
        emailVerified: false 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: 'Login Succesfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone:user.phone,
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const logout = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Add current token to blacklist
    user.tokenBlacklist.push(req.token);
    
    // Keep only last 10 tokens in blacklist to prevent unlimited growth
    if (user.tokenBlacklist.length > 10) {
      user.tokenBlacklist = user.tokenBlacklist.slice(-10);
    }
    
    await user.save();
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Method 1: Using UUID (recommended)
    const resetToken = uuidv4() + uuidv4(); // Double UUID for extra security
    
    // Method 2: Alternative using built-in crypto (if you prefer)
    // const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Method 3: Simple random string generator
    // const resetToken = Math.random().toString(36).substring(2, 15) + 
    //                   Math.random().toString(36).substring(2, 15) + 
    //                   Date.now().toString(36);
    
    // Hash token using built-in crypto and set to resetPasswordToken field
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Set expire time (10 minutes)
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    
    await user.save();

    // Create reset URL
    const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;

    // Email HTML content
    const htmlContent = `
      <h2>Password Reset Request</h2>
      <p>Dear ${user.name},</p>
      <p>You have requested to reset your password. Please click the button below to reset your password:</p>
      <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>If the button doesn't work, copy and paste this URL into your browser:</p>
      <p>${resetUrl}</p>
      <p>This link will expire in 10 minutes.</p>
      <p>If you did not request this password reset, please ignore this email.</p>
      <p>Best regards,<br>Takeaway Team</p>
    `;

    const emailSent = await sendEmail(
      user.email,
      'Password Reset Request - Takeaway App',
      htmlContent
    );

    if (emailSent) {
      res.json({ message: 'Password reset email sent successfully' });
    } else {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      res.status(500).json({ message: 'Email could not be sent' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    console.log('Reset password - Received token:', token);
    console.log('Reset password - Password length:', password?.length);

    // Hash the token to match with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    console.log('Reset password - Hashed token:', hashedToken);

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    console.log('Reset password - User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Hash the new password before saving (important!)
    const bcrypt = require('bcrypt');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Set new password
    user.password = hashedPassword; // Use hashed password
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    await user.save();
    console.log('Password updated successfully');

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
module.exports = { register, verifyOTP, resendOTP, login, logout, forgotPassword, resetPassword };



