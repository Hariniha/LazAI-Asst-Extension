import * as vscode from 'vscode';

// Alith imports
let ChainConfig: any, Client: any, Agent: any;
try {
    const alithLazai = require('alith/lazai');
    const alithAgent = require('alith');
    ChainConfig = alithLazai.ChainConfig;
    Client = alithLazai.Client;
    Agent = alithAgent.Agent;
} catch (error) {
    console.warn('Alith not available, falling back to direct API calls');
}

export interface CompletionRequest {
    prompt: string;
    maxTokens?: number;
    temperature?: number;
}

export interface CompletionResponse {
    text: string;
    error?: string;
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ChatRequest {
    messages: ChatMessage[];
    maxTokens?: number;
    temperature?: number;
}

export class LazAIService {
    private readonly baseUrl = 'https://api.groq.com/openai/v1';
    private alithClient: any = null;
    private alithAgent: any = null;

    constructor() {
        this.initializeAlith();
    }

    private async initializeAlith() {
        const config = vscode.workspace.getConfiguration('lazai');
        const useAlith = config.get<boolean>('useAlith', true);
        let privateKey = config.get<string>('privateKey');
        
        console.log('LazAI: Initializing Alith...', { useAlith, hasPrivateKey: !!privateKey, hasChainConfig: !!ChainConfig });
        
        if (useAlith && privateKey && ChainConfig && Client && Agent) {
            try {
                // Clean and validate the private key
                privateKey = privateKey.trim();
                
                // Remove 0x prefix if present
                if (privateKey.startsWith('0x')) {
                    privateKey = privateKey.slice(2);
                }
                
                // Validate private key format (should be 64 hex characters)
                if (!/^[0-9a-fA-F]{64}$/.test(privateKey)) {
                    throw new Error(`Invalid private key format. Expected 64 hex characters, got: ${privateKey.length} characters`);
                }
                
                // Add 0x prefix back
                privateKey = '0x' + privateKey;
                
                console.log('LazAI: Setting private key in environment');
                process.env.PRIVATE_KEY = privateKey;
                
                console.log('LazAI: Creating Alith client');
                this.alithClient = new Client(ChainConfig.testnet());
                console.log('LazAI: Alith client created');
                
                console.log('LazAI: Getting wallet address');
                const walletAddress = this.alithClient.getWallet().address;
                console.log('LazAI: Wallet address:', walletAddress);
                
                console.log('LazAI: Getting user info');
                await this.alithClient.getUser(walletAddress);
                console.log('LazAI: User retrieved');
                
                const nodeAddress = config.get<string>('nodeAddress', '0xc3e98E8A9aACFc9ff7578C2F3BA48CA4477Ecf49');
                const fileId = config.get<number>('fileId', 10);
                
                console.log('LazAI: Getting node info for:', nodeAddress);
                const nodeInfo = await this.alithClient.getInferenceNode(nodeAddress);
                const url = nodeInfo.url;
                console.log('LazAI: Node URL:', url);
                
                console.log('LazAI: Creating Alith Agent');
                this.alithAgent = new Agent({
                    baseUrl: `${url}/v1`,
                    model: this.getModel(),
                    extraHeaders: await this.alithClient.getRequestHeaders(nodeAddress, BigInt(fileId)),
                });
                
                console.log('LazAI: Alith Agent initialized successfully');
                vscode.window.showInformationMessage('✅ Alith Agent connected successfully!');
            } catch (error) {
                console.error('LazAI: Failed to initialize Alith Agent:', error);
                let errorMessage = 'Unknown error';
                
                if (error instanceof Error) {
                    errorMessage = error.message;
                    
                    // Provide specific guidance for common errors
                    if (errorMessage.includes('Invalid private key format')) {
                        errorMessage += '\n\nPlease ensure your private key is:\n- 64 hexadecimal characters long\n- Without spaces or special characters\n- Example: abc123def456... (64 chars total)';
                    } else if (errorMessage.includes('InvalidPrivateKeyError')) {
                        errorMessage = 'Invalid private key format. Please check that your private key is exactly 64 hexadecimal characters (0-9, a-f, A-F) without the 0x prefix.';
                    }
                }
                
                vscode.window.showErrorMessage(`❌ Alith initialization failed: ${errorMessage}`);
                this.alithAgent = null;
            }
        } else {
            console.log('LazAI: Using direct API mode');
            if (useAlith && !privateKey) {
                vscode.window.showWarningMessage('⚠️ Alith enabled but no private key configured. Please set your private key in settings.');
            }
            if (useAlith && !ChainConfig) {
                vscode.window.showErrorMessage('❌ Alith library not properly installed. Please check your dependencies.');
            }
        }
    }

    private getApiKey(): string | undefined {
        const config = vscode.workspace.getConfiguration('lazai');
        return config.get<string>('apiKey');
    }

    private getModel(): string {
        const config = vscode.workspace.getConfiguration('lazai');
        return config.get<string>('model') || 'gpt-3.5-turbo';
    }

