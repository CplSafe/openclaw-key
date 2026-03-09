import type { Request, Response } from "express";
import { prisma } from "wasp/server";
import { verify, hash } from "argon2";

export const updatePassword = async (
  req: Request,
  res: Response,
  _context: any,
) => {
  const { currentPassword, newPassword } = req.body;

  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ message: "未授权" });
    return;
  }

  try {
    // Find Auth record for this user, then get identity
    const auth = await prisma.auth.findUnique({
      where: { userId },
      include: { identities: true },
    });

    if (!auth) {
      res.status(404).json({ message: "认证信息不存在" });
      return;
    }

    const identity = auth.identities.find(
      (i) => i.providerName === "username",
    );
    if (!identity) {
      res.status(404).json({ message: "认证信息不存在" });
      return;
    }

    // Parse providerData (stored as JSON string)
    const providerData = JSON.parse(identity.providerData);
    if (!providerData?.hashedPassword) {
      res.status(400).json({ message: "密码信息不完整" });
      return;
    }

    const valid = await verify(providerData.hashedPassword, currentPassword);
    if (!valid) {
      res.status(400).json({ message: "当前密码错误" });
      return;
    }

    const newHashedPassword = await hash(newPassword);

    // Update using composite key
    await prisma.authIdentity.update({
      where: {
        providerName_providerUserId: {
          providerName: identity.providerName,
          providerUserId: identity.providerUserId,
        },
      },
      data: {
        providerData: JSON.stringify({
          ...providerData,
          hashedPassword: newHashedPassword,
        }),
      },
    });

    res.json({ success: true, message: "密码修改成功" });
  } catch (error: any) {
    console.error("Password update error:", error);
    res.status(500).json({ message: "修改失败，请稍后重试" });
  }
};

export const updateUsername = async (
  req: Request,
  res: Response,
  _context: any,
) => {
  const { currentPassword, newUsername } = req.body;

  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ message: "未授权" });
    return;
  }

  if (!newUsername || newUsername.trim().length < 3) {
    res.status(400).json({ message: "用户名至少需要3个字符" });
    return;
  }

  try {
    // Find Auth record for this user, then get identity
    const auth = await prisma.auth.findUnique({
      where: { userId },
      include: { identities: true },
    });

    if (!auth) {
      res.status(404).json({ message: "认证信息不存在" });
      return;
    }

    const identity = auth.identities.find(
      (i) => i.providerName === "username",
    );
    if (!identity) {
      res.status(404).json({ message: "认证信息不存在" });
      return;
    }

    // Parse providerData and verify password
    const providerData = JSON.parse(identity.providerData);
    if (!providerData?.hashedPassword) {
      res.status(400).json({ message: "密码信息不完整" });
      return;
    }

    const valid = await verify(providerData.hashedPassword, currentPassword);
    if (!valid) {
      res.status(400).json({ message: "当前密码错误" });
      return;
    }

    // Check if username is already taken
    const existingUser = await prisma.user.findFirst({
      where: {
        username: newUsername.trim(),
        NOT: { id: userId },
      },
    });

    if (existingUser) {
      res.status(400).json({ message: "用户名已被使用" });
      return;
    }

    const trimmedUsername = newUsername.trim();

    // Update user table
    await prisma.user.update({
      where: { id: userId },
      data: { username: trimmedUsername },
    });

    // Delete old identity and create new one with updated providerUserId
    // (since providerUserId is part of the composite key, we can't just update it)
    await prisma.authIdentity.delete({
      where: {
        providerName_providerUserId: {
          providerName: identity.providerName,
          providerUserId: identity.providerUserId,
        },
      },
    });

    await prisma.authIdentity.create({
      data: {
        providerName: "username",
        providerUserId: trimmedUsername,
        providerData: identity.providerData,
        authId: auth.id,
      },
    });

    res.json({ success: true, message: "用户名修改成功" });
  } catch (error: any) {
    console.error("Username update error:", error);
    res.status(500).json({ message: "修改失败，请稍后重试" });
  }
};
