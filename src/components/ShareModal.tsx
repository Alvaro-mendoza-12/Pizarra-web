import React, { useState, useCallback } from 'react';
import { X, Copy, Check, Users, Link2, Wifi, WifiOff, LogIn } from 'lucide-react';
import { useBoardStore } from '../store/boardStore';

interface ShareModalProps {
  onClose: () => void;
  onConnect: (roomId: string, name: string) => void;
  onDisconnect: () => void;
  isConnected: boolean;
}

const ADJECTIVES = ['Crispy', 'Blazing', 'Cosmic', 'Turbo', 'Neon', 'Silky', 'Cyber', 'Quantum'];
const NOUNS = ['Pizarra', 'Canvas', 'Board', 'Studio', 'Space', 'Arena', 'Hub', 'Lab'];

function generateRoom() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${adj}${noun}${num}`;
}

export const ShareModal: React.FC<ShareModalProps> = ({ onClose, onConnect, onDisconnect, isConnected }) => {
  const { roomId, userName, setUserName, peers } = useBoardStore();
  const [inputRoom, setInputRoom] = useState(roomId || generateRoom());
  const [inputName, setInputName] = useState(userName);
  const [copied, setCopied] = useState(false);
  const [joining, setJoining] = useState(false);
  const [shareAsViewOnly, setShareAsViewOnly] = useState(false);

  const isJoinMode = !!new URLSearchParams(window.location.search).get('room');

  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(inputRoom)}${shareAsViewOnly ? '&mode=view' : ''}`;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [shareUrl]);

  const handleConnect = useCallback(() => {
    setJoining(true);
    setUserName(inputName || 'Anónimo');
    onConnect(inputRoom, inputName || 'Anónimo');
    setTimeout(() => setJoining(false), 1500);
  }, [inputRoom, inputName, onConnect, setUserName]);

  return (
    <div className="share-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="share-modal">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(99,102,241,0.4)'
            }}>
              <Users size={22} color="#fff" />
            </div>
            <div>
              <div className="section-title">{isJoinMode ? 'Unirse a la sala' : 'Colaborar en tiempo real'}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                {isJoinMode ? 'Ingresa tu nombre para entrar a la pizarra' : 'Invita a tus amigos a editar juntos'}
              </div>
            </div>
          </div>
          <button className="toolbar-btn" onClick={onClose} title="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Status */}
        {isConnected && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: 10, marginBottom: 20
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#34d399' }}>
              Conectado a «{roomId}»
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {peers.length} colaborador{peers.length !== 1 ? 'es' : ''} activo{peers.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Peers */}
        {isConnected && peers.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div className="panel-label">En la sala</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {peers.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 8, border: '1px solid var(--border)'
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: p.color, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff'
                  }}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>En línea</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div className="panel-label">Tu nombre</div>
            <input
              className="board-input"
              value={inputName}
              onChange={e => setInputName(e.target.value)}
              placeholder="¿Cómo te llamas?"
              maxLength={30}
            />
          </div>

          {!isJoinMode && (
            <div>
              <div className="panel-label">ID de la sala</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="board-input"
                  value={inputRoom}
                  onChange={e => setInputRoom(e.target.value)}
                  placeholder="Nombre de sala..."
                  style={{ fontFamily: 'Fira Code, monospace', fontSize: 13 }}
                />
                <button
                  className="btn-secondary"
                  onClick={() => setInputRoom(generateRoom())}
                  title="Generar nuevo ID"
                  style={{ flex: '0 0 auto', padding: '8px 12px' }}
                >
                  ↺
                </button>
              </div>
            </div>
          )}

          {/* Share link - Always visible to let anyone invite friends */}
          <div>
            <div className="panel-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              Enlace para compartir
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', textTransform: 'none', color: 'var(--text-primary)' }}>
                <input type="checkbox" checked={shareAsViewOnly} onChange={e => setShareAsViewOnly(e.target.checked)} />
                Solo lectura
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{
                flex: 1, padding: '8px 12px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                borderRadius: 8, fontSize: 12,
                color: 'var(--text-muted)',
                fontFamily: 'Fira Code, monospace',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                <Link2 size={12} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                {shareUrl}
              </div>
              <button className="btn-secondary" onClick={handleCopy} style={{ flex: '0 0 auto', padding: '8px 12px' }}>
                {copied ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
              </button>
            </div>
            {copied && (
              <span style={{ fontSize: 12, color: '#34d399', marginTop: 4, display: 'block' }}>
                ✓ Enlace copiado al portapapeles
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          {isConnected ? (
            <>
              <button className="btn-secondary" onClick={onDisconnect} style={{ flex: 1, justifyContent: 'center' }}>
                <WifiOff size={16} />
                Desconectarse
              </button>
              <button className="btn-primary" onClick={handleConnect} style={{ flex: 1, justifyContent: 'center' }}>
                <Wifi size={16} />
                Reconectar
              </button>
            </>
          ) : (
            <button
              className="btn-primary"
              onClick={handleConnect}
              disabled={joining || !inputRoom.trim()}
              style={{ flex: 1, justifyContent: 'center', opacity: joining ? 0.7 : 1 }}
            >
              {joining ? (
                <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : <LogIn size={16} />}
              {joining ? 'Conectando...' : (isJoinMode ? 'Unirse a la sala' : 'Unirse / Crear sala')}
            </button>
          )}
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
          La colaboración usa WebSockets seguros. Todos los datos se comparten en tiempo real entre los usuarios de la sala.
        </p>
      </div>
    </div>
  );
};
