import { useQuery } from 'wasp/client/operations';
import { getLicenses } from 'wasp/client/operations';
import { Link } from 'wasp/client/router';

export function DashboardPage() {
  const { data: licenses, isLoading } = useQuery(getLicenses);

  if (isLoading) return <div>加载中...</div>;

  const totalCount = licenses?.length || 0;
  const usedCount = licenses?.filter(l => l.status === 'used').length || 0;
  const unusedCount = licenses?.filter(l => l.status === 'unused').length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">OpenClaw Manager</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/licenses" className="text-gray-700 hover:text-gray-900">
                卡密管理
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold mb-6">仪表盘</h2>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="text-sm font-medium text-gray-500">总卡密数</div>
              <div className="mt-1 text-3xl font-semibold text-gray-900">{totalCount}</div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="text-sm font-medium text-gray-500">已使用</div>
              <div className="mt-1 text-3xl font-semibold text-green-600">{usedCount}</div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="text-sm font-medium text-gray-500">未使用</div>
              <div className="mt-1 text-3xl font-semibold text-blue-600">{unusedCount}</div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">最近安装记录</h3>
          <div className="space-y-3">
            {licenses?.filter(l => l.lastInstallLog).slice(0, 5).map(license => (
              <div key={license.id} className="flex justify-between items-center border-b pb-2">
                <div>
                  <div className="font-mono text-sm">{license.token.substring(0, 12)}...</div>
                  <div className="text-xs text-gray-500">
                    {license.machineId?.substring(0, 16)}...
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(license.usedAt!).toLocaleString('zh-CN')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
