import { useState } from "react";
import { createLicense } from "wasp/client/operations";

// 所有支持的渠道配置
const SUPPORTED_CHANNELS = [
  {
    id: "whatsapp",
    name: "WhatsApp (Baileys)",
    fields: [{ name: "sessionId", label: "Session ID" }],
  },
  {
    id: "telegram",
    name: "Telegram",
    fields: [{ name: "botToken", label: "Bot Token" }],
  },
  {
    id: "slack",
    name: "Slack (Bolt)",
    fields: [
      { name: "botToken", label: "Bot Token (xoxb-...)" },
      { name: "signingSecret", label: "Signing Secret" },
    ],
  },
  {
    id: "discord",
    name: "Discord",
    fields: [{ name: "token", label: "Bot Token" }],
  },
  {
    id: "googlechat",
    name: "Google Chat",
    fields: [
      { name: "serviceAccount", label: "Service Account JSON" },
    ],
  },
  {
    id: "signal",
    name: "Signal",
    fields: [
      { name: "account", label: "Phone Number" },
      { name: "httpUrl", label: "signal-cli REST API URL" },
    ],
  },
  {
    id: "bluebubbles",
    name: "BlueBubbles (iMessage 推荐)",
    fields: [
      { name: "serverUrl", label: "Server URL" },
      { name: "password", label: "Password" },
    ],
  },
  {
    id: "imessage",
    name: "iMessage (旧版)",
    fields: [
      { name: "dbPath", label: "Chat DB Path" },
    ],
  },
  {
    id: "irc",
    name: "IRC",
    fields: [
      { name: "host", label: "Server Host" },
      { name: "nick", label: "Nickname" },
      { name: "channels", label: "Channels (逗号分隔)" },
    ],
  },
  {
    id: "msteams",
    name: "Microsoft Teams",
    fields: [
      { name: "appId", label: "App ID" },
      { name: "appPassword", label: "App Password" },
      { name: "tenantId", label: "Tenant ID" },
    ],
  },
  {
    id: "matrix",
    name: "Matrix",
    fields: [
      { name: "homeserver", label: "Homeserver URL" },
      { name: "accessToken", label: "Access Token" },
      { name: "userId", label: "User ID (@user:server)" },
    ],
  },
  {
    id: "feishu",
    name: "飞书",
    fields: [
      { name: "appId", label: "App ID" },
      { name: "appSecret", label: "App Secret" },
    ],
  },
  {
    id: "line",
    name: "LINE",
    fields: [
      { name: "channelAccessToken", label: "Channel Access Token" },
      { name: "channelSecret", label: "Channel Secret" },
    ],
  },
  {
    id: "mattermost",
    name: "Mattermost",
    fields: [
      { name: "token", label: "Bot Token" },
      { name: "serverUrl", label: "Server URL" },
    ],
  },
  {
    id: "nextcloud",
    name: "Nextcloud Talk",
    fields: [
      { name: "serverUrl", label: "Server URL" },
      { name: "username", label: "Username" },
      { name: "password", label: "App Password" },
    ],
  },
  {
    id: "nostr",
    name: "Nostr",
    fields: [
      { name: "privateKey", label: "Private Key (nsec或hex)" },
      { name: "relays", label: "Relays (逗号分隔)" },
    ],
  },
  {
    id: "synology",
    name: "Synology Chat",
    fields: [
      { name: "token", label: "Bot Token" },
      { name: "serverUrl", label: "Server URL" },
    ],
  },
  {
    id: "twitch",
    name: "Twitch",
    fields: [
      { name: "token", label: "OAuth Token" },
      { name: "clientId", label: "Client ID" },
      { name: "channel", label: "Channel Name" },
    ],
  },
  {
    id: "zalo",
    name: "Zalo",
    fields: [
      { name: "appId", label: "App ID" },
      { name: "appSecret", label: "App Secret" },
    ],
  },
  {
    id: "webchat",
    name: "WebChat",
    fields: [
      { name: "enabled", label: "Enabled (true/false)" },
    ],
  },
];

