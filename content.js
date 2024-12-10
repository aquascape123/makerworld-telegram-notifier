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
        await this.sendTelegramMessage(`🔥 New Downloads for Model ${modelData.name}:
Previous: ${prevModelData.downloads || 0}
Current: ${modelData.downloads}
Increase: +${increase}`);
        
        hasChanges = true;
      }

      // Controlla prints
      if (modelData.prints > (prevModelData.prints || 0)) {
        const increase = modelData.prints - (prevModelData.prints || 0);
        await this.sendTelegramMessage(`📄 New Prints for Model ${modelData.name}:
Previous: ${prevModelData.prints || 0}
Current: ${modelData.prints}
Increase: +${increase}`);
        
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

  start() {
    // Carica configurazione da chrome storage
    chrome.storage.sync.get(['telegramToken', 'chatId', 'refreshInterval'], (config) => {
      if (config.telegramToken && config.chatId) {
        this.telegramToken = config.telegramToken;
        this.chatId = config.chatId;
        this.refreshInterval = config.refreshInterval || 900000;

        // Controlla immediatamente all'avvio
        this.checkAndNotify();

        // Avvia il monitoraggio
        this.timer = setInterval(() => this.checkAndNotify(), 60000);
        console.log('Monitoring started');

        // Intervallo di refresh pagina
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

// Inizializza il monitor quando la pagina carica
const monitor = new ValueMonitor({});
monitor.start();
