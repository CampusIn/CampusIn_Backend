const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateOtpHTML = (otp) => {
  const campusInRed = "#b31522";

  return `<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CampusIn OTP Verification</title>
    </head>
    <body style="margin:0; padding:0; background:#f7f7f8; font-family:Arial, Helvetica, sans-serif; color:#202124;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f8; margin:0; padding:36px 16px;">
            <tr>
                <td align="center">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; background:#ffffff;">
                        <tr>
                            <td style="padding:32px 36px 18px;">
                                <p style="margin:0; color:${campusInRed}; font-size:18px; line-height:1.2; font-weight:800; letter-spacing:0.04em;">CAMPUSIN</p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:0 36px;">
                                <div style="height:1px; line-height:1px; background:#e8eaed;">&nbsp;</div>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:30px 36px 12px;">
                                <h1 style="margin:0; color:#202124; font-size:28px; line-height:1.3; font-weight:700;">Your verification code</h1>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:0 36px 32px; color:#3c4043; font-size:16px; line-height:1.75;">
                                <p style="margin:0 0 18px;">
                                    Almost in. Just prove you are you, and not someone borrowing your snack budget.
                                </p>

                                <p style="margin:0 0 18px; color:${campusInRed}; font-size:34px; line-height:1.25; font-weight:800; letter-spacing:0.18em;">
                                    ${otp}
                                </p>

                                <p style="margin:0 0 22px;">
                                    This OTP is valid for <strong>5 minutes</strong>. For your account's sake, keep it to yourself.
                                </p>

                                <p style="margin:0; color:#5f6368; font-size:14px; line-height:1.6;">
                                    If you did not request this code, you can safely ignore this email.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
</html>
    `;
};

const generateWelcomeHTML = () => {
  const campusInRed = "#b31522";

  return `<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to CAMPUSIN</title>
    </head>
    <body style="margin:0; padding:0; background:#f7f7f8; font-family:Arial, Helvetica, sans-serif; color:#202124;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f8; margin:0; padding:36px 16px;">
            <tr>
                <td align="center">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; background:#ffffff;">
                        <tr>
                            <td style="padding:32px 36px 18px;">
                                <p style="margin:0; color:${campusInRed}; font-size:18px; line-height:1.2; font-weight:800; letter-spacing:0.04em;">CAMPUSIN</p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:0 36px;">
                                <div style="height:1px; line-height:1px; background:#e8eaed;">&nbsp;</div>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:30px 36px 12px;">
                                <h1 style="margin:0; color:#202124; font-size:28px; line-height:1.3; font-weight:700;">Congratulations!</h1>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:0 36px 32px; color:#3c4043; font-size:16px; line-height:1.75;">
                                <p style="margin:0 0 18px;">You've successfully unlocked the ancient student superpower of <strong>not leaving your hostel for food.</strong></p>

                                <p style="margin:0 0 6px;"><strong>Need lunch?</strong></p>
                                <p style="margin:0 0 18px;">We've got you.</p>

                                <p style="margin:0 0 6px;"><strong>Midnight cravings?</strong></p>
                                <p style="margin:0 0 18px;">Absolutely.</p>

                                <p style="margin:0 0 6px;"><strong>Need gifts to console your girlfriend?</strong></p>
                                <p style="margin:0 0 22px;">Marketplace has got you covered.</p>

                                <p style="margin:0 0 22px;">
                                    Now all that's left is deciding what to order first.
                                </p>

                                <p style="margin:0 0 30px; color:#5f6368; font-size:14px; line-height:1.6;">
                                    <em>Warning: Browsing while hungry may result in excessive ordering.</em>
                                </p>

                                <p style="margin:0;">See you soon,</p>
                                <p style="margin:4px 0 0; color:#202124;"><strong>Team <span style="color:${campusInRed};">CAMPUSIN</span></strong></p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
</html>
    `;
};

const generateForgotPasswordHTML = (otp) => {
  const campusInRed = "#b31522";

  return `<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your CAMPUSIN Password</title>
    </head>
    <body style="margin:0; padding:0; background:#f7f7f8; font-family:Arial, Helvetica, sans-serif; color:#202124;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f8; margin:0; padding:36px 16px;">
            <tr>
                <td align="center">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; background:#ffffff;">
                        <tr>
                            <td style="padding:32px 36px 18px;">
                                <p style="margin:0; color:${campusInRed}; font-size:18px; line-height:1.2; font-weight:800; letter-spacing:0.04em;">CAMPUSIN</p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:0 36px;">
                                <div style="height:1px; line-height:1px; background:#e8eaed;">&nbsp;</div>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:30px 36px 12px;">
                                <h1 style="margin:0; color:#202124; font-size:28px; line-height:1.3; font-weight:700;">Reset your password</h1>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:0 36px 32px; color:#3c4043; font-size:16px; line-height:1.75;">
                                <p style="margin:0 0 18px;">
                                    No worries&mdash;we've got you covered.
                                </p>

                                <p style="margin:0 0 18px;">
                                    Use the verification code below to reset your password and get back to your campus cravings.
                                </p>

                                <p style="margin:0 0 22px; color:${campusInRed}; font-size:34px; line-height:1.25; font-weight:800; letter-spacing:0.18em;">
                                    ${otp}
                                </p>

                                <p style="margin:0; color:#5f6368; font-size:14px; line-height:1.6;">
                                    This OTP is valid for <strong>5 minutes</strong>. Keep it private&mdash;only you should know this code.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
</html>
    `;
};

const genereateWelcomeHtml = generateWelcomeHTML;

const generateRepairRequestEstimateHTML = (repairRequest,estimatedPrice,adminRemarks) => {
  return (
    `
    Hi ${repairRequest.user.username},

Your repair request ${repairRequest.requestNumber} has an estimated price of Rs. ${estimatedPrice}.

${adminRemarks ? `Admin remarks: ${adminRemarks}` : ""}

Please open Campus Out to accept or reject this estimate.

Team Campus Out`,
    `<p>Hi ${repairRequest.user.username},</p>
<p>Your repair request <strong>${repairRequest.requestNumber}</strong> has an estimated price of <strong>Rs. ${estimatedPrice}</strong>.</p>
${adminRemarks ? `<p><strong>Admin remarks:</strong> ${adminRemarks}</p>` : ""}
<p>Please open Campus Out to accept or reject this estimate.</p>
<p>Team Campus Out</p>`
  );
};

export {
  generateOTP,
  generateOtpHTML,
  generateWelcomeHTML,
  generateForgotPasswordHTML,
  genereateWelcomeHtml,
  generateRepairRequestEstimateHTML
};
