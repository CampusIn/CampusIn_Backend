import config from "../config/config.js";

const EMAIL_COLORS = {
  canvas: "#eef0f5",
  shellBorder: "#d8dcee",
  cardTop: "#fde9cf",
  cardMid: "#4a5fc7",
  cardBottom: "#060816",
  innerTop: "#f6eadb",
  innerMid: "#3c4fb1",
  innerBottom: "#080b1a",
  textPrimary: "#f8fbff",
  textSecondary: "#d4dffb",
  textMuted: "#9ba5c7",
  darkStrip: "#040612",
  divider: "#2f3552",
  accentBlue: "#7eb8ff",
  accentAmber: "#ffd17f",
  accentMint: "#81f2db",
  accentRose: "#ff9d9d",
};

const EMAIL_ACCENTS = {
  info: EMAIL_COLORS.accentBlue,
  operational: EMAIL_COLORS.accentMint,
  urgent: EMAIL_COLORS.accentAmber,
  danger: EMAIL_COLORS.accentRose,
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

const renderButton = ({ href, label, accentColor = EMAIL_COLORS.accentBlue }) => {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px auto 0;"><tr><td align="center"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:${accentColor};color:#0c1025;text-decoration:none;font-size:13px;line-height:1.1;font-weight:800;letter-spacing:0.02em;">${escapeHtml(label)}</a></td></tr></table>`;
};

const renderDetailRows = (rows = []) => {
  if (!rows.length) {
    return "";
  }

  const renderedRows = rows
    .map(
      (row) => `<tr>
        <td style="padding:6px 0 4px;color:${EMAIL_COLORS.textSecondary};font-size:14px;line-height:1.5;">
          <span style="color:${EMAIL_COLORS.textMuted};font-weight:600;">${escapeHtml(row.label)}:</span>
          <span style="color:${EMAIL_COLORS.textPrimary};font-weight:700;"> ${escapeHtml(row.value)}</span>
        </td>
      </tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0 0;">${renderedRows}</table>`;
};

const renderLayout = ({
  title,
  subtitle,
  eyebrow = "campusin",
  accentColor = EMAIL_COLORS.accentBlue,
  body,
  details = [],
  ctaLabel,
  ctaHref,
  footerLead = "We are almost there.",
  footerText = "Open CampusIn and keep the momentum going.",
}) => {
  const buttonBlock = ctaLabel && ctaHref
    ? renderButton({ href: ctaHref, label: ctaLabel, accentColor })
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${EMAIL_COLORS.canvas};font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${EMAIL_COLORS.canvas};padding:38px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;border:1px solid ${EMAIL_COLORS.shellBorder};border-radius:22px;overflow:hidden;background:#ffffff;">
            <tr>
              <td style="padding:16px 16px 0;background:linear-gradient(180deg, ${EMAIL_COLORS.cardTop} 0%, ${EMAIL_COLORS.cardMid} 55%, ${EMAIL_COLORS.cardBottom} 100%);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:56px 56px 0 0;background:linear-gradient(180deg, ${EMAIL_COLORS.innerTop} 0%, ${EMAIL_COLORS.innerMid} 53%, ${EMAIL_COLORS.innerBottom} 100%);">
                  <tr>
                    <td align="center" style="padding:66px 36px 54px;">
                      <p style="margin:0;color:${EMAIL_COLORS.textPrimary};font-size:18px;line-height:1.2;font-weight:700;letter-spacing:0.02em;text-transform:lowercase;">${escapeHtml(eyebrow)}</p>
                      <p style="margin:34px 0 16px;color:${EMAIL_COLORS.textSecondary};font-size:18px;line-height:1.35;">${escapeHtml(subtitle)}</p>
                      <h1 style="margin:0;color:${EMAIL_COLORS.textPrimary};font-size:62px;line-height:1.03;font-weight:800;letter-spacing:-0.03em;">${escapeHtml(title)}</h1>
                      <div style="margin:26px auto 0;width:76px;height:2px;background:${accentColor};line-height:2px;font-size:0;">&nbsp;</div>
                      <div style="margin:24px auto 0;max-width:500px;color:${EMAIL_COLORS.textSecondary};font-size:16px;line-height:1.75;text-align:center;">${body}</div>
                      ${renderDetailRows(details)}
                      ${buttonBlock}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:${EMAIL_COLORS.darkStrip};padding:38px 24px 34px;border-top:1px solid ${EMAIL_COLORS.divider};" align="center">
                <p style="margin:0 0 8px;color:${EMAIL_COLORS.textPrimary};font-size:21px;line-height:1.4;font-weight:700;">${escapeHtml(footerLead)}</p>
                <p style="margin:0;color:${EMAIL_COLORS.textSecondary};font-size:16px;line-height:1.6;">${escapeHtml(footerText)}</p>
                <p style="margin:24px 0 0;color:${EMAIL_COLORS.textMuted};font-size:12px;line-height:1.5;">This email was sent because your CampusIn account did a thing.</p>
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
    title: "Use this OTP",
    subtitle: "Before your snacks get trust issues",
    accentColor: EMAIL_ACCENTS.urgent,
    body: `<p style="margin:0;">Quick identity check. Drop this code in the app and continue your legendary ordering streak.</p>`,
    details: [
      { label: "One-time code", value: otp },
      { label: "Expires in", value: "5 minutes" },
    ],
    footerLead: "Security check, almost done.",
    footerText: "If this was not you, ignore this email and keep being iconic.",
  });
};

