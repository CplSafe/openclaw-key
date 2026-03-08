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

echo "⚙️  配置通信渠道..."
`;

  // 添加渠道配置
  channels.forEach(channel => {
    script += generateChannelConfig(channel);
  });

  // 添加模型配置
  if (model) {
    script += `
echo "🤖 配置 AI 模型..."
openclaw config set models.default.provider "${model.provider}"
openclaw config set models.default.model "${model.model}"
openclaw config set models.default.apiKey "${model.apiKey}"
`;
    if (model.endpoint) {
      script += `openclaw config set models.default.endpoint "${model.endpoint}"\n`;
    }
  }

  script += `
echo "🚀 启动 OpenClaw Gateway..."
openclaw onboard --install-daemon --skip-wizard

echo ""
echo "✅ OpenClaw 安装完成！"
echo ""
echo "运行以下命令查看状态："
echo "  openclaw gateway status"
echo "  openclaw dashboard"
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

Write-Host "⚙️  配置通信渠道..." -ForegroundColor Cyan
`;

  channels.forEach(channel => {
    script += generateChannelConfig(channel);
  });

  if (model) {
    script += `
Write-Host "🤖 配置 AI 模型..." -ForegroundColor Cyan
openclaw config set models.default.provider "${model.provider}"
openclaw config set models.default.model "${model.model}"
openclaw config set models.default.apiKey "${model.apiKey}"
`;
  }

  script += `
Write-Host "✅ 安装完成！" -ForegroundColor Green
`;

  return script;
}

function generateChannelConfig(channel: ChannelConfig): string {
  const { type, credentials } = channel;
  let config = '';

  switch (type) {
    case 'telegram':
      config = `openclaw config set channels.telegram.enabled true\n`;
      config += `openclaw config set channels.telegram.token "${credentials.botToken}"\n`;
      break;

    case 'feishu':
      config = `openclaw config set channels.feishu.enabled true\n`;
      config += `openclaw config set channels.feishu.appId "${credentials.appId}"\n`;
      config += `openclaw config set channels.feishu.appSecret "${credentials.appSecret}"\n`;
      break;

    case 'discord':
      config = `openclaw config set channels.discord.enabled true\n`;
      config += `openclaw config set channels.discord.token "${credentials.botToken}"\n`;
      break;

    case 'slack':
      config = `openclaw config set channels.slack.enabled true\n`;
      config += `openclaw config set channels.slack.token "${credentials.botToken}"\n`;
      config += `openclaw config set channels.slack.signingSecret "${credentials.signingSecret}"\n`;
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
