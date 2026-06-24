import { getVatNote } from '@/lib/vat';
import { CartClient } from './CartClient';

export default async function CartPage() {
  const vatNote = await getVatNote();
  return <CartClient vatNote={vatNote} />;
}
