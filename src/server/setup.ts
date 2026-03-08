import { prisma } from "wasp/server";
import type { ServerSetupFn } from "wasp/server";
import {
  createProviderId,
  sanitizeAndSerializeProviderData,
  createUser,
} from "wasp/auth/utils";

export const serverSetup: ServerSetupFn = async () => {
  await setupDefaultAdmin();
};

async function setupDefaultAdmin() {
  const defaultUsername = "admin";
  const defaultPassword = "admin123456";

  try {
    // 检查是否已存在管理员账号
    const existingUser = await prisma.user.findUnique({
      where: { username: defaultUsername },
    });

    if (existingUser) {
      console.log("ℹ️  默认管理员账号已存在");
      return;
    }

    console.log("🔧 创建默认管理员账号...");

    // 使用 Wasp 的工具函数创建用户
    const providerId = createProviderId("username", defaultUsername);
    const providerData = await sanitizeAndSerializeProviderData({
      hashedPassword: defaultPassword,
    });

    await createUser(providerId, providerData, {
      username: defaultUsername,
      isAdmin: true,
    });

    console.log("✅ 默认管理员账号创建成功");
    console.log("   用户名: admin");
    console.log("   密码: admin123456");
    console.log("   请访问 http://localhost:3000/login");
  } catch (error) {
    console.error("❌ 创建默认管理员失败:", error);
  }
}
