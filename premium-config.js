/* Purchases / unlocks: the ONE place to change when real payments are added.
   This build is a DEMO: nothing is charged, and unlocks are stored on this device only (localStorage).

   Separate products (entitlements) share these settings:
     products.pencils   – Premium Pencils (metallic, chrome, glitter, neon, glow, pulse sets + airbrush / watercolor)
     products.palettes  – All Palettes (the themed pencil palettes)
     products.effects3d – 3D Pop (raised / pressed depth effect)
   Free samples (3 strokes or 1 fill per premium set, a 1-page preview of themed palettes, 3 free pops) are counted
   in localStorage 'ep.trials.v1'. ownerCodes unlock EVERY product and bypass all samples.
   NOTE: codes in this file are visible to anyone who opens the app's source. They are fine for a demo, but for real
   sales use licenseCheckUrl (a server check) and remove demoCodes / ownerCodes.

   mode:
     'demo'        – the Buy button unlocks locally and says "Demo unlock (no payment taken)"; demoCodes also unlock.
     'stripe-link' – the Buy button opens the product's stripePaymentLink (a Stripe Payment Link, e.g. https://buy.stripe.com/...).
                     Set the link's success URL to come back to this app with
                       ?premium=return&product=<pencils|palettes>&session_id={CHECKOUT_SESSION_ID}
                     and set verifyUrl to YOUR server endpoint that checks the session with Stripe and answers {"valid":true}.
                     Never unlock from the URL alone.
     'license'     – codes are checked by POSTing {code, product} to licenseCheckUrl, which must answer {"valid":true}.
   In every mode, a code typed in "Have a code?" goes to licenseCheckUrl when it is set, otherwise to demoCodes (demo only). */
window.EP_PREMIUM_CONFIG = {
  mode: 'demo',                   // 'demo' | 'stripe-link' | 'license'
  verifyUrl: '',                  // e.g. 'https://your-server.example/verify-stripe-session' (mode 'stripe-link')
  licenseCheckUrl: '',            // e.g. 'https://your-server.example/check-code' (any mode)
  ownerCodes: ['PRIMEWEST-OWNER'],// unlocks all products (demo mode only; use the license server for real)
  products: {
    pencils: {
      productId: 'emberpost-premium-pencils',
      productName: 'Premium Pencils',
      price: '$2.99',               // display only (placeholder)
      stripePaymentLink: '',        // e.g. 'https://buy.stripe.com/XXXXXXXX'
      demoCodes: ['EMBER-GOLD'],    // accepted only while mode === 'demo'
      storageKey: 'ep.premium.v1'   // kept separate from story progress, so "Reset progress" doesn't remove a purchase
    },
    palettes: {
      productId: 'emberpost-all-palettes',
      productName: 'All Palettes',
      price: '$1.99',
      stripePaymentLink: '',
      demoCodes: ['EMBER-PALETTES'],
      storageKey: 'ep.premium.palettes.v1'
    },
    effects3d: {
      productId: 'emberpost-effects-3d',
      productName: '3D Pop',
      price: '$1.99',
      stripePaymentLink: '',
      demoCodes: ['EMBER-3D'],
      storageKey: 'ep.premium.effects3d.v1'
    }
  }
};
