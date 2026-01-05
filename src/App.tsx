import VocaScanTuner from './components/VocaScanTuner';
// import './App.css'; main.tsxに移動

export default function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Voca Scan</h1>
        <p className="subtitle">AI Pitch Analysis & Diagnosis</p>
      </header>
      
      <main className="app-main">
        <VocaScanTuner />
      </main>

      <footer className="read-the-docs">
        © 2024 Voca Scan - Real-time Voice Analysis
      </footer>
    </div>
  );
}