import config from "../config/config.js";

const EMAIL_COLORS = {
  primary: "#4A35E8",
  background: "#FFFDF8",
  cyan: "#20C7C9",
  azure: "#2498E8",
  coral: "#FF5A3D",
  ink: "#1F1F2A",
  muted: "#5A5D72",
  border: "#E8E6FB",
};

const EMAIL_ACCENTS = {
  info: EMAIL_COLORS.cyan,
  operational: EMAIL_COLORS.azure,
  urgent: EMAIL_COLORS.coral,
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const escapeHtml = (value) => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const renderButton = ({ href, label, accentColor = EMAIL_COLORS.primary }) => {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 20px;"><tr><td><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:${accentColor};color:#ffffff;text-decoration:none;font-size:14px;line-height:1.2;font-weight:700;">${escapeHtml(label)}</a></td></tr></table>`;
};

const renderLayout = ({ title, subtitle, accentColor, body }) => {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${EMAIL_COLORS.background};font-family:Arial,Helvetica,sans-serif;color:${EMAIL_COLORS.ink};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${EMAIL_COLORS.background};padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid ${EMAIL_COLORS.border};border-radius:14px;overflow:hidden;">
            <tr>
              <td style="height:6px;background:${accentColor};line-height:6px;font-size:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:26px 30px 14px;">
                <p style="margin:0;color:${EMAIL_COLORS.primary};font-size:18px;line-height:1.2;font-weight:800;letter-spacing:0.08em;">CAMPUSIN</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px;"><div style="height:1px;background:${EMAIL_COLORS.border};line-height:1px;">&nbsp;</div></td>
            </tr>
            <tr>
              <td style="padding:24px 30px 8px;">
                <h1 style="margin:0;color:${EMAIL_COLORS.ink};font-size:27px;line-height:1.25;font-weight:800;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 28px;color:${EMAIL_COLORS.muted};font-size:15px;line-height:1.7;">
                <p style="margin:0 0 14px;color:${EMAIL_COLORS.azure};font-weight:700;">${escapeHtml(subtitle)}</p>
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 22px;">
                <div style="height:1px;background:${EMAIL_COLORS.border};line-height:1px;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 24px;color:${EMAIL_COLORS.muted};font-size:12px;line-height:1.6;">
                <p style="margin:0;">You received this email because of activity on your CampusIn account.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const generateOtpHTML = (otp) => {
  return renderLayout({
    title: "Your verification code",
    subtitle: "Security with a side of sass",
    accentColor: EMAIL_ACCENTS.urgent,
    body: `
      <p style="margin:0 0 14px;">Almost in. Prove you are human (and not a very hungry robot) with this one-time code:</p>
      <p style="margin:0 0 18px;color:${EMAIL_COLORS.primary};font-size:34px;line-height:1.2;font-weight:800;letter-spacing:0.16em;">${escapeHtml(otp)}</p>
      <p style="margin:0 0 10px;">This OTP self-destructs in <strong style="color:${EMAIL_COLORS.coral};">5 minutes</strong>.</p>
      <p style="margin:0;">If this was not you, ignore this email and continue being fabulous.</p>
    `,
  });
};

const generateOtpText = (otp) => {
  return `CampusIn code: ${otp}. Valid for 5 minutes. If this was not you, ignore this and carry on.`;
};

const generateWelcomeHTML = () => {
  return renderLayout({
    title: "Welcome to CampusIn",
    subtitle: "You are officially in the club",
    accentColor: EMAIL_ACCENTS.info,
    body: `
      <p style="margin:0 0 14px;">Your account is live. Food, marketplace finds, and campus essentials are now one tap away.</p>
      <p style="margin:0 0 14px;">From lunch breaks to midnight snack emergencies, we are on standby.</p>
      <p style="margin:0 0 18px;">Thanks for joining. Your "I am too busy to walk out" era starts now.</p>
      ${renderButton({ href: config.CLIENT_URL, label: "Open CampusIn", accentColor: EMAIL_COLORS.primary })}
      <p style="margin:0;color:${EMAIL_COLORS.ink};">Team <strong>CAMPUSIN</strong></p>
    `,
  });
};

const generateWelcomeText = () => {
  return "Welcome to CampusIn. Your account is ready, your cravings are valid, and checkout is one tap away.";
};

const generateForgotPasswordHTML = (otp) => {
  return renderLayout({
    title: "Reset your password",
    subtitle: "Memory lapse recovery mission",
    accentColor: EMAIL_ACCENTS.urgent,
    body: `
      <p style="margin:0 0 14px;">No stress, happens to the best of us. Use this code to reset your password:</p>
      <p style="margin:0 0 18px;color:${EMAIL_COLORS.primary};font-size:34px;line-height:1.2;font-weight:800;letter-spacing:0.16em;">${escapeHtml(otp)}</p>
      <p style="margin:0 0 10px;">This OTP expires in <strong style="color:${EMAIL_COLORS.coral};">5 minutes</strong>, like your patience during exams.</p>
      <p style="margin:0;">If you did not request this, please secure your account right away.</p>
    `,
  });
};

const generateForgotPasswordText = (otp) => {
  return `CampusIn reset code: ${otp}. Valid for 5 minutes. If this was not you, secure your account immediately.`;
};

const generateRepairRequestEstimateHTML = (repairRequest, estimatedPrice, adminRemarks) => {
  const remarks = adminRemarks
    ? `<p style="margin:0 0 14px;"><strong style="color:${EMAIL_COLORS.ink};">Admin remarks:</strong> ${escapeHtml(adminRemarks)}</p>`
    : "";

  return renderLayout({
    title: "Repair estimate ready",
    subtitle: "Your gadget gets a quote",
    accentColor: EMAIL_ACCENTS.operational,
    body: `
      <p style="margin:0 0 14px;">Hi ${escapeHtml(repairRequest?.user?.username || "there")},</p>
      <p style="margin:0 0 14px;">Your repair request <strong style="color:${EMAIL_COLORS.ink};">${escapeHtml(repairRequest?.requestNumber)}</strong> has been reviewed by our fix-it squad.</p>
      <p style="margin:0 0 14px;color:${EMAIL_COLORS.primary};font-size:29px;line-height:1.3;font-weight:800;">Rs. ${escapeHtml(estimatedPrice)}</p>
      ${remarks}
      <p style="margin:0;">Open CampusIn to accept or reject the estimate and decide your gadget's fate.</p>
    `,
  });
};

const generateRepairRequestEstimateText = ({ requestNumber, estimatedPrice, adminRemarks }) => {
  const remarksText = adminRemarks ? ` Remarks: ${adminRemarks}` : "";
  return `Repair estimate for ${requestNumber}: Rs. ${estimatedPrice}. Open CampusIn to accept or reject and continue the repair flow.${remarksText}`;
};

const generateReminderHTML = (userName = "there") => {
  return renderLayout({
    title: "Your cart is waiting",
    subtitle: "Your snacks miss you",
    accentColor: EMAIL_ACCENTS.info,
    body: `
      <p style="margin:0 0 14px;">Hi ${escapeHtml(userName)},</p>
      <p style="margin:0 0 14px;">You left some items in your CampusIn cart. They are still there, patiently judging your hesitation.</p>
      ${renderButton({ href: `${config.CLIENT_URL}/cart`, label: "Complete Your Order", accentColor: EMAIL_COLORS.primary })}
      <p style="margin:0;">Quick checkout takes less than a minute. Your future self says thank you.</p>
    `,
  });
};

const generateReminderText = (userName = "there") => {
  return `Hi ${userName}, your CampusIn cart is still waiting. Complete your order at ${config.CLIENT_URL}/cart before your willpower returns.`;
};

const generateVendorNewOrderHTML = ({
  vendorName = "there",
  restaurantName,
  orderNumber,
  customerPhone,
  totalAmount,
}) => {
  return renderLayout({
    title: "New order received",
    subtitle: "Time to fire up the kitchen",
    accentColor: EMAIL_ACCENTS.operational,
    body: `
      <p style="margin:0 0 14px;">Hi ${escapeHtml(vendorName)},</p>
      <p style="margin:0 0 14px;">A fresh order just landed for <strong style="color:${EMAIL_COLORS.ink};">${escapeHtml(restaurantName)}</strong>. Cue the cooking montage.</p>
      <p style="margin:0 0 7px;"><strong>Order number:</strong> ${escapeHtml(orderNumber)}</p>
      <p style="margin:0 0 7px;"><strong>Customer phone:</strong> ${escapeHtml(customerPhone)}</p>
      <p style="margin:0 0 14px;"><strong>Total amount:</strong> Rs. ${escapeHtml(totalAmount)}</p>
      ${renderButton({ href: config.CLIENT_URL, label: "Open Dashboard", accentColor: EMAIL_COLORS.azure })}
    `,
  });
};

const generateVendorNewOrderText = ({ orderNumber, restaurantName, customerPhone, totalAmount }) => {
  return `New order ${orderNumber} for ${restaurantName}. Customer: ${customerPhone}. Total: Rs. ${totalAmount}. Time to cook something legendary.`;
};

const generateAdminMarketplaceOrderHTML = ({
  adminName = "there",
  orderNumber,
  categoryName,
  customerPhone,
  finalAmount,
}) => {
  return renderLayout({
    title: "New marketplace order",
    subtitle: "New order on deck",
    accentColor: EMAIL_ACCENTS.operational,
    body: `
      <p style="margin:0 0 14px;">Hi ${escapeHtml(adminName)},</p>
      <p style="margin:0 0 7px;"><strong>Order number:</strong> ${escapeHtml(orderNumber)}</p>
      <p style="margin:0 0 7px;"><strong>Category:</strong> ${escapeHtml(categoryName)}</p>
      <p style="margin:0 0 7px;"><strong>Customer phone:</strong> ${escapeHtml(customerPhone)}</p>
      <p style="margin:0 0 14px;"><strong>Total amount:</strong> Rs. ${escapeHtml(finalAmount)}</p>
      ${renderButton({ href: config.CLIENT_URL, label: "Open Dashboard", accentColor: EMAIL_COLORS.azure })}
    `,
  });
};

const generateAdminMarketplaceOrderText = ({ orderNumber, categoryName, customerPhone, finalAmount }) => {
  return `Marketplace order ${orderNumber} is in. Category: ${categoryName}. Customer: ${customerPhone}. Total: Rs. ${finalAmount}.`;
};

const generateDeliveryAssignmentHTML = ({
  deliveryPartnerName = "there",
  orderNumber,
  pickupFrom,
  customerPhone,
  deliveryAddress,
}) => {
  return renderLayout({
    title: "Delivery assigned to you",
    subtitle: "Hero mode activated",
    accentColor: EMAIL_ACCENTS.operational,
    body: `
      <p style="margin:0 0 14px;">Hi ${escapeHtml(deliveryPartnerName)}, your next mission just dropped:</p>
      <p style="margin:0 0 7px;"><strong>Order number:</strong> ${escapeHtml(orderNumber)}</p>
      <p style="margin:0 0 7px;"><strong>Pickup from:</strong> ${escapeHtml(pickupFrom)}</p>
      <p style="margin:0 0 7px;"><strong>Customer phone:</strong> ${escapeHtml(customerPhone)}</p>
      <p style="margin:0 0 14px;"><strong>Delivery address:</strong> ${escapeHtml(deliveryAddress)}</p>
      ${renderButton({ href: config.CLIENT_URL, label: "View Delivery Details", accentColor: EMAIL_COLORS.azure })}
    `,
  });
};

const generateDeliveryAssignmentText = ({ orderNumber, pickupFrom, customerPhone, deliveryAddress }) => {
  return `Delivery assigned: ${orderNumber}. Pickup: ${pickupFrom}. Customer: ${customerPhone}. Address: ${deliveryAddress}. Go get it.`;
};

const generateAdminRepairRequestSubmittedHTML = ({
  adminName = "there",
  requestNumber,
  serviceType,
  customerPhone,
  pickupLocation,
}) => {
  return renderLayout({
    title: "New repair request submitted",
    subtitle: "Another gadget needs saving",
    accentColor: EMAIL_ACCENTS.operational,
    body: `
      <p style="margin:0 0 14px;">Hi ${escapeHtml(adminName)},</p>
      <p style="margin:0 0 7px;"><strong>Request number:</strong> ${escapeHtml(requestNumber)}</p>
      <p style="margin:0 0 7px;"><strong>Service type:</strong> ${escapeHtml(serviceType)}</p>
      <p style="margin:0 0 7px;"><strong>Customer phone:</strong> ${escapeHtml(customerPhone)}</p>
      <p style="margin:0 0 14px;"><strong>Pickup location:</strong> ${escapeHtml(pickupLocation)}</p>
      ${renderButton({ href: config.CLIENT_URL, label: "Open Dashboard", accentColor: EMAIL_COLORS.azure })}
    `,
  });
};

const generateAdminRepairRequestSubmittedText = ({ requestNumber, serviceType, customerPhone, pickupLocation }) => {
  return `New repair request ${requestNumber}. Service: ${serviceType}. Customer: ${customerPhone}. Pickup: ${pickupLocation}.`;
};

const generateAdminRepairPriceDecisionHTML = ({
  adminName = "there",
  requestNumber,
  requestStatus,
  customerPhone,
}) => {
  const decision = String(requestStatus || "").toUpperCase();
  const accent = decision === "REJECTED" ? EMAIL_ACCENTS.urgent : EMAIL_ACCENTS.info;

  return renderLayout({
    title: "Customer decision received",
    subtitle: "Estimate verdict is in",
    accentColor: accent,
    body: `
      <p style="margin:0 0 14px;">Hi ${escapeHtml(adminName)},</p>
      <p style="margin:0 0 7px;"><strong>Request number:</strong> ${escapeHtml(requestNumber)}</p>
      <p style="margin:0 0 7px;"><strong>Customer phone:</strong> ${escapeHtml(customerPhone)}</p>
      <p style="margin:0 0 14px;"><strong>Decision:</strong> <span style="color:${decision === "REJECTED" ? EMAIL_COLORS.coral : EMAIL_COLORS.primary};font-weight:700;">${escapeHtml(decision)}</span></p>
      ${renderButton({ href: config.CLIENT_URL, label: "Open Dashboard", accentColor: EMAIL_COLORS.azure })}
    `,
  });
};

const generateAdminRepairPriceDecisionText = ({ requestNumber, requestStatus, customerPhone }) => {
  return `Repair request ${requestNumber} decision: ${requestStatus}. Customer: ${customerPhone}. Update the workflow when ready.`;
};

const generatePrintingOrderCreatedHTML = ({ username, orderNumber, amount }) => {
  return renderLayout({
    title: "Print order created",
    subtitle: "Your pages are in the queue",
    accentColor: EMAIL_ACCENTS.info,
    body: `
      <p style="margin:0 0 14px;">Hi ${escapeHtml(username || "there")},</p>
      <p style="margin:0 0 14px;">Your print order <strong style="color:${EMAIL_COLORS.ink};">${escapeHtml(orderNumber)}</strong> is created and waiting for the printer to wake up.</p>
      <p style="margin:0;color:${EMAIL_COLORS.primary};font-size:22px;line-height:1.3;font-weight:800;">Total: INR ${escapeHtml(amount)}</p>
    `,
  });
};

const generatePrintingOrderCreatedText = ({ orderNumber, amount }) => {
  return `Your print order ${orderNumber} is created. Total: INR ${amount}. Ink is warming up.`;
};

const generateAdminPrintingOrderCreatedHTML = ({
  username,
  orderNumber,
  userName,
  contactMobile,
  deliveryAddress,
}) => {
  return renderLayout({
    title: "New print order received",
    subtitle: "Fresh print request alert",
    accentColor: EMAIL_ACCENTS.operational,
    body: `
      <p style="margin:0 0 14px;">Hi ${escapeHtml(username || "admin")},</p>
      <p style="margin:0 0 14px;">A new print order <strong style="color:${EMAIL_COLORS.ink};">${escapeHtml(orderNumber)}</strong> was placed by ${escapeHtml(userName)}.</p>
      <p style="margin:0 0 8px;"><strong>Contact mobile:</strong> ${escapeHtml(contactMobile)}</p>
      <p style="margin:0;"><strong>Delivery address:</strong> ${escapeHtml(deliveryAddress)}</p>
    `,
  });
};

const generateAdminPrintingOrderCreatedText = ({
  orderNumber,
  userName,
  contactMobile,
  deliveryAddress,
}) => {
  return `New print order ${orderNumber} by ${userName}. Contact: ${contactMobile}. Delivery address: ${deliveryAddress}.`;
};

const generatePrintingOrderStatusHTML = ({ username, orderNumber, status, note }) => {
  const upperStatus = String(status || "").toUpperCase();
  const isUrgent = ["REJECTED", "CANCELLED"].includes(upperStatus);
  const noteBlock = note
    ? `<p style="margin:14px 0 0;"><strong>Note:</strong> ${escapeHtml(note)}</p>`
    : "";

  return renderLayout({
    title: "Print order status updated",
    subtitle: "Progress from the print desk",
    accentColor: isUrgent ? EMAIL_ACCENTS.urgent : EMAIL_ACCENTS.info,
    body: `
      <p style="margin:0 0 14px;">Hi ${escapeHtml(username || "there")},</p>
      <p style="margin:0 0 14px;">Your print order <strong style="color:${EMAIL_COLORS.ink};">${escapeHtml(orderNumber)}</strong> is now <strong style="color:${isUrgent ? EMAIL_COLORS.coral : EMAIL_COLORS.primary};">${escapeHtml(upperStatus)}</strong>.</p>
      ${noteBlock}
    `,
  });
};

const generatePrintingOrderStatusText = ({ orderNumber, status, note }) => {
  const noteText = note ? ` Note: ${note}` : "";
  return `Your print order ${orderNumber} is now ${status}.${noteText}`;
};

const genereateWelcomeHtml = generateWelcomeHTML;

export {
  generateOTP,
  generateOtpHTML,
  generateOtpText,
  generateWelcomeHTML,
  generateWelcomeText,
  generateForgotPasswordHTML,
  generateForgotPasswordText,
  genereateWelcomeHtml,
  generateRepairRequestEstimateHTML,
  generateRepairRequestEstimateText,
  generateReminderHTML,
  generateReminderText,
  generateVendorNewOrderHTML,
  generateVendorNewOrderText,
  generateAdminMarketplaceOrderHTML,
  generateAdminMarketplaceOrderText,
  generateDeliveryAssignmentHTML,
  generateDeliveryAssignmentText,
  generateAdminRepairRequestSubmittedHTML,
  generateAdminRepairRequestSubmittedText,
  generateAdminRepairPriceDecisionHTML,
  generateAdminRepairPriceDecisionText,
  generatePrintingOrderCreatedHTML,
  generatePrintingOrderCreatedText,
  generateAdminPrintingOrderCreatedHTML,
  generateAdminPrintingOrderCreatedText,
  generatePrintingOrderStatusHTML,
  generatePrintingOrderStatusText,
};
