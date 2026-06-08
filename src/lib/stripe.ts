import { loadStripe } from "@stripe/stripe-js";

// Singleton — one instance shared across the entire app
export const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;
