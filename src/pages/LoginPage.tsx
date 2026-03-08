import "../index.css";
import { ChineseLoginForm } from "../auth/LoginForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold tracking-tight">
            OpenClaw 许可证管理系统
          </CardTitle>
          <CardDescription className="text-base">
            请使用管理员账号登录
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChineseLoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
