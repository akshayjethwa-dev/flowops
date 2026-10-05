// src/utils/BotStateMachine.ts

import { BotFlowStep, BotSession, CustomerOrder, CustomerOrderComponent, Invoice, Customer } from '../types';

export interface BotResponse {
  message: string;
  updatedSession: BotSession;
  orderToCreate?: Omit<CustomerOrder, 'id' | 'orderNumber' | 'status' | 'createdAt'>;
}

export class BotStateMachine {
  /**
   * Evaluates the current state, handles user input, and returns the next state and bot response message.
   */
  public static getNextStep(
    userInput: string,
    session: BotSession,
    context: {
      customer: Customer | null;
      latestOrders: CustomerOrder[];
      latestInvoices: Invoice[];
    }
  ): BotResponse {
    const inputClean = userInput.trim().toUpperCase();
    const { customer, latestOrders, latestInvoices } = context;
    const name = customer?.contactPerson || customer?.name || 'Valued Partner';

    // If session is older than 30 minutes, reset it
    const lastActive = new Date(session.lastActiveAt).getTime();
    const now = new Date();
    const diffMin = (now.getTime() - lastActive) / 1000 / 60;
    
    let currentStep = session.currentStep;
    let updatedSession = { ...session, lastActiveAt: now.toISOString() };

    if (diffMin > 30) {
      currentStep = 'IDLE';
      updatedSession.currentStep = 'IDLE';
      updatedSession.collectedOrderItems = [];
      updatedSession.collectedAddress = undefined;
      updatedSession.collectedDeliveryDate = undefined;
    }

    // 1. Check for global commands that can override any state
    if (inputClean === 'HELP' || inputClean === 'HI' || inputClean === 'HELLO') {
      updatedSession.currentStep = 'IDLE';
      updatedSession.collectedOrderItems = [];
      updatedSession.collectedAddress = undefined;
      updatedSession.collectedDeliveryDate = undefined;

      return {
        message: `Hi ${name}! I can help you with: \n\n` +
                 `👉 Reply *ORDER* to place a new order\n` +
                 `👉 Reply *STATUS* to check order status\n` +
                 `👉 Reply *BALANCE* for your outstanding amount\n\n` +
                 `Reply *STOP* to talk to an internal coordinator.`,
        updatedSession
      };
    }

    if (inputClean === 'STATUS') {
      updatedSession.currentStep = 'IDLE';
      updatedSession.collectedOrderItems = [];
      updatedSession.collectedAddress = undefined;
      updatedSession.collectedDeliveryDate = undefined;

      if (latestOrders.length === 0) {
        return {
          message: `Dear ${name}, you don't have any recent orders in FlowOps yet. Reply *ORDER* to place your first one!`,
          updatedSession
        };
      }

      // List latest 3 orders
      const top3 = latestOrders.slice(0, 3);
      let listStr = '';
      top3.forEach((o) => {
        const dateStr = o.createdAt ? o.createdAt.split('T')[0] : 'N/A';
        const itemSummary = o.items.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ');
        listStr += `• *#${o.orderNumber}* (${dateStr}): _${o.status.replace('_', ' ').toUpperCase()}_\nItems: ${itemSummary}\n\n`;
      });

      return {
        message: `Here are your latest 3 orders:\n\n${listStr}Reply with the exact order number (e.g. *#C-ORD-9481*) to drill down into dispatch and tracking details.`,
        updatedSession
      };
    }

    if (inputClean === 'BALANCE') {
      updatedSession.currentStep = 'IDLE';
      updatedSession.collectedOrderItems = [];
      updatedSession.collectedAddress = undefined;
      updatedSession.collectedDeliveryDate = undefined;

      const outstandingSum = latestInvoices.reduce((sum, inv) => sum + (inv.outstanding || 0), 0);
      
      // Calculate last payment received
      const paidInvoices = [...latestInvoices]
        .filter((i) => i.totalPaid > 0)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
      const lastPaymentAmt = paidInvoices[0]?.totalPaid || 0;
      const lastPaymentDate = paidInvoices[0]?.invoiceDate || 'N/A';

      return {
        message: `Your current outstanding: *₹${outstandingSum.toLocaleString('en-IN')}*\n` +
                 `Last payment received: *₹${lastPaymentAmt.toLocaleString('en-IN')}* on *${lastPaymentDate}*.\n\n` +
                 `Reply *HELP* for main list.`,
        updatedSession
      };
    }

    // 2. Handle interactive flow states
    // --- ORDER FLOW ---
    if (inputClean === 'ORDER' && currentStep === 'IDLE') {
      updatedSession.currentStep = 'AWAITING_ORDER_PARTICULARS';
      return {
        message: `Sure! Please tell me the product name and quantity. You can send multiple items. (e.g. "Wire rod 500kg, Copper wire 200kg")`,
        updatedSession
      };
    }

    if (currentStep === 'AWAITING_ORDER_PARTICULARS') {
      // User entered text like: "Wire rod 500kg, Copper wire 200kg"
      // Parse items
      const itemsRaw = userInput.split(',');
      const parsedItems: { productName: string; qtyStr: string }[] = [];

      itemsRaw.forEach(item => {
        const parts = item.trim().split(/\s+(?=\d)|(?<=\d)\s*([a-zA-Z]+)/);
        const namePart = item.replace(/[\d\s]+(kg|ton|unit|tonnes|rolls|pieces|bundle|mtr|meters|boxes|g)/gi, '').trim();
        const qtyMatch = item.match(/\d+(\.\d+)?/);
        const qtyStr = qtyMatch ? qtyMatch[0] : '1';
        if (namePart) {
          parsedItems.push({
            productName: namePart,
            qtyStr: qtyStr
          });
        }
      });

      if (parsedItems.length === 0) {
        return {
          message: `Sorry, I couldn't understand those items. Please reply with product and quantity (e.g., "M12 Hex Bolts 500 units, CS45 Round bars 20 tonnes")`,
          updatedSession
        };
      }

      updatedSession.collectedOrderItems = parsedItems;
      updatedSession.currentStep = 'AWAITING_ADDRESS_RESOLUTION';
      
      const savedAddr = customer?.billingAddress || 'Your corporate address';
      return {
        message: `Got it. Delivery address: *"${savedAddr}"*?\n\nReply *YES* to confirm, or send a new delivery address text directly.`,
        updatedSession
      };
    }

    if (currentStep === 'AWAITING_ADDRESS_RESOLUTION') {
      const address = inputClean === 'YES' || inputClean === 'Y' 
        ? (customer?.billingAddress || 'Pre-saved address') 
        : userInput;

      updatedSession.collectedAddress = address;
      updatedSession.currentStep = 'AWAITING_DELIVERY_DATE';

      return {
        message: `Delivery date? (Reply with a date like "15 June" or "30 July")`,
        updatedSession
      };
    }

    if (currentStep === 'AWAITING_DELIVERY_DATE') {
      updatedSession.collectedDeliveryDate = userInput;
      updatedSession.currentStep = 'COMPLETED';

      // Assemble final CustomerOrder
      const address = updatedSession.collectedAddress || customer?.billingAddress || 'Saved Office';
      const items: CustomerOrderComponent[] = (updatedSession.collectedOrderItems || []).map((parsed, idx) => {
        const parsedQty = parseFloat(parsed.qtyStr) || 1;
        return {
          productId: `p-${idx}-${Math.floor(Math.random() * 90)}`,
          name: parsed.productName,
          quantity: parsedQty,
          unit: parsed.productName.toLowerCase().includes('wire') ? 'rolls' : 'units',
          unitPrice: 0, // Pending back-office cost estimation
          total: 0
        };
      });

      const orderNumber = `C-ORD-${Math.floor(100000 + Math.random() * 900000)}`;

      const orderToCreate: Omit<CustomerOrder, 'id' | 'orderNumber' | 'status' | 'createdAt'> = {
        tenantId: customer?.tenantId || 'tenant_1',
        customerId: customer?.id || 'demo_id',
        customerName: customer?.name || 'Walkin Customer',
        items,
        deliveryAddress: address,
        requestedDeliveryDate: userInput,
        notes: 'Placed via WhatsApp Order Bot',
        isBotOrder: true,
        createdByDevice: 'whatsapp'
      };

      // Reset step to IDLE for subsequent requests
      updatedSession.currentStep = 'IDLE';
      updatedSession.collectedOrderItems = [];
      updatedSession.collectedAddress = undefined;
      updatedSession.collectedDeliveryDate = undefined;

      return {
        message: `Your order has been placed successfully! 🎉\n\n` +
                 `Order *#${orderNumber}* for:\n` +
                 items.map(i => `• ${i.name} (Qty: ${i.quantity})`).join('\n') + `\n\n` +
                 `Delivery Address: _${address}_\n` +
                 `Target Date: _${userInput}_\n\n` +
                 `Our central coordinators will evaluate pricing and confirm within 24 hours.`,
        updatedSession,
        orderToCreate: {
          ...orderToCreate,
        }
      };
    }

    // Checking if user replied with an order number in status flow
    const matchedOrder = latestOrders.find(
      (o) => o.orderNumber.toUpperCase() === inputClean || 
             o.orderNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === inputClean.replace(/[^a-zA-Z0-9]/g, '') ||
             inputClean.includes(o.orderNumber.replace('C-ORD-', ''))
    );

    if (matchedOrder) {
      const itemsStr = matchedOrder.items.map(i => `• ${i.name} (Qty: ${i.quantity} ${i.unit})`).join('\n');
      const stage = matchedOrder.status.replace('_', ' ').toUpperCase();
      
      return {
        message: `🔍 *Order Verification Details:* \n\n` +
                 `Order No: *#${matchedOrder.orderNumber}*\n` +
                 `Stage: *${stage}*\n` +
                 `Placed On: ${matchedOrder.createdAt ? matchedOrder.createdAt.split('T')[0] : 'N/A'}\n` +
                 `Items:\n${itemsStr}\n\n` +
                 `Delivery Address: ${matchedOrder.deliveryAddress}\n` +
                 `Expected Delivery: ${matchedOrder.requestedDeliveryDate}\n` +
                 `Consignment Tracker: *LR-45920-A (VRL Logistics)*`,
        updatedSession
      };
    }

    // Default Fallback
    updatedSession.currentStep = 'IDLE';
    return {
      message: `Hi ${name}! I did not quite catch that. \n\n` +
               `👉 Reply *ORDER* to place a new order\n` +
               `👉 Reply *STATUS* to check order status\n` +
               `👉 Reply *BALANCE* for your outstanding amount\n\n` +
               `Reply *STOP* to talk to an internal coordinator.`,
      updatedSession
    };
  }
}
