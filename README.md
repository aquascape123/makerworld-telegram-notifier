# MakerWorld Monitor

A Chrome extension that tracks your MakerWorld models' performance and sends notifications via Telegram.

## Features
- Real-time monitoring of:
  - Downloads
  - Prints
  - Boosts
  - Points
- Automated notifications for:
  - New downloads (with point tracking)
  - New prints (with 2x point multiplier)
  - New boosts
  - Point rewards
- Daily summary reports including:
  - Total downloads and prints
  - Current points
  - Top 5 most downloaded models
  - Top 5 most printed models
- Configurable refresh intervals (5min to 1hr)
- Image previews in notifications
- Point reward tracking system with dynamic intervals (10, 25, 50, or 100 points)

## Requirements
- Chrome or Chromium-based browser
- **Recommended Setup**: Raspberry Pi running Chromium
  - Perfect for 24/7 monitoring since the webpage needs to stay open
  - Low power consumption
  - Headless operation possible
- Telegram account and bot token (create one through [BotFather](https://t.me/botfather) if you don't have it)

## Installation
1. Download and extract the repository
2. Open Chrome's Extension Management page (`chrome://extensions`)
3. Enable Developer Mode
4. Click "Load unpacked" and select the extracted folder

## Configuration
1. Click the extension icon
2. Configure Telegram:
   - Create a new bot with [BotFather](https://t.me/botfather) if needed:
     1. Start a chat with BotFather
     2. Send `/newbot` command
     3. Follow instructions to set name and username
     4. Copy the provided token
   - Enter your bot token and chat ID
3. Set your preferred refresh interval
4. Configure daily report settings:
   - Enable/disable daily summaries
   - Set preferred notification time
5. Click Save

## Raspberry Pi Setup Tips
- Use Raspberry Pi OS Lite for minimal resource usage
- Install Chromium: `sudo apt install chromium-browser`
- Set up auto-login and browser autostart
- Configure system to prevent sleep/display shutdown
- Use a stable internet connection

## Support
If you find this extension helpful, consider supporting my work:
[🚀 My MakerWorld Profile](https://makerworld.com/en/@aquascape)

## License
MIT