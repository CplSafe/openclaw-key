import { useState } from 'react';
import { useQuery } from 'wasp/client/operations';
import { getLicenses } from 'wasp/client/operations';
import { Link } from 'wasp/client/router';
import { CreateLicenseModal } from '../components/CreateLicenseModal';

export function LicensePage() {
  const { data: licenses, isLoading, refetch } = useQuery(getLicenses);
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) return <div>加载中...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">OpenClaw Manager</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-gray-700 hover:text-gray-900">
                仪表盘
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">卡密管理</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + 创建卡密
          </button>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">令牌</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">机器码</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">渠道数</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {licenses?.map(license => (
                <tr key={license.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                    {license.token.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={license.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {license.machineId ? license.machineId.substring(0, 12) + '...' : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {license.channelCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(license.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {license.status === 'unused' && (
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/api/install/${license.token}.sh`;
                          navigator.clipboard.writeText(`curl -fsSL ${url} | bash`);
                          alert('安装命令已复制！');
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        复制安装命令
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showCreate && (
          <CreateLicenseModal
            onClose={() => setShowCreate(false)}
            onSuccess={() => {
              setShowCreate(false);
              refetch();
            }}
          />
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    unused: 'bg-green-100 text-green-800',
    used: 'bg-gray-100 text-gray-800',
    revoked: 'bg-red-100 text-red-800'
  };

  const labels: Record<string, string> = {
    unused: '未使用',
    used: '已使用',
    revoked: '已撤销'
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}
