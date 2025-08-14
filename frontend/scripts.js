// Global variables
let currentRegistrations = [];
let charts = {};

// DOM Elements
const elements = {
    form: document.getElementById('ebForm'),
    adminBtn: document.getElementById('adminBtn'),
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
    searchInput: document.getElementById('searchInput')
};

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    initializeFileUploads();
    loadDashboardData();
});

// Event Listeners
function initializeEventListeners() {
    // Form submission
    elements.form.addEventListener('submit', handleFormSubmission);
    
    // Navigation
    elements.adminBtn.addEventListener('click', showAdminDashboard);
    elements.backToForm.addEventListener('click', showApplicationForm);
    
    // Modal
    elements.closeModal.addEventListener('click', hideSuccessModal);
    
    // Dashboard tabs
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // Export functionality
    elements.exportBtn.addEventListener('click', exportToExcel);
    
    // Mailer form
    elements.mailerForm.addEventListener('submit', handleMailerSubmission);
    
    // Search functionality
    elements.searchInput.addEventListener('input', handleSearch);
    
    // File validation
    document.querySelectorAll('input[type="file"]').forEach(input => {
        input.addEventListener('change', validateFile);
    });
}

// File upload initialization
function initializeFileUploads() {
    document.querySelectorAll('.file-input-wrapper').forEach(wrapper => {
        const input = wrapper.querySelector('input[type="file"]');
        const display = wrapper.querySelector('.file-input-display span');
        
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
    if (input.files.length > 0) {
        const file = input.files[0];
        display.innerHTML = `<i class="fas fa-file-pdf"></i> ${file.name}`;
        display.style.color = 'var(--primary)';
    }
}

// File validation
function validateFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const maxSizes = {
        'idCard': 2 * 1024 * 1024, // 2MB
        'munCertificates': 2 * 1024 * 1024, // 2MB
        'chairingResume': 3 * 1024 * 1024 // 3MB
    };
    
    const maxSize = maxSizes[event.target.name];
    
    if (file.type !== 'application/pdf') {
        showError('Please upload only PDF files.');
        event.target.value = '';
        return false;
    }
    
    if (file.size > maxSize) {
        const maxSizeMB = maxSize / (1024 * 1024);
        showError(`File size must be less than ${maxSizeMB}MB.`);
        event.target.value = '';
        return false;
    }
    
    return true;
}

// Form submission handler
async function handleFormSubmission(event) {
    event.preventDefault();
    
    if (!validateForm()) {
        return;
    }
    
    showLoading();
    
    try {
        const formData = new FormData();
        
        // Add form fields
        const formFields = new FormData(elements.form);
        for (let [key, value] of formFields.entries()) {
            if (key === 'committees' || key === 'positions') {
                // Handle multiple selections
                const existing = formData.getAll(key);
                if (!existing.includes(value)) {
                    formData.append(key, value);
                }
            } else {
                formData.set(key, value);
            }
        }
        
        // Convert multi-select arrays to proper format
        const committees = formData.getAll('committees');
        const positions = formData.getAll('positions');
        
        formData.delete('committees');
        formData.delete('positions');
        formData.append('committees', JSON.stringify(committees));
        formData.append('positions', JSON.stringify(positions));
        
        const response = await axios.post('/api/submit', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        
        hideLoading();
        showSuccessModal();
        elements.form.reset();
        
    } catch (error) {
        hideLoading();
        console.error('Submission error:', error);
        showError(error.response?.data?.message || 'An error occurred while submitting the form.');
    }
}

// Form validation
function validateForm() {
    const requiredFields = [
        'name', 'email', 'phone', 'college', 'department', 'year',
        'munsParticipated', 'munsWithAwards', 'organizingExperience', 'munsChaired'
    ];
    
    for (let field of requiredFields) {
        const element = document.getElementById(field);
        if (!element.value.trim()) {
            showError(`Please fill in the ${field.replace(/([A-Z])/g, ' $1').toLowerCase()} field.`);
            element.focus();
            return false;
        }
    }
    
    // Validate ID card upload
    const idCard = document.getElementById('idCard');
    if (!idCard.files.length) {
        showError('Please upload your Aadhaar/ID Card.');
        return false;
    }
    
    // Validate committee preferences
    const committees = document.querySelectorAll('input[name="committees"]:checked');
    if (committees.length === 0) {
        showError('Please select at least one committee preference.');
        return false;
    }
    
    // Validate position preferences
    const positions = document.querySelectorAll('input[name="positions"]:checked');
    if (positions.length === 0) {
        showError('Please select at least one position preference.');
        return false;
    }
    
    // Validate email format
    const email = document.getElementById('email').value;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('Please enter a valid email address.');
        return false;
    }
    
    return true;
}

// Navigation functions
function showAdminDashboard() {
    elements.applicationForm.style.display = 'none';
    elements.adminDashboard.style.display = 'block';
    loadDashboardData();
}

function showApplicationForm() {
    elements.adminDashboard.style.display = 'none';
    elements.applicationForm.style.display = 'block';
}

// Tab switching
function switchTab(tabName) {
    elements.tabBtns.forEach(btn => btn.classList.remove('active'));
    elements.tabContents.forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    if (tabName === 'statistics') {
        setTimeout(renderCharts, 100);
    } else if (tabName === 'registrations') {
        loadRegistrations();
    } else if (tabName === 'mailer') {
        loadMailerRecipients();
    }
}

// Dashboard data loading
async function loadDashboardData() {
    try {
        const response = await axios.get('/api/admin/stats');
        const stats = response.data;
        
        document.getElementById('totalRegistrations').textContent = stats.total;
        
        // Store data for charts
        window.dashboardStats = stats;
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Failed to load dashboard data.');
    }
}

// Chart rendering
function renderCharts() {
    if (!window.dashboardStats) return;
    
    const stats = window.dashboardStats;
    
    // Committee chart
    if (charts.committee) {
        charts.committee.destroy();
    }
    
    const committeeCtx = document.getElementById('committeeChart').getContext('2d');
    charts.committee = new Chart(committeeCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(stats.committees || {}),
            datasets: [{
                data: Object.values(stats.committees || {}),
                backgroundColor: [
                    '#172d9d',
                    '#797dfa',
                    '#37c9ee',
                    '#10b981',
                    '#f59e0b',
                    '#ef4444'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    
    // Position chart
    if (charts.position) {
        charts.position.destroy();
    }
    
    const positionCtx = document.getElementById('positionChart').getContext('2d');
    charts.position = new Chart(positionCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(stats.positions || {}),
            datasets: [{
                label: 'Preferences',
                data: Object.values(stats.positions || {}),
                backgroundColor: '#797dfa'
            }]
        },
        options: {
            responsive: true,
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

// Load registrations
async function loadRegistrations() {
    try {
        const response = await axios.get('/api/admin/registrations');
        currentRegistrations = response.data;
        renderRegistrationsTable(currentRegistrations);
    } catch (error) {
        console.error('Error loading registrations:', error);
        showError('Failed to load registrations.');
    }
}

// Render registrations table
function renderRegistrationsTable(registrations) {
    const tbody = document.querySelector('#registrationsTable tbody');
    tbody.innerHTML = '';
    
    registrations.forEach(registration => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${registration.name}</td>
            <td>${registration.email}</td>
            <td>${registration.phone}</td>
            <td>${registration.year}</td>
            <td>${Array.isArray(registration.committees) ? registration.committees.join(', ') : registration.committees}</td>
            <td>${Array.isArray(registration.positions) ? registration.positions.join(', ') : registration.positions}</td>
            <td>${new Date(registration.submittedAt).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-outline" onclick="viewRegistration('${registration.id}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-outline" onclick="deleteRegistration('${registration.id}')" style="color: #ef4444; border-color: #ef4444;">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Search functionality
function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const filtered = currentRegistrations.filter(registration => 
        registration.name.toLowerCase().includes(searchTerm) ||
        registration.email.toLowerCase().includes(searchTerm) ||
        registration.phone.includes(searchTerm) ||
        registration.college.toLowerCase().includes(searchTerm)
    );
    renderRegistrationsTable(filtered);
}

// Export to Excel
function exportToExcel() {
    if (currentRegistrations.length === 0) {
        showError('No data to export.');
        return;
    }
    
    const worksheet = XLSX.utils.json_to_sheet(currentRegistrations.map(reg => ({
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
        Committees: Array.isArray(reg.committees) ? reg.committees.join(', ') : reg.committees,
        Positions: Array.isArray(reg.positions) ? reg.positions.join(', ') : reg.positions,
        'Submitted At': new Date(reg.submittedAt).toLocaleString()
    })));
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registrations');
    
    XLSX.writeFile(workbook, `KMUN25_Registrations_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Load mailer recipients
async function loadMailerRecipients() {
    try {
        const response = await axios.get('/api/admin/registrations');
        const select = document.getElementById('recipients');
        
        // Clear existing options except "All Registrants"
        select.innerHTML = '<option value="all">All Registrants</option>';
        
        response.data.forEach(registration => {
            const option = document.createElement('option');
            option.value = registration.email;
            option.textContent = `${registration.name} (${registration.email})`;
            select.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error loading recipients:', error);
        showError('Failed to load recipients.');
    }
}

// Handle mailer submission
async function handleMailerSubmission(event) {
    event.preventDefault();
    
    showLoading();
    
    try {
        const formData = new FormData(event.target);
        const recipients = Array.from(document.getElementById('recipients').selectedOptions)
            .map(option => option.value);
        
        const mailData = {
            recipients: recipients,
            subject: formData.get('subject'),
            message: formData.get('message')
        };
        
        await axios.post('/api/admin/send-mail', mailData);
        
        hideLoading();
        showSuccess('Emails sent successfully!');
        event.target.reset();
        
    } catch (error) {
        hideLoading();
        console.error('Mailer error:', error);
        showError(error.response?.data?.message || 'Failed to send emails.');
    }
}

// View registration details
function viewRegistration(id) {
    const registration = currentRegistrations.find(r => r.id === id);
    if (!registration) return;
    
    // Create a modal or detailed view
    alert(`Registration Details:\n\nName: ${registration.name}\nEmail: ${registration.email}\nPhone: ${registration.phone}\nCollege: ${registration.college}\nDepartment: ${registration.department}\nYear: ${registration.year}\nCommittees: ${Array.isArray(registration.committees) ? registration.committees.join(', ') : registration.committees}\nPositions: ${Array.isArray(registration.positions) ? registration.positions.join(', ') : registration.positions}`);
}

// Delete registration
async function deleteRegistration(id) {
    if (!confirm('Are you sure you want to delete this registration?')) {
        return;
    }
    
    try {
        await axios.delete(`/api/admin/registrations/${id}`);
        showSuccess('Registration deleted successfully!');
        loadRegistrations();
        loadDashboardData();
    } catch (error) {
        console.error('Delete error:', error);
        showError('Failed to delete registration.');
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

function showError(message) {
    alert('Error: ' + message);
}

function showSuccess(message) {
    alert('Success: ' + message);
}