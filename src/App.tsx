import Whiteboard from './components/Whiteboard';

function App() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 100, color: '#818cf8', fontWeight: 'bold', fontFamily: 'Inter', fontSize: 14, background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: 8, backdropFilter: 'blur(4px)' }}>
        Pizarra Math v2.1 🚀
      </div>
      <Whiteboard />
    </div>
  );
}

export default App;
