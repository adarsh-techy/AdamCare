// Sends emails for the app, like the password reset link

const nodemailer = require('nodemailer');

// Build the email connection once and reuse it instead of reconnecting every time
let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      // Use explicit host/port so this works with any email provider, not just Gmail
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      // Port 465 needs secure true, other ports like 587 use false
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: {
        user: process.env.EMAIL_USER,
        // Gmail needs an App Password here, not your regular login password
        pass: process.env.EMAIL_PASS
      }
    });
  }
  return transporter;
};

// Sends the password reset email; errors are thrown so the caller can hide them from the user
const sendPasswordResetEmail = async (to, resetLink) => {
  await getTransporter().sendMail({
    from: `"Adam Care EMR" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Reset your Adam Care password',
    text: `You requested a password reset.\n\nUse this link to set a new password (expires in 30 minutes):\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <p>You requested a password reset for your Adam Care account.</p>
      <p><a href="${resetLink}">Click here to set a new password</a> (expires in 30 minutes).</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `
  });
};

module.exports = { sendPasswordResetEmail };
