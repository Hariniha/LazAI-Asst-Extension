import * as vscode from 'vscode';
import { LazAIService, ChatMessage } from './lazaiService';

export class LazAIChatProvider {
    private lazaiService: LazAIService;
    private panel: vscode.WebviewPanel | undefined;

    constructor(lazaiService: LazAIService) {
        this.lazaiService = lazaiService;
    }

    public openChatPanel() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'lazaiChat',
            'LazAI Chat',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getWebviewContent();

        this.panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'sendMessage':
                        await this.handleChatMessage(message.text);
                        break;
                }
            }
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    private async handleChatMessage(userMessage: string) {
        if (!this.panel) {
            return;
        }

        // Check if API is configured
        if (!this.lazaiService.isConfigured()) {
            this.panel.webview.postMessage({
                command: 'addMessage',
                message: {
                    role: 'assistant',
                    content: '❌ **API Key Missing**\n\nPlease configure your LazAI API key in VS Code settings:\n1. Press `Ctrl+,` to open Settings\n2. Search for "LazAI"\n3. Enter your Groq API key in "LazAI: Api Key"\n\nGet your free API key at: https://console.groq.com/keys'
                }
            });
            return;
        }

        try {
            // Show typing indicator
            this.panel.webview.postMessage({
                command: 'showTyping'
            });

            console.log('LazAI: Sending chat request:', userMessage);

            const messages: ChatMessage[] = [
                {
                    role: 'system',
                    content: 'You are LazAI, a helpful programming assistant. Provide clear, concise, and helpful responses to programming questions. Format code blocks properly with syntax highlighting.'
                },
                {
                    role: 'user',
                    content: userMessage
                }
            ];

            const response = await this.lazaiService.chat({
                messages,
                maxTokens: 1000,
                temperature: 0.7
            });

            console.log('LazAI: Received response:', response);

            // Hide typing indicator
            this.panel.webview.postMessage({
                command: 'hideTyping'
            });

            if (response.error) {
                this.panel.webview.postMessage({
                    command: 'addMessage',
                    message: {
                        role: 'assistant',
                        content: `❌ **Error**: ${response.error}\n\nPlease check:\n- Your API key is valid\n- You have sufficient API credits\n- Your internet connection is working`
                    }
                });
            } else {
                this.panel.webview.postMessage({
                    command: 'addMessage',
                    message: {
                        role: 'assistant',
                        content: response.text
                    }
                });
            }
        } catch (error) {
            console.error('LazAI Chat Error:', error);
            
            // Hide typing indicator
            this.panel.webview.postMessage({
                command: 'hideTyping'
            });

            this.panel.webview.postMessage({
                command: 'addMessage',
                message: {
                    role: 'assistant',
                    content: `❌ **Unexpected Error**: ${error instanceof Error ? error.message : String(error)}`
                }
            });
        }
    }

    public async handleInlineChatQuery(query: string, document: vscode.TextDocument, position: vscode.Position) {
        if (!this.lazaiService.isConfigured()) {
            vscode.window.showErrorMessage('Please configure your LazAI API key in the settings first.');
            return;
        }

        try {
            // Get some context from the document
            const contextLines = 5;
            const startLine = Math.max(0, position.line - contextLines);
            const endLine = Math.min(document.lineCount - 1, position.line + contextLines);
            
            let contextText = '';
            for (let i = startLine; i <= endLine; i++) {
                contextText += document.lineAt(i).text + '\n';
            }

            const messages: ChatMessage[] = [
                {
                    role: 'system',
                    content: 'You are a helpful programming assistant. Answer the user\'s question based on the provided code context. Be concise and relevant. Provide code examples when helpful.'
                },
                {
                    role: 'user',
                    content: `Context:\n\`\`\`\n${contextText}\n\`\`\`\n\nQuestion: ${query}`
                }
            ];

            // Show progress
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "LazAI is thinking...",
                cancellable: false
            }, async () => {
                const response = await this.lazaiService.chat({
                    messages,
                    maxTokens: 500,
                    temperature: 0.7
                });

                if (response.error) {
                    vscode.window.showErrorMessage(`LazAI Error: ${response.error}`);
                } else {
                    // Insert both the question and response as comments at the current position
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        const languageId = document.languageId;
                        const commentPrefix = this.getCommentPrefix(languageId);
                        
                        // Format the question
                        const questionText = `${commentPrefix} Question: ${query}`;
                        
                        // Format the response - split by lines and add comment prefix to each
                        const responseLines = response.text.split('\n');
                        const formattedResponse = responseLines
                            .map(line => `${commentPrefix} ${line}`)
                            .join('\n');
                        
                        // Add separator
                        const separator = `${commentPrefix} ${'-'.repeat(50)}`;
                        
                        // Combine everything
                        const fullComment = `\n${questionText}\n${separator}\n${formattedResponse}\n${separator}\n`;

                        await editor.edit(editBuilder => {
                            editBuilder.insert(position, fullComment);
                        });
                    }
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private getCommentPrefix(languageId: string): string {
        const singleLineComments: { [key: string]: string } = {
            'javascript': '//',
            'typescript': '//',
            'python': '#',
            'java': '//',
            'csharp': '//',
            'cpp': '//',
            'c': '//',
            'go': '//',
            'rust': '//',
            'php': '//',
            'ruby': '#',
            'shell': '#',
            'powershell': '#',
            'yaml': '#',
            'dockerfile': '#'
        };

        return singleLineComments[languageId] || '//';
    }

    private getWebviewContent(): string {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LazAI Chat</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background: linear-gradient(135deg, #0f1419 0%, #1a2332 50%, #243447 100%);
            color: #e1e5eb;
            margin: 0;
            padding: 10px;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        #chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 15px;
            border: 1px solid #2d3748;
            border-radius: 10px;
            margin-bottom: 15px;
            background: rgba(26, 35, 50, 0.6);
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        
        .message {
            margin-bottom: 20px;
            padding: 15px;
            border-radius: 12px;
            position: relative;
            animation: fadeInUp 0.3s ease-out;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .user-message {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            margin-left: 40px;
            border-left: 4px solid #3b82f6;
            box-shadow: 0 2px 10px rgba(37, 99, 235, 0.3);
        }
        
        .assistant-message {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            margin-right: 40px;
            border-left: 4px solid #06b6d4;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }
        
        .message-role {
            font-weight: bold;
            margin-bottom: 8px;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .user-message .message-role {
            color: #93c5fd;
        }
        
        .assistant-message .message-role {
            color: #67e8f9;
        }
        
        .message-content {
            white-space: pre-wrap;
            word-break: break-word;
            line-height: 1.6;
            color: #f1f5f9;
        }
        
        .message-content code {
            background: rgba(15, 23, 42, 0.8);
            color: #fbbf24;
            padding: 3px 6px;
            border-radius: 4px;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 13px;
            border: 1px solid #374151;
        }
        
        .message-content pre {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            font-family: 'Consolas', 'Monaco', monospace;
            border: 1px solid #334155;
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .message-content pre code {
            background: transparent;
            color: #e2e8f0;
            border: none;
            padding: 0;
        }
        
        #input-container {
            display: flex;
            gap: 12px;
            padding: 5px;
            background: rgba(26, 35, 50, 0.4);
            border-radius: 10px;
            backdrop-filter: blur(10px);
        }
        
        #message-input {
            flex: 1;
            padding: 12px 16px;
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            color: #f1f5f9;
            border: 2px solid #475569;
            border-radius: 8px;
            font-size: 14px;
            transition: all 0.3s ease;
        }
        
        #message-input:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
        }
        
        #message-input::placeholder {
            color: #94a3b8;
        }
        
        #send-button {
            padding: 12px 20px;
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
        }
        
        #send-button:hover {
            background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
        }
        
        #send-button:active {
            transform: translateY(0);
        }
        
        #send-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .typing-indicator {
            font-style: italic;
            color: #94a3b8;
            padding: 15px;
            background: rgba(30, 41, 59, 0.5);
            border-radius: 8px;
            border-left: 4px solid #06b6d4;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        
        /* Custom scrollbar */
        #chat-container::-webkit-scrollbar {
            width: 8px;
        }
        
        #chat-container::-webkit-scrollbar-track {
            background: rgba(15, 23, 42, 0.5);
            border-radius: 4px;
        }
        
        #chat-container::-webkit-scrollbar-thumb {
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            border-radius: 4px;
        }
        
        #chat-container::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        }
    </style>
