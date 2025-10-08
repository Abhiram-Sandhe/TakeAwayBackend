// config/email.js
const sgMail = require('@sendgrid/mail');

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Keep the same function name and signature as before
const sendEmail = async (to, subject, html) => {
  try {
    console.log('Attempting to send email via SendGrid to:', to);
    
    const msg = {
      to,
      from: process.env.FROM_EMAIL, // Must be verified in SendGrid
      subject,
      html,
    };

    const response = await sgMail.send(msg);
    console.log('Email sent successfully via SendGrid');
    console.log('Message ID:', response[0].headers['x-message-id']);
    return true;
  } catch (error) {
    console.error('SendGrid email sending failed:', error);
    
    // Detailed error logging
    if (error.response) {
      console.error('SendGrid error body:', error.response.body);
      console.error('SendGrid error code:', error.code);
    }
    
    return false;
  }
};

module.exports = { sendEmail };
