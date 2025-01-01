// Background service worker to handle resources
chrome.runtime.onInstalled.addListener(() => {
  // Set up alarm for periodic checking
  chrome.alarms.create('checkUpdates', {
    periodInMinutes: 30 // Check every 30 minutes
  });
});

// Handle alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkUpdates') {
    chrome.tabs.query({
      url: 'https://makerworld.com/en/@aquascape/*'
    }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  }
});

// Handle network errors
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (details.error === 'net::ERR_INTERNET_DISCONNECTED') {
      console.log('Network disconnected, will retry when connection is restored');
    }
  },
  {urls: ['<all_urls>']}
);

// Connection recovery
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.type === 'main_frame') {
      console.log('Connection restored, resuming operations');
    }
  },
  {urls: ['<all_urls>']}
);