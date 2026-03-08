import { useState } from 'react';
import { createLicense } from 'wasp/client/operations';

const SUPPORTED_CHANNELS = [
  { id: 'telegram', name: 'Telegram', fields: [{ name: 'botToken', label: 'Bot Token' }] },
  { id: 'feishu', name: '飞书', fields: [
    { name: 'appId', label: 'App ID' },
    { name: 'appSecret', label: 'App Secret' }
  ]},
  { id: 'discord', name: 'Discord', fields: [{ name: 'botToken', label: 'Bot Token' }] },
  { id: 'slack', name: 'Slack', fields: [
    { name: 'botToken', label: 'Bot Token' },
    { name: 'signingSecret', label: 'Signing Secret' }
  ]},
];

interface CreateLicenseModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateLicenseModal({ onClose, onSuccess }: CreateLicenseModalProps) {
  const [selectedChannels, setSelectedChannels] = useState<Record<string, any>>({});
  const [modelConfig, setModelConfig] = useState({
    provider: 'openai',
    modelName: 'gpt-4',
    apiKey: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChannelToggle = (channelId: string) => {
    setSelectedChannels(prev => {
      const newState = { ...prev };
      if (newState[channelId]) {
        delete newState[channelId];
      } else {
        newState[channelId] = { enabled: true, credentials: {} };
      }
      return newState;
    });
  };

  const handleChannelFieldChange = (channelId: string, field: string, value: string) => {
    setSelectedChannels(prev => ({
      ...prev,
      [channelId]: {
        ...prev[channelId],
        credentials: {
          ...prev[channelId].credentials,
          [field]: value
        }
      }
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const channels = Object.entries(selectedChannels)
        .filter(([_, data]) => data.enabled)
        .map(([type, data]) => ({
          type,
          credentials: data.credentials
        }));

      const result = await createLicense({
        channels,
        model: modelConfig.apiKey ? modelConfig : undefined
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
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">创建卡密</h2>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">通信渠道</h3>
          <div className="space-y-4">
            {SUPPORTED_CHANNELS.map(channel => (
              <div key={channel.id} className="border rounded p-4">
                <label className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    checked={!!selectedChannels[channel.id]}
                    onChange={() => handleChannelToggle(channel.id)}
                    className="mr-2"
                  />
                  <span className="font-medium">{channel.name}</span>
                </label>

                {selectedChannels[channel.id] && (
                  <div className="ml-6 space-y-2">
                    {channel.fields.map(field => (
                      <div key={field.name}>
                        <label className="block text-sm text-gray-600 mb-1">
                          {field.label}
                        </label>
                        <input
                          type={field.name.toLowerCase().includes('secret') ? 'password' : 'text'}
                          value={selectedChannels[channel.id].credentials[field.name] || ''}
                          onChange={e => handleChannelFieldChange(channel.id, field.name, e.target.value)}
                          className="w-full border rounded px-3 py-2"
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

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">AI 模型配置</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Provider</label>
              <select
                value={modelConfig.provider}
                onChange={e => setModelConfig(prev => ({ ...prev, provider: e.target.value }))}
                className="w-full border rounded px-3 py-2"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="azure">Azure OpenAI</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">模型名称</label>
              <input
                type="text"
                placeholder="如: gpt-4"
                value={modelConfig.modelName}
                onChange={e => setModelConfig(prev => ({ ...prev, modelName: e.target.value }))}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">API Key</label>
              <input
                type="password"
                placeholder="输入 API Key"
                value={modelConfig.apiKey}
                onChange={e => setModelConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                className="w-full border rounded px-3 py-2"
              />
            </div>
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
            disabled={isSubmitting || Object.keys(selectedChannels).length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}
