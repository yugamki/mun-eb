// Global variables
let currentRegistrations = [];
let charts = {};

// Check if Axios is available, if not, create a simple fallback
if (typeof axios === 'undefined') {
    console.warn('Axios not loaded, using fallback HTTP client');
    window.axios = {
        post: async (url, data, config) => {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    body: data,
                    headers: config?.headers || {}
                });
                const result = await response.json();
                return { data: result };
            } catch (error) {
                throw { response: { data: { message: error.message } } };
            }
        },
        get: async (url) => {
            try {
                const response = await fetch(url);
                const result = await response.json();
                return { data: result };
            } catch (error) {
                throw { response: { data: { message: error.message } } };
            }
        }
    };
}

// DOM Elements - with null checks for different pages
const elements = {
    form: document.getElementById('ebForm'),
    backToForm: document.getElementById('backToForm'),
    applicationForm: document.getElementById('applicationForm'),
    adminDashboard: document.getElementById('adminDashboard'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    successModal: document.getElementById('successModal'),
    closeModal: document.getElementById('closeModal'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    submitBtn: document.getElementById('submitBtn'),
    exportBtn: document.getElementById('exportBtn'),
    mailerForm: document.getElementById('mailerForm'),
    searchInput: document.getElementById('searchInput'),
    committeeFilter: document.getElementById('committeeFilter'),
    positionFilter: document.getElementById('positionFilter'),
    previewBtn: document.getElementById('previewBtn')
};

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Application initializing...');
    console.log('Axios available:', typeof axios !== 'undefined');
    
    initializeEventListeners();
    initializeFileUploads();
    initializePage();
});

// Handle routing based on URL
function handleRouting() {
    const path = window.location.pathname;
    
    if (path === '/admin') {
        // Admin page - load dashboard data
        if (elements.adminDashboard) {
            loadDashboardData();
        }
    } else if (path === '/form') {
        // Form page - no special handling needed
        console.log('Application form page loaded');
    } else {
        // Landing page - no special handling needed
        console.log('Landing page loaded');
    }
}

// Event Listeners
function initializeEventListeners() {
    // Form submission
    if (elements.form) {
        elements.form.addEventListener('submit', handleFormSubmission);
        console.log('Form submission listener added');
    }
    
    // Navigation - only add if element exists (for admin page)
    if (elements.backToForm) {
        elements.backToForm.addEventListener('click', () => {
            window.location.href = '/form';
        });
    }
    
    // Modal
    if (elements.closeModal) {
        elements.closeModal.addEventListener('click', hideSuccessModal);
    }
    
    // Dashboard tabs - only add if elements exist (for admin page)
    if (elements.tabBtns.length > 0) {
        elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });
    }
    
    // Export functionality - only add if element exists (for admin page)
    if (elements.exportBtn) {
        elements.exportBtn.addEventListener('click', exportToExcel);
    }
    
    // Mailer form - only add if element exists (for admin page)
    if (elements.mailerForm) {
        elements.mailerForm.addEventListener('submit', handleMailerSubmission);
    }
    
    // Search functionality - only add if element exists (for admin page)
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', handleSearch);
    }
    
    // Filter functionality - only add if elements exist (for admin page)
    if (elements.committeeFilter) {
        elements.committeeFilter.addEventListener('change', handleFilter);
    }
    if (elements.positionFilter) {
        elements.positionFilter.addEventListener('change', handleFilter);
    }
    
    // Preview functionality - only add if element exists (for admin page)
    if (elements.previewBtn) {
        elements.previewBtn.addEventListener('click', handlePreview);
    }
    
    // File validation - only add if file inputs exist (for form page)
    const fileInputs = document.querySelectorAll('input[type="file"]');
    if (fileInputs.length > 0) {
        fileInputs.forEach(input => {
            input.addEventListener('change', validateFile);
        });
    }
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', handleRouting);
}

