import type { GetLicenses } from 'wasp/server/operations';
import { HttpError } from 'wasp/server';

export const getLicenses: GetLicenses = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, '未授权');
  }

  const licenses = await context.entities.LicenseKey.findMany({
    include: {
      channels: true,
      modelConfig: true,
      installLogs: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return licenses.map(license => ({
    id: license.id,
    token: license.token,
    status: license.status,
    machineId: license.machineId,
    osType: license.osType,
    ipAddress: license.ipAddress,
    createdAt: license.createdAt,
    usedAt: license.usedAt,
    channelCount: license.channels.length,
    hasModel: !!license.modelConfig,
    lastInstallLog: license.installLogs[0] || null
  }));
};
