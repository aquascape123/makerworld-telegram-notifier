document.addEventListener('DOMContentLoaded', function() {
    const telegramTokenInput = document.getElementById('telegramToken');
    const chatIdInput = document.getElementById('chatId');
    const refreshIntervalInput = document.getElementById('refreshInterval');
    const saveButton = document.getElementById('saveButton');
    const statusDiv = document.getElementById('status');

    // Load saved configuration
    chrome.storage.sync.get(['telegramToken', 'chatId', 'refreshInterval'], function(config) {
        if (config.telegramToken) telegramTokenInput.value = config.telegramToken;
        if (config.chatId) chatIdInput.value = config.chatId;
        if (config.refreshInterval) refreshIntervalInput.value = config.refreshInterval;
    });

    // Save configuration
    saveButton.addEventListener('click', function() {
        const telegramToken = telegramTokenInput.value.trim();
        const chatId = chatIdInput.value.trim();
        const refreshInterval = parseInt(refreshIntervalInput.value) || 900000;

        if (!telegramToken || !chatId) {
            statusDiv.textContent = 'Please fill in all fields';
            statusDiv.style.color = 'red';
            return;
        }

        chrome.storage.sync.set({
            telegramToken: telegramToken,
            chatId: chatId,
            refreshInterval: refreshInterval
        }, function() {
            statusDiv.textContent = 'Configuration saved successfully!';
            statusDiv.style.color = 'green';
        });
    });
});