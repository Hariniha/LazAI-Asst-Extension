import * as vscode from 'vscode';
import { LazAIChatProvider } from './chatProvider';

export class ChatDetector {
    private chatProvider: LazAIChatProvider;
    private disposables: vscode.Disposable[] = [];

    constructor(chatProvider: LazAIChatProvider) {
        this.chatProvider = chatProvider;
    }

    public activate(context: vscode.ExtensionContext) {
        // Listen for text document changes
        const changeDisposable = vscode.workspace.onDidChangeTextDocument(
            this.onDocumentChange.bind(this)
        );

        this.disposables.push(changeDisposable);
        context.subscriptions.push(...this.disposables);
    }

    private async onDocumentChange(event: vscode.TextDocumentChangeEvent) {
        const config = vscode.workspace.getConfiguration('lazai');
        if (!config.get<boolean>('chatEnabled')) {
            return;
        }

        const document = event.document;
        const activeEditor = vscode.window.activeTextEditor;

        if (!activeEditor || activeEditor.document !== document) {
            return;
        }

        for (const change of event.contentChanges) {
            const text = change.text;
            const range = change.range;

            // Check if the user pressed Enter (new line) after typing something with "chat"
            if (text === '\n' || text === '\r\n') {
                const lineText = document.lineAt(range.start.line).text;
                const trimmedLine = lineText.trim();
                
                // Check if the line contains "chat " followed by a question
                const chatMatch = trimmedLine.match(/^(\s*(?:\/\/\s*|#\s*)?)\s*chat\s+(.+)$/i);
                if (chatMatch) {
                    const question = chatMatch[2].trim();
                    if (question.length > 0) {
                        // Wait a bit for the newline to be processed
                        setTimeout(() => {
                            this.handleChatTrigger(document, range.start.line, question, lineText);
                        }, 100);
                    }
                }
            }
        }
    }

    private async handleChatTrigger(document: vscode.TextDocument, line: number, question: string, originalLineText: string) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            console.log('LazAI: No active editor for chat trigger');
            return;
        }

        try {
            console.log('LazAI: Handling chat trigger:', question);
            
            // Validate line number
            if (line < 0 || line >= document.lineCount) {
                console.error('LazAI: Invalid line number:', line);
                return;
            }

            // Remove the "chat " line
            await editor.edit(editBuilder => {
                const lineRange = new vscode.Range(
                    new vscode.Position(line, 0),
                    new vscode.Position(line, originalLineText.length)
                );
                editBuilder.delete(lineRange);
            });

            // Create a valid position (ensure it's within document bounds)
            const validLine = Math.max(0, Math.min(line, document.lineCount - 1));
            const position = new vscode.Position(validLine, 0);

            // Process the chat query
            await this.chatProvider.handleInlineChatQuery(
                question, 
                document, 
                position
            );

        } catch (error) {
            console.error('LazAI: Chat detection error:', error);
            vscode.window.showErrorMessage(`Chat detection error: ${error}`);
        }
    }

    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }
}