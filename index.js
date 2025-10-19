import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";
import SibApiV3Sdk from 'sib-api-v3-sdk';

dotenv.config();
const app = express();
app.use(cors());

app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ===== CONFIGURATION BREVO =====
const brevoClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = brevoClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const brevoApi = new SibApiV3Sdk.TransactionalEmailsApi();



// ===== Fonction d'envoi d'e-mail =====
async function sendBrevoEmail({ to, subject, htmlContent }) {
  try {
    const emailData = {
      sender: { name: "Mama Food's", email: process.env.EMAIL_USER },
      to: [{ email: to }],
      subject,
      htmlContent,
    };

    await brevoApi.sendTransacEmail(emailData);
    console.log(`📩 Email envoyé à ${to}`);
  } catch (error) {
    console.error("Erreur Brevo:", error.response?.text || error.message);
  }
}

// ===== Template Email Client - Confirmation Commande =====
function getClientConfirmationTemplate(customerInfo, items, delivery , discount , total ) {
  const itemsList = items.map(item => `
    <tr>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e0e0e0;">
        <strong style="color: #333;">${item.name}</strong>
        ${item.description ? `<br><small style="color: #666;">${item.description}</small>` : ''}
      </td>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e0e0e0; text-align: center; color: #666;">
        x${item.quantity}
      </td>
    </tr>`
  ).join('');

  return `
    <!DOCTYPE html>
    <html style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; background-color: #f5f7fa; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #f97316 0%, #dc2626 100%); padding: 32px 20px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
        .header p { margin: 8px 0 0 0; font-size: 16px; opacity: 0.9; }
        .content { padding: 32px 20px; }
        .section { margin-bottom: 24px; }
        .section-title { font-size: 14px; font-weight: 700; color: #f97316; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
        .info-box { background-color: #f9fafb; border-left: 4px solid #f97316; padding: 16px; border-radius: 6px; margin-bottom: 16px; }
        .info-row { display: flex; margin-bottom: 8px; }
        .info-label { font-weight: 600; color: #666; min-width: 120px; }
        .info-value { color: #333; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        .total-row { background-color: #f97316; color: white; }
        .total-row td { padding: 16px 8px; font-weight: 700; font-size: 16px; }
        .divider { border-top: 2px solid #e5e7eb; margin: 24px 0; }
        .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e5e7eb; }
        .security { display: flex; justify-content: center; gap: 20px; margin-top: 16px; font-size: 12px; color: #666; }
        .cta-button { display: inline-block; background-color: #f97316; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Merci pour votre commande ! 🎉</h1>
          <p>Votre commande a été confirmée avec succès</p>
        </div>

        <div class="content">
          <!-- Section Récapitulatif Commande -->
          <div class="section">
            <div class="section-title">Récapitulatif de votre commande</div>
            <table>
              <thead>
                <tr style="border-bottom: 2px solid #e5e7eb;">
                  <td style="padding: 12px 8px; font-weight: 600; color: #333;">Article</td>
                  <td style="padding: 12px 8px; font-weight: 600; color: #333; text-align: center;">Qté</td>
                </tr>
              </thead>
              <tbody>
                ${itemsList}
              </tbody>
              <tfoot>
                <tr style="border-top: 2px solid #e5e7eb;">
                  <td style="padding: 12px 8px; text-align: right; font-weight: 600; color: #666;">Livraison:</td>
                  <td style="padding: 12px 8px; text-align: center; color: #666;">${delivery.toFixed(2)}€</td>
                </tr>
                ${discount > 0 ? `
                <tr>
                  <td style="padding: 12px 8px; text-align: right; font-weight: 600; color: #10b981;">Réduction:</td>
                  <td style="padding: 12px 8px; text-align: center; color: #10b981;">-${discount.toFixed(2)}€</td>
                </tr>
                ` : ''}
                <tr class="total-row">
                  <td style="padding: 16px 8px; text-align: right;">Total payé:</td>
                  <td style="padding: 16px 8px; text-align: center; font-size: 18px;">${total.toFixed(2)}€</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Section Informations Client -->
          <div class="divider"></div>
          <div class="section">
            <div class="section-title">Vos informations</div>
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">Nom:</span>
                <span class="info-value">${customerInfo.fullName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Email:</span>
                <span class="info-value">${customerInfo.email}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Téléphone:</span>
                <span class="info-value">${customerInfo.phone}</span>
              </div>
            </div>
          </div>

          <!-- Section Adresse Livraison -->
          <div class="section">
            <div class="section-title">Adresse de livraison</div>
            <div class="info-box">
              <div class="info-row">
                <span class="info-value">
                  ${customerInfo.address.street}<br>
                  ${customerInfo.address.postalCode} ${customerInfo.address.city}<br>
                  ${customerInfo.address.country}
                </span>
              </div>
            </div>
          </div>

          <div class="divider"></div>

          <!-- Section Suivi -->
          <div class="section" style="text-align: center; background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; border-radius: 6px;">
            <p style="margin: 0; color: #166534; font-weight: 600;">
              Votre commande est en cours de préparation.<br>
              Vous recevrez un SMS de confirmation de livraison sous peu.
            </p>
          </div>

          <div class="security">
            <span>🔒 Paiement sécurisé</span>
            <span>📦 Expédition rapide</span>
            <span>💳 Données protégées</span>
          </div>
        </div>

        <div class="footer">
          <p style="margin: 0;">Cet email a été généré automatiquement, merci de ne pas y répondre.</p>
          <p style="margin: 8px 0 0 0; color: #999;">© 2024 Mama Food's - Cuisine africaine authentique</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ===== Template Email Admin - Nouvelle Commande =====
function getAdminNotificationTemplate(customerInfo , items , delivery , discount , total) {
  const itemsList = items.map(item => `
    <tr style="border-bottom: 1px solid #e0e0e0;">
      <td style="padding: 12px 8px; color: #333;">${item.name}</td>
      <td style="padding: 12px 8px; text-align: center; color: #666;">x${item.quantity}</td>
    </tr>`
  ).join('');

  return `
    <!DOCTYPE html>
    <html style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; background-color: #f5f7fa; }
        .container { max-width: 700px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #f97316 0%, #dc2626 100%); padding: 32px 20px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
        .header .amount { font-size: 20px; opacity: 0.9; margin-top: 8px; }
        .content { padding: 32px 20px; }
        .section { margin-bottom: 24px; }
        .section-title { font-size: 13px; font-weight: 700; color: #f97316; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .info-box { background-color: #f9fafb; padding: 12px; border-radius: 6px; }
        .info-label { font-size: 12px; color: #666; font-weight: 600; margin-bottom: 4px; }
        .info-value { font-size: 14px; color: #333; font-weight: 500; }
        .address-box { background-color: #f9fafb; padding: 12px; border-radius: 6px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        thead tr { border-bottom: 2px solid #e5e7eb; }
        thead td { padding: 12px 8px; font-weight: 600; font-size: 12px; color: #666; text-transform: uppercase; }
        tbody td { padding: 12px 8px; }
        .total-row { background-color: #fef3c7; font-weight: 700; }
        .total-row td { padding: 12px 8px; }
        .action-box { background-color: #fef08a; border-left: 4px solid #f97316; padding: 16px; border-radius: 6px; margin-top: 16px; }
        .action-box p { margin: 0; color: #92400e; font-weight: 600; }
        .footer { background-color: #f9fafb; padding: 16px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Nouvelle Commande Reçue 🍽️</h1>
          <div class="amount">Montant: ${total.toFixed(2)}€</div>
        </div>

        <div class="content">
          <!-- Section Client -->
          <div class="section">
            <div class="section-title">Informations Client</div>
            <div class="info-grid">
              <div class="info-box">
                <div class="info-label">Nom</div>
                <div class="info-value">${customerInfo.fullName}</div>
              </div>
              <div class="info-box">
                <div class="info-label">Téléphone</div>
                <div class="info-value">${customerInfo.phone}</div>
              </div>
              <div class="info-box" style="grid-column: 1 / -1;">
                <div class="info-label">Email</div>
                <div class="info-value">${customerInfo.email}</div>
              </div>
            </div>
          </div>

          <!-- Section Adresse -->
          <div class="section">
            <div class="section-title">Adresse de Livraison</div>
            <div class="address-box">
              <div class="info-value" style="line-height: 1.6;">
                ${customerInfo.address.street}<br>
                ${customerInfo.address.postalCode} ${customerInfo.address.city}<br>
                ${customerInfo.address.country}
              </div>
            </div>
          </div>

          <!-- Section Articles -->
          <div class="section">
            <div class="section-title">Articles Commandés</div>
            <table>
              <thead>
                <tr>
                  <td>Article</td>
                  <td style="text-align: center;">Qté</td>
                </tr>
              </thead>
              <tbody>
                ${itemsList}
              </tbody>
              <tfoot>
                <tr>
                  <td style="text-align: right; font-weight: 600;">Livraison:</td>
                  <td style="text-align: center;">${delivery.toFixed(2)}€</td>
                </tr>
                ${discount > 0 ? `
                <tr>
                  <td style="text-align: right; font-weight: 600; color: #059669;">Réduction:</td>
                  <td style="text-align: center; color: #059669;">-${discount.toFixed(2)}€</td>
                </tr>
                ` : ''}
                <tr class="total-row">
                  <td style="text-align: right;">Total TTC:</td>
                  <td style="text-align: center; font-size: 16px;">${total.toFixed(2)}€</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Action requise -->
          <div class="action-box">
            <p>📋 Action requise: Contactez le client pour confirmer la livraison et les détails de la commande.</p>
          </div>
        </div>

        <div class="footer">
          <p style="margin: 0;">Cet email a été généré automatiquement par le système de commande Mama Food's</p>
          <p style="margin: 8px 0 0 0;">© 2024 Mama Food's - Gestion des Commandes</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ===== Fonction d'envoi email client =====
async function sendOrderConfirmationEmail(session, customerInfo) {
  try {
    const { delivery, discount, items } = session.metadata;
    const parsedItems = JSON.parse(items);
    const total = (session.amount_total || 0) / 100;

    const emailHTML = getClientConfirmationTemplate(
      customerInfo,
      parsedItems,
      parseFloat(delivery),
      parseFloat(discount),
      total
    );

    if (session.customer_details?.email) {
      await sendBrevoEmail({
        to: session.customer_details.email,
        subject: `Confirmation de commande Mama Food's - ${total.toFixed(2)}€`,
        htmlContent: emailHTML,
      });
    }
  } catch (err) {
    console.error("Erreur envoi email client:", err.message);
  }
}

// ===== Fonction d'envoi email admin =====
async function sendAdminNotification(session, customerInfo) {
  try {
    const { delivery, discount, items } = session.metadata;
    const parsedItems = JSON.parse(items);
    const total = (session.amount_total || 0) / 100;

    const emailHTML = getAdminNotificationTemplate(
      customerInfo,
      parsedItems,
      parseFloat(delivery),
      parseFloat(discount),
      total
    );

    await sendBrevoEmail({
      to: process.env.ADMIN_EMAIL,
      subject: `Nouvelle commande reçue - ${total.toFixed(2)}€`,
      htmlContent: emailHTML,
    });
  } catch (err) {
    console.error("Erreur notification admin:", err.message);
  }
}

// ===== Route: Créer session Stripe =====
app.post('/create-checkout-session', async (req, res) => {
  try {
    const {
      totalAmount,
      description,
      delivery,
      discount,
      items,
      customerEmail,
      customerName,
      customerPhone,
      customerFirstName,
      customerLastName,
      customercity,
      customerstreet,
      customerpostalCode,
      customercountry
    } = req.body;

    if (!totalAmount || !items?.length) {
      return res.status(400).json({ message: "Données panier invalides" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: { name: "Commande Mama Food's", description },
          unit_amount: Math.round(totalAmount * 100),
        },
        quantity: 1,
      }],
      metadata: {
        delivery: delivery.toString(),
        discount: discount.toString(),
        items: JSON.stringify(items),
        customerName,
        customerPhone,
        customerFirstName,
        customerLastName,
        customerCity: customercity,
        customerStreet: customerstreet,
        customerPostalCode: customerpostalCode,
        customerCountry: customercountry,
      },
      customer_email: customerEmail,
      success_url: `${process.env.FRONTEND_URL}/#/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/#/cancel`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Erreur Stripe:', error);
    res.status(500).json({ message: 'Erreur création session paiement' });
  }
});

// ===== Webhook Stripe =====
app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Erreur signature webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      console.log('Paiement réussi:', session.id);

      // Récupérer les infos client depuis metadata
      const metadata = session.metadata;
      const customerInfo = {
        firstName: metadata?.customerFirstName || '',
        lastName: metadata?.customerLastName || '',
        email: session.customer_details?.email || '',
        phone: metadata?.customerPhone || '',
        fullName: metadata?.customerName || session.customer_details?.name || '',
        address: {
          street: metadata?.customerStreet || '',
          city: metadata?.customerCity || '',
          postalCode: metadata?.customerPostalCode || '',
          country: metadata?.customerCountry || ''
        }
      };
      // Envoyer les emails
      await sendOrderConfirmationEmail(session, customerInfo);
      await sendAdminNotification(session, customerInfo);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Erreur webhook:', err.message);
    res.status(500).json({ error: 'Erreur traitement webhook' });
  }
});

// ===== Test Email =====
app.post('/test-email', async (req, res) => {
  try {
    await sendBrevoEmail({
      to: process.env.ADMIN_EMAIL,
      subject: "Test Brevo réussi",
      htmlContent: "<h1>Configuration Brevo opérationnelle !</h1>",
    });
    res.json({ message: "Email de test envoyé !" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Démarrage =====
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));