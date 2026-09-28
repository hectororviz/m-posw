import { PaymentStatus } from '@prisma/client';
import { mapMpPaymentToPaymentStatus } from './mercadopago-webhook.utils';

describe('mapMpPaymentToPaymentStatus', () => {
  it('maps approved/accredited payments to APPROVED', () => {
    expect(mapMpPaymentToPaymentStatus('approved')).toBe(PaymentStatus.APPROVED);
    expect(mapMpPaymentToPaymentStatus('accredited')).toBe(PaymentStatus.APPROVED);
    expect(mapMpPaymentToPaymentStatus('pending', 'accredited')).toBe(
      PaymentStatus.APPROVED,
    );
  });

  it('maps pending statuses to PENDING', () => {
    expect(mapMpPaymentToPaymentStatus('pending')).toBe(PaymentStatus.PENDING);
    expect(mapMpPaymentToPaymentStatus('in_process')).toBe(PaymentStatus.PENDING);
  });

  it('maps rejected/cancelled to REJECTED', () => {
    expect(mapMpPaymentToPaymentStatus('rejected')).toBe(PaymentStatus.REJECTED);
    expect(mapMpPaymentToPaymentStatus('cancelled')).toBe(PaymentStatus.REJECTED);
  });

  it('maps refunded/charged_back to their own states (Fase 4 H1)', () => {
    expect(mapMpPaymentToPaymentStatus('refunded')).toBe(PaymentStatus.REFUNDED);
    expect(mapMpPaymentToPaymentStatus('charged_back')).toBe(PaymentStatus.CHARGEBACK);
  });

  it('maps expired payments to EXPIRED', () => {
    expect(mapMpPaymentToPaymentStatus('expired')).toBe(PaymentStatus.EXPIRED);
  });

  it('falls back to PENDING on unknown status and notifies callback', () => {
    const onUnknown = jest.fn();
    expect(mapMpPaymentToPaymentStatus('unknown', 'detail', onUnknown)).toBe(
      PaymentStatus.PENDING,
    );
    expect(onUnknown).toHaveBeenCalledWith('unknown', 'detail');
  });
});
