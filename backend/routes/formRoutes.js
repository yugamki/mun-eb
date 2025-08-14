const express = require('express');
const multer = require('multer');
const { registrationHelpers } = require('../utils/firebase');
const { registrationUploads } = require('../utils/s3Uploader');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB max file size
    files: 3 // Maximum 3 files
  },
  fileFilter: (req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Form submission endpoint
router.post('/submit', upload.fields([
  { name: 'idCard', maxCount: 1 },
  { name: 'munCertificates', maxCount: 1 },
  { name: 'chairingResume', maxCount: 1 }
]), async (req, res) => {
  try {
    // Validate required fields
    const requiredFields = [
      'name', 'email', 'phone', 'college', 'department', 'year',
      'munsParticipated', 'munsWithAwards', 'organizingExperience', 'munsChaired',
      'committees', 'positions'
    ];

    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate ID card upload
    if (!req.files || !req.files.idCard) {
      return res.status(400).json({
        success: false,
        message: 'ID Card upload is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(req.body.email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Validate committees and positions
    let committees, positions;
    try {
      committees = JSON.parse(req.body.committees);
      positions = JSON.parse(req.body.positions);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid committees or positions format'
      });
    }

    if (!Array.isArray(committees) || committees.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one committee preference'
      });
    }

    if (!Array.isArray(positions) || positions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one position preference'
      });
    }

    // Validate numeric fields
    const numericFields = ['munsParticipated', 'munsWithAwards', 'munsChaired'];
    for (const field of numericFields) {
      const value = parseInt(req.body[field]);
      if (isNaN(value) || value < 0) {
        return res.status(400).json({
          success: false,
          message: `${field} must be a non-negative number`
        });
      }
    }

    // Prepare registration data
    const registrationData = {
      // Personal details
      name: req.body.name.trim(),
      email: req.body.email.trim().toLowerCase(),
      phone: req.body.phone.trim(),
      college: req.body.college.trim(),
      department: req.body.department.trim(),
      year: req.body.year,

      // MUN experience
      munsParticipated: parseInt(req.body.munsParticipated),
      munsWithAwards: parseInt(req.body.munsWithAwards),
      organizingExperience: req.body.organizingExperience,
      munsChaired: parseInt(req.body.munsChaired),

      // Preferences
      committees: committees,
      positions: positions,

      // Metadata
      submittedAt: new Date().toISOString(),
      status: 'submitted',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    // Create registration record first to get ID
    const registrationId = await registrationHelpers.createRegistration(registrationData);

    // Upload files to S3
    let uploadedFiles = {};
    try {
      uploadedFiles = await registrationUploads.uploadRegistrationFiles(req.files, registrationId);
    } catch (uploadError) {
      // If file upload fails, delete the registration record
      await registrationHelpers.deleteRegistration(registrationId);
      
      return res.status(400).json({
        success: false,
        message: uploadError.message
      });
    }

    // Update registration with file URLs
    await registrationHelpers.updateRegistration(registrationId, {
      files: uploadedFiles
    });

    // Success response
    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: {
        registrationId: registrationId,
        submittedAt: registrationData.submittedAt
      }
    });

    // Log successful submission
    console.log(`✅ New registration submitted: ${registrationData.name} (${registrationData.email})`);

  } catch (error) {
    console.error('Form submission error:', error);
    
    // Return appropriate error response
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum allowed size is 3MB.'
      });
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files uploaded.'
      });
    }

    if (error.message.includes('Only PDF files are allowed')) {
      return res.status(400).json({
        success: false,
        message: 'Only PDF files are allowed for uploads.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your application. Please try again.'
    });
  }
});

// Get form validation rules (for frontend)
router.get('/validation-rules', (req, res) => {
  res.json({
    success: true,
    data: {
      requiredFields: [
        'name', 'email', 'phone', 'college', 'department', 'year',
        'munsParticipated', 'munsWithAwards', 'organizingExperience', 'munsChaired',
        'committees', 'positions', 'idCard'
      ],
      fileUpload: {
        maxSize: {
          idCard: '2MB',
          munCertificates: '2MB',
          chairingResume: '3MB'
        },
        allowedTypes: ['application/pdf'],
        required: ['idCard'],
        optional: ['munCertificates', 'chairingResume']
      },
      committees: [
        'UNSC', 'UNODC', 'LOK SABHA', 'CCC', 'IPC', 'DISEC'
      ],
      positions: [
        'Chairperson', 'Vice-Chairperson', 'Director'
      ],
      yearOptions: ['1', '2', '3', '4', '5']
    }
  });
});

// Check if email already exists
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Query Firestore for existing email
    const { firestoreHelpers, COLLECTIONS } = require('../utils/firebase');
    const existingRegistrations = await firestoreHelpers.queryDocuments(
      COLLECTIONS.REGISTRATIONS,
      [{ field: 'email', operator: '==', value: email.toLowerCase() }]
    );

    res.json({
      success: true,
      exists: existingRegistrations.length > 0,
      message: existingRegistrations.length > 0 
        ? 'An application with this email already exists' 
        : 'Email is available'
    });

  } catch (error) {
    console.error('Email check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking email availability'
    });
  }
});

module.exports = router;