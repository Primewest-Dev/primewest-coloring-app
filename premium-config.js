/* Premium Pencils: purchase / unlock configuration (the ONE place to change when real payments are added).
   This build is a DEMO: nothing is charged, and the unlock is stored on this device only (localStorage).

   mode:
     'demo'        – the Buy button unlocks locally and says "Demo unlock (no payment taken)"; demoCodes also unlock.
     'stripe-link' – the Buy button opens stripePaymentLink (a Stripe Payment Link, e.g. https://buy.stripe.com/...).
                     Configure the link's success URL to come back to this app with ?premium=return&session_id={CHECKOUT_SESSION_ID}
                     and set verifyUrl to YOUR server endpoint that checks the session with Stripe and answers {"valid":true}.
                     Never unlock from the URL alone.
     'license'     – codes are checked by POSTing {code, product} to licenseCheckUrl, which must answer {"valid":true}.
   In every mode, a code typed in "Have a code?" goes to licenseCheckUrl when it is set, otherwise to demoCodes (demo only). */
window.EP_PREMIUM_CONFIG = {
  productId: 'emberpost-premium-pencils',
  productName: 'Premium Pencils',
  price: '$2.99',                 // display only (placeholder)
  mode: 'demo',                   // 'demo' | 'stripe-link' | 'license'
  stripePaymentLink: '',          // e.g. 'https://buy.stripe.com/XXXXXXXX' (mode 'stripe-link')
  verifyUrl: '',                  // e.g. 'https://your-server.example/verify-stripe-session' (mode 'stripe-link')
  licenseCheckUrl: '',            // e.g. 'https://your-server.example/check-code' (any mode)
  demoCodes: ['EMBER-GOLD'],      // accepted only while mode === 'demo'
  storageKey: 'ep.premium.v1'     // kept separate from story progress, so "Reset progress" doesn't remove a purchase
};
