import { useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { useBoardStore } from '../store/boardStore';
import type { BoardElement, BoardPeer, Point } from '../types';

const USER_COLORS = [
  '#f43f5e', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#6366f1', '#a855f7', '#ec4899'
];

const DEFAULT_SIGNALING_SERVERS = [
  'wss://y-webrtc-eu.fly.dev',
];

function getSignalingServers() {
  const configured = import.meta.env.VITE_Y_WEBRTC_SIGNALING_SERVERS;
  if (typeof configured === 'string' && configured.trim()) {
    const servers = configured
      .split(',')
      .map(server => server.trim())
      .filter(Boolean);

    if (servers.length > 0) {
      return servers;
    }
  }

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return [`${protocol}//${window.location.hostname}:4444`];
  }

  return DEFAULT_SIGNALING_SERVERS;
}

export type CollaborationStatus = 'connecting' | 'connected' | 'disconnected';

type CollaborationPeer = BoardPeer;

type LocalRoomMessage =
  | { type: 'request-state'; from: string }
  | { type: 'elements'; from: string; elements: BoardElement[] }
  | { type: 'presence'; from: string; peer: CollaborationPeer }
  | { type: 'cursor'; from: string; cursor: { x: number; y: number } }
  | { type: 'leave'; from: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : null;
}

function readCursor(value: unknown): Point | undefined {
  const cursor = asRecord(value);
  if (!cursor || typeof cursor.x !== 'number' || typeof cursor.y !== 'number') {
    return undefined;
  }

  return { x: cursor.x, y: cursor.y };
}

function readAwarenessPeer(clientId: number, state: unknown): CollaborationPeer {
  const user = asRecord(asRecord(state)?.user);

  return {
    id: typeof user?.localId === 'string' ? user.localId : String(clientId),
    name: typeof user?.name === 'string' ? user.name : 'Anónimo',
    color: typeof user?.color === 'string' ? user.color : '#818cf8',
    cursor: readCursor(user?.cursor),
  };
}

