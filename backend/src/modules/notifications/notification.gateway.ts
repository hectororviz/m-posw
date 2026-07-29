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
  cors: { origin: '*' },
})
export class NotificationGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  @SubscribeMessage('notification-batch.subscribe')
  handleBatchSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { batchId: string },
  ) {
    const { batchId } = payload;
    if (!batchId) return { ok: false, error: 'batchId requerido' };
    const room = `notification-batch:${batchId}`;
    client.join(room);
    this.logger.debug(`Socket ${client.id} joined ${room}`);
    return { ok: true, room };
  }

  @SubscribeMessage('notification-creditor.subscribe')
  handleCreditorSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { creditorIds: number[] },
  ) {
    const { creditorIds } = payload;
    if (!creditorIds || !Array.isArray(creditorIds)) {
      return { ok: false, error: 'creditorIds requerido' };
    }
    const rooms: string[] = [];
    for (const cid of creditorIds) {
      const room = `notification-creditor:${cid}`;
      client.join(room);
      rooms.push(room);
    }
    return { ok: true, rooms };
  }

  @SubscribeMessage('conversations.subscribe')
  handleConversationsSubscribe(
    @ConnectedSocket() client: Socket,
  ) {
    const room = 'conversations';
    client.join(room);
    this.logger.debug(`Socket ${client.id} joined ${room}`);
    return { ok: true, room };
  }

  @SubscribeMessage('conversation.join')
  handleConversationJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: number },
  ) {
    const { conversationId } = payload;
    if (!conversationId) return { ok: false, error: 'conversationId requerido' };
    const room = `conversation:${conversationId}`;
    client.join(room);
    this.logger.debug(`Socket ${client.id} joined ${room}`);
    return { ok: true, room };
  }

  notifyJobUpdated(payload: {
    batchId: string;
    creditorId: number;
    jobId: number;
    status: string;
    completedAt?: string | null;
    error?: string | null;
    attempts?: number;
  }) {
    this.server
      .to(`notification-batch:${payload.batchId}`)
      .emit('notification.job_updated', payload);
    this.server
      .to(`notification-creditor:${payload.creditorId}`)
      .emit('notification.job_updated', payload);
  }

  notifyNewMessage(payload: {
    conversationId: number;
    memberId: number;
    content: string;
    createdAt: string;
  }) {
    this.server
      .to('conversations')
      .emit('conversation.new_message', payload);
    this.server
      .to(`conversation:${payload.conversationId}`)
      .emit('conversation.new_message', payload);
  }
}
