import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { CheckoutModal } from '../components/CheckoutModal';

export const CheckoutPaymentPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <AppLayout title="Checkout">
      <CheckoutModal isOpen onClose={() => navigate('/')} />
    </AppLayout>
  );
};
