const Order = require('../models/Order');
const sendEmail = require('../utils/sendEmail');
const User = require('../models/User');
const Cart = require('../models/Cart');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const path = require('path');
const Product = require('../models/Product');
const crypto = require('crypto'); // For unique tracking IDs
// const Coupon = require('../models/Coupon');

// ✅ Create New Order (Asynchronous Speed Optimized)
exports.createOrder = async (req, res) => {
  const { products, total, paymentMethod, shippingAddress, shippingMethod, shippingCost } = req.body;

  try {
    // 1. Price Freeze Logic (Har product ki order ke waqt ki price lock karna)
    const productsWithPrice = await Promise.all(products.map(async (item) => {
      const product = await Product.findById(item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);

      const currentPrice = product.discountPercentage > 0 
        ? (product.price * (1 - product.discountPercentage / 100)) 
        : product.price;

      return {
        productId: item.productId,
        quantity: item.quantity,
        priceAtOrder: currentPrice,
        selectedVariation: item.selectedVariation ? {
      label: item.selectedVariation.label,
      price: item.selectedVariation.price || 0
    } : null
      };
    }));

    // 2. Stock Check & Reduction (Critical Step)
    for (const item of products) {
      const product = await Product.findById(item.productId);
      if (product) {
        if (product.quantity >= item.quantity) {
          product.quantity -= item.quantity;
          await product.save();
        } else {
          return res.status(400).json({ message: `${product.name} is out of stock` });
        }
      }
    }

    // 3. Create Order Object (Fixed the 'total' variable bug)
    const order = new Order({
      userId: req.user.id,
      products: productsWithPrice,
      total: total, // Yahan direct 'total' use kiya hai kyunke coupon nahi hai
      paymentMethod,
      shippingAddress,
      shippingMethod: shippingMethod || "Standard",
      shippingCost: shippingCost || 0,
      trackingId: "ORD-" + crypto.randomBytes(4).toString("hex").toUpperCase(),
    });

    // Save Order to DB
    await order.save();

    // 4. Clear User's Cart
    await Cart.deleteMany({ user: req.user.id });

    // 🚀 5. SEND SUCCESS RESPONSE IMMEDIATELY
    res.status(201).json(order);

    // 🚀 6. BACKGROUND EMAIL PROCESSING (Fire and Forget)
    const sendBackgroundEmail = async () => {
      try {
        const user = await User.findById(req.user.id);
        if (!user?.email) return;

        const populatedOrder = await Order.findById(order._id).populate('products.productId');

        // Calculations for Email
        const subTotalItems = populatedOrder.products.reduce((acc, item) => 
          acc + (item.priceAtOrder * item.quantity), 0
        );
        const calculatedTax = subTotalItems * 0.05;
        const totalOriginalPrice = populatedOrder.products.reduce((acc, item) => 
          acc + ((item.productId?.price || item.priceAtOrder) * item.quantity), 0
        );
        const savings = totalOriginalPrice - subTotalItems;

        const productList = populatedOrder.products.map((item) => {
          const productName = item.productId?.name || item.productId?.brand || "Product";
          const frozenPrice = item.priceAtOrder.toFixed(2);
          const originalPrice = (item.productId?.price || item.priceAtOrder).toFixed(2);
          const hasDiscount = (item.productId?.price || 0) > item.priceAtOrder;
          
          return `
            <li style="margin-bottom: 12px; border-bottom: 1px solid #edf2f7; padding-bottom: 10px; list-style: none;">
              <span style="font-weight: 600; color: #2d3748;">${productName}</span><br/>
              <span style="font-size: 13px; color: #718096;">Qty: ${item.quantity}</span> — 
              ${hasDiscount ? `<span style="text-decoration: line-through; color: #a0aec0; font-size: 12px; margin-right: 5px;">$${originalPrice}</span>` : ""}
              <strong style="color: #198754;">$${item.priceAtOrder.toFixed(2)}</strong>
            </li>`;
        }).join("");

        const emailContent = `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#f4f4f7; padding:30px;">
            <div style="max-width:650px; margin:0 auto; background:#ffffff; padding:30px; border-radius:10px; box-shadow:0 4px 15px rgba(0,0,0,0.08);">
              <div style="text-align:center; margin-bottom:25px;">
                <h1 style="color:#198754; margin:0;">🎉 Congratulations!</h1>
                <p style="color:#4a5568; font-size:16px; margin-top:8px;">
                  You just saved <strong>$${savings.toFixed(2)}</strong> on your order!
                </p>
              </div>
              <div style="text-align:center; margin-bottom:25px;">
                <h1 style="color:#2d3748; margin:0;">🛍️ Thank You for Your Order!</h1>
                <p style="color:#718096; font-size:14px; margin-top:8px;">Your order has been successfully confirmed.</p>
              </div>
              <p style="font-size:15px; color:#2d3748;">Hi <strong>${user.name || "Customer"}</strong>,</p>
              <p style="font-size:15px; color:#4a5568;">We are processing your order and will notify you once it ships. Below is a summary of your purchase:</p>
              <div style="background:#f9fafb; padding:20px; border-radius:8px; margin-top:20px; border: 1px solid #e2e8f0;">
                <h3 style="color:#2d3748; margin:0 0 15px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">📦 Order Summary</h3>
                <table width="100%" style="font-size: 14px; color: #4a5568; border-collapse: collapse;">
                  <tr><td style="padding: 5px 0;">Items Subtotal:</td><td style="text-align: right; padding: 5px 0;">$${subTotalItems.toFixed(2)}</td></tr>
                  <tr><td style="padding: 5px 0;">VAT (5%):</td><td style="text-align: right; padding: 5px 0;">$${calculatedTax.toFixed(2)}</td></tr>
                  <tr><td style="padding: 5px 0;">Shipping Fee:</td><td style="text-align: right; padding: 5px 0;">$${Number(shippingCost).toFixed(2)}</td></tr>
                  <tr><td style="padding: 15px 0 5px 0; font-size: 18px; font-weight: bold; color: #2d3748; border-top: 2px solid #edf2f7;">Grand Total:</td><td style="padding: 15px 0 5px 0; font-size: 18px; font-weight: bold; color: #198754; text-align: right; border-top: 2px solid #edf2f7;">$${total.toFixed(2)}</td></tr>
                </table>
                <p style="font-size:13px; margin:12px 0 0 0; color:#718096;"><strong>Payment Method:</strong> ${paymentMethod}</p>
                <div style="text-align: center; margin-top: 20px;">
                  <a href="https://ai-ecommerce-4a2c6.web.app/orders" style="display:inline-block; padding:12px 25px; background:#198754; color:white; text-decoration:none; border-radius:6px; font-size:14px; font-weight: bold;">Track Your Order Details</a>
                </div>
              </div>
              <div style="margin-top:25px;">
                <h3 style="color:#2d3748; margin-bottom:10px;">🚚 Shipping Address</h3>
                <p style="font-size:15px; color:#4a5568; line-height:1.7;">
                  ${shippingAddress?.fullName}<br/>${shippingAddress?.street}<br/>
                  ${shippingAddress?.city}, ${shippingAddress?.state || ""} ${shippingAddress?.postalCode}<br/>${shippingAddress?.country}
                </p>
              </div>
              <div style="margin-top:25px;">
                <h3 style="color:#2d3748; margin-bottom:10px;">🛒 Items in Your Order</h3>
                <ul style="font-size:15px; color:#4a5568; line-height:1.7; padding-left:20px;">${productList}</ul>
              </div>
              <p style="font-size:14px; color:#718096; margin-top:30px;"><em>This is an automated generated email. Please do not reply to this email.</em></p>
              <p style="font-size:15px; color:#2d3748; margin-top:25px;">Best Regards,<br/><strong>Al Syed Tech Team</strong></p>
            </div>
            <p style="text-align:center; font-size:12px; color:#a0aec0; margin-top:15px;">© ${new Date().getFullYear()} Al Syed Tech. All rights reserved.</p>
          </div>`;

        await sendEmail(user.email, "🛒 Order Confirmation", emailContent);
        console.log("✅ Confirmation email sent in background");
      } catch (err) {
        console.error("❌ Background email processing failed:", err.message);
      }
    };

    // Trigger background process without awaiting it
    sendBackgroundEmail();

  } catch (err) {
    console.error("❌ Error creating order:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to create order" });
    }
  }
};
// ✅ Get logged-in user's orders
exports.getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id })
      .populate("products.productId")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user orders" });
  }
};

