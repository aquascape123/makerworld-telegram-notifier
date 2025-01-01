document.addEventListener('DOMContentLoaded', function () {
    const telegramTokenInput = document.getElementById('telegram-token');
    const chatIdInput = document.getElementById('chat-id');
    const refreshIntervalSelect = document.getElementById('refresh-interval');
    const dailyReportSelect = document.getElementById('daily-report');
    const notificationTimeInput = document.getElementById('notification-time');
    const saveButton = document.getElementById('save-button');
    const statusDiv = document.getElementById('status');

    function showStatus(message, isError = false) {
        statusDiv.textContent = message;
        statusDiv.className = 'status ' + (isError ? 'error' : 'success');
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = 'status';
        }, 3000);
    }

    // Load saved configuration
    chrome.storage.sync.get(
        ['telegramToken', 'chatId', 'refreshInterval', 'dailyReport', 'dailyNotificationTime'],
        function (config) {
            if (chrome.runtime.lastError) {
                console.error('Error loading configuration:', chrome.runtime.lastError);
                showStatus('Error loading configuration', true);
                return;
            }

            if (config.telegramToken) telegramTokenInput.value = config.telegramToken;
            if (config.chatId) chatIdInput.value = config.chatId;
            if (config.refreshInterval) refreshIntervalSelect.value = config.refreshInterval;
            if (config.dailyReport) dailyReportSelect.value = config.dailyReport;
            if (config.dailyNotificationTime) notificationTimeInput.value = config.dailyNotificationTime;
        }
    );

    // Save configuration
    saveButton.addEventListener('click', function () {
        const telegramToken = telegramTokenInput.value.trim();
        const chatId = chatIdInput.value.trim();
        const refreshInterval = parseInt(refreshIntervalSelect.value);
        const dailyReport = dailyReportSelect.value;
        const notificationTime = notificationTimeInput.value;

        if (!telegramToken || !chatId) {
            showStatus('Please fill in all fields', true);
            return;
        }

        chrome.storage.sync.set({
            telegramToken: telegramToken,
            chatId: chatId,
            refreshInterval: refreshInterval,
            dailyReport: dailyReport,
            dailyNotificationTime: notificationTime
        }, function() {
            if (chrome.runtime.lastError) {
                console.error('Error saving:', chrome.runtime.lastError);
                showStatus('Error saving configuration', true);
                return;
            }
            
            showStatus('Configuration saved!');
            
            // Reload page after 2 seconds
            setTimeout(() => {
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    if (tabs[0]) {
                        chrome.tabs.reload(tabs[0].id);
                    }
                });
            }, 2000);
        });
    });

    // Handle notification time change
    notificationTimeInput.addEventListener('change', function() {
        if (dailyReportSelect.value === 'yes') {
            chrome.storage.sync.set({ 
                dailyNotificationTime: notificationTimeInput.value 
            }, function() {
                showStatus('Notification time updated!');
            });
        }
    });

    // Handle daily report enable/disable
    dailyReportSelect.addEventListener('change', function() {
        notificationTimeInput.disabled = this.value === 'no';
    });
});