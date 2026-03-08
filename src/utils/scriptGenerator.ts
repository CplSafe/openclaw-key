interface ChannelConfig {
  type: string;
  credentials: Record<string, any>;
}

interface ModelConfig {
  provider: string;
  model: string;
  apiKey: string;
  endpoint?: string;
}

interface InstallScriptConfig {
  channels: ChannelConfig[];
  model: ModelConfig | null;
  osType: string;
}

export function generateVerifyScript(token: string, isWindows: boolean, apiBase: string): string {
  if (isWindows) {
    return `$INSTALL_TOKEN = "${token}"
$API_BASE = "${apiBase}"
Write-Host "🔍 正在验证..." -ForegroundColor Cyan

$MachineId = (Get-WmiObject -Class Win32_ComputerSystemProduct).UUID
if (-not $MachineId) {
    Write-Host "❌ 无法获取机器码" -ForegroundColor Red
    exit 1
}

$body = @{
    token = $INSTALL_TOKEN
    machineId = $MachineId
    osType = "windows"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$API_BASE/api/verify-install" \`
        -Method Post \`
        -ContentType "application/json" \`
        -Body $body

    if ($response.error) {
        Write-Host "❌ $($response.error)" -ForegroundColor Red
        exit 1
    }

    Write-Host "✅ 验证通过" -ForegroundColor Green
    Invoke-Expression $response.script
} catch {
    Write-Host "❌ 请求失败: $_" -ForegroundColor Red
    exit 1
}`;
  } else {
    return `#!/bin/bash
set -e

INSTALL_TOKEN="${token}"
API_BASE="${apiBase}"

echo "🔍 正在验证..."

get_machine_id() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    ioreg -rd1 -c IOPlatformExpertDevice | awk '/IOPlatformUUID/ { print $3; }' | tr -d '"'
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    cat /etc/machine-id 2>/dev/null || cat /var/lib/dbus/machine-id 2>/dev/null
  fi
}

MACHINE_ID=$(get_machine_id)

if [[ -z "$MACHINE_ID" ]]; then
  echo "❌ 无法获取机器码"
  exit 1
fi

OS_TYPE=$(uname | tr '[:upper:]' '[:lower:]')

response=$(curl -s -X POST "$API_BASE/api/verify-install" \\
  -H "Content-Type: application/json" \\
  -d "{\\"token\\":\\"$INSTALL_TOKEN\\",\\"machineId\\":\\"$MACHINE_ID\\",\\"osType\\":\\"$OS_TYPE\\"}")

if echo "$response" | grep -q '"error"'; then
  echo "❌ $(echo "$response" | jq -r '.error')"
  exit 1
fi

echo "✅ 验证通过"
echo "$response" | jq -r '.script' | bash`;
  }
}

export function generateInstallScript(config: InstallScriptConfig): string {
  const { channels, model, osType } = config;

  if (osType === 'windows') {
    return generateWindowsInstallScript(channels, model);
  } else {
    return generateUnixInstallScript(channels, model);
  }
}

