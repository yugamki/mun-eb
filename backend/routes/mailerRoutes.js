const express = require('express');
const nodemailer = require('nodemailer');
const { registrationHelpers } = require('../utils/firebase');

const router = express.Router();

// Email templates
const emailTemplates = {
  welcome: {
    subject: 'Welcome to KMUN\'25 Executive Board Recruitment',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #172d9d 0%, #797dfa 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">KMUN'25</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Executive Board Recruitment</p>
        </div>
        <div style="padding: 30px; background: #ffffff;">
          <h2 style="color: #172d9d; margin-bottom: 20px;">Welcome {{name}}!</h2>
          <p style="line-height: 1.6; color: #333;">Thank you for your interest in joining the KMUN'25 Executive Board. We have received your application and our team will review it carefully.</p>
          <p style="line-height: 1.6; color: #333;">We will get back to you soon with updates on your application status.</p>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #172d9d; margin-top: 0;">Application Summary:</h3>
            <ul style="color: #666;">
              <li>Committee Preferences: {{committees}}</li>
              <li>Position Preferences: {{positions}}</li>
              <li>Submitted: {{submittedAt}}</li>
            </ul>
          </div>
          <p style="line-height: 1.6; color: #333;">Best regards,<br>KMUN'25 Organizing Team</p>
        </div>
      </div>
    `
  },
  
  status_update: {
    subject: 'KMUN\'25 Application Status Update',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #172d9d 0%, #797dfa 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">KMUN'25</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Application Status Update</p>
        </div>
        <div style="padding: 30px; background: #ffffff;">
          <h2 style="color: #172d9d; margin-bottom: 20px;">Hello {{name}},</h2>
          <p style="line-height: 1.6; color: #333;">We have an update regarding your KMUN'25 Executive Board application.</p>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 16px; color: #172d9d; font-weight: bold; margin: 0;">{{message}}</p>
          </div>
          <p style="line-height: 1.6; color: #333;">If you have any questions, please don't hesitate to contact us.</p>
          <p style="line-height: 1.6; color: #333;">Best regards,<br>KMUN'25 Organizing Team</p>
        </div>
      </div>
    `
  },

  custom: {
    subject: '{{subject}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #172d9d 0%, #797dfa 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">KMUN'25</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Executive Board Recruitment</p>
        </div>
        <div style="padding: 30px; background: #ffffff;">
          {{message}}
        </div>
      </div>
    `
  }
};

// SMTP configurations
const smtpConfigs = {
  gmail: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  },
  outlook: {
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  },
  custom: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  }
};

// Middleware for admin authentication
const authenticateAdmin = (req, res, next) => {
  // Simplified authentication for demo
  next();
};

// Create transporter
function createTransporter(provider = 'custom') {
  const config = smtpConfigs[provider] || smtpConfigs.custom;
  return nodemailer.createTransporter(config);
}

// Template replacement function
function replaceTemplateVariables(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
}

// Send email to individual or multiple recipients
router.post('/send-mail', authenticateAdmin, async (req, res) => {
  try {
    const {
      recipients,
      subject,
      message,
      template = 'custom',
      smtpProvider = 'custom',
      cc = [],
      bcc = []
    } = req.body;

    // Validation
    if (!recipients || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Recipients are required'
      });
    }

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Subject and message are required'
      });
    }

    // Get recipient emails
    let recipientEmails = [];
    
    if (recipients.includes('all')) {
      // Get all registrant emails
      const registrations = await registrationHelpers.getAllRegistrations();
      recipientEmails = registrations.map(reg => reg.email);
    } else {
      recipientEmails = recipients.filter(email => email !== 'all');
    }

    if (recipientEmails.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid recipients found'
      });
    }

    // Create transporter
    const transporter = createTransporter(smtpProvider);

    // Verify SMTP connection
    try {
      await transporter.verify();
    } catch (verifyError) {
      console.error('SMTP verification failed:', verifyError);
      return res.status(500).json({
        success: false,
        message: 'Email configuration error. Please check SMTP settings.'
      });
    }

    // Prepare email template
    const emailTemplate = emailTemplates[template] || emailTemplates.custom;
    
    const results = {
      sent: 0,
      failed: 0,
      errors: []
    };

    // Send emails
    for (const email of recipientEmails) {
      try {
        // Get registration data for personalization
        const registrations = await registrationHelpers.getAllRegistrations();
        const registration = registrations.find(reg => reg.email === email);
        
        const templateVariables = {
          name: registration?.name || 'Applicant',
          email: email,
          subject: subject,
          message: message,
          committees: registration?.committees 
            ? (Array.isArray(registration.committees) 
                ? registration.committees.join(', ') 
                : registration.committees)
            : 'N/A',
          positions: registration?.positions 
            ? (Array.isArray(registration.positions) 
                ? registration.positions.join(', ') 
                : registration.positions)
            : 'N/A',
          submittedAt: registration?.submittedAt 
            ? new Date(registration.submittedAt).toLocaleDateString()
            : 'N/A'
        };

        const emailSubject = replaceTemplateVariables(emailTemplate.subject, templateVariables);
        const emailHtml = replaceTemplateVariables(emailTemplate.html, templateVariables);

        const mailOptions = {
          from: `"KMUN'25 Team" <${process.env.SMTP_USER}>`,
          to: email,
          cc: cc.length > 0 ? cc : undefined,
          bcc: bcc.length > 0 ? bcc : undefined,
          subject: emailSubject,
          html: emailHtml
        };

        await transporter.sendMail(mailOptions);
        results.sent++;

      } catch (emailError) {
        console.error(`Failed to send email to ${email}:`, emailError);
        results.failed++;
        results.errors.push(`${email}: ${emailError.message}`);
      }
    }

    res.json({
      success: true,
      message: `Email sending completed. Sent: ${results.sent}, Failed: ${results.failed}`,
      results: results
    });

  } catch (error) {
    console.error('Send mail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send emails'
    });
  }
});

// Send welcome emails to new registrations
router.post('/send-welcome', authenticateAdmin, async (req, res) => {
  try {
    const { registrationIds } = req.body;

    if (!registrationIds || registrationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Registration IDs are required'
      });
    }

    const transporter = createTransporter();
    const results = { sent: 0, failed: 0, errors: [] };

    for (const id of registrationIds) {
      try {
        const registration = await registrationHelpers.getRegistration(id);
        
        if (!registration) {
          results.failed++;
          results.errors.push(`Registration ${id} not found`);
          continue;
        }

        const templateVariables = {
          name: registration.name,
          committees: Array.isArray(registration.committees) 
            ? registration.committees.join(', ') 
            : registration.committees,
          positions: Array.isArray(registration.positions) 
            ? registration.positions.join(', ') 
            : registration.positions,
          submittedAt: new Date(registration.submittedAt).toLocaleDateString()
        };

        const emailSubject = replaceTemplateVariables(emailTemplates.welcome.subject, templateVariables);
        const emailHtml = replaceTemplateVariables(emailTemplates.welcome.html, templateVariables);

        const mailOptions = {
          from: `"KMUN'25 Team" <${process.env.SMTP_USER}>`,
          to: registration.email,
          subject: emailSubject,
          html: emailHtml
        };

        await transporter.sendMail(mailOptions);
        results.sent++;

      } catch (emailError) {
        console.error(`Failed to send welcome email for ${id}:`, emailError);
        results.failed++;
        results.errors.push(`${id}: ${emailError.message}`);
      }
    }

    res.json({
      success: true,
      message: `Welcome emails sent. Sent: ${results.sent}, Failed: ${results.failed}`,
      results: results
    });

  } catch (error) {
    console.error('Send welcome error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send welcome emails'
    });
  }
});

// Get email templates
router.get('/templates', authenticateAdmin, (req, res) => {
  res.json({
    success: true,
    data: {
      templates: Object.keys(emailTemplates),
      smtpProviders: Object.keys(smtpConfigs)
    }
  });
});

// Test email configuration
router.post('/test-smtp', authenticateAdmin, async (req, res) => {
  try {
    const { provider = 'custom', testEmail } = req.body;

    if (!testEmail) {
      return res.status(400).json({
        success: false,
        message: 'Test email address is required'
      });
    }

    const transporter = createTransporter(provider);

    // Verify connection
    await transporter.verify();

    // Send test email
    const mailOptions = {
      from: `"KMUN'25 Team" <${process.env.SMTP_USER}>`,
      to: testEmail,
      subject: 'KMUN\'25 Email Configuration Test',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #172d9d;">Email Configuration Test</h2>
          <p>This is a test email to verify your SMTP configuration.</p>
          <p>If you received this email, your configuration is working correctly!</p>
          <p><strong>Provider:</strong> ${provider}</p>
          <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: 'Test email sent successfully'
    });

  } catch (error) {
    console.error('SMTP test error:', error);
    res.status(500).json({
      success: false,
      message: `SMTP test failed: ${error.message}`
    });
  }
});

module.exports = router;