import { LoginForm } from 'wasp/client/auth';

export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">OpenClaw Manager</h2>
          <p className="mt-2 text-sm text-gray-600">卡密管理系统</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
