"use node";

import nodemailer from "nodemailer";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

function requiredEnv(name: "SMTP_HOST" | "SMTP_PORT" | "SMTP_FROM"): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required email configuration: ${name}`);
  return value;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

export const sendCode = internalAction({
  args: {
    email: v.string(),
    code: v.string(),
    purpose: v.union(v.literal("verify"), v.literal("reset")),
    expiresAt: v.number(),
  },
  handler: async (_ctx, args) => {
    const port = Number(requiredEnv("SMTP_PORT"));
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error("Invalid SMTP port configuration");
    }
    const transporter = nodemailer.createTransport({
      host: requiredEnv("SMTP_HOST"),
      port,
      secure: port === 465,
    });
    const isVerification = args.purpose === "verify";
    const subject = isVerification
      ? "Xác minh email Realidi"
      : "Đặt lại mật khẩu Realidi";
    const instruction = isVerification
      ? "Dùng mã sau để xác minh địa chỉ email của bạn:"
      : "Dùng mã sau để đặt lại mật khẩu của bạn:";

    await transporter.sendMail({
      from: requiredEnv("SMTP_FROM"),
      to: args.email,
      subject,
      text: `${instruction}\n\n${args.code}\n\nMã hết hạn lúc ${new Date(args.expiresAt).toISOString()}.`,
      html:
        `<p>${escapeHtml(instruction)}</p>` +
        `<p style="font-size:24px;font-weight:700;letter-spacing:0.15em">${escapeHtml(args.code)}</p>` +
        `<p>Mã hết hạn lúc ${escapeHtml(new Date(args.expiresAt).toISOString())}.</p>`,
    });
    return { delivered: true };
  },
});
