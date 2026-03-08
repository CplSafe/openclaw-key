import "../index.css";
import { useState } from "react";
import { useAuth } from "wasp/client/auth";
import { logout } from "wasp/client/auth";
import { Layout } from "../components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Settings, Key } from "lucide-react";

export function SettingsPage() {
  const { data: user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!newUsername.trim()) {
      setError("用户名不能为空");
      return;
    }

    if (newUsername.trim().length < 3) {
      setError("用户名至少需要3个字符");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/update-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newUsername: newUsername.trim(),
        }),
        credentials: "include",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "修改失败");
      }

      setMessage("用户名修改成功！");
      setCurrentPassword("");
      setNewUsername("");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!currentPassword || !newPassword) {
      setError("请填写所有字段");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }

    if (newPassword.length < 6) {
      setError("密码长度至少6位");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
        credentials: "include",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "修改失败");
      }

      setMessage("密码修改成功！请重新登录");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        handleLogout();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout activeRoute="/settings">
      <div className="max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-3xl font-bold tracking-tight">账号设置</h2>
            <p className="text-muted-foreground">管理您的账号信息和安全设置</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Current account info */}
          <Card>
            <CardHeader>
              <CardTitle>当前账号信息</CardTitle>
              <CardDescription>您当前登录的账号</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">用户名</Label>
                  <p className="text-lg font-medium">
                    {user?.username || "未知"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">账号类型</Label>
                  <p className="text-lg font-medium">
                    {user?.isAdmin ? "管理员" : "普通用户"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Change username */}
          <Card>
            <CardHeader>
              <CardTitle>修改用户名</CardTitle>
              <CardDescription>更改您的登录用户名</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangeUsername} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword1">当前密码</Label>
                  <Input
                    id="currentPassword1"
                    type="password"
                    placeholder="输入当前密码以验证身份"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newUsername">新用户名</Label>
                  <Input
                    id="newUsername"
                    type="text"
                    placeholder="输入新用户名 (至少3个字符)"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    required
                    minLength={3}
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "修改中..." : "修改用户名"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Change password */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                修改密码
              </CardTitle>
              <CardDescription>
                更改您的登录密码（修改后需要重新登录）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword2">当前密码</Label>
                    <Input
                      id="currentPassword2"
                      type="password"
                      placeholder="输入当前密码"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">新密码</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="输入新密码 (至少6位)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">确认新密码</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="再次输入新密码"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? "修改中..." : "修改密码"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Messages */}
        {message && (
          <div className="fixed bottom-4 right-4 p-4 bg-green-100 border border-green-300 text-green-800 rounded-lg shadow-lg z-50">
            {message}
          </div>
        )}
        {error && (
          <div className="fixed bottom-4 right-4 p-4 bg-red-100 border border-red-300 text-red-800 rounded-lg shadow-lg z-50">
            {error}
          </div>
        )}
      </div>
    </Layout>
  );
}