function generateUnixInstallScript(channels: ChannelConfig[], model: ModelConfig | null): string {
  let script = `#!/bin/bash
set -e

echo "📦 安装 OpenClaw..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js，请先安装 Node.js 22+"
    echo "访问: https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [[ $NODE_VERSION -lt 22 ]]; then
    echo "❌ Node.js 版本过低（当前: $(node -v)），需要 v22+"
    exit 1
fi

echo "⬇️  安装 OpenClaw..."
npm install -g openclaw@latest

`;

  // 构建 onboard 命令参数
  let onboardArgs = '--non-interactive --accept-risk --install-daemon --skip-channels --skip-skills --skip-search --skip-ui --skip-health';

  if (model) {
    // 根据不同的 provider 设置不同的认证方式
    const authChoice = getAuthChoiceForProvider(model.provider, !!model.endpoint);

    if (model.endpoint) {
      // 自定义 endpoint - 使用 custom-api-key 模式
      onboardArgs += ` --auth-choice custom-api-key`;
      onboardArgs += ` --custom-api-key "${model.apiKey}"`;
      onboardArgs += ` --custom-base-url "${model.endpoint}"`;
      onboardArgs += ` --custom-model-id "${model.model}"`;
      onboardArgs += ` --custom-provider-id "${model.provider}"`;
      onboardArgs += ` --custom-compatibility openai`;
    } else {
      // 使用内置 provider
      onboardArgs += ` --auth-choice ${authChoice}`;
      onboardArgs += ` --${authChoice.replace(/-/g, '-')} "${model.apiKey}"`;
    }
  }

  script += `echo "🚀 配置并启动 OpenClaw Gateway..."
openclaw onboard ${onboardArgs}

`;

  // 在 onboard 之后配置渠道
  if (channels.length > 0) {
    script += `echo "⚙️  配置通信渠道..."
`;
    channels.forEach(channel => {
      script += generateChannelConfig(channel);
    });
  }

  script += `# 应用渠道配置更改
openclaw doctor --fix 2>/dev/null || true

echo ""
echo "=========================================="
echo "✅ OpenClaw 安装完成！"
echo "=========================================="
echo ""
echo "📋 常用命令："
echo "  openclaw dashboard    - 打开控制面板"
echo "  openclaw gateway status - 查看 Gateway 状态"
echo "  openclaw --help       - 查看所有命令"
echo ""
echo "🌐 控制面板地址："
echo "  http://127.0.0.1:18789/"
echo ""

# 等待 Gateway 启动
sleep 3

# 自动打开 Dashboard
echo "🚀 正在打开控制面板..."
if command -v open &> /dev/null; then
  open "http://127.0.0.1:18789/"
elif command -v xdg-open &> /dev/null; then
  xdg-open "http://127.0.0.1:18789/"
fi

echo ""
echo "💡 提示：如果浏览器没有自动打开，请手动访问上面的地址"
`;

  return script;
}

function generateWindowsInstallScript(channels: ChannelConfig[], model: ModelConfig | null): string {
  let script = `Write-Host "📦 安装 OpenClaw..." -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 未检测到 Node.js" -ForegroundColor Red
    exit 1
}

Write-Host "⬇️  安装 OpenClaw..." -ForegroundColor Cyan
npm install -g openclaw@latest

`;

  // 构建 onboard 命令参数
  let onboardArgs = '--non-interactive --accept-risk --install-daemon --skip-channels --skip-skills --skip-search --skip-ui --skip-health';

  if (model) {
    const authChoice = getAuthChoiceForProvider(model.provider, !!model.endpoint);

    if (model.endpoint) {
      onboardArgs += ` --auth-choice custom-api-key`;
      onboardArgs += ` --custom-api-key "${model.apiKey}"`;
      onboardArgs += ` --custom-base-url "${model.endpoint}"`;
      onboardArgs += ` --custom-model-id "${model.model}"`;
      onboardArgs += ` --custom-provider-id "${model.provider}"`;
      onboardArgs += ` --custom-compatibility openai`;
    } else {
      onboardArgs += ` --auth-choice ${authChoice}`;
      onboardArgs += ` --${authChoice.replace(/-/g, '-')} "${model.apiKey}"`;
    }
  }

  script += `Write-Host "🚀 配置并启动 OpenClaw Gateway..." -ForegroundColor Cyan
openclaw onboard ${onboardArgs}

`;

  if (channels.length > 0) {
    script += `Write-Host "⚙️  配置通信渠道..." -ForegroundColor Cyan
`;
    channels.forEach(channel => {
      script += generateChannelConfigForWindows(channel);
    });
  }

  script += `# 应用渠道配置更改
openclaw doctor --fix 2>$null

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ OpenClaw 安装完成！" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 常用命令：" -ForegroundColor Yellow
Write-Host "  openclaw dashboard      - 打开控制面板"
Write-Host "  openclaw gateway status - 查看 Gateway 状态"
Write-Host "  openclaw --help         - 查看所有命令"
Write-Host ""
Write-Host "🌐 控制面板地址：" -ForegroundColor Yellow
Write-Host "  http://127.0.0.1:18789/"
Write-Host ""

# 等待 Gateway 启动
Start-Sleep -Seconds 3

# 自动打开 Dashboard
Write-Host "🚀 正在打开控制面板..." -ForegroundColor Cyan
Start-Process "http://127.0.0.1:18789/"

Write-Host ""
Write-Host "💡 提示：如果浏览器没有自动打开，请手动访问上面的地址" -ForegroundColor Gray
`;

  return script;
}