    private async makeRequest(endpoint: string, body: any): Promise<any> {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('LazAI API key not configured. Please set it in settings.');
        }

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
                const errorMessage = (errorData as any)?.error?.message || response.statusText;
                throw new Error(`API request failed: ${response.status} - ${errorMessage}`);
            }

            return await response.json();
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`Network error: ${String(error)}`);
        }
    }

    async getCompletion(request: CompletionRequest): Promise<CompletionResponse> {
        try {
            // Try Alith Agent first if available
            if (this.alithAgent) {
                try {
                    console.log('LazAI: Using Alith Agent for completion');
                    const prompt = `Complete this code based on context: ${request.prompt}`;
                    const response = await this.alithAgent.prompt(prompt);
                    console.log('LazAI: Alith Agent completion successful');
                    return { text: response };
                } catch (alithError) {
                    console.warn('LazAI: Alith completion failed, falling back to direct API:', alithError);
                    // Don't fall back immediately - return error to avoid rate limits
                    return { 
                        text: '', 
                        error: `Alith Agent failed: ${alithError}. Please check your private key and node connection.` 
                    };
                }
            }

            // Only use fallback API if Alith is explicitly disabled
            const config = vscode.workspace.getConfiguration('lazai');
            const useAlith = config.get<boolean>('useAlith', true);
            
            if (useAlith) {
                return { 
                    text: '', 
                    error: 'Alith Agent not initialized. Please configure your private key in settings.' 
                };
            }

            // Fallback to direct API only if Alith is disabled
            console.log('LazAI: Using direct API fallback');
            const body = {
                model: 'llama-3.3-70b-versatile', // Use a working Groq model
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful coding assistant. Provide only the code completion without explanations. Complete the code based on the context provided.'
                    },
                    {
                        role: 'user',
                        content: request.prompt
                    }
                ],
                max_tokens: request.maxTokens || 100,
                temperature: request.temperature || 0.1,
                stream: false
            };

            const response = await this.makeRequest('/chat/completions', body);
            
            if (response.choices && response.choices.length > 0) {
                const completion = response.choices[0].message.content.trim();
                return { text: completion };
            } else {
                return { text: '', error: 'No completion generated' };
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes('Rate limit')) {
                return { 
                    text: '', 
                    error: 'Rate limit reached. Please use Alith Agent by configuring your private key, or wait before trying again.' 
                };
            }
            return { 
                text: '', 
                error: error instanceof Error ? error.message : String(error) 
            };
        }
    }

    async chat(request: ChatRequest): Promise<CompletionResponse> {
        try {
            // Try Alith Agent first if available
            if (this.alithAgent) {
                try {
                    console.log('LazAI: Using Alith Agent for chat');
                    // Convert messages to a single prompt for Alith
                    const prompt = request.messages
                        .filter(msg => msg.role === 'user')
                        .map(msg => msg.content)
                        .join('\n');
                    
                    const response = await this.alithAgent.prompt(prompt);
                    console.log('LazAI: Alith Agent chat successful');
                    return { text: response };
                } catch (alithError) {
                    console.warn('LazAI: Alith chat failed, falling back to direct API:', alithError);
                    // Don't fall back immediately for chat - it's less frequent
                }
            }

            // Only use fallback API if Alith is explicitly disabled or for chat (less frequent)
            const config = vscode.workspace.getConfiguration('lazai');
            const useAlith = config.get<boolean>('useAlith', true);
            
            if (useAlith && !this.alithAgent) {
                return { 
                    text: '', 
                    error: 'Alith Agent not initialized. Please configure your private key in settings.' 
                };
            }

            // Fallback to direct API for chat (since it's less frequent than completions)
            console.log('LazAI: Using direct API for chat');
            const body = {
                model: 'llama-3.3-70b-versatile', // Use a working Groq model
                messages: request.messages,
                max_tokens: request.maxTokens || 1000,
                temperature: request.temperature || 0.7,
                stream: false
            };

            const response = await this.makeRequest('/chat/completions', body);
            
            if (response.choices && response.choices.length > 0) {
                const completion = response.choices[0].message.content.trim();
                return { text: completion };
            } else {
                return { text: '', error: 'No response generated' };
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes('Rate limit')) {
                return { 
                    text: '', 
                    error: 'Rate limit reached on Groq API. Please configure your private key to use Alith Agent for unlimited access, or wait before trying again.' 
                };
            }
            return { 
                text: '', 
                error: error instanceof Error ? error.message : String(error) 
            };
        }
    }

    isConfigured(): boolean {
        const config = vscode.workspace.getConfiguration('lazai');
        const useAlith = config.get<boolean>('useAlith', true);
        
        if (useAlith) {
            const privateKey = config.get<string>('privateKey');
            return !!privateKey && !!ChainConfig;
        } else {
            return !!this.getApiKey();
        }
    }

    async reinitialize() {
        await this.initializeAlith();
    }
}