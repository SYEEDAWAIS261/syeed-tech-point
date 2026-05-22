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
const subTotalItems = productsWithPrice.reduce((acc, item) => {
    const unitPrice = item.priceAtOrder + (item.selectedVariation?.price || 0);
    return acc + (unitPrice * item.quantity);
}, 0);

const calculatedTax = subTotalItems * 0.05;
const finalTotal = subTotalItems + calculatedTax + Number(shippingCost); // ✅ Total hamesha backend pe re-calculate karein
    // 3. Create Order Object (Fixed the 'total' variable bug)
 const order = new Order({
  userId: req.user.id,
  products: productsWithPrice,
  subtotal: subTotalItems, // ✅ Ye add karein
  tax: calculatedTax,
  total: finalTotal,
  paymentMethod,
  shippingAddress,
  shippingMethod,
  shippingCost,
  status: "Placed",
  trackingId: "ORD-" + crypto.randomBytes(4).toString("hex").toUpperCase()
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

    // ✅ PAGE SIZE A4 set karo aur margins kam karo
    const doc = new PDFDocument({ 
      margin: 40,
      size: 'A4',
      bufferPages: true // ✅ Important: Multiple pages handle karne ke liye
    });

    const watermarkPath = path.join(__dirname, '../public/logo.png');
    const watermarkOpacity = 0.05;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order._id}.pdf`);
    doc.pipe(res);

    // ✅ HELPER: Har page par watermark add karne ka function
    const addWatermark = () => {
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
    };

    // ✅ HELPER: Header add karne ka function (har page ke liye)
    const addHeader = () => {
      const logoPath = path.join(__dirname, '../public/logo.png');
      const logoWidth = 100; // ✅ Chota logo
      const logoHeight = 100;
      
      doc.image(logoPath, (doc.page.width - logoWidth) / 2, 20, {
        width: logoWidth,
        height: logoHeight,
        align: 'center',
      });

      // Brand Name
      doc.font('Helvetica-Bold').fontSize(16);
      const part1 = 'Al Syed';
      const part2 = 'Tech';
      const totalBrandWidth = doc.widthOfString(part1) + doc.widthOfString(part2);
      const brandX = (doc.page.width - totalBrandWidth) / 2;
      
      doc.fillColor('#198754').text(part1, brandX, 125, { continued: true });
      doc.fillColor('#e9e5e5').text(part2);
      
      // Address
      doc.fontSize(9).fillColor('#555');
      doc.text('12-B Main Street, Al-Ain, UAE', 0, 145, { align: 'center' });
      doc.text('Email: syeedstore.service@gmail.com | Phone: +92-334-9094849', { align: 'center' });
      
      // Line
      doc.strokeColor('#cccccc').lineWidth(1).moveTo(40, 175).lineTo(555, 175).stroke();
    };

    // ✅ FIRST PAGE SETUP
    addWatermark();
    addHeader();

    // ---------------- CUSTOMER INFO BOX ----------------
    const invoiceNo = `INV-${new Date().getFullYear()}-${order._id.toString().slice(-6).toUpperCase()}`;
    const qrData = `Invoice No: ${invoiceNo}\nOrder ID: ${order._id}\nDate: ${new Date(order.createdAt).toLocaleDateString()}`;
    const qrImage = await QRCode.toDataURL(qrData);

    const startY = 190;
    doc.image(qrImage, 40, startY, { width: 60 });

    const paymentStatus = order.paymentMethod === 'Cash on Delivery' ? 'Pending (COD)' : 'Paid';
    const completeAddress = [
      order.shippingAddress?.street,
      order.shippingAddress?.addressLine,
      order.shippingAddress?.city,
      order.shippingAddress?.postalCode,
      order.shippingAddress?.country
    ].filter(Boolean).join(', ');

    // Info Box
    doc.fillColor('#f8f9fa').rect(110, startY, 420, 140).fill();
    doc.fillColor('#000').fontSize(9);

    const infoX = 120;
    const valueX = 220;
    let infoY = startY + 8;

    doc.font('Helvetica-Bold').text('Customer Name:', infoX, infoY);
    doc.font('Helvetica').text(order.shippingAddress?.fullName || 'N/A', valueX, infoY);
    
    infoY += 14;
    doc.font('Helvetica-Bold').text('Shipping Address:', infoX, infoY);
    doc.font('Helvetica').text(completeAddress, valueX, infoY, { width: 300, height: 28, ellipsis: true });
    
    infoY += 28;
    doc.font('Helvetica-Bold').text('Invoice No:', infoX, infoY);
    doc.font('Helvetica').text(invoiceNo, valueX, infoY);
    
    infoY += 14;
    doc.font('Helvetica-Bold').text('Order Date:', infoX, infoY);
    doc.font('Helvetica').text(new Date(order.createdAt).toLocaleDateString(), valueX, infoY);
    
    infoY += 14;
    doc.font('Helvetica-Bold').text('Payment:', infoX, infoY);
    doc.font('Helvetica').text(`${order.paymentMethod} (${paymentStatus})`, valueX, infoY);
    
    infoY += 14;
    doc.font('Helvetica-Bold').text('Phone:', infoX, infoY);
    doc.font('Helvetica').text(order.shippingAddress?.phone || 'N/A', valueX, infoY);

    // ---------------- TABLE SETUP ----------------
    let tableTop = startY + 160;
    const colX = { no: 40, name: 70, qty: 280, price: 340, total: 420, variation: 480 };
    
    // ✅ Check if table fits on first page
    if (tableTop > 500) {
      doc.addPage();
      addWatermark();
      addHeader();
      tableTop = 200;
    }

    // Table Header
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#fff');
    doc.fillColor('#198754').rect(40, tableTop - 5, 515, 20).fill();
    doc.fillColor('#fff');
    doc.text('No.', colX.no, tableTop);
    doc.text('Product', colX.name, tableTop);
    doc.text('Qty', colX.qty, tableTop);
    doc.text('Price', colX.price, tableTop);
    doc.text('Total', colX.total, tableTop);
    doc.text('Variation', colX.variation, tableTop);

    let yPosition = tableTop + 20;
    let alternate = false;
    let subTotal = 0;
    let variationTotal = 0;
    const rowHeight = 18; // ✅ Fixed row height

    order.products.forEach((item, index) => {
      const product = item.productId;
      const name = product?.name || product?.brand || 'Unnamed Product';
      const variationName = item.selectedVariation?.label || '';
      
      const price = item.priceAtOrder && item.priceAtOrder > 0 ? item.priceAtOrder : product?.price || 0;
      const quantity = item.quantity || 1;
      const variationPrice = item.selectedVariation?.price || 0;
      
      variationTotal += variationPrice * quantity;
      const total = price * quantity;
      subTotal += total;

      // ✅ PAGE BREAK CHECK: Agar next page chahiye toh
      if (yPosition > 700) {
        doc.addPage();
        addWatermark();
        addHeader();
        
        // Table header repeat on new page
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#fff');
        doc.fillColor('#198754').rect(40, 190, 515, 20).fill();
        doc.fillColor('#fff');
        doc.text('No.', colX.no, 195);
        doc.text('Product', colX.name, 195);
        doc.text('Qty', colX.qty, 195);
        doc.text('Price', colX.price, 195);
        doc.text('Total', colX.total, 195);
        doc.text('Variation', colX.variation, 195);
        
        yPosition = 220;
        alternate = false;
      }

      // Row background
      if (alternate) {
        doc.fillColor('#f8f9fa').rect(40, yPosition - 3, 515, rowHeight).fill();
      }
      alternate = !alternate;

      // Row content
      doc.fillColor('#000').fontSize(8.5).font('Helvetica');
      
      // ✅ Product name wrap nahi hoga, truncate hoga
      const displayName = name.length > 35 ? name.substring(0, 35) + '...' : name;
      
      doc.text(index + 1, colX.no, yPosition);
      doc.text(displayName, colX.name, yPosition, { width: 200 });
      doc.text(quantity.toString(), colX.qty, yPosition);
      doc.text(`$${price.toFixed(2)}`, colX.price, yPosition);
      doc.text(`$${total.toFixed(2)}`, colX.total, yPosition);
      doc.text(variationName ? `$${variationPrice.toFixed(2)}` : '-', colX.variation, yPosition);

      yPosition += rowHeight;
    });

    // ---------------- TOTALS SECTION ----------------
    // ✅ Check if totals fit on current page
    if (yPosition > 650) {
      doc.addPage();
      addWatermark();
      addHeader();
      yPosition = 200;
    }

    // Line
    doc.strokeColor('#198754').lineWidth(1).moveTo(40, yPosition + 5).lineTo(555, yPosition + 5).stroke();

    const grandTotal = order.total || 0;
    const shipping = order.shippingCost || 0;
const subTotalSaved = order.subtotal || 0; // ✅ Database se uthayein
const taxSaved = order.tax || 0;

    let totalY = yPosition + 20;
    const labelX = 350;
    const totalValueX = 480;

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000');
    
    doc.text('Variation Total:', labelX, totalY);
    doc.text(`$${variationTotal.toFixed(2)}`,totalValueX, totalY, { align: 'right', width: 70 });
    
    totalY += 16;
    doc.text('Subtotal:', labelX, totalY);
    doc.text(`$${subTotalSaved.toFixed(2)}`, totalValueX, totalY, { align: 'right', width: 70 });
    
    totalY += 16;
    doc.text('VAT (5%):', labelX, totalY);
    doc.text(`$${taxSaved.toFixed(2)}`, totalValueX, totalY, { align: 'right', width: 70 });
    
    totalY += 16;
    doc.text('Shipping:', labelX, totalY);
    doc.text(`$${shipping.toFixed(2)}`, totalValueX, totalY, { align: 'right', width: 70 });
    
    totalY += 20;
    doc.fontSize(12).fillColor('#198754');
    doc.text('Grand Total:', labelX, totalY);
    doc.text(`$${grandTotal.toFixed(2)}`, totalValueX, totalY, { align: 'right', width: 70 });

    let signatureY = totalY + 60;
    if (signatureY > 700) {
      doc.addPage();
      addWatermark();
      addHeader();
      signatureY = 600;
    }
    // Signature
    doc.fillColor('#000').fontSize(10).font('Helvetica');
    doc.text('Signature: ___________________________', 60, signatureY);
const footerY = signatureY + 80;    

  doc.fontSize(8).fillColor('#666');
doc.text(`Thank you for shopping at Al Syed Tech Store!`, 0, footerY, { align: 'center' });
doc.text(`This is a computer-generated invoice. No signature required.`, 0, footerY + 12, { align: 'center' });
    // Bottom line
    // doc.strokeColor('#198754').lineWidth(2).moveTo(40, footerY + 30).lineTo(555, footerY + 30).stroke();

    doc.end();
  } catch (error) {
    console.error('Invoice generation error:', error);
    res.status(500).json({ message: 'Error generating invoice', error: error.message });
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
