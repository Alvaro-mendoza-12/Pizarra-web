import { useEffect } from 'react';
import Whiteboard from './components/Whiteboard';
import { useBoardStore } from './store/boardStore';

function App() {
  const { theme } = useBoardStore();
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Whiteboard />
    </div>
  );
}

export default App;
