import { useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useBoardStore } from '../store/boardStore';
import type { BoardElement } from '../types';

const USER_COLORS = [
  '#f43f5e', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#6366f1', '#a855f7', '#ec4899'
];

export function useCollaboration() {
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const yElementsRef = useRef<Y.Array<any> | null>(null);
  const ignoreLocalRef = useRef(false);

  const { userName, setElements, setPeers } = useBoardStore();

  const connect = useCallback((room: string, name: string) => {
    // Clean up existing connection
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
    const yElements = doc.getArray<any>('elements');
    yElementsRef.current = yElements;

    const userColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];

    try {
      const provider = new WebsocketProvider(
        'wss://demos.yjs.dev/ws',
        `pizarra-web-v2-${room}`,
        doc
      );
      providerRef.current = provider;

      // Set awareness (cursor/presence)
      provider.awareness.setLocalStateField('user', {
        name,
        color: userColor,
        cursor: null,
      });

      // Listen to peer awareness
      provider.awareness.on('change', () => {
        const states = Array.from(provider.awareness.getStates().entries());
        const peers = states
          .filter(([id]) => id !== provider.awareness.clientID)
          .map(([id, state]: [number, any]) => ({
            id: String(id),
            name: state.user?.name || 'Anónimo',
            color: state.user?.color || '#818cf8',
            cursor: state.user?.cursor,
          }));
        setPeers(peers);
      });

      // Sync elements from Y.Doc -> React state
      yElements.observe(() => {
        if (ignoreLocalRef.current) return;
        const arr = yElements.toArray() as BoardElement[];
        setElements(arr);
      });

      // Handle initial sync
      provider.on('sync', (isSynced: boolean) => {
        if (isSynced) {
          const arr = yElements.toArray() as BoardElement[];
          if (arr.length === 0) {
            const currentLocalElements = useBoardStore.getState().elements;
            if (currentLocalElements.length > 0) {
              syncElements(currentLocalElements);
            }
          } else {
            setElements(arr);
          }
        }
      });

    } catch (e) {
      console.warn('WebRTC connection failed, running in local mode', e);
    }

    return () => {
      providerRef.current?.destroy();
      docRef.current?.destroy();
    };
  }, [setElements, setPeers]);

  // Sync React state -> Y.Doc
  const syncElements = useCallback((els: BoardElement[]) => {
    const yElements = yElementsRef.current;
    if (!yElements || !docRef.current) return;

    ignoreLocalRef.current = true;
    docRef.current.transact(() => {
      yElements.delete(0, yElements.length);
      yElements.insert(0, els);
    });
    ignoreLocalRef.current = false;
  }, []);

  // Update cursor position
  const updateCursor = useCallback((x: number, y: number) => {
    if (!providerRef.current) return;
    providerRef.current.awareness.setLocalStateField('user', {
      name: userName,
      color: providerRef.current.awareness.getLocalState()?.user?.color || '#818cf8',
      cursor: { x, y },
    });
  }, [userName]);

  const disconnect = useCallback(() => {
    providerRef.current?.destroy();
    docRef.current?.destroy();
    providerRef.current = null;
    docRef.current = null;
    yElementsRef.current = null;
    setPeers([]);
  }, [setPeers]);

  return { connect, disconnect, syncElements, updateCursor };
}