// File upload initialization
function initializeFileUploads() {
    const fileWrappers = document.querySelectorAll('.file-input-wrapper');
    if (fileWrappers.length === 0) {
        console.log('No file upload elements found on this page');
        return;
    }
    
    fileWrappers.forEach(wrapper => {
        const input = wrapper.querySelector('input[type="file"]');
        const display = wrapper.querySelector('.file-input-display span');
        
        if (!input || !display) {
            console.warn('File upload wrapper missing required elements');
            return;
        }
        
        // Drag and drop functionality
        wrapper.addEventListener('dragover', (e) => {
            e.preventDefault();
            wrapper.style.borderColor = 'var(--accent-1)';
            wrapper.style.background = 'rgba(121, 125, 250, 0.1)';
        });
        
        wrapper.addEventListener('dragleave', (e) => {
            e.preventDefault();
            wrapper.style.borderColor = 'var(--border)';
            wrapper.style.background = 'transparent';
        });
        
        wrapper.addEventListener('drop', (e) => {
            e.preventDefault();
            wrapper.style.borderColor = 'var(--border)';
            wrapper.style.background = 'transparent';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                input.files = files;
                updateFileDisplay(input, display);
                validateFile({ target: input });
            }
        });
        
        input.addEventListener('change', () => {
            updateFileDisplay(input, display);
        });
    });
}

// Update file display
function updateFileDisplay(input, display) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        display.textContent = file.name;
        display.style.color = 'var(--primary)';
        display.style.fontWeight = '500';
    } else {
        display.textContent = input.required ? 'Choose file or drag here' : 'Choose file or drag here (Optional)';
        display.style.color = 'var(--text-light)';
        display.style.fontWeight = 'normal';
    }
}

// File validation
function validateFile(event) {
    const input = event.target;
    const file = input.files[0];
    
    if (!file) return;
    
    // Check file type
    if (file.type !== 'application/pdf') {
        showError('Only PDF files are allowed.');
        input.value = '';
        updateFileDisplay(input, input.parentElement.querySelector('.file-input-display span'));
        return;
    }
    
    // Check file size
    const maxSize = input.id === 'chairingResume' ? 3 * 1024 * 1024 : 2 * 1024 * 1024; // 3MB or 2MB
    if (file.size > maxSize) {
        const maxSizeMB = maxSize / (1024 * 1024);
        showError(`File size must be less than ${maxSizeMB}MB.`);
        input.value = '';
        updateFileDisplay(input, input.parentElement.querySelector('.file-input-display span'));
        return;
    }
}

