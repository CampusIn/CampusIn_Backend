import PDFDocument from "pdfkit";

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-IN").replace(/\//g, "/");

const formatMoney = (value = 0) => Number(value || 0).toFixed(2);

const formatPaymentMethod = (value = "") =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const drawLine = (doc, startX, y, endX) => {
  doc
    .moveTo(startX, y)
    .lineTo(endX, y)
    .dash(3, { space: 2 })
    .stroke("#bfbfbf")
    .undash();
};

const rightText = (doc, text, x, y, width, options = {}) => {
  doc.text(text, x, y, {
    width,
    align: "right",
    ...options,
  });
};

const getInvoiceSummary = (order) => ({
  subtotal: order.pricing?.subTotal ?? 0,
  gstCharges: order.pricing?.gstAmount ?? 0,
  deliveryCharges: order.pricing?.deliveryCharge ?? 0,
  packagingCharges: order.pricing?.packagingCharge ?? 0,
  platformCharges: order.pricing?.platformCharge ?? 0,
  discountAmount: order.pricing?.couponDiscount ?? 0,
  total: order.pricing?.finalAmount ?? 0,
});

const generateMarketPlaceInvoicePDF = async (order) => {
  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
  });

  const buffers = [];
  doc.on("data", (chunk) => buffers.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const receiptWidth = 320;
    const left = (pageWidth - receiptWidth) / 2;
    const top = 36;
    const bottom = pageHeight - 36;
    const right = left + receiptWidth;
    const customer =
      order.user && typeof order.user === "object" ? order.user : {};
    const summary = getInvoiceSummary(order);

    doc.rect(0, 0, pageWidth, pageHeight).fill("#f5f5f5");
    doc.roundedRect(left, top, receiptWidth, bottom - top, 8).fill("#ffffff");

    let y = top + 18;

    doc
      .fillColor("#111111")
      .font("Helvetica-Bold")
      .fontSize(16)
      .text("Marketplace", left, y, {
        width: receiptWidth,
        align: "center",
      });
    y += 22;

    doc
      .font("Helvetica")
      .fontSize(10.5)
      .text(`Ph: ${order.customerPhone || "N/A"}`, left, y, {
        width: receiptWidth,
        align: "center",
      });
    y += 14;

    doc.text(order.deliveryAddressSnapShot || "Campus", left, y, {
      width: receiptWidth,
      align: "center",
    });
    y += 24;

    doc
      .fontSize(10)
      .text(`Date: ${formatDate(order.createdAt)}`, left + 14, y, {
        width: 140,
      });
    rightText(
      doc,
      `Time: ${new Date(order.createdAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })}`,
      left + 166,
      y,
      140,
    );
    y += 16;

    doc.text(`Bill No: INV-${order.orderNumber}`, left + 14, y, {
      width: receiptWidth - 28,
    });
    y += 16;

    doc.text(`Order ID: ${order.orderNumber}`, left + 14, y, {
      width: 160,
    });
    rightText(doc, `Section: Marketplace`, left + 150, y, 156);
    y += 18;

    doc.text(`Payment: ${formatPaymentMethod(order.paymentMethod)}`, left + 14, y, {
      width: receiptWidth - 28,
    });
    y += 14;

    doc.text(
      `Payment Status: ${formatPaymentMethod(order.paymentStatus)}`,
      left + 14,
      y,
      {
        width: receiptWidth - 28,
      },
    );
    y += 14;

    doc.text(
      `Order Status: ${formatPaymentMethod(order.orderStatus)}`,
      left + 14,
      y,
      {
        width: receiptWidth - 28,
      },
    );
    y += 14;

    if (order.orderStatus === "REJECTED" && order.rejectionMsg) {
      doc.text(`Reason: ${order.rejectionMsg}`, left + 14, y, {
        width: receiptWidth - 28,
      });
      y += 16;
    } else {
      y += 2;
    }

    drawLine(doc, left + 14, y, right - 14);
    y += 14;

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("ITEM", left + 14, y, { width: 126 })
      .text("BASE PRICE", left + 126, y, { width: 68, align: "right" })
      .text("QTY", left + 205, y, { width: 34, align: "right" })
      .text("T.VALUE", left + 244, y, { width: 62, align: "right" });
    y += 16;

    drawLine(doc, left + 14, y, right - 14);
    y += 10;

    doc.font("Helvetica").fontSize(10.5);

    order.items.forEach((item) => {
      const itemTotal = item.quantity * item.priceAtPurchase;
      const itemNameHeight = doc.heightOfString(item.productName, {
        width: 126,
      });
      const rowHeight = Math.max(14, itemNameHeight);

      doc.text(item.productName, left + 14, y, {
        width: 126,
      });
      rightText(doc, formatMoney(item.priceAtPurchase), left + 126, y, 68);
      rightText(doc, String(item.quantity), left + 205, y, 34);
      rightText(doc, formatMoney(itemTotal), left + 244, y, 62);
      y += rowHeight + 7;
    });

    drawLine(doc, left + 14, y, right - 14);
    y += 12;

    const summaryLabelX = left + 160;
    const summaryValueX = left + 238;
    const summaryWidth = 68;

    doc.font("Helvetica").fontSize(10.5);

    if (summary.discountAmount > 0) {
      doc.text("Discount:", summaryLabelX, y, { width: 70, align: "right" });
      rightText(
        doc,
        `-${formatMoney(summary.discountAmount)}`,
        summaryValueX,
        y,
        summaryWidth,
      );
      y += 15;
    }

    doc.text("Sub Total:", summaryLabelX, y, { width: 70, align: "right" });
    rightText(doc, formatMoney(summary.subtotal), summaryValueX, y, summaryWidth);
    y += 15;

    if (summary.deliveryCharges > 0) {
      doc.text("Delivery:", summaryLabelX, y, { width: 70, align: "right" });
      rightText(
        doc,
        formatMoney(summary.deliveryCharges),
        summaryValueX,
        y,
        summaryWidth,
      );
      y += 15;
    }

    if (summary.packagingCharges > 0) {
      doc.text("Packaging:", summaryLabelX, y, { width: 70, align: "right" });
      rightText(
        doc,
        formatMoney(summary.packagingCharges),
        summaryValueX,
        y,
        summaryWidth,
      );
      y += 15;
    }

    if (summary.platformCharges > 0) {
      doc.text("Platform Fee:", summaryLabelX, y, { width: 70, align: "right" });
      rightText(
        doc,
        formatMoney(summary.platformCharges),
        summaryValueX,
        y,
        summaryWidth,
      );
      y += 15;
    }

    if (summary.gstCharges > 0) {
      doc.text("GST:", summaryLabelX, y, { width: 70, align: "right" });
      rightText(
        doc,
        formatMoney(summary.gstCharges),
        summaryValueX,
        y,
        summaryWidth,
      );
      y += 15;
    }

    drawLine(doc, left + 14, y, right - 14);
    y += 12;

    doc.font("Helvetica-Bold").fontSize(12.5);
    doc.text("Grand Total", summaryLabelX - 24, y, {
      width: 94,
      align: "right",
    });
    rightText(doc, formatMoney(summary.total), summaryValueX, y - 1, summaryWidth);
    y += 15;

    doc
      .font("Helvetica-Oblique")
      .fontSize(7.5)
      .fillColor("#666666")
      .text("(Including all GST and extra charges)", summaryLabelX - 12, y, {
        width: 148,
        align: "right",
      });
    doc.fillColor("#111111");
    y += 16;

    drawLine(doc, left + 14, y, right - 14);
    y += 14;

    doc
      .font("Helvetica")
      .fontSize(10)
      .text(`Customer: ${customer.username || "Guest"}`, left + 14, y, {
        width: receiptWidth - 28,
      });
    y += 14;

    if (customer.email) {
      doc.text(`Email: ${customer.email}`, left + 14, y, {
        width: receiptWidth - 28,
      });
      y += 14;
    }

    if (order.customerPhone) {
      doc.text(`Phone: ${order.customerPhone}`, left + 14, y, {
        width: receiptWidth - 28,
      });
      y += 14;
    }

    if (order.deliveryAddressSnapShot) {
      doc.text(`Address: ${order.deliveryAddressSnapShot}`, left + 14, y, {
        width: receiptWidth - 28,
      });
      y += 14;
    }

    doc
      .fontSize(10)
      .text("Thank you for your order", left, bottom - 36, {
        width: receiptWidth,
        align: "center",
      });

    doc.end();
  });
};

export default generateMarketPlaceInvoicePDF;
