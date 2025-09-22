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

// const sendSuccessEmail = async (user) => {
//   const successEmailHTML = `
//     <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 0;">
//       <div style="background: white; margin: 0 20px; border-radius: 10px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
//         <div style="text-align: center; margin-bottom: 30px;">
//           <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
//             <span style="color: white; font-size: 40px;">✓</span>
//           </div>
//           <h1 style="color: #333; margin: 0; font-size: 28px;">Account Created Successfully!</h1>
//         </div>
        
//         <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0;">
//           <h2 style="color: #333; margin-top: 0; font-size: 20px;">Welcome to our platform, ${user.name}!</h2>
//           <p style="color: #666; margin: 15px 0; line-height: 1.6;">
//             🎉 Congratulations! Your account has been successfully created and verified. You're now ready to explore all the amazing features we have to offer.
//           </p>
//         </div>

//         <div style="margin: 25px 0;">
//           <h3 style="color: #333; margin-bottom: 15px;">Account Details:</h3>
//           <table style="width: 100%; border-collapse: collapse;">
//             <tr>
//               <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666; font-weight: bold;">Name:</td>
//               <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${user.name}</td>
//             </tr>
//             <tr>
//               <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666; font-weight: bold;">Email:</td>
//               <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${user.email}</td>
//             </tr>
//             <tr>
//               <td style="padding: 8px 0; color: #666; font-weight: bold;">Status:</td>
//               <td style="padding: 8px 0; color: #4CAF50; font-weight: bold;">✓ Verified</td>
//             </tr>
//           </table>
//         </div>

//         <div style="background-color: #e3f2fd; border-left: 4px solid #2196F3; padding: 20px; margin: 25px 0;">
//           <h3 style="color: #1976D2; margin-top: 0; font-size: 18px;">What's Next?</h3>
//           <ul style="color: #666; margin: 0; padding-left: 20px; line-height: 1.6;">
//             <li>Complete your profile setup</li>
//             <li>Explore our features and services</li>
//             <li>Connect with other users</li>
//             <li>Start your journey with us!</li>
//           </ul>
//         </div>

//         <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
//           <p style="color: #666; margin: 10px 0;">Need help? Contact our support team</p>
//           <p style="color: #999; font-size: 14px; margin: 5px 0;">
//             This is an automated message. Please do not reply to this email.
//           </p>
//         </div>
//       </div>
//     </div>
//   `;

//   return await sendEmail(
//     user.email, 
//     '🎉 Welcome! Your Account is Ready',
//     successEmailHTML
//   );
// };