// AI 服务商配置
const AI_PROVIDERS = [
  { id: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"] },
  { id: "anthropic", name: "Anthropic (Claude)", models: ["claude-opus-4-20250514", "claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"] },
  { id: "gemini", name: "Google Gemini", models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"] },
  { id: "zai", name: "智谱 AI (GLM)", models: ["glm-5", "glm-4.7", "glm-4.7-flash", "glm-4.7-flashx"] },
  { id: "doubao", name: "豆包 (字节跳动)", models: ["doubao-seedance-1-0-pro-250415", "doubao-seedance-1-0-lite-250415", "doubao-pro-256k", "doubao-pro-32k", "doubao-lite-32k"] },
  { id: "qianfan", name: "百度千帆", models: ["ERNIE-4.0-8K", "ERNIE-3.5-8K", "ERNIE-Speed-8K"] },
  { id: "moonshot", name: "Moonshot (Kimi)", models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"] },
  { id: "minimax", name: "MiniMax", models: ["abab6.5s-chat", "abab6.5-chat", "abab5.5-chat"] },
  { id: "openrouter", name: "OpenRouter", models: ["openai/gpt-4o", "anthropic/claude-sonnet-4", "google/gemini-pro-1.5"] },
  { id: "mistral", name: "Mistral AI", models: ["mistral-large-latest", "mistral-medium", "mistral-small"] },
  { id: "xai", name: "xAI (Grok)", models: ["grok-beta", "grok-vision-beta"] },
  { id: "together", name: "Together AI", models: ["meta-llama/Llama-3-70b-chat-hf", "mistralai/Mixtral-8x7B-Instruct-v0.1"] },
  { id: "huggingface", name: "Hugging Face", models: ["meta-llama/Meta-Llama-3-70B"] },
  { id: "venice", name: "Venice AI", models: ["llama-3.1-405b", "llama-3.1-70b"] },
  { id: "litellm", name: "LiteLLM Proxy", models: ["自定义模型"] },
  { id: "custom", name: "自定义 (OpenAI 兼容)", models: ["自定义模型"] },
];

interface CreateLicenseModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateLicenseModal({
  onClose,
  onSuccess,
}: CreateLicenseModalProps) {
  const [selectedChannels, setSelectedChannels] = useState<Record<string, any>>(
    {},
  );
  const [modelConfig, setModelConfig] = useState({
    provider: "openai",
    modelName: "gpt-4o",
    apiKey: "",
    endpoint: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [channelSearch, setChannelSearch] = useState("");

  const filteredChannels = SUPPORTED_CHANNELS.filter(
    (channel) =>
      channel.name.toLowerCase().includes(channelSearch.toLowerCase()) ||
      channel.id.toLowerCase().includes(channelSearch.toLowerCase())
  );

  const selectedProvider = AI_PROVIDERS.find((p) => p.id === modelConfig.provider);

  const handleChannelToggle = (channelId: string) => {
    setSelectedChannels((prev) => {
      const newState = { ...prev };
      if (newState[channelId]) {
        delete newState[channelId];
      } else {
        newState[channelId] = { enabled: true, credentials: {} };
      }
      return newState;
    });
  };

  const handleChannelFieldChange = (
    channelId: string,
    field: string,
    value: string,
  ) => {
    setSelectedChannels((prev) => ({
      ...prev,
      [channelId]: {
        ...prev[channelId],
        credentials: {
          ...prev[channelId].credentials,
          [field]: value,
        },
      },
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const channels = Object.entries(selectedChannels)
        .filter(([_, data]) => data.enabled)
        .map(([type, data]) => ({
          type,
          credentials: data.credentials,
        }));

      const result = await createLicense({
        channels,
        model: modelConfig.apiKey ? {
          provider: modelConfig.provider === "custom" ? "custom" : modelConfig.provider,
          modelName: modelConfig.modelName,
          apiKey: modelConfig.apiKey,
          apiEndpoint: modelConfig.endpoint || undefined,
        } : undefined,
      });

      const installUrl = result.installUrl;
      const command = `curl -fsSL ${installUrl} | bash`;

      navigator.clipboard.writeText(command);
      alert(`卡密创建成功！\n\n安装命令已复制到剪贴板:\n${command}`);

      onSuccess();
    } catch (error: any) {
      alert(`创建失败: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">创建卡密</h2>

        {/* 通信渠道配置 */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">通信渠道</h3>

          {/* 渠道搜索 */}
          <input
            type="text"
            placeholder="搜索渠道..."
            value={channelSearch}
            onChange={(e) => setChannelSearch(e.target.value)}
            className="w-full border rounded px-3 py-2 mb-3"
          />

          {/* 已选择的渠道数量 */}
          {Object.keys(selectedChannels).length > 0 && (
            <div className="mb-3 text-sm text-blue-600">
              已选择 {Object.keys(selectedChannels).length} 个渠道
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
            {filteredChannels.map((channel) => (
              <div key={channel.id} className="border rounded p-3">
                <label className="flex items-center mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!selectedChannels[channel.id]}
                    onChange={() => handleChannelToggle(channel.id)}
                    className="mr-2"
                  />
                  <span className="font-medium text-sm">{channel.name}</span>
                </label>

                {selectedChannels[channel.id] && (
                  <div className="ml-6 space-y-2">
                    {channel.fields.map((field) => (
                      <div key={field.name}>
                        <label className="block text-xs text-gray-500 mb-1">
                          {field.label}
                        </label>
                        <input
                          type={
                            field.name.toLowerCase().includes("secret") ||
                            field.name.toLowerCase().includes("password") ||
                            field.name.toLowerCase().includes("token") ||
                            field.name.toLowerCase().includes("key")
                              ? "password"
                              : "text"
                          }
                          value={
                            selectedChannels[channel.id].credentials[
                              field.name
                            ] || ""
                          }
                          onChange={(e) =>
                            handleChannelFieldChange(
                              channel.id,
                              field.name,
                              e.target.value,
                            )
                          }
                          className="w-full border rounded px-2 py-1 text-sm"
                          placeholder={`输入 ${field.label}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* AI 模型配置 */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">AI 模型配置</h3>
          <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">服务商</label>
                <select
                  value={modelConfig.provider}
                  onChange={(e) => {
                    const provider = AI_PROVIDERS.find((p) => p.id === e.target.value);
                    setModelConfig((prev) => ({
                      ...prev,
                      provider: e.target.value,
                      modelName: provider?.models[0] || "",
                    }));
                  }}
                  className="w-full border rounded px-3 py-2"
                >
                  {AI_PROVIDERS.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  模型名称
                </label>
                {modelConfig.provider === "custom" || modelConfig.provider === "litellm" ? (
                  <input
                    type="text"
                    placeholder="输入模型名称"
                    value={modelConfig.modelName}
                    onChange={(e) =>
                      setModelConfig((prev) => ({
                        ...prev,
                        modelName: e.target.value,
                      }))
                    }
                    className="w-full border rounded px-3 py-2"
                  />
                ) : (
                  <select
                    value={modelConfig.modelName}
                    onChange={(e) =>
                      setModelConfig((prev) => ({
                        ...prev,
                        modelName: e.target.value,
                      }))
                    }
                    className="w-full border rounded px-3 py-2"
                  >
                    {selectedProvider?.models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                API Key <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                placeholder="输入 API Key"
                value={modelConfig.apiKey}
                onChange={(e) =>
                  setModelConfig((prev) => ({
                    ...prev,
                    apiKey: e.target.value,
                  }))
                }
                className="w-full border rounded px-3 py-2"
              />
            </div>

            {(modelConfig.provider === "custom" || modelConfig.provider === "litellm" ||
              modelConfig.provider === "doubao" || modelConfig.provider === "qianfan") && (
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  API Endpoint {modelConfig.provider === "custom" && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  placeholder={
                    modelConfig.provider === "doubao"
                      ? "https://ark.cn-beijing.volces.com/api/v3"
                      : modelConfig.provider === "qianfan"
                      ? "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat"
                      : "输入 API Base URL"
                  }
                  value={modelConfig.endpoint}
                  onChange={(e) =>
                    setModelConfig((prev) => ({
                      ...prev,
                      endpoint: e.target.value,
                    }))
                  }
                  className="w-full border rounded px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {modelConfig.provider === "doubao" && "豆包使用火山引擎 API，需填写火山引擎的 API 地址"}
                  {modelConfig.provider === "qianfan" && "百度千帆需填写千帆平台的 API 地址"}
                  {modelConfig.provider === "custom" && "自定义服务商需填写 OpenAI 兼容的 API 地址"}
                  {modelConfig.provider === "litellm" && "LiteLLM 代理服务器地址"}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              isSubmitting || (Object.keys(selectedChannels).length === 0 && !modelConfig.apiKey)
            }
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "创建中..." : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}