const generateOtpText = (otp) => {
  return `CampusIn OTP: ${otp}. Valid for 5 minutes. Use it now, then continue your snack mission.`;
};

const generateWelcomeHTML = () => {
  return renderLayout({
    title: "You are in",
    subtitle: "Welcome to the lazy genius era",
    accentColor: EMAIL_ACCENTS.info,
    body: `<p style="margin:0;">CampusIn is ready whenever your hunger, deadlines, and random marketplace cravings appear at the same time.</p>`,
    ctaLabel: "Open CampusIn",
    ctaHref: config.CLIENT_URL,
    footerLead: "Your account is live.",
    footerText: "Tap in and let future-you thank present-you.",
  });
};

const generateWelcomeText = () => {
  return "Welcome to CampusIn. You are officially one tap away from food, finds, and fewer errands.";
};

const generateForgotPasswordHTML = (otp) => {
  return renderLayout({
    title: "Reset password",
    subtitle: "Happens to the best brains",
    accentColor: EMAIL_ACCENTS.urgent,
    body: `<p style="margin:0;">Use this code to reset your password and get back in before your coffee gets cold.</p>`,
    details: [
      { label: "Reset code", value: otp },
      { label: "Expires in", value: "5 minutes" },
    ],
    footerLead: "No panic required.",
    footerText: "If this request was not yours, please secure your account right away.",
  });
};

const generateForgotPasswordText = (otp) => {
  return `CampusIn password reset code: ${otp}. Valid for 5 minutes. If this was not you, secure your account now.`;
};

const generateRepairRequestEstimateHTML = (
  repairRequest,
  estimatedPrice,
  adminRemarks,
) => {
  const userName = repairRequest?.user?.username || "there";
  const remarks = adminRemarks || "No extra notes from the repair desk.";

  return renderLayout({
    title: "Estimate is ready",
    subtitle: `Hey ${escapeHtml(userName)}, your gadget has news`,
    accentColor: EMAIL_ACCENTS.operational,
    body: `<p style="margin:0;">The repair squad checked your device. Review the quote and decide whether we proceed.</p>`,
    details: [
      { label: "Request", value: repairRequest?.requestNumber || "N/A" },
      { label: "Estimated price", value: `Rs. ${estimatedPrice}` },
      { label: "Admin remarks", value: remarks },
    ],
    ctaLabel: "Review Estimate",
    ctaHref: config.CLIENT_URL,
    footerLead: "Decision time.",
    footerText: "Accept or reject from CampusIn and we will take it from there.",
  });
};

const generateRepairRequestEstimateText = ({
  requestNumber,
  estimatedPrice,
  adminRemarks,
}) => {
  const remarksText = adminRemarks ? ` Remarks: ${adminRemarks}` : "";
  return `Repair estimate for ${requestNumber}: Rs. ${estimatedPrice}. Open CampusIn to accept or reject.${remarksText}`;
};

const generateReminderHTML = (userName = "there") => {
  return renderLayout({
    title: "Cart is waiting",
    subtitle: `Hey ${escapeHtml(userName)}, this is your tasty reminder`,
    accentColor: EMAIL_ACCENTS.info,
    body: `<p style="margin:0;">You left items in your cart. They are still there, still delicious, and mildly offended.</p>`,
    ctaLabel: "Complete Order",
    ctaHref: `${config.CLIENT_URL}/cart`,
    footerLead: "Kickoff is close.",
    footerText: "Jump back in and check out before your willpower returns.",
  });
};

