// Monitor class for tracking values and sending Telegram notifications
class ValueMonitor {
  constructor(config) {
    this.telegramToken = config.telegramToken;
    this.chatId = config.chatId;
    this.refreshInterval = config.refreshInterval || 900000; // Default 15 minutes
    
    // Load previous values from storage
    this.previousDownloads = this.loadValue('previousDownloads', 0);
    this.previousPrints = this.loadValue('previousPrints', 0);
    this.previousPoints = this.loadValue('previousPoints', 0);
  }

  loadValue(key, defaultValue) {
    return parseFloat(localStorage.getItem(key) || defaultValue.toString());
  }

  saveValue(key, value) {
    localStorage.setItem(key, value.toString());
  }

  async sendTelegramMessage(message) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: this.chatId, text: message }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Telegram Error:', errorText);
        return false;
      }

      const data = await response.json();
      console.log('Message sent:', data);
      return true;
    } catch (err) {
      console.error('Network or processing error:', err);
      return false;
    }
  }

  getCurrentValues() {
    try {
      const downloadXPath = '//*[@id="userInfo_wrap"]/div[7]/div/div[3]';
      const printsXPath = '//*[@id="userInfo_wrap"]/div[7]/div/div[4]';
      const pointsXPath = '//*[@id="userInfo_wrap"]/div[4]/div/a/div/div/span/span';
      
      const downloadElement = document.evaluate(
        downloadXPath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
      
      const printsElement = document.evaluate(
        printsXPath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;

      const pointsElement = document.evaluate(
        pointsXPath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;

      if (downloadElement && printsElement && pointsElement) {
        return {
          downloads: parseInt(downloadElement.textContent, 10),
          prints: parseInt(printsElement.textContent, 10),
          points: parseFloat(pointsElement.textContent.replace(',', '.')),
        };
      }

      console.error('Elements not found');
      return null;
    } catch (error) {
      console.error('Error during value extraction:', error);
      return null;
    }
  }

  async checkAndNotify() {
    const currentValues = this.getCurrentValues();

    if (!currentValues) {
      console.error('Unable to get current values');
      return;
    }

    // Check downloads
    if (currentValues.downloads > this.previousDownloads) {
      await this.sendTelegramMessage(`🔥 New Download! 
Previous: ${this.previousDownloads}
Current: ${currentValues.downloads}
Increase: +${currentValues.downloads - this.previousDownloads}`);
      this.previousDownloads = currentValues.downloads;
      this.saveValue('previousDownloads', currentValues.downloads);
    }

    // Check prints
    if (currentValues.prints > this.previousPrints) {
      await this.sendTelegramMessage(`📄 New print! 
Previous: ${this.previousPrints}
Current: ${currentValues.prints}
Increase: +${currentValues.prints - this.previousPrints}`);
      this.previousPrints = currentValues.prints;
      this.saveValue('previousPrints', currentValues.prints);
    }

    // Check points
    if (currentValues.points > this.previousPoints) {
      await this.sendTelegramMessage(`⭐️ New Points! 
Previous: ${this.previousPoints}
Current: ${currentValues.points}
Increase: +${(currentValues.points - this.previousPoints).toFixed(1)}`);
      this.previousPoints = currentValues.points;
      this.saveValue('previousPoints', currentValues.points);
    }
  }

  start() {
    // Load configuration from chrome storage
    chrome.storage.sync.get(['telegramToken', 'chatId', 'refreshInterval'], (config) => {
      if (config.telegramToken && config.chatId) {
        this.telegramToken = config.telegramToken;
        this.chatId = config.chatId;
        this.refreshInterval = config.refreshInterval || 900000;

        // Check immediately on start
        this.checkAndNotify();

        // Start monitoring interval
        this.timer = setInterval(() => this.checkAndNotify(), 60000);
        console.log('Monitoring started');

        // Page refresh interval
        setInterval(() => {
          console.log('Refreshing page...');
          window.location.reload();
        }, this.refreshInterval);
      } else {
        console.error('Telegram configuration missing. Please set up in extension options.');
      }
    });
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('Monitoring stopped');
    }
  }
}

// Initialize the monitor when the page loads
const monitor = new ValueMonitor({});
monitor.start();