const express = require('express');
const { registrationHelpers } = require('../utils/firebase');
const { registrationUploads } = require('../utils/s3Uploader');

const router = express.Router();

// Middleware for admin authentication (simplified for demo)
const authenticateAdmin = (req, res, next) => {
  // In production, implement proper JWT/session authentication
  // For now, we'll use a simple API key approach
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    // For demo purposes, we'll allow access without authentication
    // In production, uncomment the following lines:
    // return res.status(401).json({
    //   success: false,
    //   message: 'Unauthorized access'
    // });
  }
  
  next();
};

// Get dashboard statistics
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await registrationHelpers.getRegistrationStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

// Get all registrations
router.get('/registrations', authenticateAdmin, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search, 
      committee, 
      position, 
      year,
      status 
    } = req.query;

    let registrations = await registrationHelpers.getAllRegistrations();

    // Apply filters
    if (search) {
      const searchTerm = search.toLowerCase();
      registrations = registrations.filter(reg => 
        reg.name.toLowerCase().includes(searchTerm) ||
        reg.email.toLowerCase().includes(searchTerm) ||
        reg.phone.includes(searchTerm) ||
        reg.college.toLowerCase().includes(searchTerm)
      );
    }

    if (committee) {
      registrations = registrations.filter(reg => {
        const committees = Array.isArray(reg.committees) 
          ? reg.committees 
          : JSON.parse(reg.committees || '[]');
        return committees.includes(committee);
      });
    }

    if (position) {
      registrations = registrations.filter(reg => {
        const positions = Array.isArray(reg.positions) 
          ? reg.positions 
          : JSON.parse(reg.positions || '[]');
        return positions.includes(position);
      });
    }

    if (year) {
      registrations = registrations.filter(reg => reg.year === year);
    }

    if (status) {
      registrations = registrations.filter(reg => reg.status === status);
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedRegistrations = registrations.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedRegistrations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(registrations.length / limit),
        totalRecords: registrations.length,
        hasNext: endIndex < registrations.length,
        hasPrev: startIndex > 0
      }
    });

  } catch (error) {
    console.error('Get registrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch registrations'
    });
  }
});

// Get single registration
router.get('/registrations/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const registration = await registrationHelpers.getRegistration(id);

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    res.json({
      success: true,
      data: registration
    });

  } catch (error) {
    console.error('Get registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch registration'
    });
  }
});

// Update registration
router.put('/registrations/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.submittedAt;
    delete updateData.createdAt;

    // Validate email if being updated
    if (updateData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateData.email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }
      updateData.email = updateData.email.toLowerCase();
    }

    // Validate numeric fields if being updated
    const numericFields = ['munsParticipated', 'munsWithAwards', 'munsChaired', 'year'];
    for (const field of numericFields) {
      if (updateData[field] !== undefined) {
        const value = parseInt(updateData[field]);
        if (isNaN(value) || value < 0) {
          return res.status(400).json({
            success: false,
            message: `${field} must be a non-negative number`
          });
        }
        updateData[field] = value;
      }
    }

    const success = await registrationHelpers.updateRegistration(id, updateData);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    res.json({
      success: true,
      message: 'Registration updated successfully'
    });

  } catch (error) {
    console.error('Update registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update registration'
    });
  }
});

// Delete registration
router.delete('/registrations/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get registration to access file URLs
    const registration = await registrationHelpers.getRegistration(id);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Delete associated files from S3
    if (registration.files) {
      try {
        await registrationUploads.deleteRegistrationFiles(registration.files);
      } catch (fileDeleteError) {
        console.error('File deletion error:', fileDeleteError);
        // Continue with registration deletion even if file deletion fails
      }
    }

    // Delete registration from Firestore
    await registrationHelpers.deleteRegistration(id);

    res.json({
      success: true,
      message: 'Registration deleted successfully'
    });

  } catch (error) {
    console.error('Delete registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete registration'
    });
  }
});

// Bulk operations
router.post('/registrations/bulk-action', authenticateAdmin, async (req, res) => {
  try {
    const { action, registrationIds, data } = req.body;

    if (!action || !registrationIds || !Array.isArray(registrationIds)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bulk action request'
      });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const id of registrationIds) {
      try {
        switch (action) {
          case 'delete':
            const registration = await registrationHelpers.getRegistration(id);
            if (registration) {
              if (registration.files) {
                await registrationUploads.deleteRegistrationFiles(registration.files);
              }
              await registrationHelpers.deleteRegistration(id);
              results.success++;
            } else {
              results.failed++;
              results.errors.push(`Registration ${id} not found`);
            }
            break;

          case 'update':
            if (!data) {
              results.failed++;
              results.errors.push(`No update data provided for ${id}`);
              break;
            }
            const updateSuccess = await registrationHelpers.updateRegistration(id, data);
            if (updateSuccess) {
              results.success++;
            } else {
              results.failed++;
              results.errors.push(`Failed to update registration ${id}`);
            }
            break;

          default:
            results.failed++;
            results.errors.push(`Unknown action: ${action}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Error processing ${id}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      message: `Bulk ${action} completed`,
      results: results
    });

  } catch (error) {
    console.error('Bulk action error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk action'
    });
  }
});

// Export registrations
router.get('/export', authenticateAdmin, async (req, res) => {
  try {
    const { format = 'json', ...filters } = req.query;
    
    let registrations = await registrationHelpers.getAllRegistrations();

    // Apply same filters as in get registrations
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      registrations = registrations.filter(reg => 
        reg.name.toLowerCase().includes(searchTerm) ||
        reg.email.toLowerCase().includes(searchTerm) ||
        reg.phone.includes(searchTerm) ||
        reg.college.toLowerCase().includes(searchTerm)
      );
    }

    // Format data for export
    const exportData = registrations.map(reg => ({
      ID: reg.id,
      Name: reg.name,
      Email: reg.email,
      Phone: reg.phone,
      College: reg.college,
      Department: reg.department,
      Year: reg.year,
      'MUNs Participated': reg.munsParticipated,
      'MUNs with Awards': reg.munsWithAwards,
      'Organizing Experience': reg.organizingExperience,
      'MUNs Chaired': reg.munsChaired,
      'Committee Preferences': Array.isArray(reg.committees) 
        ? reg.committees.join(', ') 
        : reg.committees,
      'Position Preferences': Array.isArray(reg.positions) 
        ? reg.positions.join(', ') 
        : reg.positions,
      Status: reg.status,
      'Submitted At': reg.submittedAt,
      'Files Uploaded': reg.files ? Object.keys(reg.files).join(', ') : 'None'
    }));

    if (format === 'csv') {
      // Convert to CSV
      const csv = convertToCSV(exportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=registrations_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } else {
      // Return JSON
      res.json({
        success: true,
        data: exportData,
        exportedAt: new Date().toISOString(),
        totalRecords: exportData.length
      });
    }

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export data'
    });
  }
});

// Helper function to convert JSON to CSV
function convertToCSV(data) {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      // Escape commas and quotes in CSV
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );
  
  return [csvHeaders, ...csvRows].join('\n');
}

module.exports = router;