</head>
<body>
    <div id="chat-container"></div>
    <div id="input-container">
        <input type="text" id="message-input" placeholder="Ask LazAI anything..." />
        <button id="send-button">Send</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        document.getElementById('send-button').addEventListener('click', sendMessage);
        document.getElementById('message-input').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        function sendMessage() {
            const input = document.getElementById('message-input');
            const message = input.value.trim();
            
            if (message) {
                addMessage('user', message);
                input.value = '';
                vscode.postMessage({
                    command: 'sendMessage',
                    text: message
                });
                
                document.getElementById('send-button').disabled = true;
            }
        }
        
        function addMessage(role, content) {
            const container = document.getElementById('chat-container');
            const messageDiv = document.createElement('div');
            messageDiv.className = role + '-message message';
            
            const roleDiv = document.createElement('div');
            roleDiv.className = 'message-role';
            roleDiv.textContent = role === 'user' ? 'You' : 'LazAI';
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.innerHTML = formatContent(content);
            
            messageDiv.appendChild(roleDiv);
            messageDiv.appendChild(contentDiv);
            container.appendChild(messageDiv);
            
            container.scrollTop = container.scrollHeight;
        }
        
        function formatContent(content) {
            // Simple markdown-like formatting - fix the regex escaping
            return content
                .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>')
                .replace(/\`([^\`]*)\`/g, '<code>$1</code>');
        }
        
        let typingIndicator = null;
        
        function showTyping() {
            if (!typingIndicator) {
                const container = document.getElementById('chat-container');
                typingIndicator = document.createElement('div');
                typingIndicator.className = 'typing-indicator';
                typingIndicator.textContent = 'LazAI is typing...';
                container.appendChild(typingIndicator);
                container.scrollTop = container.scrollHeight;
            }
        }
        
        function hideTyping() {
            if (typingIndicator) {
                typingIndicator.remove();
                typingIndicator = null;
            }
            document.getElementById('send-button').disabled = false;
        }
        
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'addMessage':
                    addMessage(message.message.role, message.message.content);
                    break;
                case 'showTyping':
                    showTyping();
                    break;
                case 'hideTyping':
                    hideTyping();
                    break;
            }
        });
        
        addMessage('assistant', 'Hello! I am LazAI, your programming assistant. Ask me anything about code, programming concepts, or get help with your development tasks.');
    </script>
</body>
</html>`;
        
        return html;
    }
}