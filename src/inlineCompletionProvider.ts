import * as vscode from 'vscode';
import { LazAIService } from './lazaiService';

export class LazAIInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
    private lazaiService: LazAIService;
    private lastRequestTime: number = 0;
    private minRequestInterval: number = 2000; // 2 seconds between requests
    private pendingRequest: Promise<any> | null = null;

    constructor(lazaiService: LazAIService) {
        this.lazaiService = lazaiService;
    }

    async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[] | null> {
        // Check if the extension is enabled
        const config = vscode.workspace.getConfiguration('lazai');
        if (!config.get<boolean>('enabled')) {
            console.log('LazAI: Inline completions disabled');
            return null;
        }

        // Check if API is configured
        if (!this.lazaiService.isConfigured()) {
            console.log('LazAI: Service not configured');
            return null;
        }

        // Check if cancellation was requested
        if (token.isCancellationRequested) {
            console.log('LazAI: Completion cancelled');
            return null;
        }

        // Rate limiting - prevent too many requests
        const now = Date.now();
        if (now - this.lastRequestTime < this.minRequestInterval) {
            console.log('LazAI: Rate limiting - too soon since last request');
            return null;
        }

        // If there's already a pending request, don't make another one
        if (this.pendingRequest) {
            console.log('LazAI: Request already pending');
            return null;
        }

        console.log('LazAI: Attempting inline completion at', position);

        try {
            // Get context around the cursor
            const lineText = document.lineAt(position.line).text;
            const textBeforeCursor = lineText.substring(0, position.character);
            const textAfterCursor = lineText.substring(position.character);

            // Don't provide completions for empty lines or just whitespace
            if (textBeforeCursor.trim().length === 0) {
                console.log('LazAI: Skipping empty line');
                return null;
            }

            // Only trigger on meaningful code patterns
            if (!this.shouldTriggerCompletion(textBeforeCursor)) {
                console.log('LazAI: Skipping - not a meaningful trigger');
                return null;
            }

            // Get surrounding context (a few lines before and after)
            const contextLines = 5; // Reduced context to save tokens
            const startLine = Math.max(0, position.line - contextLines);
            const endLine = Math.min(document.lineCount - 1, position.line + contextLines);
            
            let contextText = '';
            for (let i = startLine; i <= endLine; i++) {
                if (i === position.line) {
                    // Mark the current position
                    contextText += document.lineAt(i).text.substring(0, position.character) + '<CURSOR>' + 
                                  document.lineAt(i).text.substring(position.character) + '\n';
                } else {
                    contextText += document.lineAt(i).text + '\n';
                }
            }

            const prompt = `Complete the code at the <CURSOR> position. Only provide the completion text that should be inserted at the cursor, no explanations, no context repetition:\n\n${contextText}`;

            const maxTokens = Math.min(config.get<number>('maxTokens') || 50, 50); // Reduced max tokens
            console.log('LazAI: Requesting completion with', maxTokens, 'max tokens');
            
            this.lastRequestTime = now;
            this.pendingRequest = this.lazaiService.getCompletion({
                prompt,
                maxTokens,
                temperature: 0.1
            });

            const completion = await this.pendingRequest;
            this.pendingRequest = null;

            console.log('LazAI: Received completion:', completion);

            if (completion.error || !completion.text) {
                console.log('LazAI: No valid completion received');
                if (completion.error && completion.error.includes('Rate limit')) {
                    vscode.window.showWarningMessage('⚠️ LazAI rate limit reached. Configure your private key to use Alith Agent.');
                }
                return null;
            }

            // Clean up the completion text
            let completionText = completion.text;
            
            // Remove the context if it was included in the response
            if (completionText.includes('<CURSOR>')) {
                const cursorIndex = completionText.indexOf('<CURSOR>');
                completionText = completionText.substring(cursorIndex + 8);
            }

            // Remove any leading/trailing whitespace and newlines
            completionText = completionText.trim();

            // If the completion is empty or too short, don't show it
            if (completionText.length === 0) {
                console.log('LazAI: Completion text is empty after processing');
                return null;
            }

            console.log('LazAI: Final completion text:', JSON.stringify(completionText));

            // Create the inline completion item
            const completionItem = new vscode.InlineCompletionItem(
                completionText,
                new vscode.Range(position, position)
            );

            return [completionItem];

        } catch (error) {
            // Log the error for debugging
            console.error('LazAI completion error:', error);
            this.pendingRequest = null;
            return null;
        }
    }

    private shouldTriggerCompletion(textBeforeCursor: string): boolean {
        // More flexible trigger patterns to improve user experience
        const triggers = [
            // Function declarations (more flexible)
            /function\s+\w*.*$/,                   // function name( or function name() { 
            /\w+\s*\(.*\)\s*[{=>\s]*$/,          // functionName() { or () => 
            
            // Assignments and declarations
            /=\s*$/,                              // variable = 
            /:\s*$/,                              // object property: 
            /const\s+\w+\s*=?\s*$/,              // const variable = 
            /let\s+\w+\s*=?\s*$/,                // let variable =
            /var\s+\w+\s*=?\s*$/,                // var variable =
            
            // Control structures
            /if\s*\(.*\).*$/,                    // if (condition) or if (condition) {
            /else.*$/,                           // else or else {
            /for\s*\(.*\).*$/,                   // for (init; condition; increment)
            /while\s*\(.*\).*$/,                 // while (condition)
            /switch\s*\(.*\).*$/,                // switch (variable)
            
            // Object/array operations
            /\.\w*$/,                            // object.property or object.method
            /\[\w*.*\].*$/,                      // array[index] or array["key"]
            
            // Return and control flow
            /return\s*.*$/,                      // return or return something
            /throw\s*.*$/,                       // throw or throw error
            /break\s*$/,                         // break
            /continue\s*$/,                      // continue
            
            // Class and structure
            /class\s+\w+.*$/,                    // class ClassName
            /extends\s+\w+.*$/,                  // extends BaseClass
            /implements\s+\w+.*$/,               // implements Interface
            
            // Import/export
            /import\s+.*$/,                      // import statements
            /export\s+.*$/,                      // export statements
            /from\s+.*$/,                        // from "module"
            
            // Comments and documentation
            /\/\/\s*\w*/,                        // // comments
            /\/\*\*?\s*\w*/,                     // /* or /** comments
            
            // Common patterns
            /\{\s*$/,                            // opening brace {
            /\w+\s*$/,                          // any word (more permissive)
            /;\s*$/,                            // after semicolon
        ];

        const trimmedText = textBeforeCursor.trim();
        
        // Skip completely empty lines or only whitespace
        if (trimmedText.length === 0) {
            return false;
        }
        
        // Skip very short inputs (less than 2 characters)
        if (trimmedText.length < 2) {
            return false;
        }

        return triggers.some(trigger => trigger.test(textBeforeCursor));
    }
}