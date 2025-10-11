import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";
import nodemailer from "nodemailer";

dotenv.config();
const app = express();
app.use(cors());

// Pour le webhook, utiliser raw bodyyy
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Configuration du transporteur d'emaillll
const transporter = nodemailer.createTransport({
  service: 'gmail', // Ou 'outlook', 'yahoo', etc.
  auth: {
    user: process.env.EMAIL_USER, // Votre email
    pass: process.env.EMAIL_PASS, // Mot de passe d'application
  },
});

// Fonction pour envoyer l'email de confirmation au client
async function sendOrderConfirmationEmail(session) {
  try {
    const { delivery, discount, items } = session.metadata;
    const parsedItems = JSON.parse(items);
    
    // Créer le contenu HTML de l'email
    const itemsList = parsedItems
      .map(item => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">
            <strong>${item.name}</strong>
            ${item.description ? `<br><small style="color: #666;">${item.description}</small>` : ''}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        </tr>
      `)
      .join('');

    const emailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 20px; }
          .order-details { background-color: white; padding: 15px; margin: 20px 0; }
          table { width: 100%; border-collapse: collapse; }
          .total { font-weight: bold; font-size: 18px; color: #4CAF50; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Commande Confirmée !</h1>
          </div>
          <div class="content">
            <h2>Merci pour votre commande chez Mama Food's</h2>
            <p>Votre paiement a été traité avec succès. Voici le récapitulatif de votre commande :</p>
            
            <div class="order-details">
              <h3>📦 Détails de la commande</h3>
              <table>
                <thead>
                  <tr style="background-color: #f0f0f0;">
                    <th style="padding: 10px; text-align: left;">Article</th>
                    <th style="padding: 10px; text-align: center;">Quantité</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsList}
                </tbody>
              </table>
              
              <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #4CAF50;">
                <p>Frais de livraison: <strong>${delivery}€</strong></p>
                ${discount > 0 ? `<p>Réduction appliquée: <strong>-${discount}€</strong></p>` : ''}
                <p class="total">Total payé: ${(session.amount_total / 100).toFixed(2)}€</p>
              </div>
            </div>
            
            <p><strong>Numéro de commande:</strong> ${session.id}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('fr-FR', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
            
            <p style="margin-top: 30px;">Votre commande sera préparée et livrée dans les meilleurs délais.</p>
            <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
          </div>
          <div class="footer">
            <p>Mama Food's - Cuisine africaine authentique</p>
            <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Envoyer l'email au client
    if (session.customer_details?.email) {
      await transporter.sendMail({
        from: `"Mama Food's" <${process.env.EMAIL_USER}>`,
        to: session.customer_details.email,
        subject: `✅ Confirmation de commande - Mama Food's`,
        html: emailHTML,
      });
      console.log('✅ Email de confirmation envoyé au client:', session.customer_details.email);
    }

  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email client:', error);
    throw error;
  }
}

