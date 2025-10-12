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

// ===== Fonction d’envoi d’e-mail =====
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
    console.error("❌ Erreur Brevo:", error.response?.text || error.message);
  }
}

// ===== Email client =====
async function sendOrderConfirmationEmail(session) {
  try {
    const { delivery, discount, items } = session.metadata;
    const parsedItems = JSON.parse(items);

    const itemsList = parsedItems.map(
      (item) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">
            <strong>${item.name}</strong>
            ${item.description ? `<br><small>${item.description}</small>` : ''}
          </td>
          <td style="padding: 10px; text-align: center;">${item.quantity}</td>
        </tr>`
    ).join('');

    const emailHTML = `
      <h2>Merci pour votre commande chez Mama Food's 🎉</h2>
      <p>Votre commande a été confirmée avec succès.</p>
      <table>${itemsList}</table>
      <p>Frais de livraison: ${delivery}€</p>
      ${discount > 0 ? `<p>Réduction: -${discount}€</p>` : ''}
      <p><strong>Total payé:</strong> ${(session.amount_total / 100).toFixed(2)}€</p>
      <hr>
      <p><small>Cet e-mail est automatique, merci de ne pas y répondre.</small></p>
    `;

    if (session.customer_details?.email) {
      await sendBrevoEmail({
        to: session.customer_details.email,
        subject: `✅ Confirmation de commande - Mama Food's`,
        htmlContent: emailHTML,
      });
    }
  } catch (err) {
    console.error("❌ Erreur envoi email client:", err.message);
  }
}

// ===== Email admin =====
async function sendAdminNotification(session) {
  try {
    const { delivery, discount, items, customerName, customerPhone } = session.metadata;
    const parsedItems = JSON.parse(items);

    const itemsList = parsedItems.map(
      (item) => `
        <tr>
          <td><strong>${item.name}</strong></td>
          <td style="text-align:center;">${item.quantity}</td>
        </tr>`
    ).join('');

    const adminHTML = `
      <h2>Nouvelle commande reçue 🍽️</h2>
      <p><strong>Client:</strong> ${customerName || session.customer_details?.name || 'Non renseigné'}</p>
      <p><strong>Téléphone:</strong> ${customerPhone || 'Non renseigné'}</p>
      <p><strong>Email:</strong> ${session.customer_details?.email || 'Non renseigné'}</p>
      <table>${itemsList}</table>
      <p>Livraison: ${delivery}€</p>
      ${discount > 0 ? `<p>Réduction: -${discount}€</p>` : ''}
      <p><strong>Total:</strong> ${(session.amount_total / 100).toFixed(2)}€</p>
    `;

    await sendBrevoEmail({
      to: process.env.ADMIN_EMAIL,
      subject: `🔔 Nouvelle commande - ${(session.amount_total / 100).toFixed(2)}€`,
      htmlContent: adminHTML,
    });
  } catch (err) {
    console.error("❌ Erreur notification admin:", err.message);
  }
}

// ===== Routes Stripe =====
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { totalAmount, description, delivery, discount, items, customerEmail, customerName, customerPhone } = req.body;

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
        delivery,
        discount,
        items: JSON.stringify(items),
        customerName,
        customerPhone,
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
    console.error('❌ Erreur signature webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      console.log('✅ Paiement réussi:', session.id);

      await sendOrderConfirmationEmail(session);
      await sendAdminNotification(session);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('❌ Erreur webhook:', err.message);
    res.status(500).json({ error: 'Erreur traitement webhook' });
  }
});

// ===== Test Email =====
app.post('/test-email', async (req, res) => {
  try {
    await sendBrevoEmail({
      to: process.env.ADMIN_EMAIL,
      subject: "🚀 Test Brevo réussi",
      htmlContent: "<h1>✅ Configuration Brevo opérationnelle !</h1>",
    });
    res.json({ message: "Email de test envoyé !" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Démarrage =====
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`✅ Serveur prêt sur le port ${PORT}`));
