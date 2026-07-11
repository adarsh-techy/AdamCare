// Handles all outbound transactional email for the app (currently just the
// "Forgot Password" reset link). Kept as its own service file — separate
// from auth.controller.js — so the SMTP/transport details live in one place
// and any future email (e.g. appointment reminders) can reuse getTransporter()
// instead of re-configuring nodemailer from scratch.

const nodemailer = require('nodemailer');

// Lazily created and cached: nodemailer's transporter holds an open
// connection pool, so we build it once on first use and reuse it for every
// email afterward, rather than reconnecting to the SMTP server every call.
let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      // Explicit host/port (rather than nodemailer's `service: 'gmail'`
      // shorthand) so this works with any SMTP provider, not just Gmail —
      // swap EMAIL_HOST/EMAIL_PORT in .env to point at a different provider
      // later without touching this file.
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      // Port 587 uses STARTTLS (secure: false, upgraded after connecting);
      // port 465 would need secure: true instead. If you ever switch to
      // port 465, flip this too.
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: {
        user: process.env.EMAIL_USER,
        // Gmail requires an "App Password" here, NOT the account's normal
        // login password — see .env.example for how to generate one.
        pass: process.env.EMAIL_PASS
      }
    });
  }
  return transporter;
};

/**
 * Send a password-reset email containing the raw (unhashed) reset link.
 *
 * Why this throws instead of swallowing errors itself: the caller
 * (forgotPassword in auth.controller.js) must ALWAYS return the same
 * generic "if that email exists..." response to the client no matter what
 * happens here — otherwise a failed/successful send would leak whether the
 * email address is actually registered. So this function's only job is to
 * attempt the send; the controller decides what (if anything) to tell the
 * user, and logs the real error for us to debug server-side.
 */
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
