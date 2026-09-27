/* Purchases / unlocks: the ONE place to change when real payments are added.
   This build is a DEMO: nothing is charged, and unlocks are stored on this device only (localStorage).

   Separate products (entitlements) share these settings:
     products.pencils   – Premium Pencils (metallic, chrome, glitter, neon, glow, pulse sets + airbrush / watercolor)
     products.palettes  – All Palettes (the themed pencil palettes)
     products.effects3d – 3D (Pop Pencil, 3D Pop, 3D views)
     products.smoke     – Smoke Pencils (drifting smoke wisps)
     products.clouds    – Cloud Pencils (billowing cloud puffs)
     products.gradients – Rainbow & Gradient Pencils (colour runs along the stroke and slowly shifts)
   Free samples (3 strokes or 1 fill per premium set, a 1-page preview of themed palettes, 3 free pops) are counted
   in localStorage 'ep.trials.v1'. The owner test unlock lives in ONE block at the end of this file (REMOVE BEFORE SELLING).
   NOTE: codes in this file are visible to anyone who opens the app's source. They are fine for a demo, but for real
   sales use licenseCheckUrl (a server check) and remove demoCodes and the owner block at the end of this file.

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
    },
    smoke: {
      productId: 'emberpost-smoke',
      productName: 'Smoke Pencils',
      price: '$2.99',
      stripePaymentLink: '',
      demoCodes: ['EMBER-SMOKE'],
      storageKey: 'ep.premium.smoke.v1'
    },
    clouds: {
      productId: 'emberpost-clouds',
      productName: 'Cloud Pencils',
      price: '$2.99',
      stripePaymentLink: '',
      demoCodes: ['EMBER-CLOUD'],
      storageKey: 'ep.premium.clouds.v1'
    },
    gradients: {
      productId: 'emberpost-gradients',
      productName: 'Rainbow & Gradient Pencils',
      price: '$1.99',
      stripePaymentLink: '',
      demoCodes: ['EMBER-RAINBOW'],
      storageKey: 'ep.premium.gradients.v1'
    }
  }
};

/* ======================= OWNER TEST UNLOCK — REMOVE BEFORE SELLING =======================
   Everything owner-only is gated by this one object. Delete this whole block (down to END) at launch and:
     - the code PRIMEWEST-OWNER stops working (it unlocks EVERY product: pencils incl. jewel, palettes, smoke,
       clouds, Mix, 3D modes on all scenes and the Pop Pencil, and bypasses all free-try limits),
     - the ?owner=primewest test bar (Unlock all / Re-lock) no longer appears.
   Anyone can read this file, so it must not ship in a paid build. */
window.EP_OWNER = {
  codes: ['PRIMEWEST-OWNER'],     // typed into any "Have a code?" / Redeem field
  urlParam: 'owner',              // ?owner=primewest shows the owner test bar
  urlValue: 'primewest',
  storageKey: 'ep.owner.v1'       // remembers owner mode on this device after the code or URL was used
};
/* ===================================== END OWNER TEST UNLOCK ============================== */
