const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { addDocument } = require('../utils/firebase');
const { uploadToS3 } = require('../utils/s3Uploader');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Check file type
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 3 * 1024 * 1024, // 3MB max file size
        files: 3 // Maximum 3 files
    }
});

// Handle form submission with file uploads
router.post('/', upload.fields([
  { name: 'idCard', maxCount: 1 },
  { name: 'munCertificates', maxCount: 1 },
  { name: 'chairingResume', maxCount: 1 }
]), async (req, res) => {
  try {
        console.log('Form submission received');
        console.log('Files:', req.files);
        console.log('Body:', req.body);

    // Validate required fields
        const requiredFields = ['name', 'email', 'phone', 'college', 'department', 'year'];
        for (const field of requiredFields) {
            if (!req.body[field]) {
      return res.status(400).json({
        success: false,
                    message: `Missing required field: ${field}`
      });
            }
    }

        // Validate required file
    if (!req.files || !req.files.idCard) {
      return res.status(400).json({
        success: false,
                message: 'ID Card is required'
            });
        }

        // Parse checkbox values
        let committees = [];
        let positions = [];

        try {
            if (req.body.committees) {
      committees = JSON.parse(req.body.committees);
            }
            if (req.body.positions) {
      positions = JSON.parse(req.body.positions);
            }
    } catch (error) {
            console.error('Error parsing checkbox values:', error);
            committees = req.body.committees ? [req.body.committees] : [];
            positions = req.body.positions ? [req.body.positions] : [];
        }

        // Validate checkbox selections
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

        // Upload files to S3
        const fileUrls = {};
        const uploadPromises = [];

        // Upload ID Card
        if (req.files.idCard) {
            const idCardFile = req.files.idCard[0];
            const idCardKey = `id-cards/${uuidv4()}-${idCardFile.originalname}`;
            uploadPromises.push(
                uploadToS3(idCardFile.buffer, idCardKey, idCardFile.mimetype)
                    .then(url => { fileUrls.idCardUrl = url; })
                    .catch(error => {
                        console.error('Error uploading ID card:', error);
                        throw new Error('Failed to upload ID card');
                    })
            );
        }

        // Upload MUN Certificates (optional)
        if (req.files.munCertificates) {
            const certFile = req.files.munCertificates[0];
            const certKey = `certificates/${uuidv4()}-${certFile.originalname}`;
            uploadPromises.push(
                uploadToS3(certFile.buffer, certKey, certFile.mimetype)
                    .then(url => { fileUrls.munCertificatesUrl = url; })
                    .catch(error => {
                        console.error('Error uploading MUN certificates:', error);
                        // Don't fail the entire submission for optional files
                    })
            );
        }

        // Upload Chairing Resume (optional)
        if (req.files.chairingResume) {
            const resumeFile = req.files.chairingResume[0];
            const resumeKey = `resumes/${uuidv4()}-${resumeFile.originalname}`;
            uploadPromises.push(
                uploadToS3(resumeFile.buffer, resumeKey, resumeFile.mimetype)
                    .then(url => { fileUrls.chairingResumeUrl = url; })
                    .catch(error => {
                        console.error('Error uploading chairing resume:', error);
                        // Don't fail the entire submission for optional files
                    })
            );
        }

        // Wait for all file uploads to complete
        await Promise.all(uploadPromises);

        // Prepare data for Firestore
        const formData = {
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
            college: req.body.college,
            department: req.body.department,
      year: req.body.year,
            munsParticipated: parseInt(req.body.munsParticipated) || 0,
            munsWithAwards: parseInt(req.body.munsWithAwards) || 0,
      organizingExperience: req.body.organizingExperience,
            munsChaired: parseInt(req.body.munsChaired) || 0,
      committees: committees,
      positions: positions,
            idCardUrl: fileUrls.idCardUrl,
            munCertificatesUrl: fileUrls.munCertificatesUrl || null,
            chairingResumeUrl: fileUrls.chairingResumeUrl || null,
            submittedAt: new Date().toISOString()
        };

        console.log('Saving to Firestore:', formData);

        // Save to Firestore
        const docRef = await addDocument('registrations', formData);

        console.log('Document saved with ID:', docRef.id);

        res.json({
      success: true,
            message: 'Application submitted successfully!',
      data: {
                id: docRef.id,
                submittedAt: formData.submittedAt
      }
    });

  } catch (error) {
    console.error('Form submission error:', error);

    res.status(500).json({
      success: false,
            message: error.message || 'Failed to submit application'
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