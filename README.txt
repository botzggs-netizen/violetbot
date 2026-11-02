VIOLET BOT — STARTER 1.0

Requirements:
- Windows 10/11
- Node.js 20 or newer
- WhatsApp account you own

SETUP
1. Extract this folder somewhere convenient, for example:
   C:\VioletBot

2. Open the folder in VS Code.

3. Open Terminal > New Terminal, then run:
   npm install

4. Open config.json and replace:
   "628xxxxxxxxxx"
   with your WhatsApp number in international format, digits only.
   Example: 6281234567890

5. Run:
   npm start

6. Scan the QR code using WhatsApp > Settings > Linked devices > Link a device.

7. After the terminal says the bot is connected, send:
   .boton
   from the authorized owner account, then:
   .menu

MENU IMAGE
Put your own bot image at:
   assets/menu-banner.jpg

If that file exists, .menu sends it with the menu as its caption.
If it does not exist, .menu sends text only.

AUTHORIZED NUMBERS
Add more numbers in config.json:
"authorizedNumbers": ["6281111111111", "6282222222222"]

IMPORTANT
- The bot starts in OFF state every time the program launches.
- While OFF, only .boton and .botoff are handled.
- Close the terminal or press Ctrl+C to stop the program.
- This is an unofficial WhatsApp Web automation library, not an official WhatsApp API.
  Use only with an account you own, avoid spam, and be aware that unofficial automation
  can cause account restrictions.
- Pixiv, Pinterest, lyrics and audio search are placeholders in this first starter.
  We'll connect them one by one after the WhatsApp connection and basic commands work.
- The initial version handles private chats only. Self-chat behavior can vary by WhatsApp
  client/library version; test it after linking. If your own sent commands do not arrive
  as events, use a separate authorized number to control the bot.
