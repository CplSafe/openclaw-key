import type { CreateLicense, RevokeLicense } from 'wasp/server/operations';
import { HttpError } from 'wasp/server';
import { v4 as uuidv4 } from 'uuid';
import { encrypt } from './utils/crypto.js';

interface ChannelInput {
  type: string;
  credentials: Record<string, any>;
}

interface ModelInput {
  provider: string;
  modelName: string;
  apiKey: string;
  apiEndpoint?: string;
}

interface CreateLicenseInput {
  channels: ChannelInput[];
  model?: ModelInput;
}

export const createLicense: CreateLicense<CreateLicenseInput, { token: string; installUrl: string }> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, '未授权');
  }

  const token = uuidv4();

  const license = await context.entities.LicenseKey.create({
    data: {
      token,
      status: 'unused',
      channels: {
        create: args.channels.map(ch => ({
          channelType: ch.type,
          credentials: encrypt(JSON.stringify(ch.credentials)),
          enabled: true
        }))
      },
      modelConfig: args.model ? {
        create: {
          provider: args.model.provider,
          modelName: args.model.modelName,
          apiKey: encrypt(args.model.apiKey),
          apiEndpoint: args.model.apiEndpoint
        }
      } : undefined
    }
  });

  const apiBase = process.env.API_BASE_URL || 'http://localhost:3000';

  return {
    token: license.token,
    installUrl: `${apiBase}/api/install/${token}.sh`
  };
};

export const revokeLicense: RevokeLicense<{ licenseId: string }, void> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, '未授权');
  }

  await context.entities.LicenseKey.update({
    where: { id: args.licenseId },
    data: { status: 'revoked' }
  });
};
