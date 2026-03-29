// Placeholder email service — wire up AWS SES in production
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  // TODO: Implement with AWS SES (nodemailer + SES transport)
  console.log(`[EmailService] Would send email to ${params.to}: ${params.subject}`);
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${process.env['FRONTEND_URL']}/auth/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Reset your People Intelligence Platform password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1B2A47;">Reset Your Password</h2>
        <p>Click the button below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="background: #3A9FD6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Reset Password
        </a>
        <p style="color: #666; margin-top: 24px; font-size: 12px;">
          If you didn't request this, please ignore this email.
        </p>
      </div>
    `,
  });
}