// ✅ Admin: Get all orders
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("userId", "username email")
      .populate("products.productId")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch all orders" });
  }
};

// ✅ Admin: Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, comment } = req.body;
    const orderId = req.params.id;
    const updateData = {

      status: status,

      statusUpdatedAt: Date.now()

    };

    console.log("Updating status for order ID:", orderId);
    console.log("New Status:", status);

    // ✅ Hal: findByIdAndUpdate use karein aur validation off kar dein
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { 
        $set: { 
          status: status, 
          statusUpdatedAt: Date.now() 
        } 
      },
      { 
        new: true,           // Updated document wapas milega
        runValidators: false // 👈 Yeh sab se zaroori hai, purane missing fields ka error nahi ayega
      }
    );

    if (!updatedOrder) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({ message: "Order status updated", order: updatedOrder });
  } catch (err) {
    console.error("❌ Error in updateOrderStatus:", err.message);
    res.status(500).json({ error: "Failed to update order status" });
  }
};
// ✅ New: Customer can track order progress by tracking ID
exports.trackOrder = async (req, res) => {
  try {
    const { trackingId } = req.params;

    const order = await Order.findOne({ trackingId }).populate("products.productId");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Define all steps (like IBCC)
    const steps = ["Placed", "Pending", "Processing", "Shipped", "Delivered"];
    const currentStep = steps.indexOf(order.status);

    res.json({
      trackingId: order.trackingId,
      status: order.status,
      currentStep,
      steps,
      createdAt: order.createdAt,
      estimatedDelivery:
        order.status === "Delivered"
          ? null
          : moment(order.createdAt).add(3, "days").format("MMM DD, YYYY"), // example
    });
  } catch (err) {
    console.error("❌ Tracking error:", err);
    res.status(500).json({ message: "Failed to fetch tracking info" });
  }
};

