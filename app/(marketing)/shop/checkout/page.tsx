import { CheckoutForm } from '@/components/shop/CheckoutForm';

export const dynamic = 'force-dynamic';

export default function CheckoutPage() {
  return (
    <section className="container-lux section pt-[calc(var(--header-h,5.25rem)+2rem)]">
      <h1 className="text-title mb-8">Checkout</h1>
      <CheckoutForm />
    </section>
  );
}
