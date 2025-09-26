# LazAI Assistant - AI-Powered VS Code Chat Extension

🎮 Commands

Access via Command Palette (`Ctrl+Shift+P`):

- **LazAI: Open LazAI Chat** - Open the chat panel
- **LazAI: New Chat Session** - Create a new chat conversation
- **LazAI: List Chat Sessions** - Switch between chat sessions
- **LazAI: Test API Connection** - Verify your API configuration
- **LazAI: Reinitialize Alith Connection** - Reset Alith connection

## 🛠️ Getting API Keys

### Groq API Key (Free)
1. Visit [console.groq.com](https://console.groq.com/)
2. Sign up for free account
3. Navigate to API Keys section
4. Create new API key
5. Copy key to VS Code settings

### Alith Private Key (Advanced)
1. Set up Alith wallet
2. Export your 64-character hex private key (no 0x prefix)
3. Add to VS Code settings
4. Ensure sufficient balance for AI requests

## 🎯 Perfect For

- **Developers** who want AI coding assistance
- **Students** learning programming concepts  
- **Teams** collaborating on code projects
- **Anyone** who needs quick programming help
- **Blockchain enthusiasts** wanting decentralized AI

## 🏗️ Technical Details

- **Built with TypeScript** for reliability
- **VS Code Extension API** for native integration
- **Dual backend architecture** for maximum uptime
- **Session management** for organized conversations
- **Smart comment detection** across programming languages
- **Lightweight** - minimal resource usage

---

**Made with ❤️ for the coding community**and for VS Code with dual backend support (Alith blockchain + Groq API).

## ✨ Features

### � Chat Panel
- **Beautiful chat interface** with dark blue gradient design
- **Session management** - Create and switch between named chat conversations
- **Context preservation** - Each session maintains conversation history
- **Markdown support** - Rich formatting for better readability

### 🎯 Inline Chat Commands
- **Type anywhere**: `// chat <your question>` in any file and press Enter
- **Multi-language support**: Works with `//`, `#`, `/* */` comment styles
- **Instant response** - Chat panel opens automatically with your question
- **Smart detection** - Recognizes chat commands in JavaScript, Python, HTML, etc.

### 🔗 Dual AI Backend
- **Alith Blockchain AI**: Decentralized, unlimited access (primary)
- **Groq API**: Fast, reliable cloud fallback (secondary)
- **Smart failover**: Automatically switches if primary service fails
- **Flexible configuration**: Use either service or both

## 🚀 Quick Start

### Installation
1. Install the extension from VS Code marketplace
2. Configure your AI service (see Configuration below)
3. Start chatting!

### Basic Usage

**Chat Panel:**
- Press `Ctrl+Shift+P`
- Type "LazAI: Open LazAI Chat"
- Start asking programming questions

**Inline Chat:**
```javascript
// chat how do I create a React component?
// Press Enter - chat opens with your question
```

```python  
# chat explain Python decorators
# Press Enter - chat opens automatically
```

**Ready to supercharge your coding with AI assistance? See [USAGE.md](USAGE.md) for simple setup instructions!**

