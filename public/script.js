let statusPollInterval;

async function fetchUsers() {
    try {
        const response = await fetch('/users');
        const users = await response.json();
        const userSelect = document.getElementById('userSelect');
        
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.name} (${user.tier})`;
            userSelect.appendChild(option);
        });
        
        // Set Alice (userId: 1) as the default selected user
        userSelect.value = '1';
    } catch (error) {
        console.error('Error fetching users:', error);
    }
}

async function fetchStatus() {
    try {
        const response = await fetch('/status');
        const status = await response.json();
        updateToggleState(status.rateLimitingEnabled);
    } catch (error) {
        console.error('Error fetching status:', error);
    }
}

function updateToggleState(enabled) {
    const toggle = document.getElementById('rateLimitToggle');
    const statusText = document.querySelector('.toggle-status');
    toggle.checked = enabled;
    statusText.textContent = enabled ? 'ON' : 'OFF';
}

function startStatusPolling() {
    statusPollInterval = setInterval(fetchStatus, 3000);
}

async function toggleRateLimit(enabled) {
    try {
        const response = await fetch('/toggle-rate-limit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ enabled })
        });
        const result = await response.json();
        updateToggleState(result.rateLimitingEnabled);
    } catch (error) {
        console.error('Error toggling rate limit:', error);
    }
}

async function sendMessage() {
    const userSelect = document.getElementById('userSelect');
    const messageInput = document.getElementById('messageInput');
    const messageArea = document.getElementById('messageArea');
    
    const userId = userSelect.value;
    const message = messageInput.value.trim();
    
    if (!userId || !message) {
        return;
    }
    
    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId, message })
        });
        
        const data = await response.json();
        
        if (response.status === 200) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message success';
            messageDiv.innerHTML = `
                <div class="message-header">
                    <strong>${data.user}</strong>
                    <span class="message-time">${new Date().toLocaleTimeString()}</span>
                </div>
                <div class="message-content">
                    <div class="user-message">${data.message}</div>
                    <div class="ai-response">${data.response}</div>
                </div>
            `;
            messageArea.appendChild(messageDiv);
            messageInput.value = '';
        } else if (response.status === 429) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message error';
            errorDiv.innerHTML = `
                <div class="error-icon">⚠️</div>
                <div class="error-content">
                    <strong>Rate Limit Exceeded</strong>
                    <p>${data.error}</p>
                    ${data.retryAfter ? `<p class="retry-info">Retry after: ${data.retryAfter}</p>` : ''}
                </div>
            `;
            messageArea.appendChild(errorDiv);
        } else {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message error';
            errorDiv.innerHTML = `
                <div class="error-icon">❌</div>
                <div class="error-content">
                    <strong>Error</strong>
                    <p>${data.error || 'An error occurred'}</p>
                </div>
            `;
            messageArea.appendChild(errorDiv);
        }
        
        messageArea.scrollTop = messageArea.scrollHeight;
    } catch (error) {
        console.error('Error sending message:', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message error';
        errorDiv.innerHTML = `
            <div class="error-icon">❌</div>
            <div class="error-content">
                <strong>Network Error</strong>
                <p>Failed to send message</p>
            </div>
        `;
        messageArea.appendChild(errorDiv);
        messageArea.scrollTop = messageArea.scrollHeight;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchUsers();
    fetchStatus();
    startStatusPolling();
    
    const toggle = document.getElementById('rateLimitToggle');
    toggle.addEventListener('change', (e) => {
        toggleRateLimit(e.target.checked);
    });
    
    const sendButton = document.getElementById('sendButton');
    sendButton.addEventListener('click', sendMessage);
    
    const messageInput = document.getElementById('messageInput');
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
});