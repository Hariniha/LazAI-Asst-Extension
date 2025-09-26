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
        try {
            const config = vscode.workspace.getConfiguration('lazai');
            const useAlith = config.get<boolean>('useAlith', false);
            let privateKey = config.get<string>('privateKey');
            
            console.log('LazAI: Initializing service...', { useAlith, hasPrivateKey: !!privateKey });
            
            if (!useAlith || !privateKey) {
                console.log('LazAI: Using Groq API only (Alith disabled or not configured)');
                return;
            }

            if (!ChainConfig || !Client || !Agent) {
                console.warn('LazAI: Alith packages not available, falling back to Groq');
                return;
            }

            // Clean and validate the private key
            privateKey = privateKey.trim();
            if (privateKey.startsWith('0x')) {
                privateKey = privateKey.slice(2);
            }

            // Validate private key format (64 hex characters)
            if (!/^[0-9a-fA-F]{64}$/.test(privateKey)) {
                console.error('LazAI: Invalid private key format');
                vscode.window.showErrorMessage('Invalid private key format. Must be 64 hex characters.');
                return;
            }

            console.log('LazAI: Initializing Alith client...');
            this.alithClient = new Client(ChainConfig.testnet());
            
            const nodeAddress = config.get<string>('nodeAddress', '0xc3e98E8A9aACFc9ff7578C2F3BA48CA4477Ecf49');
            const fileId = config.get<number>('fileId', 10);
            
            const nodeInfo = await this.alithClient.getInferenceNode(nodeAddress);
            this.alithAgent = new Agent({
                baseUrl: `${nodeInfo.url}/v1`,
                model: this.getModel(),
                extraHeaders: await this.alithClient.getRequestHeaders(nodeAddress, BigInt(fileId)),
            });
            
            console.log('LazAI: Alith initialized successfully');
            
        } catch (error) {
            console.error('LazAI: Failed to initialize Alith:', error);
            console.log('LazAI: Falling back to Groq API');
        }
    }

    public isConfigured(): boolean {
        const config = vscode.workspace.getConfiguration('lazai');
        const apiKey = config.get<string>('apiKey');
        const privateKey = config.get<string>('privateKey');
        const useAlith = config.get<boolean>('useAlith', false);
        
        // Check if either Alith or Groq is configured
        if (useAlith && privateKey && privateKey.trim().length > 0) {
            return true; // Alith is configured
        }
        
        if (apiKey && apiKey.trim().length > 0) {
            return true; // Groq is configured
        }
        
        return false; // Neither is configured
    }

    private getApiKey(): string | undefined {
        const config = vscode.workspace.getConfiguration('lazai');
        return config.get<string>('apiKey');
    }

    private getModel(): string {
        const config = vscode.workspace.getConfiguration('lazai');
        return config.get<string>('model', 'llama3-8b-8192');
    }

    private async makeRequest(endpoint: string, body: any): Promise<any> {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('API key not configured');
        }

        console.log(`LazAI: Making request to ${endpoint}`);

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('LazAI: API Error:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return await response.json();
    }

    public async getCompletion(request: CompletionRequest): Promise<CompletionResponse> {
        try {
            // Try Alith first if configured
            const config = vscode.workspace.getConfiguration('lazai');
            const useAlith = config.get<boolean>('useAlith', false);
            
            if (useAlith && this.alithAgent) {
                console.log('LazAI: Getting completion via Alith Agent');
                
                const result = await this.alithAgent.completions.create({
                    model: this.getModel(),
                    prompt: request.prompt,
                    max_tokens: request.maxTokens || 50,
                    temperature: request.temperature || 0.1,
                });
                
                if (result && result.choices && result.choices.length > 0) {
                    const completionText = result.choices[0].text || '';
                    console.log('LazAI: Completion received via Alith');
                    return { text: completionText };
                }
            }
            
            // Fallback to Groq API
            console.log('LazAI: Getting completion via Groq API');
            
            const body = {
                model: this.getModel(),
                messages: [
                    { role: 'system', content: 'You are a code completion assistant. Provide only the completion text, no explanations.' },
                    { role: 'user', content: request.prompt }
                ],
                max_tokens: request.maxTokens || 50,
                temperature: request.temperature || 0.1,
                stream: false
            };

            const result = await this.makeRequest('/chat/completions', body);
            
            if (result.choices && result.choices.length > 0) {
                const completionText = result.choices[0].message?.content || '';
                console.log('LazAI: Completion received via Groq');
                return { text: completionText };
            } else {
                console.log('LazAI: No completion choices returned');
                return { text: '', error: 'No completion generated' };
            }
        } catch (error) {
            console.error('LazAI: Completion error:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { text: '', error: errorMessage };
        }
    }

    public async chat(request: ChatRequest): Promise<CompletionResponse> {
        try {
            // Try Alith first if configured
            const config = vscode.workspace.getConfiguration('lazai');
            const useAlith = config.get<boolean>('useAlith', false);
            
            if (useAlith && this.alithAgent) {
                console.log('LazAI: Processing chat request via Alith Agent');
                
                const result = await this.alithAgent.chat.completions.create({
                    model: this.getModel(),
                    messages: request.messages,
                    max_tokens: request.maxTokens || 1000,
                    temperature: request.temperature || 0.7,
                });
                
                if (result && result.choices && result.choices.length > 0) {
                    const responseText = result.choices[0].message?.content || '';
                    console.log('LazAI: Chat response received via Alith');
                    return { text: responseText };
                }
            }
            
            // Fallback to Groq API
            console.log('LazAI: Processing chat request via Groq API');
            
            const body = {
                model: this.getModel(),
                messages: request.messages,
                max_tokens: request.maxTokens || 1000,
                temperature: request.temperature || 0.7,
                stream: false
            };

            const result = await this.makeRequest('/chat/completions', body);
            
            if (result.choices && result.choices.length > 0) {
                const responseText = result.choices[0].message?.content || '';
                console.log('LazAI: Chat response received via Groq');
                return { text: responseText };
            } else {
                console.log('LazAI: No chat choices returned');
                return { text: '', error: 'No response generated' };
            }
        } catch (error) {
            console.error('LazAI: Chat error:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { text: '', error: errorMessage };
        }
    }
}