const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Initialize S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

  // Upload file to S3
async function uploadToS3(fileBuffer, key, contentType) {
    try {
        console.log(`Uploading file to S3: ${key}`);
      
      const uploadParams = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key,
            Body: fileBuffer,
            ContentType: contentType,
            ACL: 'public-read'
      };

      const command = new PutObjectCommand(uploadParams);
      const result = await s3Client.send(command);

        console.log(`File uploaded successfully: ${key}`);
        
        // Return the public URL
        const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${key}`;
        return fileUrl;

    } catch (error) {
      console.error('S3 upload error:', error);
        throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
}

  // Delete file from S3
async function deleteFromS3(key) {
    try {
        console.log(`Deleting file from S3: ${key}`);
        
        const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      const deleteParams = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key
      };

      const command = new DeleteObjectCommand(deleteParams);
      await s3Client.send(command);

        console.log(`File deleted successfully: ${key}`);
        return true;

    } catch (error) {
      console.error('S3 delete error:', error);
        throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
}

// Extract key from S3 URL
function getKeyFromUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.pathname.substring(1); // Remove leading slash
    } catch (error) {
        console.error('Error extracting key from URL:', error);
        return null;
    }
}

module.exports = {
    uploadToS3,
    deleteFromS3,
    getKeyFromUrl
};