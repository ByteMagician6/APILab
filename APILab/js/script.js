document.addEventListener('DOMContentLoaded', function() {
    // DOM元素引用
    const apiKeyInput = document.getElementById('api-key');
    const apiPresetSelect = document.getElementById('api-preset');
    const apiEndpointInput = document.getElementById('api-endpoint');
    const saveConfigBtn = document.getElementById('save-config');
    const modelSelect = document.getElementById('model-select');
    const modelInput = document.getElementById('model-input');
    const temperatureSlider = document.getElementById('temperature');
    const tempValueDisplay = document.getElementById('temp-value');
    const maxTokensInput = document.getElementById('max-tokens');
    const systemPromptInput = document.getElementById('system-prompt');
    const chatMessagesContainer = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const stopButton = document.getElementById('stop-button');
    const clearChatBtn = document.getElementById('clear-chat');
    const exportChatBtn = document.getElementById('export-chat');
    const connectionStatus = document.getElementById('connection-status');
    const tokenCountDisplay = document.getElementById('token-count');
    
    // 全局变量
    let chatHistory = [];
    let abortController = null;
    let totalTokensUsed = 0;
    let isResizing = false;
    let lastY = 0;
    
    // 预设API端点和模型映射
    const presetEndpoints = {
        "DeepSeek": {
            url: "https://api.deepseek.com/v1",
            models: ["deepseek-chat","deepseek-reasoner","deepseek-coder"]
        },
        "OpenAI": {
            url: "https://api.openai.com/v1",
            models: ["gpt-3.5-turbo", "gpt-4"]
        }
    };
    
    // 初始化应用
    initApp();
    
    function initApp() {
        // 从本地存储加载配置
        loadConfig();
        
        // 设置事件监听器
        setupEventListeners();
        
        // 添加欢迎消息
        if (!localStorage.getItem('apilab_welcome_shown')) {
            addSystemMessage('欢迎使用APILAB - 大模型API调试平台！请先配置您的API密钥和模型设置。');
            localStorage.setItem('apilab_welcome_shown', 'true');
        }
    }
    
    function loadConfig() {
        // 加载API配置
        apiKeyInput.value = localStorage.getItem('apilab_api_key') || '';
        apiEndpointInput.value = localStorage.getItem('apilab_api_endpoint') || '';
        apiPresetSelect.value = localStorage.getItem('apilab_api_preset') || '';
        
        // 加载模型配置
        const savedModel = localStorage.getItem('apilab_model') || '';
        if (localStorage.getItem('apilab_api_preset')) {
            modelSelect.value = savedModel;
            modelSelect.classList.remove('hidden');
            modelInput.classList.add('hidden');
        } else {
            modelInput.value = savedModel;
            modelSelect.classList.add('hidden');
            modelInput.classList.remove('hidden');
        }
        
        temperatureSlider.value = localStorage.getItem('apilab_temperature') || '0.7';
        tempValueDisplay.textContent = temperatureSlider.value;
        maxTokensInput.value = localStorage.getItem('apilab_max_tokens') || '1024';
        systemPromptInput.value = localStorage.getItem('apilab_system_prompt') || '';
        
        // 加载聊天历史
        const savedChat = localStorage.getItem('apilab_chat_history');
        if (savedChat) {
            chatHistory = JSON.parse(savedChat);
            renderChatHistory();
        }
        
        // 加载token计数
        const savedTokens = localStorage.getItem('apilab_total_tokens');
        totalTokensUsed = savedTokens ? parseInt(savedTokens) : 0;
        updateTokenCount();
    }
    
    function saveConfig() {
        const apiKey = apiKeyInput.value.trim();
        const apiEndpoint = apiEndpointInput.value.trim();
        const modelValue = modelSelect.classList.contains('hidden') 
            ? modelInput.value.trim()
            : modelSelect.value;
        
        if (!apiKey) {
            showTemporaryMessage('请输入有效的API密钥', 'error');
            return;
        }
        
        if (!apiEndpoint) {
            showTemporaryMessage('请输入有效的API端点', 'error');
            return;
        }
        
        if (!modelValue) {
            showTemporaryMessage('请选择或输入模型名称', 'error');
            return;
        }
        
        // 保存配置到本地存储
        localStorage.setItem('apilab_api_key', apiKey);
        localStorage.setItem('apilab_api_endpoint', apiEndpoint);
        localStorage.setItem('apilab_api_preset', apiPresetSelect.value);
        localStorage.setItem('apilab_model', modelValue);
        localStorage.setItem('apilab_temperature', temperatureSlider.value);
        localStorage.setItem('apilab_max_tokens', maxTokensInput.value);
        localStorage.setItem('apilab_system_prompt', systemPromptInput.value);
        
        showTemporaryMessage('配置已保存！', 'success');
    }
    
    function setupEventListeners() {
        // 配置保存
        saveConfigBtn.addEventListener('click', saveConfig);
        
        // 温度滑块值显示更新
        temperatureSlider.addEventListener('input', function() {
            tempValueDisplay.textContent = this.value;
        });
        
        // 预设端点选择
        apiPresetSelect.addEventListener('change', function() {
            const selectedPreset = this.value;
            if (selectedPreset && presetEndpoints[selectedPreset]) {
                apiEndpointInput.value = presetEndpoints[selectedPreset].url;
                updateModelOptions(selectedPreset);
            } else {
                // 自定义端点时清空模型列表
                modelSelect.innerHTML = '<option value="">自定义模型（请手动输入）</option>';
                modelSelect.classList.add('hidden');
                modelInput.classList.remove('hidden');
                modelInput.value = localStorage.getItem('apilab_model') || '';
            }
        });
        
        // 自定义端点输入时处理
        apiEndpointInput.addEventListener('input', function() {
            if (apiPresetSelect.value) {
                apiPresetSelect.value = ''; // 清除预设选择
                modelSelect.innerHTML = '<option value="">自定义模型（请手动输入）</option>';
                modelSelect.classList.add('hidden');
                modelInput.classList.remove('hidden');
            }
        });
        
        // 模型输入变化时保存
        modelInput.addEventListener('input', function() {
            localStorage.setItem('apilab_model', this.value);
        });
        
        // 发送消息
        sendButton.addEventListener('click', sendMessage);
        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // 停止生成
        stopButton.addEventListener('click', stopGeneration);
        
        // 清空聊天
        clearChatBtn.addEventListener('click', clearChat);
        
        // 导出聊天记录
        exportChatBtn.addEventListener('click', exportChat);
        
        // 输入框高度自适应
        messageInput.addEventListener('input', autoResizeTextarea);
        systemPromptInput.addEventListener('input', autoResizeTextarea);
        
        // 设置可拖动调整大小的处理
        setupResizableTextareas();
    }
    
    function setupResizableTextareas() {
        const resizeHandles = document.querySelectorAll('.resize-handle');
        
        resizeHandles.forEach(handle => {
            handle.addEventListener('mousedown', function(e) {
                e.preventDefault();
                isResizing = true;
                lastY = e.clientY;
                const container = this.parentElement;
                const startHeight = container.offsetHeight;
                
                function handleMouseMove(e) {
                    if (!isResizing) return;
                    const dy = e.clientY - lastY;
                    const newHeight = startHeight + dy;
                    
                    if (newHeight > 80 && newHeight < window.innerHeight * 0.6) {
                        container.style.height = newHeight + 'px';
                        const textarea = container.querySelector('textarea');
                        textarea.style.height = '100%';
                    }
                }
                
                function handleMouseUp() {
                    isResizing = false;
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                }
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            });
        });
    }
    
    function updateModelOptions(presetKey) {
        const models = presetEndpoints[presetKey].models;
        modelSelect.innerHTML = '';
        
        if (models && models.length > 0) {
            // 添加默认提示
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '-- 选择模型 --';
            modelSelect.appendChild(defaultOption);
            
            // 添加模型选项
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });
            
            modelSelect.classList.remove('hidden');
            modelInput.classList.add('hidden');
        } else {
            modelSelect.innerHTML = '<option value="">该端点无预设模型</option>';
        }
    }
    
    function autoResizeTextarea(e) {
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }
    
    async function sendMessage() {
        const message = messageInput.value.trim();
        const apiKey = apiKeyInput.value.trim();
        const apiEndpoint = apiEndpointInput.value.trim();
        const model = modelSelect.classList.contains('hidden') 
            ? modelInput.value.trim()
            : modelSelect.value;
        
        if (!message) {
            showTemporaryMessage('请输入消息内容', 'error');
            return;
        }
        
        if (!apiKey) {
            showTemporaryMessage('请先配置API密钥', 'error');
            return;
        }
        
        if (!apiEndpoint) {
            showTemporaryMessage('请配置API端点', 'error');
            return;
        }
        
        if (!model) {
            showTemporaryMessage('请选择或输入模型名称', 'error');
            return;
        }
        
        // 获取其他参数
        const temperature = parseFloat(temperatureSlider.value);
        const maxTokens = parseInt(maxTokensInput.value);
        const systemPrompt = systemPromptInput.value.trim();
        
        // 添加用户消息到聊天界面和历史记录
        addUserMessage(message);
        messageInput.value = '';
        messageInput.style.height = 'auto'; // 重置输入框高度
        
        // 构建消息数组
        let messages = [];
        
        // 添加系统提示词（如果有）
        if (systemPrompt) {
            messages.push({
                role: 'system',
                content: systemPrompt
            });
        }
        
        // 添加上下文消息（最近3轮对话）
        const recentHistory = chatHistory.slice(-6); // 保留最近3轮对话
        messages = messages.concat(recentHistory);
        
        // 添加当前用户消息
        messages.push({
            role: 'user',
            content: message
        });
        
        // 显示"思考中"消息
        const thinkingId = addBotMessage('思考中...');
        
        // 准备API请求
        const requestBody = {
            model: model,
            messages: messages,
            temperature: temperature,
            max_tokens: maxTokens,
            stream: false
        };
        
        // 更新状态
        connectionStatus.textContent = '状态: 请求中...';
        sendButton.disabled = true;
        stopButton.disabled = false;
        abortController = new AbortController();
        
        try {
            // 调用API
            const response = await fetch(`${apiEndpoint}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody),
                signal: abortController.signal
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error?.message || `API请求失败: ${response.status}`);
            }
            
            // 移除"思考中"消息，添加实际回复
            removeMessage(thinkingId);
            const reply = data.choices[0].message.content;
            addBotMessage(reply);
            
            // 更新聊天历史
            chatHistory.push({
                role: 'user',
                content: message
            });
            
            chatHistory.push({
                role: 'assistant',
                content: reply
            });
            
            // 更新token计数
            if (data.usage) {
                totalTokensUsed += data.usage.total_tokens;
                updateTokenCount();
                
                // 显示API使用信息
                const usageInfo = `本次调用消耗: ${data.usage.prompt_tokens} + ${data.usage.completion_tokens} = ${data.usage.total_tokens} tokens`;
                addSystemMessage(usageInfo);
            }
            
            // 保存更新后的聊天历史和token计数
            localStorage.setItem('apilab_chat_history', JSON.stringify(chatHistory));
            localStorage.setItem('apilab_total_tokens', totalTokensUsed.toString());
            
            // 在控制台显示完整响应
            console.log('API响应:', data);
            
        } catch (error) {
            if (error.name === 'AbortError') {
                removeMessage(thinkingId);
                addSystemMessage('生成已停止');
            } else {
                removeMessage(thinkingId);
                
                // 处理模型不存在错误
                if (error.message.includes('Model Not Exist')) {
                    addBotMessage(`错误: 模型不存在。请检查模型名称是否正确。当前模型: ${model}`);
                    addSystemMessage('提示: 确保使用正确的模型名称，如 "deepseek-chat" 或 "deepseek-coder"');
                } else {
                    addBotMessage(`错误: ${error.message}`);
                }
                
                console.error('API调用失败:', error);
            }
        } finally {
            // 重置状态
            connectionStatus.textContent = '状态: 就绪';
            sendButton.disabled = false;
            stopButton.disabled = true;
            abortController = null;
        }
    }
    
    function stopGeneration() {
        if (abortController) {
            abortController.abort();
        }
    }
    
    function clearChat() {
        if (confirm('确定要清空当前对话记录吗？')) {
            chatHistory = [];
            chatMessagesContainer.innerHTML = '';
            totalTokensUsed = 0;
            updateTokenCount();
            
            localStorage.removeItem('apilab_chat_history');
            localStorage.removeItem('apilab_total_tokens');
            
            addSystemMessage('对话记录已清空');
        }
    }
    
    function exportChat() {
        if (chatHistory.length === 0) {
            showTemporaryMessage('没有可导出的对话记录', 'warning');
            return;
        }
        
        let exportText = `APILAB 对话记录\n生成时间: ${new Date().toLocaleString()}\n\n`;
        
        chatHistory.forEach(msg => {
            const role = msg.role === 'user' ? '用户' : '助手';
            exportText += `${role}: ${msg.content}\n\n`;
        });
        
        exportText += `\n总计Token使用量: ${totalTokensUsed}`;
        
        // 创建下载链接
        const blob = new Blob([exportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `APILAB_对话记录_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    // 聊天界面辅助函数
    function addUserMessage(content) {
        const message = {
            id: 'msg-' + Date.now(),
            role: 'user',
            content: content,
            timestamp: new Date()
        };
        
        renderMessage(message);
        return message.id;
    }
    
    function addBotMessage(content) {
        const message = {
            id: 'msg-' + Date.now(),
            role: 'assistant',
            content: content,
            timestamp: new Date()
        };
        
        renderMessage(message);
        return message.id;
    }
    
    function addSystemMessage(content) {
        const message = {
            id: 'msg-' + Date.now(),
            role: 'system',
            content: content,
            timestamp: new Date()
        };
        
        renderMessage(message);
        return message.id;
    }
    
    function renderMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.id = message.id;
        messageDiv.className = `${message.role}-message message`;
        messageDiv.innerHTML = `
            <div class="message-content">${escapeHtml(message.content)}</div>
            <div class="message-time">${formatTime(message.timestamp)}</div>
        `;
        
        chatMessagesContainer.appendChild(messageDiv);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
    
    function renderChatHistory() {
        chatMessagesContainer.innerHTML = '';
        
        chatHistory.forEach(msg => {
            const message = {
                id: 'msg-' + Date.now() + Math.random().toString(36).substr(2, 5),
                role: msg.role,
                content: msg.content,
                timestamp: new Date()
            };
            
            renderMessage(message);
        });
        
        // 添加token使用总结
        if (totalTokensUsed > 0) {
            addSystemMessage(`当前会话已使用 ${totalTokensUsed} tokens`);
        }
    }
    
    function removeMessage(id) {
        const element = document.getElementById(id);
        if (element) {
            element.remove();
        }
    }
    
    function updateTokenCount() {
        tokenCountDisplay.textContent = `Tokens: ${totalTokensUsed}`;
    }
    
    // 工具函数
    function showTemporaryMessage(message, type) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `temp-message ${type}`;
        msgDiv.textContent = message;
        document.body.appendChild(msgDiv);
        
        setTimeout(() => {
            msgDiv.remove();
        }, 3000);
    }
    
    function formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/\n/g, "<br>");
    }
});