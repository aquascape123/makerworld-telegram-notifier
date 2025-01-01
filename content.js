class ValueMonitor {
  constructor() {
    this.telegramToken = '';
    this.chatId = '';
    this.previousValues = null;
    this.checkInterval = null;
    this.isChecking = false;
  }

  async loadPreviousValues() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['previousValues'], (result) => {
        if (result.previousValues) {
          console.log('Previous values loaded:', result.previousValues);
          this.previousValues = result.previousValues;
        }
        resolve();
      });
    });
  }

  async savePreviousValues(values) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ previousValues: values }, () => {
        console.log('Values saved to storage');
        resolve();
      });
    });
  }

  getRewardInterval(total) {
    let next = 100;
    if (total <= 50) {
      next = 10;
    } else if (total <= 500) {
      next = 25;
    } else if (total <= 1000) {
      next = 50;
    }
    return next;
  }

  nextRewardPoints(total) {
    const interval = this.getRewardInterval(total);
    const mod = total % interval;
    if (total === 0 || mod === 0) {
      return total + interval;
    }
    return total + (interval - mod);
  }

  calculateTotalPoints(downloads, prints) {
    return downloads + (prints * 2);
  }

  async sendTelegramMessage(message) {
    if (!this.telegramToken || !this.chatId) {
      console.error('Missing Token or Chat ID');
      return false;
    }

    try {
      console.log('Sending Telegram message:', message);
      const response = await fetch(`https://api.telegram.org/bot${this.telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chat_id: this.chatId, 
          text: message,
          parse_mode: 'HTML'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const result = await response.json();
      console.log('Telegram response:', result);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  async sendTelegramMessageWithPhoto(message, photoUrl) {
    if (!this.telegramToken || !this.chatId || !photoUrl) {
      console.error('Missing Token, Chat ID, or photo URL:', {
        hasToken: !!this.telegramToken,
        hasChatId: !!this.chatId,
        hasPhotoUrl: !!photoUrl
      });
      return this.sendTelegramMessage(message);
    }

    try {
      console.log('Attempting to send photo:', {
        message,
        photoUrl,
        chatId: this.chatId
      });

      const imageResponse = await fetch(photoUrl);
      if (!imageResponse.ok) {
        throw new Error(`Image download failed: ${imageResponse.status}`);
      }

      const imageBlob = await imageResponse.blob();
      console.log('Image downloaded, size:', imageBlob.size);

      const formData = new FormData();
      formData.append('chat_id', this.chatId);
      formData.append('caption', message);
      formData.append('photo', imageBlob, 'model_image.jpg');

      const response = await fetch(`https://api.telegram.org/bot${this.telegramToken}/sendPhoto`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      console.log('Telegram response:', result);

      if (!response.ok) {
        throw new Error(`Telegram Error: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Error sending photo:', error);
      return this.sendTelegramMessage(message);
    }
  }

  async getCurrentValues() {
    try {
      const currentValues = {
        models: {},
        points: 0,
        timestamp: Date.now()
      };

      // Get points
      try {
        const pointsElement = document.evaluate(
          '//*[@id="userInfo_wrap"]/div[4]/div/a/div/div/span/span',
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;

        if (pointsElement) {
          currentValues.points = parseFloat(pointsElement.textContent.replace(',', '.'));
        }
      } catch (pointsError) {
        console.error('Error extracting points:', pointsError);
      }

      // Get total pages
      const paginationLinks = document.querySelectorAll('.pagination a');
      const totalPages = Math.max(...Array.from(paginationLinks)
        .map(link => parseInt(link.textContent))
        .filter(num => !isNaN(num))) || 1;

      console.log(`Total pages found: ${totalPages}`);

      // Process current page
      await this.processPage(currentValues.models);
      console.log(`Processed page 1 of ${totalPages}`);

      // Process remaining pages
      for (let page = 2; page <= totalPages; page++) {
        const pageUrl = new URL(window.location.href);
        pageUrl.searchParams.set('page', page);
        
        console.log(`Fetching page ${page}...`);
        const response = await fetch(pageUrl);
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        
        await this.processPage(currentValues.models, doc);
        console.log(`Processed page ${page} of ${totalPages}`);
      }

      console.log(`Total models processed: ${Object.keys(currentValues.models).length}`);
      return currentValues;
    } catch (error) {
      console.error('Error extracting values:', error);
      return null;
    }
  }

  async processPage(models, doc = document) {
    const downloadElements = doc.querySelectorAll('[data-trackid]');
    downloadElements.forEach((element) => {
      const modelId = element.getAttribute('data-trackid');
      console.log(`Processing model ID: ${modelId}`);
      
      const modelLink = element.querySelector('a[title]');
      const name = modelLink?.getAttribute('title') || 'Model';
      
      const imageElement = element.querySelector('img.lazy, img.gif-image');
      const imageUrl = imageElement?.getAttribute('src') || '';

      const statDivs = Array.from(element.querySelectorAll('div')).filter(div => {
        return div.className.includes('mw-css-12g5tx') && div.querySelector('span');
      });

      if (statDivs.length >= 3) {
        const boostValue = statDivs[statDivs.length - 3]?.querySelector('span')?.textContent || '0';
        const downloadValue = statDivs[statDivs.length - 2]?.querySelector('span')?.textContent || '0';
        const printValue = statDivs[statDivs.length - 1]?.querySelector('span')?.textContent || '0';

        const boost = this.parseNumber(boostValue);
        const downloads = this.parseNumber(downloadValue);
        const prints = this.parseNumber(printValue);

        models[modelId] = {
          name,
          boosts: boost,
          downloads: downloads,
          prints: prints,
          imageUrl
        };

        console.log(`Model "${name}":`, {
          rawValues: {
            boost: boostValue,
            downloads: downloadValue,
            prints: printValue
          },
          convertedValues: {
            boost,
            downloads,
            prints
          }
        });
      } else {
        console.log(`Not enough stat divs found for ${name} (found: ${statDivs.length})`);
      }
    });
  }

  parseNumber(text) {
    if (!text) return 0;
    text = text.trim().toLowerCase();
    
    if (text.includes('k')) {
      const base = parseFloat(text.replace('k', ''));
      return Math.round(base * 1000);
    }
    
    return parseInt(text.replace(/[^\d]/g, '')) || 0;
  }

  getDailySummary() {
    const currentValues = this.getCurrentValues();
    if (!currentValues) {
      console.error('Unable to get current values');
      return null;
    }

    const totalDownloads = Object.values(currentValues.models)
      .reduce((sum, model) => sum + model.downloads, 0);
    const totalPrints = Object.values(currentValues.models)
      .reduce((sum, model) => sum + model.prints, 0);

    const top5Downloads = Object.values(currentValues.models)
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 5);
    const top5Prints = Object.values(currentValues.models)
      .sort((a, b) => b.prints - a.prints)
      .slice(0, 5);

    return { 
      totalDownloads, 
      totalPrints, 
      points: currentValues.points,
      top5Downloads, 
      top5Prints 
    };
  }

  scheduleDailyNotification() {
    chrome.storage.sync.get(['dailyReport', 'dailyNotificationTime'], (config) => {
      const dailyReport = config.dailyReport || 'yes';
      if (dailyReport === 'no') {
        console.log('Daily report disabled');
        return;
      }

      const dailyTime = config.dailyNotificationTime || '12:00';
      const [hour, minute] = dailyTime.split(':').map(Number);

      const now = new Date();
      const nextNotification = new Date();
      nextNotification.setHours(hour, minute, 0, 0);

      if (nextNotification <= now) {
        nextNotification.setDate(nextNotification.getDate() + 1);
      }

      const delay = nextNotification - now;
      console.log(`Daily report scheduled for: ${nextNotification}. Delay: ${delay}ms`);

      setTimeout(async () => {
        console.log(`Sending daily report: ${new Date()}`);
        const summary = this.getDailySummary();
        if (summary) {
          const message = `
📊 Daily Summary:
- Total Downloads: ${summary.totalDownloads}
- Total Prints: ${summary.totalPrints}
- Total Points: ${summary.points}

🏆 Top 5 Downloads:
${summary.top5Downloads.map((m, i) => `${i + 1}. ${m.name}: ${m.downloads}`).join('\n')}

🖨️ Top 5 Prints:
${summary.top5Prints.map((m, i) => `${i + 1}. ${m.name}: ${m.prints}`).join('\n')}`;

          await this.sendTelegramMessage(message);
        }

        this.scheduleDailyNotification();
      }, delay);
    });
  }

  async checkAndNotify() {
    if (this.isChecking) {
      console.log('Check already in progress, skipping...');
      return;
    }
    this.isChecking = true;

    try {
      console.log('Starting change check...');
      
      const currentValues = await this.getCurrentValues();
      if (!currentValues) {
        console.log('No current values found');
        return;
      }

      if (!this.previousValues) {
        await this.loadPreviousValues();
      }

      if (!this.previousValues) {
        console.log('First run, saving initial values');
        this.previousValues = currentValues;
        await this.savePreviousValues(currentValues);
        return;
      }

      if (currentValues.points > this.previousValues.points) {
        const message = `
⭐️ New Points!
Before: ${this.previousValues.points}
After: ${currentValues.points} 
Increase: +${(currentValues.points - this.previousValues.points).toFixed(1)}`;
        
        await this.sendTelegramMessage(message);
      }

      for (const [id, current] of Object.entries(currentValues.models)) {
        const previous = this.previousValues.models[id];
        if (!previous) {
          console.log(`New model found: ${current.name}`);
          continue;
        }

        const previousTotal = this.calculateTotalPoints(previous.downloads, previous.prints);
        const currentTotal = this.calculateTotalPoints(current.downloads, current.prints);
        const nextReward = this.nextRewardPoints(currentTotal);
        const pointsToNext = nextReward - currentTotal;
        const rewardInterval = this.getRewardInterval(currentTotal);

        console.log(`\nChecking model "${current.name}":`, {
          'Previous downloads': previous.downloads,
          'Current downloads': current.downloads,
          'Previous prints': previous.prints,
          'Current prints': current.prints
        });

        if (current.boosts > previous.boosts) {
          const message = `
⚡️ New boosts for: ${current.name}
Before: ${previous.boosts}
After: ${current.boosts}
Increase: +${current.boosts - previous.boosts}`;
            
          console.log('Sending boost notification...');
          await this.sendTelegramMessageWithPhoto(message, current.imageUrl);
        }

        if (current.downloads > previous.downloads) {
          const newPoints = current.downloads - previous.downloads;
          const message = `
📈 New downloads for: ${current.name}
Before: ${previous.downloads}
After: ${current.downloads}
Increase: +${current.downloads - previous.downloads}

📊 Points Status:
Total Points: ${currentTotal} (+${newPoints})
Next Reward: ${nextReward} (${pointsToNext} points needed)
Reward Interval: every ${rewardInterval} points`;
          
          console.log('Sending downloads notification...');
          await this.sendTelegramMessageWithPhoto(message, current.imageUrl);
        }

        if (current.prints > previous.prints) {
          const newPoints = (current.prints - previous.prints) * 2;
          const message = `
🖨️ New prints for: ${current.name}
Before: ${previous.prints}
After: ${current.prints}
Increase: +${current.prints - previous.prints}

📊 Points Status:
Total Points: ${currentTotal} (+${newPoints})
Next Reward: ${nextReward} (${pointsToNext} points needed)
Reward Interval: every ${rewardInterval} points`;
          
          console.log('Sending prints notification...');
          await this.sendTelegramMessageWithPhoto(message, current.imageUrl);
        }
      }

      this.previousValues = currentValues;
      await this.savePreviousValues(currentValues);

    } catch (error) {
      console.error('Error during check:', error);
    } finally {
      this.isChecking = false;
    }
  }

  start() {
    console.log('Starting monitor...');
    
    chrome.storage.sync.get(['telegramToken', 'chatId', 'refreshInterval', 'dailyReport', 'dailyNotificationTime'], async (config) => {
      if (!config.telegramToken || !config.chatId) {
        console.error('Missing Telegram configuration');
        return;
      }

      this.telegramToken = config.telegramToken;
      this.chatId = config.chatId;
      
      const refreshInterval = config.refreshInterval || 900000; // Default 15 minutes
      console.log(`Refresh interval: ${refreshInterval}ms`);

      // First check
      await this.checkAndNotify();

      // Set periodic refresh
      this.checkInterval = setInterval(() => {
        console.log('Refreshing page...');
        window.location.reload();
      }, refreshInterval);

      // Schedule daily report if enabled
      if (config.dailyReport !== 'no') {
        this.scheduleDailyNotification();
      }

      console.log(`Monitor started, refresh every ${refreshInterval/60000} minutes`);
    });
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isChecking = false;
    console.log('Monitor stopped');
  }
}

// Startup
console.log('Initializing monitor...');
const monitor = new ValueMonitor();
monitor.start();