const generateReminderText = (userName = "there") => {
  return `Hi ${userName}, your CampusIn cart is still waiting. Finish checkout at ${config.CLIENT_URL}/cart before your cravings unionize.`;
};

const generateVendorNewOrderHTML = ({
  vendorName = "there",
  restaurantName,
  orderNumber,
  customerPhone,
  totalAmount,
}) => {
  return renderLayout({
    title: "New order",
    subtitle: `Chef mode on, ${escapeHtml(vendorName)}`,
    accentColor: EMAIL_ACCENTS.operational,
    body: `<p style="margin:0;">A fresh order landed for your kitchen. The customer is hungry and hopeful.</p>`,
    details: [
      { label: "Restaurant", value: restaurantName },
      { label: "Order", value: orderNumber },
      { label: "Customer", value: customerPhone },
      { label: "Total", value: `Rs. ${totalAmount}` },
    ],
    ctaLabel: "Open Dashboard",
    ctaHref: config.CLIENT_URL,
    footerLead: "Time to cook.",
    footerText: "Mark status updates quickly so delivery keeps pace.",
  });
};

const generateVendorNewOrderText = ({
  orderNumber,
  restaurantName,
  customerPhone,
  totalAmount,
}) => {
  return `New order ${orderNumber} for ${restaurantName}. Customer: ${customerPhone}. Total: Rs. ${totalAmount}. Kitchen hero mode starts now.`;
};

const generateAdminMarketplaceOrderHTML = ({
  adminName = "there",
  orderNumber,
  categoryName,
  customerPhone,
  finalAmount,
}) => {
  return renderLayout({
    title: "Marketplace ping",
    subtitle: `Heads up, ${escapeHtml(adminName)}`,
    accentColor: EMAIL_ACCENTS.operational,
    body: `<p style="margin:0;">A new marketplace order just came in and needs smooth ops handling.</p>`,
    details: [
      { label: "Order", value: orderNumber },
      { label: "Category", value: categoryName },
      { label: "Customer", value: customerPhone },
      { label: "Total", value: `Rs. ${finalAmount}` },
    ],
    ctaLabel: "Open Dashboard",
    ctaHref: config.CLIENT_URL,
    footerLead: "Flow is active.",
    footerText: "Assign, confirm, and keep the timeline crisp.",
  });
};

const generateAdminMarketplaceOrderText = ({
  orderNumber,
  categoryName,
  customerPhone,
  finalAmount,
}) => {
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
    title: "Delivery assigned",
    subtitle: `Road captain mode, ${escapeHtml(deliveryPartnerName)}`,
    accentColor: EMAIL_ACCENTS.operational,
    body: `<p style="margin:0;">Your next delivery quest is ready. Grab, ride, deliver, repeat.</p>`,
    details: [
      { label: "Order", value: orderNumber },
      { label: "Pickup", value: pickupFrom },
      { label: "Customer", value: customerPhone },
      { label: "Address", value: deliveryAddress },
    ],
    ctaLabel: "View Delivery",
    ctaHref: config.CLIENT_URL,
    footerLead: "Mission accepted.",
    footerText: "Keep the customer posted and the wheels moving.",
  });
};

const generateDeliveryAssignmentText = ({
  orderNumber,
  pickupFrom,
  customerPhone,
  deliveryAddress,
}) => {
  return `Delivery assigned: ${orderNumber}. Pickup: ${pickupFrom}. Customer: ${customerPhone}. Address: ${deliveryAddress}. Go win this route.`;
};

const generateAdminRepairRequestSubmittedHTML = ({
  adminName = "there",
  requestNumber,
  serviceType,
  customerPhone,
  pickupLocation,
}) => {
  return renderLayout({
    title: "Repair request",
    subtitle: `Admin alert for ${escapeHtml(adminName)}`,
    accentColor: EMAIL_ACCENTS.operational,
    body: `<p style="margin:0;">A new repair request entered the queue and awaits assignment.</p>`,
    details: [
      { label: "Request", value: requestNumber },
      { label: "Service", value: serviceType },
      { label: "Customer", value: customerPhone },
      { label: "Pickup", value: pickupLocation },
    ],
    ctaLabel: "Open Dashboard",
    ctaHref: config.CLIENT_URL,
    footerLead: "Another device to rescue.",
    footerText: "Review, assign, and keep the repair train rolling.",
  });
};

