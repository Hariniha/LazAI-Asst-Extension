// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { LazAIService } from './lazaiService';
// import { LazAIInlineCompletionProvider } from './inlineCompletionProvider'; // Disabled for now
import { LazAIChatProvider } from './chatProvider';
import { ChatDetector } from './chatDetector';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('LazAI Assistant extension is now active!');

	// Initialize services
	const lazaiService = new LazAIService();
	const chatProvider = new LazAIChatProvider(lazaiService);
	// const inlineCompletionProvider = new LazAIInlineCompletionProvider(lazaiService); // Disabled for now
	const chatDetector = new ChatDetector(chatProvider); // Re-enabled

	console.log('LazAI: Chat services initialized');

	// Inline completion provider disabled - user only wants chat features
	// const inlineCompletionDisposable = vscode.languages.registerInlineCompletionItemProvider(
	//     { pattern: '**' },
	//     inlineCompletionProvider
	// );
	
	console.log('LazAI: Inline completions disabled, chat features enabled');

	// Register commands
	const openChatCommand = vscode.commands.registerCommand('lazai.openChat', () => {
		chatProvider.openChatPanel();
	});

	const testConnectionCommand = vscode.commands.registerCommand('lazai.testConnection', async () => {
		if (!lazaiService.isConfigured()) {
			vscode.window.showErrorMessage('❌ API key not configured. Please set your Groq API key in settings.');
			return;
		}

		vscode.window.showInformationMessage('🧪 Testing LazAI connection...');
		
		try {
			const response = await lazaiService.chat({
				messages: [
					{ role: 'system', content: 'You are a test assistant.' },
					{ role: 'user', content: 'Say "Hello from LazAI!" to test the connection.' }
				],
				maxTokens: 50,
				temperature: 0.1
			});

			if (response.error) {
				vscode.window.showErrorMessage(`❌ Connection failed: ${response.error}`);
			} else {
				vscode.window.showInformationMessage(`✅ Connection successful! Response: ${response.text}`);
			}
		} catch (error) {
			vscode.window.showErrorMessage(`❌ Connection test failed: ${error}`);
		}
	});

	const clearHistoryCommand = vscode.commands.registerCommand('lazai.clearHistory', () => {
		console.log('Clear history command triggered from command palette');
		chatProvider.listSessions();
	});

	const newChatCommand = vscode.commands.registerCommand('lazai.newChat', () => {
		console.log('New chat command triggered');
		chatProvider.createNewChat();
	});

	const listSessionsCommand = vscode.commands.registerCommand('lazai.listSessions', () => {
		console.log('List sessions command triggered');
		chatProvider.listSessions();
	});

	const reinitializeAlithCommand = vscode.commands.registerCommand('lazai.reinitializeAlith', async () => {
		vscode.window.showInformationMessage('🔄 Reinitializing Alith connection...');
		try {
			// Create a new service instance to reinitialize
			const newLazaiService = new LazAIService();
			vscode.window.showInformationMessage('✅ Alith connection reinitialized successfully!');
		} catch (error) {
			vscode.window.showErrorMessage(`❌ Failed to reinitialize Alith: ${error}`);
		}
	});

	// Activate chat detector
	chatDetector.activate(context); // Re-enabled

	// Check if API key is configured on activation
	const config = vscode.workspace.getConfiguration('lazai');
	const useAlith = config.get<boolean>('useAlith', true);
	
	if (useAlith) {
		const privateKey = config.get<string>('privateKey');
		if (!privateKey) {
			vscode.window.showWarningMessage(
				'Alith private key not configured. Please set your wallet private key in the extension settings for decentralized AI.',
				'Open Settings'
			).then(selection => {
				if (selection === 'Open Settings') {
					vscode.commands.executeCommand('workbench.action.openSettings', 'lazai.privateKey');
				}
			});
		}
	} else {
		if (!lazaiService.isConfigured()) {
			vscode.window.showWarningMessage(
				'LazAI API key not configured. Please set your Groq API key in the extension settings.',
				'Open Settings'
			).then(selection => {
				if (selection === 'Open Settings') {
					vscode.commands.executeCommand('workbench.action.openSettings', 'lazai.apiKey');
				}
			});
		}
	}

	// Show status bar item
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.text = '$(robot) LazAI';
	statusBarItem.tooltip = 'Click to open LazAI Chat';
	statusBarItem.command = 'lazai.openChat';
	statusBarItem.show();

	// Add all disposables to context
	context.subscriptions.push(
		// inlineCompletionDisposable, // Disabled
		openChatCommand,
		testConnectionCommand,
		clearHistoryCommand,
		newChatCommand,
		listSessionsCommand,
		reinitializeAlithCommand
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
