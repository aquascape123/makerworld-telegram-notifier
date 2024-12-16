document.addEventListener('DOMContentLoaded', function () {
    const telegramTokenInput = document.getElementById('telegramToken');
    const chatIdInput = document.getElementById('chatId');
    const refreshIntervalInput = document.getElementById('refreshInterval');
    const dailyReportInput = document.getElementById('dailyReport');
    const notificationTimeInput = document.getElementById('notificationTime');
    const saveButton = document.getElementById('saveButton');
    const statusDiv = document.getElementById('status');

    // Funzione per mostrare un messaggio di stato temporaneo
    function showTemporaryMessage(message, color = 'green', duration = 3000) {
        statusDiv.textContent = message;
        statusDiv.style.color = color;

        // Nasconde il messaggio dopo il tempo specificato
        setTimeout(() => {
            statusDiv.textContent = '';
        }, duration);
    }

    // Load saved configuration
    chrome.storage.sync.get(['telegramToken', 'chatId', 'refreshInterval', 'dailyReport', 'dailyNotificationTime'], function (config) {
        if (config.telegramToken) telegramTokenInput.value = config.telegramToken;
        if (config.chatId) chatIdInput.value = config.chatId;
        if (config.refreshInterval) refreshIntervalInput.value = config.refreshInterval;
        if (config.dailyReport) dailyReportInput.value = config.dailyReport;
        if (config.dailyNotificationTime) notificationTimeInput.value = config.dailyNotificationTime;
    });

    // Save configuration
    saveButton.addEventListener('click', function () {
        const telegramToken = telegramTokenInput.value.trim();
        const chatId = chatIdInput.value.trim();
        const refreshInterval = parseInt(refreshIntervalInput.value) || 900000;
        const dailyReport = dailyReportInput.value;
        const notificationTime = notificationTimeInput.value;

        if (!telegramToken || !chatId) {
            showTemporaryMessage('Please fill in all fields', 'red');
            return;
        }

        chrome.storage.sync.set({
            telegramToken: telegramToken,
            chatId: chatId,
            refreshInterval: refreshInterval,
            dailyReport: dailyReport,
            dailyNotificationTime: notificationTime
        }, function () {
            showTemporaryMessage('Configuration saved successfully!');
        });
    });

    // Save daily notification time separately (optional change handler)
    notificationTimeInput.addEventListener('change', function () {
        chrome.storage.sync.set({ dailyNotificationTime: notificationTimeInput.value }, function () {
            showTemporaryMessage('Daily notification time saved!');
        });
    });
});
