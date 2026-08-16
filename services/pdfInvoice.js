const PDFDocument = require('pdfkit');

/**
 * Generates an in-memory PDF Buffer for an order invoice.
 * No files are left on disk.
 * @param {Object} order
 * @returns {Promise<Buffer>}
 */
function generateOrderInvoicePdfBuffer(order) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      const primaryColor = '#7c3aed'; // Purple Accent
      const goldColor = '#f59e0b'; // Gold
      const darkBg = '#0f172a';
      const grayText = '#475569';
      const lightGray = '#f1f5f9';

      // Header Banner
      doc.rect(0, 0, doc.page.width, 100).fill(darkBg);

      doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
        .text('PRINCE CLOUD SELLAR', 40, 28, { characterSpacing: 1.5 });
      
      doc.fillColor(goldColor).fontSize(10).font('Helvetica')
        .text('PREMIUM CLOUD ACCOUNTS • RDPS • SERVERS • DEVELOPER ASSETS', 40, 56);

      doc.fillColor('#94a3b8').fontSize(9)
        .text('https://princecloudsellar.onrender.com  |  Support: +91 9507325677', 40, 72);

      // INVOICE Title on Right
      doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
        .text('INVOICE / RECEIPT', doc.page.width - 240, 32, { width: 200, align: 'right' });
      
      doc.fillColor(goldColor).fontSize(10).font('Helvetica')
        .text(`Status: PAID & DELIVERED`, doc.page.width - 240, 56, { width: 200, align: 'right' });

      doc.moveDown(3);

      // Order & Customer Details Box
      const topY = 120;
      doc.rect(40, topY, doc.page.width - 80, 80).fillAndStroke('#f8fafc', '#e2e8f0');

      // Left column
      doc.fillColor(darkBg).fontSize(9).font('Helvetica-Bold').text('BILLED TO:', 55, topY + 12);
      doc.font('Helvetica').fillColor('#1e293b');
      doc.text(`Customer: ${order.userName || 'Verified Client'}`, 55, topY + 28);
      doc.text(`Contact: ${order.userPhone || 'N/A'}`, 55, topY + 42);
      doc.text(`User ID: ${order.userId || 'Guest'}`, 55, topY + 56);

      // Right column
      const col2X = doc.page.width / 2 + 30;
      doc.fillColor(darkBg).fontSize(9).font('Helvetica-Bold').text('ORDER DETAILS:', col2X, topY + 12);
      doc.font('Helvetica').fillColor('#1e293b');
      doc.text(`Order ID: ${order._id || 'N/A'}`, col2X, topY + 28);
      doc.text(`Date: ${new Date(order.createdAt || Date.now()).toLocaleString('en-IN')}`, col2X, topY + 42);
      doc.text(`Payment: ${order.paymentMethod || 'ONLINE'} (${order.utrId ? `UTR: ${order.utrId}` : (order.txHash ? `TxHash: ${String(order.txHash).substring(0, 16)}...` : 'SUCCESS')})`, col2X, topY + 56);

      // Item Table Header
      const tableY = 220;
      doc.rect(40, tableY, doc.page.width - 80, 24).fill(primaryColor);
      
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold');
      doc.text('DESCRIPTION / ITEM', 50, tableY + 6);
      doc.text('REGION', 280, tableY + 6);
      doc.text('QTY', 370, tableY + 6);
      doc.text('UNIT PRICE', 420, tableY + 6);
      doc.text('TOTAL', doc.page.width - 110, tableY + 6, { width: 60, align: 'right' });

      // Table Row
      const rowY = tableY + 28;
      doc.rect(40, rowY, doc.page.width - 80, 36).fillAndStroke('#ffffff', '#e2e8f0');

      doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold');
      const prodTitle = `${order.productName || 'Cloud Account'} ${order.subProduct ? `(${order.subProduct})` : ''}`;
      doc.text(prodTitle.length > 35 ? prodTitle.substring(0, 35) + '...' : prodTitle, 50, rowY + 10);
      
      doc.font('Helvetica').fontSize(9).fillColor('#64748b');
      doc.text(order.country || 'Global', 280, rowY + 10);
      doc.text(String(order.quantity || 1), 370, rowY + 10);
      doc.text(`Rs.${order.unitPrice || order.totalPaid}`, 420, rowY + 10);
      
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b');
      doc.text(`Rs.${order.totalPaid}`, doc.page.width - 110, rowY + 10, { width: 60, align: 'right' });

      // Grand Total Box
      const totalBoxY = rowY + 45;
      doc.rect(doc.page.width - 240, totalBoxY, 200, 42).fillAndStroke(lightGray, primaryColor);
      doc.fillColor(grayText).fontSize(9).font('Helvetica').text('GRAND TOTAL PAID:', doc.page.width - 230, totalBoxY + 8);
      doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold').text(`Rs. ${order.totalPaid} INR`, doc.page.width - 230, totalBoxY + 20);

      // Delivered Credentials Box
      const credsY = totalBoxY + 55;
      doc.fillColor(darkBg).fontSize(11).font('Helvetica-Bold').text('DELIVERED ACCOUNT CREDENTIALS / LICENSE DETAILS:', 40, credsY);
      
      const credsBoxY = credsY + 18;
      const credText = order.deliveredItem || 'Account details dispatched to user dashboard / email.';
      
      doc.rect(40, credsBoxY, doc.page.width - 80, 90).fillAndStroke('#0f172a', '#334155');
      doc.fillColor(goldColor).fontSize(9).font('Courier-Bold')
        .text(credText, 50, credsBoxY + 10, {
          width: doc.page.width - 100,
          height: 70,
          ellipsis: true
        });

      // Terms & Warranty Note
      const footerY = credsBoxY + 105;
      doc.rect(40, footerY, doc.page.width - 80, 60).fillAndStroke('#f1f5f9', '#cbd5e1');
      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold')
        .text('TERMS & WARRANTY POLICY:', 50, footerY + 8);
      doc.font('Helvetica').fontSize(7.5).fillColor('#64748b')
        .text('1. 24-48 Hours replacement warranty on valid non-working credentials reported via Support ticket.', 50, footerY + 20)
        .text('2. Do not violate cloud provider policies (cryptomining, illegal scraping, or abuse).', 50, footerY + 30)
        .text('3. For instant support or replacement, message on WhatsApp +91 9507325677 with this Order ID.', 50, footerY + 40);

      // Bottom Stamp
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
        .text('Thank you for trusting Prince Cloud Sellar! This is an electronically generated proof of delivery.', 40, doc.page.height - 35, { align: 'center', width: doc.page.width - 80 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates an in-memory PDF Buffer for an SMM Growth order invoice.
 * @param {Object} order
 * @returns {Promise<Buffer>}
 */
function generateSmmInvoicePdfBuffer(order) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      const primaryColor = '#0284c7'; // Sky Blue Accent
      const goldColor = '#f59e0b';
      const darkBg = '#0b132b';
      const grayText = '#475569';
      const lightGray = '#f0f9ff';

      // Header Banner
      doc.rect(0, 0, doc.page.width, 100).fill(darkBg);

      doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
        .text('PRINCE CLOUD SELLAR', 40, 28, { characterSpacing: 1.5 });
      
      doc.fillColor(primaryColor).fontSize(10).font('Helvetica')
        .text('SOCIAL MEDIA GROWTH AUTOMATION • SMM SERVICES • HIGH RETENTION', 40, 56);

      doc.fillColor('#94a3b8').fontSize(9)
        .text('https://princecloudsellar.onrender.com  |  Support: +91 9507325677', 40, 72);

      // INVOICE Title on Right
      doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
        .text('TAX INVOICE / RECEIPT', doc.page.width - 260, 32, { width: 220, align: 'right' });
      
      doc.fillColor(goldColor).fontSize(10).font('Helvetica')
        .text(`Status: ${order.status || 'PROCESSING'}`, doc.page.width - 260, 56, { width: 220, align: 'right' });

      doc.moveDown(3);

      // Order & Customer Details Box
      const topY = 120;
      doc.rect(40, topY, doc.page.width - 80, 80).fillAndStroke('#f8fafc', '#e2e8f0');

      // Left column
      doc.fillColor(darkBg).fontSize(9).font('Helvetica-Bold').text('BILLED TO:', 55, topY + 12);
      doc.font('Helvetica').fillColor('#1e293b');
      doc.text(`Customer: ${order.userName || 'Verified Customer'}`, 55, topY + 28);
      doc.text(`Contact: ${order.userPhone || 'N/A'}`, 55, topY + 42);
      doc.text(`Email: ${order.userEmail || 'N/A'}`, 55, topY + 56);

      // Right column
      const col2X = doc.page.width / 2 + 30;
      doc.fillColor(darkBg).fontSize(9).font('Helvetica-Bold').text('ORDER DETAILS:', col2X, topY + 12);
      doc.font('Helvetica').fillColor('#1e293b');
      doc.text(`Order ID: ${order.orderId || order._id}`, col2X, topY + 28);
      doc.text(`Date: ${new Date(order.createdAt || Date.now()).toLocaleString('en-IN')}`, col2X, topY + 42);
      doc.text(`Payment: ${order.paymentMethod || 'ONLINE'} (${order.utrId ? `UTR: ${order.utrId}` : (order.txHash ? `TxHash: ${String(order.txHash).substring(0, 14)}...` : 'SUCCESS')})`, col2X, topY + 56);

      // Item Table Header
      const tableY = 220;
      doc.rect(40, tableY, doc.page.width - 80, 24).fill(primaryColor);
      
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold');
      doc.text('PACKAGE / SERVICE NAME', 50, tableY + 6);
      doc.text('PLATFORM', 280, tableY + 6);
      doc.text('QTY', 370, tableY + 6);
      doc.text('RATE/1K', 420, tableY + 6);
      doc.text('TOTAL', doc.page.width - 110, tableY + 6, { width: 60, align: 'right' });

      // Table Row
      const rowY = tableY + 28;
      doc.rect(40, rowY, doc.page.width - 80, 36).fillAndStroke('#ffffff', '#e2e8f0');

      doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold');
      const srvTitle = order.serviceName || 'Social Growth Service';
      doc.text(srvTitle.length > 35 ? srvTitle.substring(0, 35) + '...' : srvTitle, 50, rowY + 10);
      
      doc.font('Helvetica').fontSize(9).fillColor('#64748b');
      doc.text((order.platform || 'Social').toUpperCase(), 280, rowY + 10);
      doc.text(String(order.quantity?.toLocaleString() || 1000), 370, rowY + 10);
      doc.text(`Rs.${order.rate || Math.round(order.totalCost)}`, 420, rowY + 10);
      
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b');
      doc.text(`Rs.${order.totalCost || order.totalPaid}`, doc.page.width - 110, rowY + 10, { width: 60, align: 'right' });

      // Grand Total Box
      const totalBoxY = rowY + 45;
      doc.rect(doc.page.width - 240, totalBoxY, 200, 42).fillAndStroke(lightGray, primaryColor);
      doc.fillColor(grayText).fontSize(9).font('Helvetica').text('TOTAL AMOUNT PAID:', doc.page.width - 230, totalBoxY + 8);
      doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold').text(`Rs. ${order.totalCost || order.totalPaid} INR`, doc.page.width - 230, totalBoxY + 20);

      // Target URL & Growth Details Box
      const targetY = totalBoxY + 55;
      doc.fillColor(darkBg).fontSize(11).font('Helvetica-Bold').text('TARGET LINK & AUTOMATED GROWTH SERVER DETAILS:', 40, targetY);
      
      const targetBoxY = targetY + 18;
      doc.rect(40, targetBoxY, doc.page.width - 80, 80).fillAndStroke('#0b132b', '#1e293b');
      
      doc.fillColor(goldColor).fontSize(9).font('Courier-Bold')
        .text(`Target URL: ${order.targetUrl || 'Provided on checkout'}`, 50, targetBoxY + 12, { width: doc.page.width - 100 });
      doc.fillColor('#38bdf8').fontSize(8.5).font('Courier')
        .text(`Provider Order Ref: #${order.providerOrderId || 'Queued for automated dispatch'}`, 50, targetBoxY + 30)
        .text(`Refill Status: ${order.refillable ? 'Auto-Refill Lifetime Guarantee Active' : 'Standard Speed Delivery'}`, 50, targetBoxY + 44)
        .text(`Start Count: ${order.startCount || 0}  |  Remains: ${order.remains || order.quantity || 0}`, 50, targetBoxY + 58);

      // Terms & Guarantee Note
      const footerY = targetBoxY + 95;
      doc.rect(40, footerY, doc.page.width - 80, 60).fillAndStroke('#f1f5f9', '#cbd5e1');
      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold')
        .text('GROWTH POLICY & WARRANTY GUARANTEE:', 50, footerY + 8);
      doc.font('Helvetica').fontSize(7.5).fillColor('#64748b')
        .text('1. Do not change username or make profile private while growth order is in progress.', 50, footerY + 20)
        .text('2. All Non-Drop packages include free lifetime automated refill if drops exceed 5%.', 50, footerY + 30)
        .text('3. WhatsApp Support: +91 9507325677  |  Track real-time status in dashboard.', 50, footerY + 40);

      // Bottom Stamp
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
        .text('Thank you for choosing Prince Cloud Sellar! Electronically generated tax invoice.', 40, doc.page.height - 35, { align: 'center', width: doc.page.width - 80 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateOrderInvoicePdfBuffer,
  generateSmmInvoicePdfBuffer
};
