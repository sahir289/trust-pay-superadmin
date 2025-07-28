// import nodemailer from 'nodemailer';
// import path from 'path';
import { logger } from '../utils/logger.js';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// const pngLogoPath = path.resolve('./src/assets/images/TrustPays24.png');

const sesClient = new SESClient({
  region: process.env.SMTP_REGION,
  credentials: {
    accessKeyId: process.env.SMTP_ACCESSS_KEY_ID,
    secretAccessKey: process.env.SMTP_SECRET_ACCESS_KEY,
  },
});
const name = process.env.APP_NAME;

// const transporter = nodemailer.createTransport({
//   SES: { ses, aws: { SESClient } },
// });

const Role = {
  MERCHANT: 'MERCHANT',
  SUB_MERCHANT: 'SUB_MERCHANT',
  ADMIN : 'ADMIN',
};

/**
 * Send credentials email to user
 * @param {Object} param0
 * @param {string} param0.email - Recipient's email
 * @param {string} param0.username - Username to send
 * @param {string} param0.password - Password to send
 * @param {string} param0.code - Optional code
 * @param {string} param0.secretKey - Optional secret key
 * @param {string} param0.publicKey - Optional public key
 * @param {string} param0.designation - User designation
 */
export const sendCredentialsEmail = async ({
  email,
  username,
  password,
  code,
  secretKey,
  publicKey,
  designation,
  unique_id,
}) => {
  const subject = 'Your Account Credentials';
  const text = `Hello,\n\nYour account has been created successfully.\n\nUsername: ${username}\nPassword: ${password}\n\nPlease log in and change your password immediately for security.\n\nBest regards,\nPG Admin Team`;

  const redirectingUrl = process.env.FRONTEND_URL;
  const baseUrl = process.env.BASE_URL;
  const apiDocsUrl = process.env.API_DOCS_URL;

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #f9fafb;">
    <div style="display: flex; align-items: center; margin-bottom: 24px;">
      <img src="cid:trustpays-logo" alt="${name} Logo" style="height: 65px; max-height: 65px; margin-right: 8px;">
      <h2 style="font-size: 22px; color: #1a202c; margin: 0; line-height: 65px;">${name}</h2>
    </div>
    <div style="background-color: #ffffff; padding: 24px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
      <p style="font-size: 16px; color: #2d3748;">Hello, Greetings of the day,</p>
      <h2 style="font-size: 22px; color: #1a202c;">Welcome to ${name} – a fast, secure, and reliable Payment Gateway.</h2>
      <p style="font-size: 15px; color: #4a5568;">You can sign in to your ${name} account using the credentials below:</p>
      <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; margin-top: 16px;">
        <p style="margin: 8px 0; color: #2d3748;"><strong>Login URL:</strong> <a href="${redirectingUrl}" style="color: #3182ce;">${redirectingUrl}</a></p>
        <p style="margin: 8px 0; color: #2d3748;"><strong>Username:</strong> ${username}</p>
        ${password ? `<p style="margin: 8px 0; color: #2d3748;"><strong>Password:</strong> ${password}</p>` : ''}
      </div>
      ${
        designation && [Role.MERCHANT, Role.SUB_MERCHANT].includes(designation)
          ? `
            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; margin-top: 16px;">
              <p style="margin: 8px 0; color: #2d3748;"><strong>Base URL:</strong> <a href="${baseUrl}" style="color: #3182ce;">${baseUrl}</a></p>
              <p style="margin: 8px 0; color: #2d3748;"><strong>Code:</strong> ${code}</p>
              <p style="margin: 8px 0; color: #2d3748;"><strong>API Key:</strong> ${secretKey}</p>
              <p style="margin: 8px 0; color: #2d3748;"><strong>Public API Key:</strong> ${publicKey}</p>
              <p style="margin: 8px 0; color: #2d3748;"><strong>API Docs:</strong> <a href="${apiDocsUrl}" style="color: #3182ce;">${apiDocsUrl}</a></p>
            </div>
          `
          : ''
      }
      ${
        designation && [Role.ADMIN, Role.SUPER_ADMIN].includes(designation)
          ? `
            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; margin-top: 16px;">
              <p style="margin: 8px 0; color: #2d3748;"><strong>Unique_id:</strong> ${unique_id}</p>
            </div>
          `
          : ''
      }
      <p style="font-size: 14px; color: #718096; margin-top: 20px;">Please log in and change your password immediately for security.</p>
      <p style="font-size: 14px; color: #718096;">Thank you,<br>${name} Team</p>
    </div>
    <p style="text-align: center; font-size: 12px; color: #a0aec0; margin-top: 20px;">© ${new Date().getFullYear()} ${name}. All rights reserved.</p>
  </div>
  `;

  // const mailOptions = {
  //   from: `"${name} Admin" <${process.env.SES_FROM_EMAIL}>`,
  //   to: email,
  //   subject,
  //   text,
  //   html,
  //   attachments: [
  //     {
  //       filename: 'TrustPays24_Logo.png',
  //       path: pngLogoPath,
  //       cid: 'trustpays-logo',
  //     },
  //   ],
  // };

  const params = {
    Source: process.env.SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: html,
          Charset: 'UTF-8',
        },

        Text: {
          Data: text,
          Charset: 'UTF-8',
        },
      },
    },
  };

  try {
    const sendEmail = new SendEmailCommand(params);
    const info = await sesClient.send(sendEmail);
    const Data = {
      messageId: info.messageId,
      username,
      password,
      code,
      secretKey,
      publicKey,
    };
    const status = 200;
    logger.info('Credentials email sent:', { status, data: Data });
    return info;
  } catch (error) {
    logger.error('Failed to send credentials email:', error);
    throw error;
  }
};

/**
 * Send OTP email for password reset
 * @param {string} email - Recipient's email
 * @param {string} otp - One-time password
 * @param {string} user_name - User's name
 * @param {string} designation - User's designation
 */
export const sendOTP = async (email, otp, user_name, designation) => {
  const subject = 'Password Reset OTP';
  const text = `Hello ${user_name},\n\nYou have requested a password reset. Your OTP is: ${otp}\n\nThis OTP is valid for 10 minutes. Do not share it with anyone.\n\nRequest Details:\n- User: ${user_name}\n- Designation: ${designation}\n\nIf you didn't request this, please contact support@pgadmin.com.\n\nBest regards,\nTrustPay Admin Team`;

  const html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f7fa;">
    <div style="display: flex; align-items: center; margin-bottom: 20px;">
      <img src="cid:trustpays-logo" alt="${name} Logo" style="height: 65px; max-height: 65px; margin-right: 8px;">
      <h2 style="font-size: 22px; color: #1a202c; margin: 0; line-height: 65px;">${name}</h2>
    </div>
    <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h2 style="color: #1a202c; font-size: 24px; margin-bottom: 20px;">Password Reset Request</h2>
      <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">Hello ${user_name},</p>
      <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">You have requested a password reset. Your one-time password (OTP) is:</p>
      <div style="text-align: center; margin: 20px 0;">
        <span style="display: inline-block; font-size: 28px; font-weight: bold; color: #3182ce; letter-spacing: 4px; background-color: #edf2f7; padding: 10px 20px; border-radius: 6px;">${otp}</span>
      </div>
      <p style="color: #4a5568; font-style: italic; margin-bottom: 20px;">This OTP is valid for 10 minutes. Do not share it with anyone.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      <p style="color: #718096; font-size: 12px; text-align: center;">
        If you didn’t request this, please <a href="mailto:${process.env.SMTP_USER}" style="color: #3182ce; text-decoration: none;">contact support</a> immediately.
      </p>
    </div>
    <p style="color: #718096; font-size: 12px; text-align: center; margin-top: 20px;">© ${new Date().getFullYear()} ${name} Admin. All rights reserved.</p>
  </div>
  `;

  // <h4 style="color: #2d3748; font-size: 16px; margin-bottom: 10px;">Request Details:</h4>
  //     <ul style="color: #4a5568; line-height: 1.6; margin-bottom: 20px; padding-left: 20px;">
  //       <li><strong>User:</strong> ${user_name}</li>
  //       <li><strong>Designation:</strong> ${designation}</li>
  //     </ul>

  // const mailOptions = {
  //   from: `"${name} Admin" <${process.env.SMTP_USER}>`,
  //   to: email,
  //   subject,
  //   text,
  //   html,
  //   attachments: [
  //     {
  //       filename: 'TrustPays24_Logo.png',
  //       path: pngLogoPath,
  //       cid: 'trustpays-logo',
  //     },
  //   ],
  // };

  const params = {
    Source: process.env.SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: html,
          Charset: 'UTF-8',
        },

        Text: {
          Data: text,
          Charset: 'UTF-8',
        },
      },
    },
  };

  try {
    const sendEmail = new SendEmailCommand(params);
    const info = await sesClient.send(sendEmail);

    logger.info('OTP email sent:', info.messageId);
    return { success: true };
  } catch (error) {
    logger.error('Failed to send OTP email:', error);
    throw error;
  }
};