// ✅ Soft Delete Cancelled Order (Customer)
exports.deleteCancelledOrder = async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // ✅ Use correct field name 'userId'
    if (order.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized action" });
    }

    // ❌ Only allow deletion for Cancelled orders
    if (order.status !== "Cancelled") {
      return res.status(400).json({
        message: "Only cancelled orders can be hidden.",
      });
    }

    // ✅ Instead of deleting, mark as hidden for this user
    order.hiddenForUser = true;
    await order.save();

    res.json({ message: "Cancelled order hidden from your view.", order });
  } catch (err) {
    console.error("❌ Hide cancelled order error:", err);
    res.status(500).json({ message: "Error hiding cancelled order" });
  }
};


// ✅ Delete Order (Admin) — Only allowed for Cancelled or Delivered orders
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // ❌ Prevent deletion of active orders
    if (order.status !== "Cancelled" && order.status !== "Delivered") {
      return res.status(400).json({
        message: "Only Cancelled or Delivered orders can be deleted.",
      });
    }

    await order.deleteOne();

    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("❌ Delete order error:", err);
    res.status(500).json({ message: "Error deleting order" });
  }
};



// GET /api/orders/:orderId/invoice
exports.downloadInvoice = async (req, res) => {
  const PDFDocument = require('pdfkit');
  const Order = require('../models/Order');
  const User = require('../models/User');
  const QRCode = require('qrcode');
  const path = require('path');

  try {
    const order = await Order.findById(req.params.orderId).populate('products.productId');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const user = await User.findById(order.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const doc = new PDFDocument({ margin: 50 });

    const watermarkPath = path.join(__dirname, '../public/logo.png');
    const watermarkOpacity = 0.05;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const watermarkSize = 400;
    const centerX = pageWidth / 2;
    const centerY = pageHeight / 2;

    doc.save();
    doc.translate(centerX, centerY);
    doc.rotate(-45);
    doc.opacity(watermarkOpacity);
    doc.image(watermarkPath, -watermarkSize / 2, -watermarkSize / 2, {
      width: watermarkSize,
      align: 'center',
      valign: 'center',
    });
    doc.restore();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order._id}.pdf`);
    doc.pipe(res);

    // ---------------- HEADER ----------------
    doc.fontSize(26).font('Helvetica-Bold');
    // const logoPath = path.join(__dirname, '');
    const syeedWidth = doc.widthOfString('Syeed');
    const ecommerceWidth = doc.widthOfString(' Tech Point');
    const totalWidth = syeedWidth + ecommerceWidth;
    const startX = centerX - totalWidth / 2;
    const y = 35;

    const logoPath = path.join(__dirname, '../public/logo.png');

const logoWidth = 135;
const logoheight = 135;
doc.image(logoPath, (doc.page.width - logoWidth) / 2, 30, {
  width: logoWidth,
  height: logoheight,
  align: 'center',
});
doc.moveDown(4);

    // Function sahi hai, bas call galat ho rahi thi
const centerText = (text, fontSize = 12, font = 'Helvetica-Bold', color = '#000') => {
    doc.font(font).fontSize(fontSize).fillColor(color);
    const textWidth = doc.widthOfString(text);
    const x = (doc.page.width - textWidth) / 2;
    doc.text(text, x, doc.y);
};

// ---------------- BRAND HEADER (Centered Multi-Color) ----------------
const part1 = 'Al Syed';
const part2 = 'Tech';

doc.font('Helvetica-Bold').fontSize(18);

// Dono parts ki total width calculate karein taake perfect center align ho sake
const totalBrandWidth = doc.widthOfString(part1) + doc.widthOfString(part2);
const brandX = (doc.page.width - totalBrandWidth) / 2;

// Part 1: Syeed (Green Color)
doc.fillColor('#198754') // Professional Success Green
   .text(part1, brandX, doc.y, { continued: true });

// Part 2: Tech Point (Dark Gray/Black)
doc.fillColor('#1a1a1a')
   .text(part2);

// Baki details ke liye wapas normal function use karein
doc.moveDown(0.2); // Thora sa gap

// 1. 'UAE' ko string ke andar shamil kar dein (Extra argument remove karein)
centerText('12-B Main Street, Al-Ain, UAE', 10, 'Helvetica', '#555');

// 2. Email aur Phone wali line bilkul theek hai  
centerText('Email: syeedstore.service@gmail.com | Phone: +92-334-9094849', 10, 'Helvetica', '#555');

    doc.moveDown(0.5).strokeColor('#cccccc').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1.2);
// ---------------- INVOICE INFO ----------------
const invoiceNo = `INV-${new Date().getFullYear()}-${order._id.toString().slice(-6).toUpperCase()}`;
const qrData = `Invoice No: ${invoiceNo}\nOrder ID: ${order._id}\nDate: ${new Date(order.createdAt).toLocaleDateString()}`;
const qrImage = await QRCode.toDataURL(qrData);

const startY = doc.y;
doc.image(qrImage, 50, startY, { width: 70 });

const paymentStatus = order.paymentMethod === 'Cash on Delivery' ? 'Pending (COD)' : 'Paid';

// ✅ Box height thori barha di (160) taake address 2 lines mein aaye toh fit ho jaye
doc.fillColor('#f0f0f0').rect(140, startY, 390, 160).fill();
doc.fillColor('#000').fontSize(10);

// ✅ UPDATE: Street aur AddressLine dono check kar rahe hain taake address miss na ho
const completeAddress = [
    order.shippingAddress?.street,      // Frontend se 'street' aata hai
    order.shippingAddress?.addressLine, // Agar database mein 'addressLine' ho
    order.shippingAddress?.city,
    order.shippingAddress?.postalCode,
    order.shippingAddress?.country
].filter(Boolean).join(', ');

// Customer Details
doc.font('Helvetica-Bold').text(`Customer Name:`, 150, startY + 5)
   .font('Helvetica').text(`${order.shippingAddress?.fullName || 'N/A'}`, 260, startY + 5);

doc.font('Helvetica-Bold').text(`Shipping Address:`, 150, startY + 20)
   .font('Helvetica').text(completeAddress, 260, startY + 20, { width: 250 });

// Order Details (Inki positions thori niche ki hain taake address ke saath overlap na ho)
doc.font('Helvetica-Bold').text(`Invoice No:`, 150, startY + 55)
   .font('Helvetica').text(invoiceNo, 260, startY + 55);

doc.font('Helvetica-Bold').text(`Order ID:`, 150, startY + 70)
   .font('Helvetica').text(`${order.id}`, 260, startY + 70);

doc.font('Helvetica-Bold').text(`Order Date:`, 150, startY + 85)
   .font('Helvetica').text(`${new Date(order.createdAt).toLocaleDateString()}`, 260, startY + 85);

doc.font('Helvetica-Bold').text(`Payment Method:`, 150, startY + 100)
   .font('Helvetica').text(`${order.paymentMethod}`, 260, startY + 100);

doc.font('Helvetica-Bold').text(`Payment Status:`, 150, startY + 115)
   .font('Helvetica').text(`${paymentStatus}`, 260, startY + 115);

doc.font('Helvetica-Bold').text(`Customer Phone:`, 150, startY + 130)
   .font('Helvetica').text(`${order.shippingAddress?.phone || 'N/A'}`, 260, startY + 130);

// ---------------- REST OF INVOICE CONTENT ----------------
doc.moveDown(6); // Space for table

    const tableTop = doc.y;
    const colX = { no: 50, name: 90, qty: 320, price: 390, total: 480 };

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#000')
      .text('No.', colX.no, tableTop)
      .text('Product', colX.name, tableTop)
      .text('Qty', colX.qty, tableTop)
      .text('Price', colX.price, tableTop)
      .text('Total', colX.total, tableTop);

    doc
      .strokeColor('#aaa')
      .lineWidth(1)
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();

    let yPosition = tableTop + 25;
    let alternate = false;
    let subTotal = 0;
let variationTotal = 0;

    order.products.forEach((item, index) => {
  const product = item.productId;
  const name = product?.name || product?.brand || 'Unnamed Product';
  const variationName = item.selectedVariation
    ? ` (${item.selectedVariation.label})`
    : '';

  const price =
    item.priceAtOrder && item.priceAtOrder > 0
      ? item.priceAtOrder
      : product?.price || 0;

  const quantity = item.quantity || 1; // ✅ pehle define
  const variationPrice = item.selectedVariation?.price || 0;

  // 🔹 Sirf display ke liye variation total
  variationTotal += variationPrice * quantity;

  const total = price * quantity;
  subTotal += total;

  if (alternate) {
    doc.rect(50, yPosition - 2, 500, 18).fill('#f9f9f9');
    doc.fillColor('#000');
  }
  alternate = !alternate;

  doc
    .fontSize(9.5)
    .fillColor('#000')
    .text(index + 1, colX.no, yPosition)
    .text(name + variationName, colX.name, yPosition, { width: 220 })
    .text(quantity.toString(), colX.qty, yPosition)
    .text(`$${price.toFixed(2)}`, colX.price, yPosition)
    .text(`$${total.toFixed(2)}`, colX.total, yPosition);

  yPosition += 20;
});


   // --- TOTALS SECTION (FIXED TO MATCH ORDER TOTAL) ---
// Database se direct total uthaein taake mismatch na ho
const grandTotal = order.total || 0; 
const shipping = order.shippingCost || 0;

// Subtotal aur Tax ko reverse calculate karein taake breakdown sahi dikhay
const subTotalExclTax = (grandTotal - shipping) / 1.05; 
const tax = subTotalExclTax * 0.05;

// Line draw karein table ke baad
doc.strokeColor('#ccc').lineWidth(1).moveTo(50, yPosition + 5).lineTo(550, yPosition + 5).stroke();

let currentY = yPosition + 20; 
const labelX = 380; 
const valueX = 480; 

doc.font('Helvetica-Bold').fontSize(10).fillColor('#000');

// 🔹 Variation Total (Sirf display ke liye)
doc.font('Helvetica-Bold').fontSize(10).fillColor('#000');
doc.text('Variation Total:', labelX, currentY);
doc.text(`$${variationTotal.toFixed(2)}`, valueX, currentY, {
align: 'right',
  width: 70,
});
currentY += 18;


// Subtotal (Base Amount)
doc.text('Subtotal:', labelX, currentY);
doc.text(`$${subTotalExclTax.toFixed(2)}`, valueX, currentY, { align: 'right', width: 70 });

// VAT (5%)
currentY += 18;
doc.text('VAT (5%):', labelX, currentY);
doc.text(`$${tax.toFixed(2)}`, valueX, currentY, { align: 'right', width: 70 });

// Shipping
currentY += 18;
doc.text('Shipping:', labelX, currentY);
doc.text(`$${shipping.toFixed(2)}`, valueX, currentY, { align: 'right', width: 70 });

// Grand Total (Ab yeh $1111.19 hi dikhayega)
currentY += 22;
doc.fontSize(12).fillColor('#198754');
doc.text('Grand Total:', labelX, currentY);
doc.text(`$${grandTotal.toFixed(2)}`, valueX, currentY, { align: 'right', width: 70 });

    // --- SIGNATURE ---
    doc.moveDown(4);
    doc.fillColor('#000').fontSize(10).font('Helvetica');
    doc.text('Signature: ___________________________', 50, doc.y);

    // ---------------- FOOTER (CENTERED PERFECTLY) ----------------
const footerWidth = doc.page.width - 100;
const footerX1 = 190;
const footerX2 = 50;
// Signature ke baad thora gap
const footerY = doc.y + 40;
doc.fontSize(9).fillColor('#666');
doc.text(
  'Thank you for shopping at Al Syed Tech Store!',
  footerX1,
  footerY,
);
doc.text(
  'This is a computer-generated invoice and does not require a signature.',
  footerX2,
  footerY + 14,
  {
    width: footerWidth,
    align: 'center',
  }
);
doc.end();



  }catch (err) {
    console.error('❌ Invoice generation failed:', err);
    res.status(500).json({ message: 'Failed to generate invoice' });
  }
};

  
// Cancel order (customer)
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // ✅ Allow cancellation for all statuses
    order.status = "Cancelled";
    order.cancelledAt = new Date();

    await order.save();

    res.json({ message: "Order cancelled successfully", order });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ message: "Server error" });
  }
};