function getAuthChoiceForProvider(provider: string, hasCustomEndpoint?: boolean): string {
  if (hasCustomEndpoint) {
    return 'custom-api-key';
  }

  // 映射 provider 到 OpenClaw 的 auth-choice
  const providerMap: Record<string, string> = {
    'openai': 'openai-api-key',
    'anthropic': 'anthropic-api-key',
    'gemini': 'gemini-api-key',
    'mistral': 'mistral-api-key',
    'openrouter': 'openrouter-api-key',
    'together': 'together-api-key',
    'huggingface': 'huggingface-api-key',
    'moonshot': 'moonshot-api-key',
    'zai': 'zai-api-key',
    'xiaomi': 'xiaomi-api-key',
    'minimax': 'minimax-api-key',
    'qianfan': 'qianfan-api-key',
    'volcengine': 'volcengine-api-key',
    'byteplus': 'byteplus-api-key',
    'xai': 'xai-api-key',
    'venice': 'venice-api-key',
    'litellm': 'litellm-api-key',
    'kilocode': 'kilocode-api-key',
    'kimi-code': 'kimi-code-api-key',
    'synthetic': 'synthetic-api-key',
    'ai-gateway': 'ai-gateway-api-key',
    'cloudflare-ai-gateway': 'cloudflare-ai-gateway-api-key',
    'doubao': 'custom-api-key',  // 豆包使用自定义 endpoint
  };

  return providerMap[provider.toLowerCase()] || 'custom-api-key';
}

function generateChannelConfig(channel: ChannelConfig): string {
  const { type, credentials } = channel;
  let config = '';

  switch (type) {
    case 'telegram':
      config = `openclaw config set channels.telegram.enabled true\n`;
      config += `openclaw config set channels.telegram.botToken "${credentials.botToken}"\n`;
      break;

    case 'feishu':
      config = `openclaw config set channels.feishu.enabled true\n`;
      config += `openclaw config set channels.feishu.appId "${credentials.appId}"\n`;
      config += `openclaw config set channels.feishu.appSecret "${credentials.appSecret}"\n`;
      break;

    case 'discord':
      config = `openclaw config set channels.discord.enabled true\n`;
      config += `openclaw config set channels.discord.token "${credentials.token || credentials.botToken}"\n`;
      break;

    case 'slack':
      config = `openclaw config set channels.slack.enabled true\n`;
      config += `openclaw config set channels.slack.botToken "${credentials.botToken}"\n`;
      config += `openclaw config set channels.slack.signingSecret "${credentials.signingSecret}"\n`;
      break;

    case 'whatsapp':
      config = `openclaw config set channels.whatsapp.enabled true\n`;
      config += `openclaw config set channels.whatsapp.sessionId "${credentials.sessionId}"\n`;
      break;

    case 'googlechat':
      config = `openclaw config set channels.googlechat.enabled true\n`;
      config += `openclaw config set channels.googlechat.serviceAccount '${credentials.serviceAccount}'\n`;
      break;

    case 'signal':
      config = `openclaw config set channels.signal.enabled true\n`;
      config += `openclaw config set channels.signal.account "${credentials.account}"\n`;
      config += `openclaw config set channels.signal.httpUrl "${credentials.httpUrl}"\n`;
      break;

    case 'bluebubbles':
      config = `openclaw config set channels.bluebubbles.enabled true\n`;
      config += `openclaw config set channels.bluebubbles.serverUrl "${credentials.serverUrl}"\n`;
      config += `openclaw config set channels.bluebubbles.password "${credentials.password}"\n`;
      break;

    case 'imessage':
      config = `openclaw config set channels.imessage.enabled true\n`;
      if (credentials.dbPath) {
        config += `openclaw config set channels.imessage.dbPath "${credentials.dbPath}"\n`;
      }
      break;

    case 'irc':
      config = `openclaw config set channels.irc.enabled true\n`;
      config += `openclaw config set channels.irc.host "${credentials.host}"\n`;
      config += `openclaw config set channels.irc.nick "${credentials.nick}"\n`;
      if (credentials.channels) {
        config += `openclaw config set channels.irc.channels "${credentials.channels}"\n`;
      }
      break;

    case 'msteams':
      config = `openclaw config set channels.msteams.enabled true\n`;
      config += `openclaw config set channels.msteams.appId "${credentials.appId}"\n`;
      config += `openclaw config set channels.msteams.appPassword "${credentials.appPassword}"\n`;
      config += `openclaw config set channels.msteams.tenantId "${credentials.tenantId}"\n`;
      break;

    case 'matrix':
      config = `openclaw config set channels.matrix.enabled true\n`;
      config += `openclaw config set channels.matrix.homeserver "${credentials.homeserver}"\n`;
      config += `openclaw config set channels.matrix.accessToken "${credentials.accessToken}"\n`;
      config += `openclaw config set channels.matrix.userId "${credentials.userId}"\n`;
      break;

    case 'line':
      config = `openclaw config set channels.line.enabled true\n`;
      config += `openclaw config set channels.line.channelAccessToken "${credentials.channelAccessToken}"\n`;
      config += `openclaw config set channels.line.channelSecret "${credentials.channelSecret}"\n`;
      break;

    case 'mattermost':
      config = `openclaw config set channels.mattermost.enabled true\n`;
      config += `openclaw config set channels.mattermost.token "${credentials.token}"\n`;
      config += `openclaw config set channels.mattermost.serverUrl "${credentials.serverUrl}"\n`;
      break;

    case 'nextcloud':
      config = `openclaw config set channels.nextcloud.enabled true\n`;
      config += `openclaw config set channels.nextcloud.serverUrl "${credentials.serverUrl}"\n`;
      config += `openclaw config set channels.nextcloud.username "${credentials.username}"\n`;
      config += `openclaw config set channels.nextcloud.password "${credentials.password}"\n`;
      break;

    case 'nostr':
      config = `openclaw config set channels.nostr.enabled true\n`;
      config += `openclaw config set channels.nostr.privateKey "${credentials.privateKey}"\n`;
      if (credentials.relays) {
        config += `openclaw config set channels.nostr.relays "${credentials.relays}"\n`;
      }
      break;

    case 'synology':
      config = `openclaw config set channels.synology.enabled true\n`;
      config += `openclaw config set channels.synology.token "${credentials.token}"\n`;
      config += `openclaw config set channels.synology.serverUrl "${credentials.serverUrl}"\n`;
      break;

    case 'twitch':
      config = `openclaw config set channels.twitch.enabled true\n`;
      config += `openclaw config set channels.twitch.token "${credentials.token}"\n`;
      config += `openclaw config set channels.twitch.clientId "${credentials.clientId}"\n`;
      config += `openclaw config set channels.twitch.channel "${credentials.channel}"\n`;
      break;

    case 'zalo':
      config = `openclaw config set channels.zalo.enabled true\n`;
      config += `openclaw config set channels.zalo.appId "${credentials.appId}"\n`;
      config += `openclaw config set channels.zalo.appSecret "${credentials.appSecret}"\n`;
      break;

    case 'webchat':
      config = `openclaw config set channels.webchat.enabled true\n`;
      break;

    default:
      // 通用配置
      config = `openclaw config set channels.${type}.enabled true\n`;
      Object.entries(credentials).forEach(([key, value]) => {
        config += `openclaw config set channels.${type}.${key} "${value}"\n`;
      });
  }

  return config;
}