// Form submission handler
async function handleFormSubmission(event) {
    event.preventDefault();
    console.log('Form submission started');
    
    try {
    showLoading();
    
        // Get form data
        const formData = new FormData(elements.form);
        
        // Validate required fields
        const requiredFields = ['name', 'email', 'phone', 'college', 'department', 'year'];
        for (const field of requiredFields) {
            if (!formData.get(field)) {
                throw new Error(`Please fill in all required fields. Missing: ${field}`);
            }
        }
        
        // Validate file uploads
        if (!formData.get('idCard')) {
            throw new Error('Please upload your ID Card.');
        }
        
        // Get checkbox values
        const committees = Array.from(document.querySelectorAll('input[name="committees"]:checked')).map(cb => cb.value);
        const positions = Array.from(document.querySelectorAll('input[name="positions"]:checked')).map(cb => cb.value);
        
        if (committees.length === 0) {
            throw new Error('Please select at least one committee preference.');
        }
        
        if (positions.length === 0) {
            throw new Error('Please select at least one position preference.');
        }
        
        // Add checkbox values to form data
        formData.set('committees', JSON.stringify(committees));
        formData.set('positions', JSON.stringify(positions));
        
        console.log('Submitting form data...');
        
        // Submit form
        const response = await axios.post('/api/submit', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        
        console.log('Form submission response:', response);
        
        if (response.data.success) {
        hideLoading();
        showSuccessModal();
        elements.form.reset();
            
            // Reset file displays
            document.querySelectorAll('.file-input-display span').forEach(span => {
                span.textContent = span.textContent.includes('Optional') ? 'Choose file or drag here (Optional)' : 'Choose file or drag here';
                span.style.color = 'var(--text-light)';
                span.style.fontWeight = 'normal';
            });
        } else {
            throw new Error(response.data.message || 'Form submission failed.');
        }
        
    } catch (error) {
        hideLoading();
        console.error('Form submission error:', error);
        
        if (error.response) {
            // Server error
            showError(error.response.data.message || 'Server error occurred. Please try again.');
        } else if (error.message) {
            // Validation error
            showError(error.message);
        } else {
            // Network error
            showError('Network error. Please check your connection and try again.');
        }
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        // Load statistics
        const statsResponse = await axios.get('/api/admin/stats');
        if (statsResponse.data.success) {
            updateStatistics(statsResponse.data.data);
        }
        
        // Load registrations
        const registrationsResponse = await axios.get('/api/admin/registrations');
        if (registrationsResponse.data.success) {
            currentRegistrations = registrationsResponse.data.data;
            updateRegistrationsTable(currentRegistrations);
        }
        
    } catch (error) {
        console.error('Dashboard data loading error:', error);
        // Use mock data for development
        updateStatistics({
            total: 0,
            committeeStats: {},
            positionStats: {},
            yearStats: {},
            recentSubmissions: []
        });
        updateRegistrationsTable([]);
    }
}

// Update statistics
function updateStatistics(stats) {
    // Update total registrations
    const totalElement = document.getElementById('totalRegistrations');
    if (totalElement) {
        totalElement.textContent = stats.total || 0;
    }
    
    // Update charts
    updateCharts(stats);
}

// Update charts
function updateCharts(stats) {
    // Committee chart
    const committeeCtx = document.getElementById('committeeChart');
    if (committeeCtx && stats.committeeStats) {
    if (charts.committee) {
        charts.committee.destroy();
    }
    
        const committeeData = {
            labels: Object.keys(stats.committeeStats),
            datasets: [{
                label: 'Committee Preferences',
                data: Object.values(stats.committeeStats),
                backgroundColor: [
                    '#172d9d',
                    '#797dfa',
                    '#37c9ee',
                    '#10b981',
                    '#f59e0b',
                    '#ef4444'
                ],
                borderWidth: 0
            }]
        };
        
        charts.committee = new Chart(committeeCtx, {
            type: 'doughnut',
            data: committeeData,
        options: {
            responsive: true,
                maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    }
    
    // Position chart
    const positionCtx = document.getElementById('positionChart');
    if (positionCtx && stats.positionStats) {
    if (charts.position) {
        charts.position.destroy();
    }
    
        const positionData = {
            labels: Object.keys(stats.positionStats),
            datasets: [{
                label: 'Position Preferences',
                data: Object.values(stats.positionStats),
                backgroundColor: [
                    '#172d9d',
                    '#797dfa',
                    '#37c9ee'
                ],
                borderWidth: 0
            }]
        };
        
    charts.position = new Chart(positionCtx, {
        type: 'bar',
            data: positionData,
        options: {
            responsive: true,
                maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    }
}

// Update registrations table
function updateRegistrationsTable(registrations) {
    const tbody = document.querySelector('#registrationsTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (registrations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No registrations found</td></tr>';
        return;
    }
    
    registrations.forEach(reg => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${reg.name || 'N/A'}</td>
            <td>${reg.email || 'N/A'}</td>
            <td>${reg.phone || 'N/A'}</td>
            <td>${reg.year || 'N/A'}</td>
            <td>${Array.isArray(reg.committees) ? reg.committees.join(', ') : 'N/A'}</td>
            <td>${Array.isArray(reg.positions) ? reg.positions.join(', ') : 'N/A'}</td>
            <td>${reg.submittedAt ? new Date(reg.submittedAt).toLocaleDateString() : 'N/A'}</td>
            <td>
                <button class="btn btn-outline" onclick="viewRegistration('${reg.id}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-outline" onclick="editRegistration('${reg.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-outline" onclick="deleteRegistration('${reg.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Page-specific initialization
function initializePage() {
    const path = window.location.pathname;
    
    if (path === '/admin') {
        // Admin page specific initialization
        if (elements.adminDashboard) {
            loadDashboardData();
        }
    } else if (path === '/form') {
        // Form page specific initialization
        console.log('Application form initialized');
    }
}

// Tab switching
function switchTab(tabName) {
    // Remove active class from all tabs and contents
    elements.tabBtns.forEach(btn => btn.classList.remove('active'));
    elements.tabContents.forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

// Search functionality
function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const filteredRegistrations = currentRegistrations.filter(reg => 
        reg.name?.toLowerCase().includes(searchTerm) ||
        reg.email?.toLowerCase().includes(searchTerm) ||
        reg.phone?.includes(searchTerm) ||
        reg.college?.toLowerCase().includes(searchTerm)
    );
    updateRegistrationsTable(filteredRegistrations);
}

// Filter functionality
function handleFilter() {
    const committeeFilter = elements.committeeFilter?.value || '';
    const positionFilter = elements.positionFilter?.value || '';
    
    let filteredRegistrations = currentRegistrations;
    
    if (committeeFilter) {
        filteredRegistrations = filteredRegistrations.filter(reg => 
            Array.isArray(reg.committees) && reg.committees.includes(committeeFilter)
        );
    }
    
    if (positionFilter) {
        filteredRegistrations = filteredRegistrations.filter(reg => 
            Array.isArray(reg.positions) && reg.positions.includes(positionFilter)
        );
    }
    
    updateRegistrationsTable(filteredRegistrations);
}

// Preview functionality
function handlePreview() {
    const subject = elements.mailerForm?.querySelector('#subject')?.value || '';
    const message = elements.mailerForm?.querySelector('#message')?.value || '';
    
    if (!subject || !message) {
        showError('Please fill in both subject and message before previewing.');
        return;
    }
    
    const previewText = `Subject: ${subject}\n\nMessage:\n${message}`;
    alert(previewText);
}

// Export to Excel
function exportToExcel() {
    if (currentRegistrations.length === 0) {
        showError('No data to export.');
        return;
    }
    
    try {
    const worksheet = XLSX.utils.json_to_sheet(currentRegistrations.map(reg => ({
            Name: reg.name || 'N/A',
            Email: reg.email || 'N/A',
            Phone: reg.phone || 'N/A',
            College: reg.college || 'N/A',
            Department: reg.department || 'N/A',
            Year: reg.year || 'N/A',
            'MUNs Participated': reg.munsParticipated || 'N/A',
            'MUNs with Awards': reg.munsWithAwards || 'N/A',
            'Organizing Experience': reg.organizingExperience || 'N/A',
            'MUNs Chaired': reg.munsChaired || 'N/A',
            Committees: Array.isArray(reg.committees) ? reg.committees.join(', ') : 'N/A',
            Positions: Array.isArray(reg.positions) ? reg.positions.join(', ') : 'N/A',
            'Submitted At': reg.submittedAt ? new Date(reg.submittedAt).toLocaleString() : 'N/A'
    })));
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registrations');
    
        XLSX.writeFile(workbook, `Kumaraguru_MUN_Registrations_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        showSuccess('Data exported successfully!');
    } catch (error) {
        console.error('Export error:', error);
        showError('Failed to export data.');
    }
}

// Mailer submission
async function handleMailerSubmission(event) {
    event.preventDefault();
    
    try {
    showLoading();
    
        const formData = new FormData(elements.mailerForm);
        const response = await axios.post('/api/admin/send-mail', formData);
        
        if (response.data.success) {
            showSuccess('Email sent successfully!');
            elements.mailerForm.reset();
        } else {
            throw new Error(response.data.message || 'Failed to send email.');
        }
        
    } catch (error) {
        console.error('Mailer error:', error);
        showError(error.response?.data?.message || 'Failed to send email.');
    } finally {
        hideLoading();
    }
}

// Utility functions
function showLoading() {
    elements.loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    elements.loadingOverlay.style.display = 'none';
}

function showSuccessModal() {
    elements.successModal.style.display = 'flex';
}

function hideSuccessModal() {
    elements.successModal.style.display = 'none';
}

function showSuccess(message) {
    // Create a simple success notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 1rem 2rem;
        border-radius: 8px;
        z-index: 1001;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showError(message) {
    // Create a simple error notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 1rem 2rem;
        border-radius: 8px;
        z-index: 1001;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Admin functions (placeholder implementations)
function viewRegistration(id) {
    showSuccess(`Viewing registration ${id}`);
}

function editRegistration(id) {
    showSuccess(`Editing registration ${id}`);
}

function deleteRegistration(id) {
    if (confirm('Are you sure you want to delete this registration?')) {
        showSuccess(`Deleting registration ${id}`);
    }
}