function createClientId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useCollaboration() {
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebrtcProvider | null>(null);
  const yElementsRef = useRef<Y.Array<BoardElement> | null>(null);
  const localChannelRef = useRef<BroadcastChannel | null>(null);
  const localClientIdRef = useRef(createClientId());
  const localPeerRef = useRef<CollaborationPeer | null>(null);
  const localPeersRef = useRef<Map<string, CollaborationPeer>>(new Map());
  const providerPeersRef = useRef<CollaborationPeer[]>([]);
  const ignoreLocalRef = useRef(false);

  const { userName, setElements, setPeers } = useBoardStore();

  const publishPeers = useCallback(() => {
    const merged = new Map<string, CollaborationPeer>();
    providerPeersRef.current.forEach(peer => merged.set(peer.id, peer));
    localPeersRef.current.forEach(peer => merged.set(peer.id, peer));
    setPeers(Array.from(merged.values()));
  }, [setPeers]);

  // Sync React state -> Y.Doc
  const syncElements = useCallback((els: BoardElement[]) => {
    const yElements = yElementsRef.current;
    if (yElements && docRef.current) {
      ignoreLocalRef.current = true;
      docRef.current.transact(() => {
        yElements.delete(0, yElements.length);
        yElements.insert(0, els);
      });
      ignoreLocalRef.current = false;
    }

    localChannelRef.current?.postMessage({
      type: 'elements',
      from: localClientIdRef.current,
      elements: els,
    } satisfies LocalRoomMessage);
  }, []);

  const connect = useCallback((room: string, name: string, onStatus?: (status: CollaborationStatus) => void) => {
    // Clean up existing connection
    localChannelRef.current?.postMessage({
      type: 'leave',
      from: localClientIdRef.current,
    } satisfies LocalRoomMessage);
    localChannelRef.current?.close();
    localChannelRef.current = null;
    localPeersRef.current.clear();
    providerPeersRef.current = [];
    publishPeers();

    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
    }
    if (docRef.current) {
      docRef.current.destroy();
      docRef.current = null;
    }

    const doc = new Y.Doc();
    docRef.current = doc;
    const yElements = doc.getArray<BoardElement>('elements');
    yElementsRef.current = yElements;
    const initialElements = useBoardStore.getState().elements;
    if (initialElements.length > 0) {
      yElements.insert(0, initialElements);
    }

    const userColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
    const localPeer: CollaborationPeer = {
      id: localClientIdRef.current,
      name,
      color: userColor,
    };
    localPeerRef.current = localPeer;

    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(`pizarra-web-room-${room}`);
      localChannelRef.current = channel;
      channel.onmessage = event => {
        const message = event.data as LocalRoomMessage;
        if (!message || message.from === localClientIdRef.current) return;

        if (message.type === 'request-state') {
          channel.postMessage({
            type: 'elements',
            from: localClientIdRef.current,
            elements: useBoardStore.getState().elements,
          } satisfies LocalRoomMessage);
          if (localPeerRef.current) {
            channel.postMessage({
              type: 'presence',
              from: localClientIdRef.current,
              peer: localPeerRef.current,
            } satisfies LocalRoomMessage);
          }
          return;
        }

        if (message.type === 'elements') {
          setElements(message.elements);
          return;
        }

        if (message.type === 'presence') {
          localPeersRef.current.set(message.from, message.peer);
          publishPeers();
          return;
        }

        if (message.type === 'cursor') {
          const peer = localPeersRef.current.get(message.from);
          if (peer) {
            localPeersRef.current.set(message.from, { ...peer, cursor: message.cursor });
            publishPeers();
          }
          return;
        }

        localPeersRef.current.delete(message.from);
        publishPeers();
      };

      channel.postMessage({
        type: 'presence',
        from: localClientIdRef.current,
        peer: localPeer,
      } satisfies LocalRoomMessage);
      channel.postMessage({
        type: 'request-state',
        from: localClientIdRef.current,
      } satisfies LocalRoomMessage);
      onStatus?.('connected');
    }

    try {
      if (!localChannelRef.current) onStatus?.('connecting');

      // Sync elements from Y.Doc -> React state
      yElements.observe(() => {
        if (ignoreLocalRef.current) return;
        const arr = yElements.toArray() as BoardElement[];
        setElements(arr);
        localChannelRef.current?.postMessage({
          type: 'elements',
          from: localClientIdRef.current,
          elements: arr,
        } satisfies LocalRoomMessage);
      });

      // Handle initial sync. The timeout also seeds a board shared before peers arrive.
      const seedOrReadRoom = () => {
        const arr = yElements.toArray() as BoardElement[];
        if (arr.length === 0) {
          if (initialElements.length > 0) {
            syncElements(initialElements);
          }
        } else {
          setElements(arr);
        }
      };

      const provider = new WebrtcProvider(`pizarra-web-v3-${room}`, doc, {
        signaling: getSignalingServers(),
        filterBcConns: false,
      });
      providerRef.current = provider;

      provider.on('status', ({ connected }: { connected: boolean }) => {
        onStatus?.(connected ? 'connected' : 'disconnected');
      });

      // Set awareness (cursor/presence)
      provider.awareness.setLocalStateField('user', {
        localId: localClientIdRef.current,
        name,
        color: userColor,
        cursor: null,
      });

      // Listen to peer awareness
      provider.awareness.on('change', () => {
        const states = Array.from(provider.awareness.getStates().entries());
        const peers = states
          .filter(([id]) => id !== provider.awareness.clientID)
          .map(([id, state]) => readAwarenessPeer(id, state));
        providerPeersRef.current = peers;
        publishPeers();
      });

      provider.on('synced', ({ synced }: { synced: boolean }) => {
        if (synced) {
          seedOrReadRoom();
        }
      });

      window.setTimeout(() => {
        if (docRef.current === doc) {
          seedOrReadRoom();
        }
      }, 800);

    } catch (e) {
      onStatus?.('disconnected');
      console.warn('No se pudo abrir la sala compartida entre pares; se mantiene el modo local.', e);
    }

    return () => {
      providerRef.current?.destroy();
      docRef.current?.destroy();
      localChannelRef.current?.postMessage({
        type: 'leave',
        from: localClientIdRef.current,
      } satisfies LocalRoomMessage);
      localChannelRef.current?.close();
      localChannelRef.current = null;
      onStatus?.('disconnected');
    };
  }, [publishPeers, setElements, syncElements]);

  // Update cursor position
  const updateCursor = useCallback((x: number, y: number) => {
    const provider = providerRef.current;
    if (provider) {
      provider.awareness.setLocalStateField('user', {
        localId: localClientIdRef.current,
        name: userName,
        color: provider.awareness.getLocalState()?.user?.color || '#818cf8',
        cursor: { x, y },
      });
    }

    localChannelRef.current?.postMessage({
      type: 'cursor',
      from: localClientIdRef.current,
      cursor: { x, y },
    } satisfies LocalRoomMessage);
  }, [userName]);

  const disconnect = useCallback(() => {
    localChannelRef.current?.postMessage({
      type: 'leave',
      from: localClientIdRef.current,
    } satisfies LocalRoomMessage);
    localChannelRef.current?.close();
    providerRef.current?.destroy();
    docRef.current?.destroy();
    localChannelRef.current = null;
    localPeerRef.current = null;
    localPeersRef.current.clear();
    providerPeersRef.current = [];
    providerRef.current = null;
    docRef.current = null;
    yElementsRef.current = null;
    setPeers([]);
  }, [setPeers]);

  return { connect, disconnect, syncElements, updateCursor };
}