function generateChannelConfigForWindows(channel: ChannelConfig): string {
  const { type, credentials } = channel;
  let config = '';

  switch (type) {
    case 'telegram':
      config = `openclaw config set channels.telegram.enabled true\n`;
      config += `openclaw config set channels.telegram.botToken "${credentials.botToken}"\n`;
      break;

    case 'feishu':
      config = `openclaw config set channels.feishu.enabled true\n`;
      config += `openclaw config set channels.feishu.appId "${credentials.appId}"\n`;
      config += `openclaw config set channels.feishu.appSecret "${credentials.appSecret}"\n`;
      break;

    case 'discord':
      config = `openclaw config set channels.discord.enabled true\n`;
      config += `openclaw config set channels.discord.token "${credentials.token || credentials.botToken}"\n`;
      break;

    case 'slack':
      config = `openclaw config set channels.slack.enabled true\n`;
      config += `openclaw config set channels.slack.botToken "${credentials.botToken}"\n`;
      config += `openclaw config set channels.slack.signingSecret "${credentials.signingSecret}"\n`;
      break;

    case 'whatsapp':
      config = `openclaw config set channels.whatsapp.enabled true\n`;
      config += `openclaw config set channels.whatsapp.sessionId "${credentials.sessionId}"\n`;
      break;

    case 'googlechat':
      config = `openclaw config set channels.googlechat.enabled true\n`;
      config += `openclaw config set channels.googlechat.serviceAccount '${credentials.serviceAccount}'\n`;
      break;

    case 'signal':
      config = `openclaw config set channels.signal.enabled true\n`;
      config += `openclaw config set channels.signal.account "${credentials.account}"\n`;
      config += `openclaw config set channels.signal.httpUrl "${credentials.httpUrl}"\n`;
      break;

    case 'bluebubbles':
      config = `openclaw config set channels.bluebubbles.enabled true\n`;
      config += `openclaw config set channels.bluebubbles.serverUrl "${credentials.serverUrl}"\n`;
      config += `openclaw config set channels.bluebubbles.password "${credentials.password}"\n`;
      break;

    case 'imessage':
      config = `openclaw config set channels.imessage.enabled true\n`;
      if (credentials.dbPath) {
        config += `openclaw config set channels.imessage.dbPath "${credentials.dbPath}"\n`;
      }
      break;

    case 'irc':
      config = `openclaw config set channels.irc.enabled true\n`;
      config += `openclaw config set channels.irc.host "${credentials.host}"\n`;
      config += `openclaw config set channels.irc.nick "${credentials.nick}"\n`;
      if (credentials.channels) {
        config += `openclaw config set channels.irc.channels "${credentials.channels}"\n`;
      }
      break;

    case 'msteams':
      config = `openclaw config set channels.msteams.enabled true\n`;
      config += `openclaw config set channels.msteams.appId "${credentials.appId}"\n`;
      config += `openclaw config set channels.msteams.appPassword "${credentials.appPassword}"\n`;
      config += `openclaw config set channels.msteams.tenantId "${credentials.tenantId}"\n`;
      break;

    case 'matrix':
      config = `openclaw config set channels.matrix.enabled true\n`;
      config += `openclaw config set channels.matrix.homeserver "${credentials.homeserver}"\n`;
      config += `openclaw config set channels.matrix.accessToken "${credentials.accessToken}"\n`;
      config += `openclaw config set channels.matrix.userId "${credentials.userId}"\n`;
      break;

    case 'line':
      config = `openclaw config set channels.line.enabled true\n`;
      config += `openclaw config set channels.line.channelAccessToken "${credentials.channelAccessToken}"\n`;
      config += `openclaw config set channels.line.channelSecret "${credentials.channelSecret}"\n`;
      break;

    case 'mattermost':
      config = `openclaw config set channels.mattermost.enabled true\n`;
      config += `openclaw config set channels.mattermost.token "${credentials.token}"\n`;
      config += `openclaw config set channels.mattermost.serverUrl "${credentials.serverUrl}"\n`;
      break;

    case 'nextcloud':
      config = `openclaw config set channels.nextcloud.enabled true\n`;
      config += `openclaw config set channels.nextcloud.serverUrl "${credentials.serverUrl}"\n`;
      config += `openclaw config set channels.nextcloud.username "${credentials.username}"\n`;
      config += `openclaw config set channels.nextcloud.password "${credentials.password}"\n`;
      break;

    case 'nostr':
      config = `openclaw config set channels.nostr.enabled true\n`;
      config += `openclaw config set channels.nostr.privateKey "${credentials.privateKey}"\n`;
      if (credentials.relays) {
        config += `openclaw config set channels.nostr.relays "${credentials.relays}"\n`;
      }
      break;

    case 'synology':
      config = `openclaw config set channels.synology.enabled true\n`;
      config += `openclaw config set channels.synology.token "${credentials.token}"\n`;
      config += `openclaw config set channels.synology.serverUrl "${credentials.serverUrl}"\n`;
      break;

    case 'twitch':
      config = `openclaw config set channels.twitch.enabled true\n`;
      config += `openclaw config set channels.twitch.token "${credentials.token}"\n`;
      config += `openclaw config set channels.twitch.clientId "${credentials.clientId}"\n`;
      config += `openclaw config set channels.twitch.channel "${credentials.channel}"\n`;
      break;

    case 'zalo':
      config = `openclaw config set channels.zalo.enabled true\n`;
      config += `openclaw config set channels.zalo.appId "${credentials.appId}"\n`;
      config += `openclaw config set channels.zalo.appSecret "${credentials.appSecret}"\n`;
      break;

    case 'webchat':
      config = `openclaw config set channels.webchat.enabled true\n`;
      break;

    default:
      // 通用配置
      config = `openclaw config set channels.${type}.enabled true\n`;
      Object.entries(credentials).forEach(([key, value]) => {
        config += `openclaw config set channels.${type}.${key} "${value}"\n`;
      });
  }

  return config;
}
