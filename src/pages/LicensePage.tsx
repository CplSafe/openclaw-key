import "../index.css";
import { useState } from "react";
import { useQuery } from "wasp/client/operations";
import { getLicenses } from "wasp/client/operations";
import { Layout } from "../components/Layout";
import { CreateLicenseModal } from "../components/CreateLicenseModal";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Copy, Plus } from "lucide-react";

type License = {
  id: string;
  token: string;
  status: string;
  machineId?: string | null;
  ipAddress?: string | null;
  city?: string | null;
  country?: string | null;
  channelCount: number;
  createdAt: Date;
};

export function LicensePage() {
  const { data: licenses, isLoading, refetch } = useQuery(getLicenses);
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) {
    return (
      <Layout activeRoute="/licenses">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </Layout>
    );
  }

  const licenseList = (licenses as License[]) || [];

  return (
    <Layout activeRoute="/licenses">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold tracking-tight">卡密管理</h2>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          创建卡密
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>令牌</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>机器码</TableHead>
              <TableHead>IP / 位置</TableHead>
              <TableHead>渠道数</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {licenseList.map((license: License) => (
              <TableRow key={license.id}>
                <TableCell className="font-mono text-sm">
                  {license.token.substring(0, 8)}...
                </TableCell>
                <TableCell>
                  <StatusBadge status={license.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {license.machineId
                    ? license.machineId.substring(0, 12) + "..."
                    : "-"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {license.ipAddress ? (
                    <div>
                      <div>{license.ipAddress}</div>
                      {license.city && (
                        <div className="text-xs">
                          {license.city}
                          {license.country ? `, ${license.country}` : ""}
                        </div>
                      )}
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {license.channelCount}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(license.createdAt).toLocaleDateString("zh-CN")}
                </TableCell>
                <TableCell>
                  {license.status === "unused" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const url = `${window.location.origin}/api/install/${license.token}.sh`;
                        navigator.clipboard.writeText(
                          `curl -fsSL ${url} | bash`,
                        );
                        alert("安装命令已复制！");
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      复制命令
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {showCreate && (
        <CreateLicenseModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            refetch();
          }}
        />
      )}
    </Layout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive"> = {
    unused: "default",
    used: "secondary",
    revoked: "destructive",
  };

  const labels: Record<string, string> = {
    unused: "未使用",
    used: "已使用",
    revoked: "已撤销",
  };

  return (
    <Badge variant={variants[status] || "secondary"}>
      {labels[status] || status}
    </Badge>
  );
}
