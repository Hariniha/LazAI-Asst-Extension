# 🚀 LazAI Usage Guide - Quick Start

Simple instructions to get AI coding assistance in VS Code.

## ⚡ Quick Setup (2 minutes)

### Step 1: Get API Key
1. Go to [console.groq.com/keys](https://console.groq.com/keys)
2. Sign up (free) and create an API key
3. Copy the key (starts with `gsk_...`)

### Step 2: Configure VS Code
1. Open Settings: `Ctrl+,` (Windows) or `Cmd+,` (Mac)
2. Search: **"LazAI"**
3. Set these values:
   - **LazAI: Api Key** = `gsk_your_key_here`
   - **LazAI: Use Alith** = `false` (use Groq)
   - **LazAI: Enabled** = `true`

### Step 3: Start Coding!
Open any `.js`, `.py`, `.ts` file and start typing!

---

## 🎯 How to Use

### 1. 👻 Inline Completions (Ghost Text)

**What it does:** Shows AI suggestions as gray text while you type

**How to use:**
1. **Type code** in any supported file
2. **Pause for 2-3 seconds**
3. **Gray ghost text** appears with suggestions
4. **Press Tab** to accept, **Esc** to dismiss

**Examples that trigger completions:**
```javascript
function calculate() {
    // ← Ghost text appears here

const result = 
    // ← Suggestion appears here

if (true) {
    // ← AI suggests what goes here
```

### 2. 💬 Inline Chat

**What it does:** Ask questions directly in your code

**How to use:**
1. **Type:** `chat how do I create a loop`
2. **Press Enter**
3. **AI answer** appears as a comment in your code

**Example:**
```javascript
// You type this:
chat how do I create a for loop in JavaScript

// AI responds with:
// To create a for loop in JavaScript:
// for (let i = 0; i < 10; i++) {
//     console.log(i);
// }
```

### 3. 🗨️ Chat Panel

**What it does:** Open a dedicated chat window for longer conversations

**How to use:**
1. **Press:** `Ctrl+Shift+P`
2. **Type:** "LazAI: Open Chat"
3. **Ask questions** in the blue chat panel

---

## 🔧 Commands Available

Open Command Palette (`Ctrl+Shift+P`) and use:

- **"LazAI: Open Chat"** - Open chat window
- **"LazAI: Test API Connection"** - Check if setup works
- **"LazAI: Toggle Completions"** - Turn on/off ghost text

---

## 🐛 Troubleshooting

### No ghost text appearing?
1. **Check Settings:** Make sure API key is set and `LazAI: Enabled = true`
2. **Wait:** Ghost text takes 2-3 seconds to appear
3. **Use trigger patterns:** Type `function test() {` and wait
4. **Check file type:** Works with `.js`, `.py`, `.ts`, `.html`, `.css` files

### "API key not configured" error?
1. **Get Groq API key:** [console.groq.com/keys](https://console.groq.com/keys)
2. **Add to settings:** Search "LazAI" in VS Code settings
3. **Set LazAI: Api Key** to your key

### Chat not working?
1. **Try command:** `Ctrl+Shift+P` → "LazAI: Open Chat"
2. **For inline chat:** Type `chat your question` and press Enter
3. **Check API key** is configured correctly

---

## 🎊 You're Ready!

That's it! You now have:
- ✅ **AI completions** as you type (like GitHub Copilot)
- ✅ **Instant answers** to coding questions
- ✅ **Chat interface** for longer conversations
- ✅ **Multi-language support** for all popular languages

**Happy coding with AI assistance!** 🚀

---