const generateAdminRepairRequestSubmittedText = ({
  requestNumber,
  serviceType,
  customerPhone,
  pickupLocation,
}) => {
  return `New repair request ${requestNumber}. Service: ${serviceType}. Customer: ${customerPhone}. Pickup: ${pickupLocation}.`;
};

const generateAdminRepairPriceDecisionHTML = ({
  adminName = "there",
  requestNumber,
  requestStatus,
  customerPhone,
}) => {
  const decision = String(requestStatus || "").toUpperCase();
  const isRejected = decision === "REJECTED";

  return renderLayout({
    title: "Customer verdict",
    subtitle: `Update for ${escapeHtml(adminName)}`,
    accentColor: isRejected ? EMAIL_ACCENTS.danger : EMAIL_ACCENTS.info,
    body: `<p style="margin:0;">The customer responded to your estimate. Update workflow accordingly.</p>`,
    details: [
      { label: "Request", value: requestNumber },
      { label: "Customer", value: customerPhone },
      { label: "Decision", value: decision || "PENDING" },
    ],
    ctaLabel: "Open Dashboard",
    ctaHref: config.CLIENT_URL,
    footerLead: "Reply received.",
    footerText: isRejected
      ? "No worries. Re-route the request and keep moving."
      : "Great news. Move to the next repair step.",
  });
};

const generateAdminRepairPriceDecisionText = ({
  requestNumber,
  requestStatus,
  customerPhone,
}) => {
  return `Repair request ${requestNumber} decision: ${requestStatus}. Customer: ${customerPhone}.`;
};

const generatePrintingOrderCreatedHTML = ({ username, orderNumber, amount }) => {
  return renderLayout({
    title: "Print queued",
    subtitle: `Hey ${escapeHtml(username || "there")}, pages are lining up`,
    accentColor: EMAIL_ACCENTS.info,
    body: `<p style="margin:0;">Your print order is in the queue. The printer squad has been notified.</p>`,
    details: [
      { label: "Order", value: orderNumber },
      { label: "Amount", value: `INR ${amount}` },
    ],
    footerLead: "Ink incoming.",
    footerText: "We will ping you as soon as status changes.",
  });
};

const generatePrintingOrderCreatedText = ({ orderNumber, amount }) => {
  return `Your print order ${orderNumber} is created. Total: INR ${amount}. Ink engines are warming up.`;
};

const generateAdminPrintingOrderCreatedHTML = ({
  username,
  orderNumber,
  userName,
  contactMobile,
  deliveryAddress,
}) => {
  return renderLayout({
    title: "Print request",
    subtitle: `Admin desk update for ${escapeHtml(username || "admin")}`,
    accentColor: EMAIL_ACCENTS.operational,
    body: `<p style="margin:0;">A new print order was placed. Please review and process.</p>`,
    details: [
      { label: "Order", value: orderNumber },
      { label: "Customer", value: userName },
      { label: "Contact", value: contactMobile },
      { label: "Address", value: deliveryAddress || "N/A" },
    ],
    ctaLabel: "Open Dashboard",
    ctaHref: config.CLIENT_URL,
    footerLead: "Queue updated.",
    footerText: "Assign quickly and keep turnaround sharp.",
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

const generatePrintingOrderStatusHTML = ({
  username,
  orderNumber,
  status,
  note,
}) => {
  const upperStatus = String(status || "").toUpperCase();
  const isUrgent = ["REJECTED", "CANCELLED"].includes(upperStatus);

  return renderLayout({
    title: "Print status",
    subtitle: `Update for ${escapeHtml(username || "there")}`,
    accentColor: isUrgent ? EMAIL_ACCENTS.danger : EMAIL_ACCENTS.info,
    body: `<p style="margin:0;">Your print order status changed. See the latest update below.</p>`,
    details: [
      { label: "Order", value: orderNumber },
      { label: "Status", value: upperStatus || "PENDING" },
      { label: "Note", value: note || "No additional note" },
    ],
    footerLead: isUrgent ? "Update needs your attention." : "Progress looks good.",
    footerText: isUrgent
      ? "Open CampusIn for the next step on this order."
      : "We will notify you again as it moves forward.",
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
