const Order = require('../models/Order');
const sendEmail = require('../utils/sendEmail');
const User = require('../models/User');
const Cart = require('../models/Cart');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const path = require('path');
const Product = require('../models/Product');
const crypto = require('crypto'); // For unique tracking IDs

// ✅ Create New Order
exports.createOrder = async (req, res) => {
  const { products, total, paymentMethod, shippingAddress } = req.body;

  try {
    // 1. Generate unique tracking ID
    const trackingId = "ORD-" + crypto.randomBytes(4).toString("hex").toUpperCase();

    const order = new Order({
      userId: req.user.id,
      products,
      total,
      paymentMethod: paymentMethod || "Cash on Delivery",
      shippingAddress,
      status: "Placed",
      trackingId,
    });

    await order.save();

    // 2. Populate products for email details
    const populatedOrder = await Order.findById(order._id).populate('products.productId');

    // 3. Reduce stock
    for (const item of products) {
      const product = await Product.findById(item.productId);
      if (product) {
        if (product.quantity >= item.quantity) {
          product.quantity -= item.quantity;
          await product.save();
        } else {
          // Note: Agar stock khatam ho jaye toh order cancel logic yahan add ho sakta hai
          return res.status(400).json({ message: `${product.name} is out of stock` });
        }
      }
    }

    // 4. Clear user's cart
    await Cart.deleteMany({ user: req.user.id });

    // 5. Send confirmation email (Wrapped in try-catch so it doesn't break the response)
    const user = await User.findById(req.user.id);
    if (user?.email) {
      try {
        const productList = populatedOrder.products.map((item) => 
          `<li>${item.productId?.name || item.productId?.brand || "Product"} × ${item.quantity}</li>`
        ).join("");

        const emailContent = `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#f4f4f7; padding:30px;">
            <div style="max-width:650px; margin:0 auto; background:#ffffff; padding:30px; border-radius:10px; box-shadow:0 4px 15px rgba(0,0,0,0.08);">
              <div style="text-align:center; margin-bottom:25px;">
                <h1 style="color:#2d3748; margin:0;">🛍️ Thank You for Your Order!</h1>
              </div>
              <p>Hi <strong>${user.name || "Customer"}</strong>,</p>
              <div style="background:#f9fafb; padding:20px; border-radius:8px; margin-top:20px;">
                <h3 style="color:#2d3748; margin:0 0 10px 0;">📦 Order Summary</h3>
                <p><strong>Total:</strong> $${total.toFixed(2)}</p>
                <p><strong>Payment Method:</strong> ${paymentMethod}</p>
                <p><strong>Tracking ID:</strong> ${trackingId}</p>
              </div>
              <div style="margin-top:25px;">
                <h3 style="color:#2d3748; margin-bottom:10px;">🛒 Items</h3>
                <ul>${productList}</ul>
              </div>
            </div>
          </div>`;

        console.log("Attempting to send email to:", user.email);
        // Await is crucial for Vercel
        await sendEmail(user.email, "🛒 Order Confirmation", emailContent);
        console.log("✅ Confirmation email sent successfully");
      } catch (emailErr) {
        console.error("❌ Email failed but order was saved:", emailErr.message);
        // Hum yahan return nahi kar rahe taake user ko order success dikhe
      }
    }

    // 6. Final Response
    return res.status(201).json(order);

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
    const { status } = req.body;
    console.log("Updating status for order ID:", req.params.id);
    console.log("New Status:", status);

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.status = status;
    await order.save();

    res.json({ message: "Order status updated", order });
  } catch (err) {
    console.error("Error in updateOrderStatus:", err.message);
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
    const steps = ["Placed", "Processing", "Shipped", "Delivered"];
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
    const ecommerceWidth = doc.widthOfString(' E-Commerce');
    const totalWidth = syeedWidth + ecommerceWidth;
    const startX = centerX - totalWidth / 2;
    const y = 35;

    const logoPath = path.join(__dirname, '../public/logo.png');

const logoWidth = 120;
doc.image(logoPath, (doc.page.width - logoWidth) / 2, 30, {
  width: logoWidth,
  align: 'center',
});
doc.moveDown(4);

    const centerText = (text, fontSize = 12, font = 'Helvetica-Bold', color = '#000') => {
      doc.font(font).fontSize(fontSize).fillColor(color);
      const textWidth = doc.widthOfString(text);
      const x = (doc.page.width - textWidth) / 2;
      doc.text(text, x, doc.y);
    };

    centerText('Syeed E-Commerce Store', 18, 'Helvetica-Bold', '#1a1a1a');
    centerText('12-B Main Street, Peshawar, Pakistan', 10, 'Helvetica', '#555');
    centerText('Email: syeedstore.service@gmail.com | Phone: +92-334-9094849', 10, 'Helvetica', '#555');

    doc.moveDown(0.5).strokeColor('#cccccc').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1.2);

    // ---------------- INVOICE INFO ----------------
    // Generate Invoice No (example: INV-2025-XXXX)
    const invoiceNo = `INV-${new Date().getFullYear()}-${order._id.toString().slice(-6).toUpperCase()}`;

    const qrData = `Invoice No: ${invoiceNo}\nOrder ID: ${order._id}\nDate: ${new Date(order.createdAt).toLocaleDateString()}`;
    const qrImage = await QRCode.toDataURL(qrData);

    const startY = doc.y;
    doc.image(qrImage, 50, startY, { width: 70 });

    const paymentStatus = order.paymentMethod === 'Cash on Delivery' ? 'Pending (COD)' : 'Paid';

    doc.fillColor('#f0f0f0').rect(140, startY, 390, 120).fill();

    doc.fillColor('#000').fontSize(10)
      .text(`Invoice No: ${invoiceNo}`, 150, startY + 5)
      .text(`Order ID: ${order._id}`, 150, startY + 20)
      .text(`Order Date: ${new Date(order.createdAt).toLocaleDateString()}`, 150, startY + 35)
      .text(`Payment Method: ${order.paymentMethod}`, 150, startY + 50)
      .text(`Order Status: ${order.status || 'Processing'}`, 150, startY + 65)
      .text(`Payment Status: ${paymentStatus}`, 150, startY + 80)
      .text(`Shipping Method: ${order.shippingAddress.shippingMethod || 'Standard'}`, 150, startY + 95)
      .text(`Customer Phone: ${order.shippingAddress?.phone || 'N/A'}`, 150, startY + 110);

    // ---------------- REST OF INVOICE CONTENT ----------------
    doc.moveDown(1.5);

    const tableTop = doc.y;
    const colX = { no: 50, name: 90, qty: 300, price: 370, total: 460 };

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

    order.products.forEach((item, index) => {
      const product = item.productId;
      const name = product?.name || product?.brand || 'Unnamed Product';
      const price = product?.price || 0;
      const quantity = item.quantity;
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
        .text(name, colX.name, yPosition, { width: 190 })
        .text(quantity.toString(), colX.qty, yPosition)
        .text(`$${price.toFixed(2)}`, colX.price, yPosition)
        .text(`$${total.toFixed(2)}`, colX.total, yPosition);

      yPosition += 18;
    });

    const tax = subTotal * 0.1;
    const grandTotal = subTotal + tax;

    doc
      .strokeColor('#ccc')
      .lineWidth(1)
      .moveTo(50, yPosition + 5)
      .lineTo(550, yPosition + 5)
      .stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(10.5)
      .fillColor('#000')
      .text(`Subtotal: $${subTotal.toFixed(2)}`, colX.total - 30, yPosition + 15)
      .text(`VAT (10%): $${tax.toFixed(2)}`, colX.total - 30, yPosition + 30)
      .fontSize(11.5)
      .text(`Grand Total: $${grandTotal.toFixed(2)}`, colX.total - 30, yPosition + 45);

    doc.moveDown(2.5);

    doc
      .moveDown(1.2)
      .fontSize(10)
      .fillColor('#000')
      .text('Signature: ___________________________', 50, doc.y, { continued: true })
      // .text('Date: ___________________________', 100);

    doc
      .moveDown(7.5)
      .fontSize(9)
      .fillColor('#666')
      .text('Thank you for shopping at Syeed E-Commerce Store!', { align: 'center' })
      .text('This is a computer-generated invoice and does not require a signature.', { align: 'center' });

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
