import { Link } from "wasp/client/router";
import { useAuth } from "wasp/client/auth";
import { logout } from "wasp/client/auth";
import {
  LayoutDashboard,
  KeyRound,
  Settings,
  LogOut,
  Shield,
} from "lucide-react";

type NavItem = {
  label: string;
  to: "/" | "/licenses" | "/settings";
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  {
    label: "仪表盘",
    to: "/",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    label: "卡密管理",
    to: "/licenses",
    icon: <KeyRound className="h-5 w-5" />,
  },
  {
    label: "账号设置",
    to: "/settings",
    icon: <Settings className="h-5 w-5" />,
  },
];

export function Layout({
  children,
  activeRoute,
}: {
  children: React.ReactNode;
  activeRoute: string;
}) {
  const { data: user } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Left Sidebar */}
      <aside className="w-60 bg-white border-r flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2 px-5 border-b">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold tracking-tight">OpenClaw</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = activeRoute === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom logout */}
        <div className="px-3 py-4 border-t">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors w-full"
          >
            <LogOut className="h-5 w-5" />
            退出登录
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-white/50 backdrop-blur-sm border-b flex items-center justify-end px-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary">
                {user?.username?.charAt(0)?.toUpperCase() || "A"}
              </span>
            </div>
            <div className="text-sm">
              <div className="font-medium">{user?.username || "管理员"}</div>
              <div className="text-xs text-muted-foreground">管理员</div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
