class ValueMonitor {
  constructor(config) {
    this.telegramToken = config.telegramToken;
    this.chatId = config.chatId;
    this.refreshInterval = config.refreshInterval || 900000; // Default 15 minutes
    this.previousValues = {};

    // Carica i valori precedenti dal localStorage
    this.loadPreviousValues();
  }

  loadPreviousValues() {
    // Carica i valori precedenti dal localStorage
    const storedValues = localStorage.getItem('trackedModelValues');
    this.previousValues = storedValues ? JSON.parse(storedValues) : {
      models: {},
      points: 0,
      lastNotificationTime: 0
    };
  }

  saveValues() {
    // Salva i valori correnti nel localStorage
    localStorage.setItem('trackedModelValues', JSON.stringify(this.previousValues));
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

      return true;
    } catch (err) {
      console.error('Network or processing error:', err);
      return false;
    }
  }

  async sendTelegramPhoto(message, photoUrl) {
    try {
      const formData = new FormData();
      formData.append('chat_id', this.chatId);
      formData.append('caption', message);
      
      // Fetch the image and convert to blob
      const imageResponse = await fetch(photoUrl);
      const imageBlob = await imageResponse.blob();
      formData.append('photo', imageBlob, 'model_image.jpg');

      const response = await fetch(`https://api.telegram.org/bot${this.telegramToken}/sendPhoto`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Telegram Photo Error:', errorText);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Network or processing error:', err);
      return false;
    }
  }

  getCurrentValues() {
    try {
      const downloadElements = document.querySelectorAll('[data-trackid]');
      const currentValues = {
        models: {},
        points: 0
      };
  
      downloadElements.forEach((element) => {
        const modelId = element.getAttribute('data-trackid');
        
        // Estrai solo il nome del modello, rimuovendo altri dettagli
        const fullText = element.textContent.trim();
        const modelName = fullText.split(/\d/)[0].trim();
        
        // Find download and prints elements
        const printsDiv = element.querySelector("div.download_count");
        const sibs = this.getSiblings(printsDiv);
        const downloadsDiv = sibs[sibs.length-1];
  
        // Extract numeric values
        const printsStr = printsDiv.querySelector("span").textContent;
        const downloadsStr = downloadsDiv.querySelector("span").textContent;
        
        const numPrints = this.strToNumber(printsStr);
        const numDownloads = this.strToNumber(downloadsStr);
  
        currentValues.models[modelId] = {
          name: modelName,
          prints: numPrints,
          downloads: numDownloads
        };
      });

      // Extract points information
      const pointsElement = document.evaluate(
        '//*[@id="userInfo_wrap"]/div[4]/div/a/div/div/span/span',
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;

      currentValues.points = parseFloat(pointsElement.textContent.replace(',', '.'));

      return currentValues;
    } catch (error) {
      console.error('Error during value extraction:', error);
      return null;
    }
  }

  // Utility methods
  strToNumber(inVal) {
    const groups = /(\d+)\.?(\d+)?\sk/.exec(inVal);
    if (groups && groups[1]) {
      let val = Number(groups[1] * 1000);
      if (groups[2]) {
        val += Number(groups[2] * 100);
      }
      return val;
    }
    return Number(inVal);
  }

  getSiblings(elem) {
    return Array.from(elem.parentNode.childNodes).filter((s) => s !== elem);
  }

  async checkAndNotify() {
    const currentValues = this.getCurrentValues();

    if (!currentValues) {
      console.error('Unable to get current values');
      return;
    }

    // Flag per verificare se ci sono state modifiche
    let hasChanges = false;

    // Controlla i download per ogni modello
    for (const [modelId, modelData] of Object.entries(currentValues.models)) {
      const prevModelData = this.previousValues.models[modelId] || {};

      // Controlla download
      if (modelData.downloads > (prevModelData.downloads || 0)) {
        const increase = modelData.downloads - (prevModelData.downloads || 0);
        
        // Trova l'elemento del modello per estrarre l'URL dell'immagine
        const modelElement = document.querySelector(`[data-trackid="${modelId}"]`);
        const imageUrl = modelElement ? modelElement.querySelector('img')?.src : null;

        const message = `🔥 New Downloads for Model: ${modelData.name}
Previous: ${prevModelData.downloads || 0}
Current: ${modelData.downloads}
Increase: +${increase}`;

        if (imageUrl) {
          await this.sendTelegramPhoto(message, imageUrl);
        } else {
          await this.sendTelegramMessage(message);
        }
        
        hasChanges = true;
      }

      // Controlla prints
      if (modelData.prints > (prevModelData.prints || 0)) {
        const increase = modelData.prints - (prevModelData.prints || 0);
        
        // Trova l'elemento del modello per estrarre l'URL dell'immagine
        const modelElement = document.querySelector(`[data-trackid="${modelId}"]`);
        const imageUrl = modelElement ? modelElement.querySelector('img')?.src : null;

        const message = `📄 New Prints for Model ${modelData.name}:
Previous: ${prevModelData.prints || 0}
Current: ${modelData.prints}
Increase: +${increase}`;

        if (imageUrl) {
          await this.sendTelegramPhoto(message, imageUrl);
        } else {
          await this.sendTelegramMessage(message);
        }
        
        hasChanges = true;
      }

      // Aggiorna i valori precedenti
      this.previousValues.models[modelId] = modelData;
    }

    // Controlla punti
    if (currentValues.points > this.previousValues.points) {
      const pointsIncrease = currentValues.points - this.previousValues.points;
      await this.sendTelegramMessage(`⭐️ New Points!
Previous: ${this.previousValues.points}
Current: ${currentValues.points} 
Increase: +${pointsIncrease.toFixed(1)}`);
      
      hasChanges = true;
      this.previousValues.points = currentValues.points;
    }

    // Salva i valori solo se ci sono state modifiche
    if (hasChanges) {
      this.saveValues();
    }
  }

  getDailySummary() {
    const currentValues = this.getCurrentValues();

    if (!currentValues) {
        console.error('Unable to get current values');
        return null;
    }

    // Calcola i totali
    const totalDownloads = Object.values(currentValues.models).reduce((sum, model) => sum + model.downloads, 0);
    const totalPrints = Object.values(currentValues.models).reduce((sum, model) => sum + model.prints, 0);

    // Ottieni la Top 5
    const top5Downloads = Object.values(currentValues.models)
        .sort((a, b) => b.downloads - a.downloads)
        .slice(0, 5);
    const top5Prints = Object.values(currentValues.models)
        .sort((a, b) => b.prints - a.prints)
        .slice(0, 5);

    return { totalDownloads, totalPrints, top5Downloads, top5Prints };
  }

  scheduleDailyNotification() {
    chrome.storage.sync.get(['dailyReport', 'dailyNotificationTime'], (config) => {
        const dailyReport = config.dailyReport || 'yes';
        if (dailyReport === 'no') {
            console.log('[INFO] Daily report is disabled.');
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
        console.log(`[INFO] Daily notification scheduled at ${nextNotification}. Delay: ${delay} ms`);

        setTimeout(async () => {
            console.log(`[INFO] Triggering daily notification at ${new Date()}`);

            const summary = this.getDailySummary();
            if (summary) {
                const message = `
📊 Daily Summary:
- Total Downloads: ${summary.totalDownloads}
- Total Prints: ${summary.totalPrints}

🏆 Top 5 Downloads:
${summary.top5Downloads.map((m, i) => `${i + 1}. ${m.name}: ${m.downloads}`).join('\n')}

🏅 Top 5 Prints:
${summary.top5Prints.map((m, i) => `${i + 1}. ${m.name}: ${m.prints}`).join('\n')}
                `;
                await this.sendTelegramMessage(message);
            } else {
                console.error('[ERROR] Failed to generate daily summary.');
            }

            this.scheduleDailyNotification();
        }, delay);
    });
  }

  start() {
    chrome.storage.sync.get(['telegramToken', 'chatId', 'refreshInterval'], (config) => {
        if (config.telegramToken && config.chatId) {
            this.telegramToken = config.telegramToken;
            this.chatId = config.chatId;
            this.refreshInterval = config.refreshInterval || 900000;

            this.checkAndNotify(); // Controllo immediato
            this.scheduleDailyNotification(); // Pianifica la notifica giornaliera

            this.timer = setInterval(() => this.checkAndNotify(), 60000);
            console.log('[INFO] Monitoring started');
        } else {
            console.error('[ERROR] Telegram configuration missing. Please set up in extension options.');
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

// Inizializza il monitor quando la pagina carica
const monitor = new ValueMonitor({});
monitor.start();