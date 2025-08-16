# Kumaraguru MUN - Executive Board Recruitment

A web application for managing Executive Board applications for Kumaraguru MUN 2025.

## Features

### Admin Dashboard
- **Statistics**: View total registrations, today's registrations, and weekly registrations
- **Registrations Management**: 
  - Enhanced dropdown UI with custom styling
  - Search and filter by committee and position
  - Export registrations to Excel
- **Email System**:
  - Send emails to registrants or single person
  - Choose between Gmail and Outlook email providers
  - Email preview functionality with full HTML preview
  - Committee-specific recipient selection

### Application Form
- Comprehensive application form for Executive Board positions
- File upload functionality
- Real-time validation

## Environment Variables

### Required for Email Functionality

#### Gmail SMTP Configuration
```
SMTP_HOST_GMAIL=smtp.gmail.com
SMTP_PORT_GMAIL=587
SMTP_USER_GMAIL=your_gmail@gmail.com
SMTP_PASS_GMAIL=your_app_password
```

#### Outlook SMTP Configuration
```
SMTP_HOST_OUTLOOK=smtp-mail.outlook.com
SMTP_PORT_OUTLOOK=587
SMTP_USER_OUTLOOK=your_outlook@outlook.com
SMTP_PASS_OUTLOOK=your_password
```

### Firebase Configuration
```
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
```

### AWS S3 Configuration (for file uploads)
```
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=your_region
AWS_S3_BUCKET=your_bucket_name
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Set up environment variables
4. Start the server:
   ```bash
   npm start
   ```

## Usage

### Admin Access
- Navigate to `/admin` to access the admin dashboard
- No authentication required (as per request)

### Email System
1. Go to the Mailer tab in the admin dashboard
2. Choose recipient type:
   - **Send to Registrants**: Select from predefined groups
   - **Send to Single Person**: Enter a specific email address
3. Select email provider (Gmail or Outlook)
4. Fill in subject and message
5. Use Preview to see the full email before sending
6. Send the email

### Registration Management
- Use the enhanced dropdowns to filter by committee and position
- Search through registrations using the search bar
- Export data to Excel format

## Technical Details

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Database**: Firebase Firestore
- **File Storage**: AWS S3
- **Email**: Nodemailer with Gmail/Outlook SMTP
- **UI**: Custom CSS with modern design patterns
