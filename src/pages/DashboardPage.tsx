import "../index.css";
import { useQuery } from "wasp/client/operations";
import { getLicenses } from "wasp/client/operations";
import { Layout } from "../components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Activity, CheckCircle2, Clock, MapPin } from "lucide-react";

type License = {
  id: string;
  token: string;
  status: string;
  machineId?: string | null;
  ipAddress?: string | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  usedAt?: Date | null;
  lastInstallLog?: any;
};

export function DashboardPage() {
  const { data: licenses, isLoading } = useQuery(getLicenses);

  if (isLoading) {
    return (
      <Layout activeRoute="/">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </Layout>
    );
  }

  const licenseList = (licenses as License[]) || [];
  const totalCount = licenseList.length;
  const usedCount = licenseList.filter((l) => l.status === "used").length;
  const unusedCount = licenseList.filter((l) => l.status === "unused").length;

  // Collect used licenses with location data for map
  const usedLicenses = licenseList.filter(
    (l) => l.status === "used" && l.latitude && l.longitude,
  );

  return (
    <Layout activeRoute="/">
      <h2 className="text-3xl font-bold tracking-tight mb-8">仪表盘</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总卡密数</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              系统中的所有卡密
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已使用</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{usedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">已激活的卡密</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">未使用</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {unusedCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              等待激活的卡密
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Map Distribution */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            卡密使用地图分布
          </CardTitle>
          <CardDescription>已激活卡密的地理位置分布</CardDescription>
        </CardHeader>
        <CardContent>
          <ActivationMap licenses={usedLicenses} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>最近安装记录</CardTitle>
          <CardDescription>最近激活的卡密列表</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {licenseList
              .filter((l: License) => l.lastInstallLog)
              .slice(0, 5)
              .map((license: License) => (
                <div
                  key={license.id}
                  className="flex items-center justify-between border-b last:border-0 pb-4 last:pb-0"
                >
                  <div className="space-y-1">
                    <div className="font-mono text-sm font-medium">
                      {license.token.substring(0, 12)}...
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {license.machineId?.substring(0, 16)}...
                      {license.city && (
                        <span className="ml-2">
                          {license.city}
                          {license.country ? `, ${license.country}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {license.status === "used" ? "已使用" : "未使用"}
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      {new Date(license.usedAt!).toLocaleString("zh-CN")}
                    </div>
                  </div>
                </div>
              ))}
            {licenseList.filter((l: License) => l.lastInstallLog).length ===
              0 && (
              <div className="text-center text-muted-foreground py-8">
                暂无安装记录
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}

/**
 * Simple SVG-based world map with activation points.
 * Uses a basic equirectangular projection for lat/lng to pixel mapping.
 */
function ActivationMap({ licenses }: { licenses: License[] }) {
  const MAP_WIDTH = 900;
  const MAP_HEIGHT = 450;

  if (licenses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        暂无地理位置数据，卡密激活后将在此显示分布图
      </div>
    );
  }

  // Equirectangular projection: lng [-180,180] -> x [0, width], lat [-90,90] -> y [height, 0]
  const toX = (lng: number) => ((lng + 180) / 360) * MAP_WIDTH;
  const toY = (lat: number) => ((90 - lat) / 180) * MAP_HEIGHT;

  // Group by location to count density
  const locationMap = new Map<string, { x: number; y: number; count: number; city: string }>();
  for (const l of licenses) {
    if (!l.latitude || !l.longitude) continue;
    const key = `${l.latitude.toFixed(1)},${l.longitude.toFixed(1)}`;
    const existing = locationMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      locationMap.set(key, {
        x: toX(l.longitude),
        y: toY(l.latitude),
        count: 1,
        city: l.city || "未知",
      });
    }
  }

  const points = Array.from(locationMap.values());

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-slate-50 border">
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="w-full h-auto"
        style={{ maxHeight: "400px" }}
      >
        {/* Simplified world map outline - major continents */}
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#f1f5f9" />

        {/* Grid lines */}
        {Array.from({ length: 7 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={(i * MAP_HEIGHT) / 6}
            x2={MAP_WIDTH}
            y2={(i * MAP_HEIGHT) / 6}
            stroke="#e2e8f0"
            strokeWidth={0.5}
          />
        ))}
        {Array.from({ length: 13 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={(i * MAP_WIDTH) / 12}
            y1={0}
            x2={(i * MAP_WIDTH) / 12}
            y2={MAP_HEIGHT}
            stroke="#e2e8f0"
            strokeWidth={0.5}
          />
        ))}

        {/* Simplified continent shapes */}
        {/* North America */}
        <path
          d="M 100,60 L 140,55 160,70 180,80 200,75 220,85 230,100 240,120 235,140 225,160 210,170 200,165 180,175 160,180 140,170 130,155 120,140 115,120 105,100 100,80 Z"
          fill="#cbd5e1"
          stroke="#94a3b8"
          strokeWidth={0.5}
        />
        {/* South America */}
        <path
          d="M 190,200 L 210,195 225,210 230,230 235,260 230,290 225,320 215,340 200,350 185,340 180,310 175,280 178,250 182,220 Z"
          fill="#cbd5e1"
          stroke="#94a3b8"
          strokeWidth={0.5}
        />
        {/* Europe */}
        <path
          d="M 420,60 L 440,55 460,60 480,65 490,80 485,95 475,100 460,105 445,100 435,90 425,80 Z"
          fill="#cbd5e1"
          stroke="#94a3b8"
          strokeWidth={0.5}
        />
        {/* Africa */}
        <path
          d="M 430,140 L 460,135 480,150 490,170 495,200 490,230 480,260 470,290 455,310 440,305 430,280 425,250 420,220 415,190 418,160 Z"
          fill="#cbd5e1"
          stroke="#94a3b8"
          strokeWidth={0.5}
        />
        {/* Asia */}
        <path
          d="M 490,50 L 530,45 570,50 610,55 650,60 690,70 720,80 740,100 750,120 740,140 720,150 700,155 680,160 660,155 640,150 620,145 600,140 580,130 560,120 540,110 520,100 500,90 495,70 Z"
          fill="#cbd5e1"
          stroke="#94a3b8"
          strokeWidth={0.5}
        />
        {/* China region highlight */}
        <path
          d="M 620,90 L 650,85 680,90 700,100 710,120 700,140 680,150 660,145 640,140 625,130 615,115 618,100 Z"
          fill="#b4c6db"
          stroke="#94a3b8"
          strokeWidth={0.5}
        />
        {/* Australia */}
        <path
          d="M 700,270 L 730,260 760,265 780,280 785,300 775,320 755,330 730,325 715,310 705,290 Z"
          fill="#cbd5e1"
          stroke="#94a3b8"
          strokeWidth={0.5}
        />

        {/* Activation points */}
        {points.map((point, idx) => (
          <g key={idx}>
            {/* Pulse ring */}
            <circle
              cx={point.x}
              cy={point.y}
              r={Math.min(6 + point.count * 3, 20)}
              fill="rgba(59, 130, 246, 0.15)"
              stroke="rgba(59, 130, 246, 0.3)"
              strokeWidth={1}
            >
              <animate
                attributeName="r"
                from={Math.min(6 + point.count * 3, 20)}
                to={Math.min(10 + point.count * 4, 30)}
                dur="2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                from="1"
                to="0"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
            {/* Center dot */}
            <circle
              cx={point.x}
              cy={point.y}
              r={Math.min(3 + point.count, 10)}
              fill="#3b82f6"
              stroke="#fff"
              strokeWidth={1.5}
            />
            {/* Label */}
            <text
              x={point.x}
              y={point.y - Math.min(5 + point.count, 14)}
              textAnchor="middle"
              fontSize="10"
              fill="#334155"
              fontWeight="600"
            >
              {point.city} ({point.count})
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