// Fonction pour envoyer une notification à l'admin
async function sendAdminNotification(session) {
  try {
    const { delivery, discount, items, customerName, customerPhone } = session.metadata;
    const parsedItems = JSON.parse(items);
    
    const itemsList = parsedItems
      .map(item => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">
            <strong>${item.name}</strong>
            ${item.description ? `<br><small style="color: #666;">${item.description}</small>` : ''}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        </tr>
      `)
      .join('');

    const adminEmailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FF5722; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 20px; }
          .order-details { background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #FF5722; }
          table { width: 100%; border-collapse: collapse; }
          .total { font-weight: bold; font-size: 18px; color: #FF5722; }
          .info-box { background-color: #fff3e0; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 Nouvelle Commande Reçue !</h1>
          </div>
          <div class="content">
            <h2>Une nouvelle commande vient d'être effectuée</h2>
            
            <div class="info-box">
              <p><strong>👤 Client:</strong> ${customerName || session.customer_details?.name || 'Non renseigné'}</p>
              <p><strong>📧 Email:</strong> ${session.customer_details?.email || 'Non renseigné'}</p>
              <p><strong>📱 Téléphone:</strong> ${customerPhone || session.customer_details?.phone || 'Non renseigné'}</p>
            </div>
            
            <div class="order-details">
              <h3>📦 Détails de la commande</h3>
              <table>
                <thead>
                  <tr style="background-color: #f0f0f0;">
                    <th style="padding: 10px; text-align: left;">Article</th>
                    <th style="padding: 10px; text-align: center;">Quantité</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsList}
                </tbody>
              </table>
              
              <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #FF5722;">
                <p>Frais de livraison: <strong>${delivery}€</strong></p>
                ${discount > 0 ? `<p>Réduction appliquée: <strong>-${discount}€</strong></p>` : ''}
                <p class="total">💰 Total encaissé: ${(session.amount_total / 100).toFixed(2)}€</p>
              </div>
            </div>
            
            <div class="info-box">
              <p><strong>🔖 Numéro de commande:</strong> ${session.id}</p>
              <p><strong>📅 Date:</strong> ${new Date().toLocaleDateString('fr-FR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
              <p><strong>💳 Statut du paiement:</strong> <span style="color: #4CAF50; font-weight: bold;">PAYÉ</span></p>
            </div>
            
            <p style="margin-top: 30px; padding: 15px; background-color: #e3f2fd; border-radius: 5px;">
              ⚡ <strong>Action requise:</strong> Préparer et livrer cette commande dans les meilleurs délais.
            </p>
          </div>
          <div class="footer">
            <p>Notification automatique - Mama Food's Admin</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Envoyer l'email à l'admin
    await transporter.sendMail({
      from: `"Mama Food's Notifications" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `🔔 NOUVELLE COMMANDE - ${(session.amount_total / 100).toFixed(2)}€ - ${customerName || 'Client'}`,
      html: adminEmailHTML,
    });

    console.log('✅ Notification envoyée à l\'admin:', process.env.ADMIN_EMAIL);
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de la notification admin:', error);
    throw error;
  }
}

// Créer une session de paiement
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { totalAmount, quantity, description, delivery, discount, items, customerEmail, customerName, customerPhone } = req.body;
    
    // Validation
    if (!totalAmount || !items || items.length === 0) {
      return res.status(400).json({ 
        message: "Données du panier invalides" 
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { 
              name: "Commande Mama Food's", 
              description 
            },
            unit_amount: Math.round(totalAmount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        delivery: delivery.toString(),
        discount: discount.toString(),
        items: JSON.stringify(items),
        totalAmount: totalAmount.toString(),
        customerName: customerName || '',
        customerPhone: customerPhone || '',
      },
      customer_email: customerEmail, // Email du client pour Stripe
      success_url: `${process.env.FRONTEND_URL}/#/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/#/cancel`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Erreur Stripe:', error);
    res.status(500).json({ 
      message: "Erreur lors de la création de la session de paiement",
      error: error.message 
    });
  }
});

// Webhook Stripe pour gérer les événements
app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Vérifier la signature du webhook
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ Erreur de vérification du webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Gérer les différents types d'événements
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('✅ Paiement réussi pour la session:', session.id);
        
        // Envoyer l'email de confirmation au client
        await sendOrderConfirmationEmail(session);
        
        // Envoyer la notification à l'admin
        await sendAdminNotification(session);
        break;

      case 'payment_intent.succeeded':
        console.log('✅ PaymentIntent réussi:', event.data.object.id);
        break;

      case 'payment_intent.payment_failed':
        console.log('❌ Paiement échoué:', event.data.object.id);
        break;

      default:
        console.log(`ℹ️ Événement non géré: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Erreur lors du traitement du webhook:', error);
    res.status(500).json({ error: 'Erreur lors du traitement' });
  }
});

// Route de test pour l'envoi d'email
app.post('/test-email', async (req, res) => {
  try {
    await transporter.sendMail({
      from: `"Mama Food's" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: "Test d'envoi d'email",
      html: "<h1>✅ Configuration email fonctionnelle !</h1>",
    });
    res.json({ message: 'Email de test envoyé avec succès' });
  } catch (error) {
    console.error('Erreur test email:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route de santé
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend Stripe opérationnel' });
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`✅ Backend Stripe prêt sur le port ${PORT}`));