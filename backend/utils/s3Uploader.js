const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET;

// File upload configuration
const UPLOAD_CONFIG = {
  maxFileSize: {
    idCard: 2 * 1024 * 1024, // 2MB
    munCertificates: 2 * 1024 * 1024, // 2MB
    chairingResume: 3 * 1024 * 1024, // 3MB
  },
  allowedMimeTypes: ['application/pdf'],
  allowedExtensions: ['.pdf']
};

// Helper functions
const s3Helpers = {
  // Generate unique file name
  generateFileName(originalName, prefix = '') {
    const timestamp = Date.now();
    const uuid = uuidv4().substring(0, 8);
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    
    return `${prefix}${timestamp}-${uuid}-${baseName}${extension}`;
  },

  // Validate file
  validateFile(file, fieldName) {
    const errors = [];

    // Check if file exists
    if (!file) {
      errors.push(`${fieldName} is required`);
      return errors;
    }

    // Check file size
    const maxSize = UPLOAD_CONFIG.maxFileSize[fieldName];
    if (maxSize && file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      errors.push(`${fieldName} must be less than ${maxSizeMB}MB`);
    }

    // Check MIME type
    if (!UPLOAD_CONFIG.allowedMimeTypes.includes(file.mimetype)) {
      errors.push(`${fieldName} must be a PDF file`);
    }

    // Check file extension
    const extension = path.extname(file.originalname).toLowerCase();
    if (!UPLOAD_CONFIG.allowedExtensions.includes(extension)) {
      errors.push(`${fieldName} must have a .pdf extension`);
    }

    return errors;
  },

  // Upload file to S3
  async uploadFile(file, folder = 'uploads') {
    try {
      const fileName = this.generateFileName(file.originalname, `${folder}/`);
      
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentDisposition: 'inline',
        Metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        }
      };

      const command = new PutObjectCommand(uploadParams);
      const result = await s3Client.send(command);

      // Return file URL and metadata
      return {
        success: true,
        url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`,
        key: fileName,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  },

  // Upload multiple files
  async uploadMultipleFiles(files, folder = 'uploads') {
    const uploadPromises = files.map(file => this.uploadFile(file, folder));
    
    try {
      const results = await Promise.all(uploadPromises);
      return {
        success: true,
        files: results
      };
    } catch (error) {
      console.error('Multiple file upload error:', error);
      throw new Error(`Failed to upload files: ${error.message}`);
    }
  },

  // Delete file from S3
  async deleteFile(fileKey) {
    try {
      const deleteParams = {
        Bucket: BUCKET_NAME,
        Key: fileKey,
      };

      const command = new DeleteObjectCommand(deleteParams);
      await s3Client.send(command);

      return {
        success: true,
        message: 'File deleted successfully'
      };

    } catch (error) {
      console.error('S3 delete error:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  },

  // Delete multiple files
  async deleteMultipleFiles(fileKeys) {
    const deletePromises = fileKeys.map(key => this.deleteFile(key));
    
    try {
      await Promise.all(deletePromises);
      return {
        success: true,
        message: 'Files deleted successfully'
      };
    } catch (error) {
      console.error('Multiple file delete error:', error);
      throw new Error(`Failed to delete files: ${error.message}`);
    }
  },

  // Get file metadata
  async getFileMetadata(fileKey) {
    try {
      const params = {
        Bucket: BUCKET_NAME,
        Key: fileKey,
      };

      const command = new GetObjectCommand(params);
      const result = await s3Client.send(command);

      return {
        success: true,
        metadata: {
          contentType: result.ContentType,
          contentLength: result.ContentLength,
          lastModified: result.LastModified,
          metadata: result.Metadata
        }
      };

    } catch (error) {
      console.error('S3 metadata error:', error);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  },

  // Generate presigned URL for secure file access
  async generatePresignedUrl(fileKey, expiresIn = 3600) {
    try {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
      });

      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });

      return {
        success: true,
        url: signedUrl,
        expiresIn: expiresIn
      };

    } catch (error) {
      console.error('Presigned URL error:', error);
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }
};

// Registration-specific upload helpers
const registrationUploads = {
  async uploadRegistrationFiles(files, registrationId) {
    const uploadedFiles = {};
    const errors = [];

    // Process each file type
    for (const [fieldName, fileArray] of Object.entries(files)) {
      if (!fileArray || fileArray.length === 0) {
        // Skip optional files
        if (fieldName !== 'idCard') {
          continue;
        }
        errors.push(`${fieldName} is required`);
        continue;
      }

      const file = fileArray[0]; // Take first file only

      // Validate file
      const validationErrors = s3Helpers.validateFile(file, fieldName);
      if (validationErrors.length > 0) {
        errors.push(...validationErrors);
        continue;
      }

      try {
        // Upload to S3 with registration-specific folder
        const uploadResult = await s3Helpers.uploadFile(
          file, 
          `registrations/${registrationId}/${fieldName}`
        );
        
        uploadedFiles[fieldName] = uploadResult;

      } catch (error) {
        errors.push(`Failed to upload ${fieldName}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      // Clean up any successfully uploaded files
      const uploadedKeys = Object.values(uploadedFiles).map(file => file.key);
      if (uploadedKeys.length > 0) {
        try {
          await s3Helpers.deleteMultipleFiles(uploadedKeys);
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }
      }
      
      throw new Error(errors.join(', '));
    }

    return uploadedFiles;
  },

  async deleteRegistrationFiles(fileUrls) {
    if (!fileUrls || Object.keys(fileUrls).length === 0) {
      return { success: true };
    }

    const fileKeys = Object.values(fileUrls)
      .filter(fileData => fileData && fileData.key)
      .map(fileData => fileData.key);

    if (fileKeys.length === 0) {
      return { success: true };
    }

    return await s3Helpers.deleteMultipleFiles(fileKeys);
  }
};

module.exports = {
  s3Client,
  s3Helpers,
  registrationUploads,
  UPLOAD_CONFIG
};