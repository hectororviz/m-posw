import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class SalesGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SalesGateway.name);

  @SubscribeMessage('sale.join')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() payload: { saleId?: string }) {
    const saleId = payload?.saleId?.trim();
    if (!saleId) {
      return { ok: false, error: 'saleId requerido' };
    }
    const room = this.getSaleRoom(saleId);
    client.join(room);
    this.logger.debug(`Socket ${client.id} joined ${room}`);
    return { ok: true, room };
  }

  notifyPaymentStatusChanged(payload: {
    saleId: string;
    paymentStatus: string;
    mpStatus?: string | null;
    mpStatusDetail?: string | null;
  }) {
    const room = this.getSaleRoom(payload.saleId);
    this.server.to(room).emit('sale.payment_status_changed', payload);
  }

  private getSaleRoom(saleId: string) {
    return `sale:${saleId}`;
  }
}
