import {
  EventId,
  EventStore,
  StreamId,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { randomUUID } from "crypto";

export class InMemoryEventStore implements EventStore {
  // it's more work to search through the messages to find a particular id, but now we can guarantee the original order of events
  private events: Array<{ streamId: StreamId; message: JSONRPCMessage }> = [];

  async storeEvent(
    streamId: StreamId,
    message: JSONRPCMessage,
  ): Promise<EventId> {
    this.events.push({
      streamId,
      message,
    });

    // since events cannot be deleted, just use the index as the event ID
    return this.events.length.toString();
  }

  async replayEventsAfter(
    lastEventId: EventId,
    {
      send,
    }: { send: (eventId: EventId, message: JSONRPCMessage) => Promise<void> },
  ): Promise<StreamId> {
    const events = this.events.slice(0, Number(lastEventId));

    for (let i = 0; i < events.length; i++) {
      await send(i.toString(), events[i].message);
    }

    const streamId =
      events.length > 0 ? events[events.length - 1].streamId : randomUUID();

    return streamId;
  }
}