const sendSuccessEmail = async (user) => {
  const successEmailHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to GrabGrub!</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Poppins', sans-serif;
                background: linear-gradient(135deg, #ff6b6b 0%, #ffa500 50%, #ff4757 100%);
                padding: 20px;
                margin: 0;
            }
            
            .email-container {
                max-width: 650px;
                margin: 0 auto;
                background: white;
                border-radius: 24px;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(255, 75, 87, 0.3);
            }
            
            .header {
                background: linear-gradient(135deg, #ff4757 0%, #ff3838 100%);
                padding: 50px 30px;
                text-align: center;
                position: relative;
                overflow: hidden;
            }
            
            .header::before {
                content: '';
                position: absolute;
                top: -50px;
                left: -50px;
                width: 150px;
                height: 150px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 50%;
            }
            
            .food-emoji {
                font-size: 80px;
                margin-bottom: 20px;
                position: relative;
                z-index: 2;
            }
            
            .header h1 {
                color: white;
                font-size: 32px;
                font-weight: 800;
                margin-bottom: 12px;
                position: relative;
                z-index: 2;
                text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            }
            
            .header p {
                color: rgba(255, 255, 255, 0.95);
                font-size: 16px;
                font-weight: 400;
                position: relative;
                z-index: 2;
            }
            
            .content {
                padding: 40px 30px;
            }
            
            .welcome-card {
                background: linear-gradient(135deg, #fff5f5 0%, #fef2f2 100%);
                border-radius: 20px;
                padding: 30px;
                margin-bottom: 30px;
                border: 2px solid #ffe4e6;
                position: relative;
            }
            
            .welcome-card::before {
                content: '🍕';
                position: absolute;
                top: 15px;
                right: 20px;
                font-size: 35px;
                opacity: 0.3;
            }
            
            .welcome-card h2 {
                color: #dc2626;
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 15px;
            }
            
            .welcome-card p {
                color: #7f1d1d;
                line-height: 1.7;
                font-size: 16px;
            }
            
            .account-details {
                background: white;
                border-radius: 18px;
                padding: 25px;
                margin-bottom: 30px;
                border: 1px solid #f1f5f9;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
            }
            
            .account-details h3 {
                color: #1e293b;
                font-size: 20px;
                font-weight: 600;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
            }
            
            .account-details h3::before {
                content: '👤';
                margin-right: 10px;
                font-size: 20px;
            }
            
            .detail-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 0;
                border-bottom: 1px solid #f1f5f9;
            }
            
            .detail-row:last-child {
                border-bottom: none;
            }
            
            .detail-label {
                color: #64748b;
                font-weight: 500;
                font-size: 14px;
            }
            
            .detail-value {
                color: #1e293b;
                font-weight: 600;
                font-size: 16px;
            }
            
            .status-verified {
                color: #059669;
                display: flex;
                align-items: center;
                font-weight: 600;
            }
            
            .status-verified::before {
                content: '✅';
                margin-right: 8px;
            }
            
            .food-features {
                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                border-radius: 18px;
                padding: 30px;
                margin-bottom: 30px;
                border: 2px solid #fcd34d;
            }
            
            .food-features h3 {
                color: #92400e;
                font-size: 20px;
                font-weight: 700;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
            }
            
            .food-features h3::before {
                content: '🍽️';
                margin-right: 12px;
                font-size: 24px;
            }
            
            .features-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
            }
            
            .feature-item {
                background: rgba(255, 255, 255, 0.8);
                border-radius: 12px;
                padding: 20px;
                text-align: center;
                border: 1px solid rgba(146, 64, 14, 0.1);
            }
            
            .feature-item .emoji {
                font-size: 32px;
                margin-bottom: 10px;
                display: block;
            }
            
            .feature-item h4 {
                color: #92400e;
                font-weight: 600;
                margin-bottom: 8px;
                font-size: 16px;
            }
            
            .feature-item p {
                color: #a16207;
                font-size: 14px;
                line-height: 1.4;
            }
            
            .cta-section {
                text-align: center;
                margin: 35px 0;
            }
            
            .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #ff4757 0%, #ff3838 100%);
                color: white;
                padding: 16px 40px;
                border-radius: 50px;
                text-decoration: none;
                font-weight: 700;
                font-size: 18px;
                box-shadow: 0 8px 25px rgba(255, 71, 87, 0.4);
                margin: 10px;
            }
            
            .promo-banner {
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                border-radius: 16px;
                padding: 25px;
                text-align: center;
                margin-bottom: 30px;
                color: white;
            }
            
            .promo-banner h3 {
                font-size: 22px;
                font-weight: 700;
                margin-bottom: 8px;
            }
            
            .promo-banner p {
                font-size: 16px;
                opacity: 0.9;
            }
            
            .promo-code {
                background: rgba(255, 255, 255, 0.2);
                border: 2px dashed white;
                border-radius: 8px;
                padding: 10px 20px;
                font-size: 20px;
                font-weight: 800;
                letter-spacing: 2px;
                margin-top: 15px;
                display: inline-block;
            }
            
            .footer {
                background: #f8fafc;
                padding: 30px;
                text-align: center;
                border-top: 1px solid #e2e8f0;
            }
            
            .footer h4 {
                color: #1e293b;
                font-weight: 600;
                margin-bottom: 10px;
            }
            
            .contact-info {
                color: #64748b;
                font-size: 14px;
                margin: 5px 0;
            }
            
            .social-links {
                margin: 20px 0 15px;
            }
            
            .social-links a {
                display: inline-block;
                margin: 0 8px;
                text-decoration: none;
                font-size: 24px;
            }
            
            .disclaimer {
                color: #94a3b8;
                font-size: 12px;
                margin-top: 20px;
                line-height: 1.4;
            }
            
            @media (max-width: 600px) {
                .email-container {
                    margin: 10px;
                    border-radius: 16px;
                }
                
                .content {
                    padding: 25px 20px;
                }
                
                .header {
                    padding: 40px 20px;
                }
                
                .features-grid {
                    grid-template-columns: 1fr;
                }
                
                .header h1 {
                    font-size: 24px;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <h1>Welcome to GrabGrub!</h1>
                <p>Your favorite meals, delivered fresh to your door</p>
            </div>
            
            <div class="content">
                <div class="welcome-card">
                    <h2>Hey ${user.name}, you're all set! 🎉</h2>
                    <p>Welcome to the GrabGrub family! Your account has been successfully created and verified. Get ready to discover amazing restaurants, delicious cuisines, and convenient takeaway right at your fingertips.</p>
                </div>
                
                <div class="account-details">
                    <h3>Account Information</h3>
                    <div class="detail-row">
                        <span class="detail-label">Full Name : </span>
                        <span class="detail-value">${user.name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Email Address : </span>
                        <span class="detail-value">${user.email}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Account Status : </span>
                        <span class="detail-value status-verified">Verified & Active</span>
                    </div>
                </div>
                
                <div class="cta-section">
                    <a href="#" class="cta-button">🍽️ Start Ordering Now</a>
                </div>
            </div>
            
            <div class="footer">
                <h4>Need Help? We're Here!</h4>
                <div class="contact-info">📞 +91 98989 00001</div>
                <div class="contact-info">📧 grabgrubcontact@gmail.com</div>
                
                <div class="disclaimer">
                    <strong>GrabGrub</strong> - Delivering happiness, one meal at a time<br>
                    This is an automated message. Please don't reply to this email.<br>
                    © 2025 GrbGrub. All rights reserved.
                </div>
            </div>
        </div>
    </body>
    </html>
  `;

  return await sendEmail(
    user.email, 
    'Welcome to GrabGrub! Your Account is Ready',
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

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -tokenBlacklist');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        emailVerified: user.emailVerified,
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const logout = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
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
      <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your GrabGrub Password</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Poppins', sans-serif;
                background: linear-gradient(135deg, #ff6b6b 0%, #ffa500 50%, #ff4757 100%);
                padding: 20px;
                margin: 0;
            }
            
            .email-container {
                max-width: 600px;
                margin: 0 auto;
                background: white;
                border-radius: 24px;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(255, 75, 87, 0.3);
            }
            
            .header {
                background: linear-gradient(135deg, #ff4757 0%, #ff3838 100%);
                padding: 50px 30px;
                text-align: center;
                position: relative;
                overflow: hidden;
            }
            
            .header::before {
                content: '';
                position: absolute;
                top: -50px;
                right: -50px;
                width: 150px;
                height: 150px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 50%;
            }
            
            .lock-icon {
                width: 80px;
                height: 80px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                margin: 0 auto 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 40px;
                position: relative;
                z-index: 2;
                backdrop-filter: blur(10px);
                border: 2px solid rgba(255, 255, 255, 0.3);
            }
            
            .header h1 {
                color: white;
                font-size: 28px;
                font-weight: 800;
                margin-bottom: 12px;
                position: relative;
                z-index: 2;
                text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            }
            
            .header p {
                color: rgba(255, 255, 255, 0.95);
                font-size: 16px;
                font-weight: 400;
                position: relative;
                z-index: 2;
            }
            
            .content {
                padding: 40px 30px;
            }
            
            .reset-card {
                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                border-radius: 20px;
                padding: 30px;
                margin-bottom: 30px;
                border: 2px solid #fcd34d;
                text-align: center;
            }
            
            .reset-card h2 {
                color: #92400e;
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 15px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .reset-card h2::before {
                content: '⚠️';
                margin-right: 10px;
                font-size: 24px;
            }
            
            .reset-card p {
                color: #a16207;
                line-height: 1.7;
                font-size: 16px;
                margin-bottom: 25px;
            }
            
            .reset-button {
                display: inline-block;
                background: linear-gradient(135deg, #ff4757 0%, #ff3838 100%);
                color: white;
                padding: 16px 40px;
                border-radius: 50px;
                text-decoration: none;
                font-weight: 700;
                font-size: 18px;
                box-shadow: 0 8px 25px rgba(255, 71, 87, 0.4);
                transition: all 0.3s ease;
            }
            
            .reset-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 12px 35px rgba(255, 71, 87, 0.5);
            }
            
            .security-info {
                background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
                border-radius: 18px;
                padding: 25px;
                margin-bottom: 25px;
                border: 1px solid #a7f3d0;
            }
            
            .security-info h3 {
                color: #065f46;
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 15px;
                display: flex;
                align-items: center;
            }
            
            .security-info h3::before {
                content: '🔒';
                margin-right: 10px;
                font-size: 20px;
            }
            
            .security-tips {
                list-style: none;
                padding: 0;
            }
            
            .security-tips li {
                color: #047857;
                font-size: 14px;
                margin-bottom: 8px;
                display: flex;
                align-items: flex-start;
            }
            
            .security-tips li::before {
                content: '✓';
                color: #10b981;
                font-weight: bold;
                margin-right: 10px;
                margin-top: 1px;
            }
            
            .expiry-notice {
                background: linear-gradient(135deg, #fef2f2 0%, #fde8e8 100%);
                border-radius: 15px;
                padding: 20px;
                margin-bottom: 25px;
                border-left: 4px solid #ef4444;
            }
            
            .expiry-notice p {
                color: #dc2626;
                font-size: 14px;
                font-weight: 500;
                margin: 0;
                display: flex;
                align-items: center;
            }
            
            .expiry-notice p::before {
                content: '⏰';
                margin-right: 8px;
                font-size: 16px;
            }
            
            .alternative-section {
                background: white;
                border-radius: 18px;
                padding: 25px;
                margin-bottom: 25px;
                border: 1px solid #f1f5f9;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
            }
            
            .alternative-section h3 {
                color: #1e293b;
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 15px;
                display: flex;
                align-items: center;
            }
            
            .alternative-section h3::before {
                content: '🤔';
                margin-right: 10px;
                font-size: 18px;
            }
            
            .alternative-section p {
                color: #64748b;
                line-height: 1.6;
                font-size: 14px;
                margin-bottom: 15px;
            }
            
            .support-link {
                display: inline-block;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                padding: 12px 25px;
                border-radius: 25px;
                text-decoration: none;
                font-weight: 600;
                font-size: 14px;
                box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
            }
            
            .footer {
                background: #f8fafc;
                padding: 30px;
                text-align: center;
                border-top: 1px solid #e2e8f0;
            }
            
            .footer h4 {
                color: #1e293b;
                font-weight: 600;
                margin-bottom: 10px;
                font-size: 16px;
            }
            
            .contact-info {
                color: #64748b;
                font-size: 14px;
                margin: 5px 0;
            }
            
            .disclaimer {
                color: #94a3b8;
                font-size: 12px;
                margin-top: 20px;
                line-height: 1.5;
                padding-top: 15px;
                border-top: 1px solid #e2e8f0;
            }
            
            @media (max-width: 600px) {
                .email-container {
                    margin: 10px;
                    border-radius: 16px;
                }
                
                .content {
                    padding: 25px 20px;
                }
                
                .header {
                    padding: 40px 20px;
                }
                
                .header h1 {
                    font-size: 22px;
                }
                
                .reset-button {
                    padding: 14px 30px;
                    font-size: 16px;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <div class="lock-icon">🔐</div>
                <h1>Password Reset Request</h1>
                <p>We received a request to reset your password</p>
            </div>
            
            <div class="content">
                <div class="reset-card">
                    <h2>Hi ${user.name}!</h2>
                    <p>Someone requested a password reset for your GrabGrub account. If this was you, click the button below to create a new password. If you didn't request this, you can safely ignore this email.</p>
                    
                    <a href="${resetUrl}" class="reset-button">🔑 Reset My Password</a>
                </div>
                
                <div class="expiry-notice">
                    <p><strong>Important:</strong> This reset link expires in 1 hour for security reasons</p>
                </div>
                
                <div class="security-info">
                    <h3>Security Tips</h3>
                    <ul class="security-tips">
                        <li>Never share your password with anyone</li>
                        <li>Use a combination of letters, numbers, and symbols</li>
                        <li>Make your password at least 8 characters long</li>
                        <li>Don't use the same password for multiple accounts</li>
                        <li>Consider using a password manager</li>
                    </ul>
                </div>
                
                <div class="alternative-section">
                    <h3>Can't click the button?</h3>
                    <p>Copy and paste this link into your browser:</p>
                    <div style="background: #f8fafc; padding: 15px; border-radius: 8px; word-break: break-all; font-family: monospace; font-size: 12px; color: #ff4757; border: 1px solid #e2e8f0;">
                        ${resetUrl}
                    </div>
                </div>
                
                <div class="alternative-section">
                    <h3>Didn't request this reset?</h3>
                    <p>If you didn't request a password reset, please contact our support team immediately. Your account security is our top priority.</p>
                    <a href="#" class="support-link">🛡️ Contact Security Team</a>
                </div>
            </div>
            
            <div class="footer">
                <h4>Need Help?</h4>
                <div class="contact-info">📞 1-800-FOODIE (366343)</div>
                <div class="contact-info">📧 security@GrabGrub.com</div>
                <div class="contact-info">💬 Live chat available 24/7</div>
                
                <div class="disclaimer">
                    <strong>GrabGrub Security Team</strong><br>
                    This is an automated security message. Please don't reply to this email.<br>
                    If you have concerns, contact us directly through our official channels.<br>
                    © 2025 GrabGrub. All rights reserved.
                </div>
            </div>
        </div>
    </body>
    </html>
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

const verifyToken = async (req, res) => {
  try {
    // If we reach here, the auth middleware has already verified the token
    res.status(200).json({ 
      message: 'Token is valid',
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        phone: req.user.phone,
      }
    });
  } catch (error) {
    res.status(401).json({ message: 'Token verification failed' });
  }
};



//user Profile


const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -tokenBlacklist -resetPasswordToken -resetPasswordExpire');
    res.status(200).json({
      message: 'Profile retrieved successfully',
      user
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const userId = req.user._id;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, phone, address },
      { new: true, runValidators: true }
    ).select('-password -tokenBlacklist -resetPasswordToken -resetPasswordExpire');

    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword; // Pre-save middleware will hash it
    await user.save();

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
module.exports = { register, verifyOTP, resendOTP, login, logout, forgotPassword, resetPassword , verifyToken, getCurrentUser,
  //user profile functions
  getProfile,
  updateProfile,
  changePassword,
};



