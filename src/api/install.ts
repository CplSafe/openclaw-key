import type { Request, Response } from "express";
import { prisma } from "wasp/server";
import { decrypt } from "../utils/crypto.js";
import {
  generateVerifyScript,
  generateInstallScript,
} from "../utils/scriptGenerator.js";
import { lookupIpGeo } from "../utils/geoip.js";

export const handleInstallScript = async (
  req: Request,
  res: Response,
  _context?: any,
) => {
  const token = req.params.token as string;
  const tokenId = token.replace(/\.(sh|ps1)$/, "");
  const isWindows = token.endsWith(".ps1");

  try {
    const license = await prisma.licenseKey.findUnique({
      where: { token: tokenId },
    });

    if (!license) {
      res.status(404).send('echo "❌ 安装令牌无效"');
      return;
    }

    if (license.status !== "unused") {
      res.status(403).send('echo "❌ 此安装令牌已被使用或已撤销"');
      return;
    }

    const apiBase =
      process.env.API_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const verifyScript = generateVerifyScript(tokenId, isWindows, apiBase);

    res.setHeader(
      "Content-Type",
      isWindows ? "text/plain" : "application/x-sh",
    );
    res.send(verifyScript);
  } catch (error: any) {
    console.error("Install script error:", error);
    res.status(500).send('echo "❌ 服务器错误"');
  }
};

export const handleVerifyInstall = async (
  req: Request,
  res: Response,
  _context?: any,
) => {
  const { token, machineId, osType } = req.body;
  const ipAddress = (req.ip ||
    req.headers["x-forwarded-for"] ||
    "unknown") as string;

  try {
    const license = await prisma.licenseKey.findUnique({
      where: { token },
      include: {
        channels: true,
        modelConfig: true,
      },
    });

    if (!license) {
      res.status(404).json({ error: "安装令牌无效" });
      return;
    }

    if (license.status !== "unused") {
      res.status(403).json({ error: "此令牌已被使用或已撤销" });
      return;
    }

    // Lookup geolocation for the IP
    const geo = await lookupIpGeo(ipAddress);

    // 更新卡密状态
    await prisma.licenseKey.update({
      where: { id: license.id },
      data: {
        status: "used",
        machineId,
        osType,
        ipAddress,
        city: geo.city,
        country: geo.country,
        latitude: geo.latitude,
        longitude: geo.longitude,
        usedAt: new Date(),
      },
    });

    // 记录成功日志
    await prisma.installLog.create({
      data: {
        licenseId: license.id,
        machineId,
        ipAddress,
        osType,
        status: "success",
        city: geo.city,
        country: geo.country,
        latitude: geo.latitude,
        longitude: geo.longitude,
      },
    });

    // 解密配置
    const channelsConfig = license.channels.map((ch) => ({
      type: ch.channelType,
      credentials: JSON.parse(decrypt(ch.credentials)),
    }));

    const modelConfig = license.modelConfig
      ? {
          provider: license.modelConfig.provider,
          model: license.modelConfig.modelName,
          apiKey: decrypt(license.modelConfig.apiKey),
          endpoint: license.modelConfig.apiEndpoint || undefined,
        }
      : null;

    // 生成安装脚本
    const installScript = generateInstallScript({
      channels: channelsConfig,
      model: modelConfig,
      osType,
    });

    res.json({ script: installScript });
  } catch (error: any) {
    console.error("Verify install error:", error);

    // 记录失败日志
    if (token) {
      try {
        const license = await prisma.licenseKey.findUnique({
          where: { token },
        });
        if (license) {
          await prisma.installLog.create({
            data: {
              licenseId: license.id,
              machineId: machineId || "unknown",
              ipAddress: ipAddress || "unknown",
              osType: osType || "unknown",
              status: "failed",
              errorMsg: error.message,
            },
          });
        }
      } catch (logError) {
        console.error("Failed to log error:", logError);
      }
    }

    res.status(500).json({ error: "验证失败，请联系管理员" });
  }
};
