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

  getCurrentValues() {
    try {
      const currentValues = {
        models: {},
        points: 0,
        timestamp: Date.now()
      };

      try {
        console.log('Starting points search...');
        
        // Troviamo il div che contiene i punti
        const pointsContainer = document.querySelector('.mw-css-1541sxf');
        console.log('Found points container:', !!pointsContainer);

        if (pointsContainer) {
            // Prendiamo tutto il testo, inclusi i numeri e i decimali
            const pointsText = pointsContainer.textContent.trim();
            console.log('Raw points text:', pointsText);
            
            // Estraiamo tutti i numeri dal testo
            const numbers = pointsText.match(/\d+(\.\d+)?/g);
            console.log('Found numbers:', numbers);
            
            if (numbers && numbers.length > 0) {
                // Combiniamo i numeri se necessario
                const fullNumber = numbers.join('');
                currentValues.points = parseFloat(fullNumber);
                console.log('Points found:', currentValues.points);
            }
        } else {
            console.log('Could not find points element');
        }
      } catch (pointsError) {
        console.error('Error extracting points:', pointsError);
      }

      const downloadElements = document.querySelectorAll('[data-trackid]');
      downloadElements.forEach((element) => {
        const modelId = element.getAttribute('data-trackid');
        console.log(`Processing model ID: ${modelId}`);
        
        const modelTitle = element.querySelector('h3.translated-text');
        const name = modelTitle?.textContent.trim() || 'Model';
        
        const imageElement = element.querySelector('img');
        const imageUrl = imageElement?.getAttribute('src') || '';

        // Prendiamo tutti i div con classe n7pqs3 direttamente
        const allMetrics = element.querySelectorAll('.mw-css-xlgty3 span');
        
        if (allMetrics.length >= 3) {
            // Nelle metriche che abbiamo, alcune sono nel primo dtg2n1 (likes, bookmarks)
            // e quelle che ci interessano sono nel secondo. Sappiamo che quelle che ci
            // interessano sono le ultime 3
            const lastThree = Array.from(allMetrics).slice(-3);
            
            const boostValue = lastThree[0]?.textContent || '0';
            const downloadValue = lastThree[1]?.textContent || '0';
            const printValue = lastThree[2]?.textContent || '0';

            const boost = this.parseNumber(boostValue);
            const downloads = this.parseNumber(downloadValue);
            const prints = this.parseNumber(printValue);

            currentValues.models[modelId] = {
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
            console.log(`Not enough metrics found for ${name} (found: ${allMetrics.length})`);
        }
      });

      return currentValues;
    } catch (error) {
      console.error('Error extracting values:', error);
      return null;
    }
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

  async getDailySummary() {
    const currentValues = this.getCurrentValues();
    if (!currentValues) {
      console.error('Unable to get current values');
      return null;
    }

    // Carica i dati del giorno precedente
    const previousDay = await new Promise((resolve) => {
      chrome.storage.local.get(['dailyStats'], (result) => {
        if (result.dailyStats && (Date.now() - result.dailyStats.timestamp) <= 24 * 60 * 60 * 1000) {
          resolve(result.dailyStats);
        } else {
          resolve(null);
        }
      });
    });

    // Salva i dati correnti per il prossimo confronto
    chrome.storage.local.set({
      dailyStats: {
        models: currentValues.models,
        points: currentValues.points,
        timestamp: Date.now()
      }
    });

    if (!previousDay) {
      console.log('No previous day data available');
      return {
        dailyDownloads: 0,
        dailyPrints: 0,
        points: currentValues.points,
        pointsGained: 0,
        top5Downloads: [],
        top5Prints: [],
        from: new Date().toLocaleString(),
        to: new Date().toLocaleString()
      };
    }

    // Calcola le differenze per ogni modello
    const modelChanges = {};
    for (const [id, current] of Object.entries(currentValues.models)) {
      const previous = previousDay.models[id] || { downloads: 0, prints: 0 };
      if (current.downloads > previous.downloads || current.prints > previous.prints) {
        modelChanges[id] = {
          name: current.name,
          downloadsGained: current.downloads - previous.downloads,
          printsGained: current.prints - previous.prints
        };
      }
    }

    // Calcola totali giornalieri
    const dailyDownloads = Object.values(modelChanges)
      .reduce((sum, model) => sum + model.downloadsGained, 0);
    const dailyPrints = Object.values(modelChanges)
      .reduce((sum, model) => sum + model.printsGained, 0);

    // Top 5 del giorno (solo modelli con cambiamenti)
    const top5Downloads = Object.values(modelChanges)
      .filter(m => m.downloadsGained > 0)
      .sort((a, b) => b.downloadsGained - a.downloadsGained)
      .slice(0, 5);

    const top5Prints = Object.values(modelChanges)
      .filter(m => m.printsGained > 0)
      .sort((a, b) => b.printsGained - a.printsGained)
      .slice(0, 5);

    return {
      dailyDownloads,
      dailyPrints,
      points: currentValues.points,
      pointsGained: currentValues.points - previousDay.points,
      top5Downloads,
      top5Prints,
      from: new Date(previousDay.timestamp).toLocaleString(),
      to: new Date().toLocaleString()
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
        const summary = await this.getDailySummary();
        if (summary) {
          const message = `
📊 24-Hour Summary (${summary.from} - ${summary.to}):
- New Downloads: ${summary.dailyDownloads}
- New Prints: ${summary.dailyPrints}
- Points: ${summary.points} (${summary.pointsGained >= 0 ? '+' : ''}${summary.pointsGained})

🏆 Today's Most Downloaded:
${summary.top5Downloads.map((m, i) => `${i + 1}. ${m.name}: +${m.downloadsGained}`).join('\n') || 'No new downloads today'}

🖨️ Today's Most Printed:
${summary.top5Prints.map((m, i) => `${i + 1}. ${m.name}: +${m.printsGained}`).join('\n') || 'No new prints today'}`;

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
      
      const currentValues = this.getCurrentValues();
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

Total: ${current.downloads}
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

Total: ${current.prints}
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
