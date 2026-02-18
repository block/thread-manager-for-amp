import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { X, Square, TerminalSquare, Minus, Maximize } from 'lucide-react';
import type { ShellServerMessage } from '../../shared/websocket.js';
import '@xterm/xterm/css/xterm.css';

interface ShellTerminalProps {
  cwd?: string;
  onClose: () => void;
  onMinimize?: () => void;
  minimized?: boolean;
}

export function ShellTerminal({ cwd, onClose, onMinimize, minimized }: ShellTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{ shell: string; cwd: string } | null>(null);

  const connect = useCallback(() => {
    // Don't connect if already connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const cwdParam = cwd ? `?cwd=${encodeURIComponent(cwd)}` : '';
    const wsUrl = `${protocol}//${window.location.host}/shell${cwdParam}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ShellServerMessage;
        switch (msg.type) {
          case 'connected':
            setIsConnected(true);
            setSessionInfo({ shell: msg.shell ?? '', cwd: msg.cwd ?? '' });
            break;
          case 'output':
            if (msg.data) termRef.current?.write(msg.data);
            break;
          case 'exit':
            termRef.current?.write(`\r\n[Process exited with code ${msg.exitCode}]\r\n`);
            setIsConnected(false);
            break;
          case 'error':
            termRef.current?.write(`\r\n[Error: ${msg.content}]\r\n`);
            break;
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };
  }, [cwd]);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
      theme: {
        background: '#0d0936',
        foreground: '#fdfeff',
        cursor: '#0ef3ff',
        cursorAccent: '#0d0936',
        selectionBackground: '#073170',
        black: '#030d22',
        red: '#ff2592',
        green: '#4ade80',
        yellow: '#ffd400',
        blue: '#47a1fa',
        magenta: '#ff2592',
        cyan: '#0ef3ff',
        white: '#fdfeff',
        brightBlack: '#4a7bd4',
        brightRed: '#ff2592',
        brightGreen: '#4ade80',
        brightYellow: '#ffd400',
        brightBlue: '#47a1fa',
        brightMagenta: '#ff2592',
        brightCyan: '#0ef3ff',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    // Delay fit to ensure container is sized, then scroll to bottom
    setTimeout(() => {
      fitAddon.fit();
      term.scrollToBottom();
    }, 100);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle input
    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'resize',
            cols: term.cols,
            rows: term.rows,
          }),
        );
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(terminalRef.current);

    // Connect to shell with a small delay to handle StrictMode double-invoke
    const connectTimeout = setTimeout(connect, 50);

    return () => {
      clearTimeout(connectTimeout);
      resizeObserver.disconnect();
      term.dispose();
      // Only close if still connecting or connected
      if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Refit when maximized or minimized changes
  useEffect(() => {
    if (minimized) return;
    setTimeout(() => {
      fitAddonRef.current?.fit();
      if (wsRef.current?.readyState === WebSocket.OPEN && termRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: 'resize',
            cols: termRef.current.cols,
            rows: termRef.current.rows,
          }),
        );
        termRef.current.focus();
      }
    }, 100);
  }, [isMaximized, minimized]);

  return (
    <div
      className={`shell-terminal-overlay ${isMaximized ? 'maximized' : ''} ${
        minimized ? 'minimized' : ''
      }`}
    >
      <div className="shell-terminal-container">
        <div className="shell-terminal-header">
          <div className="shell-terminal-title">
            <TerminalSquare size={16} className="shell-icon" />
            <span>Terminal</span>
            {sessionInfo && <span className="shell-info">{sessionInfo.cwd}</span>}
            <span className={`shell-status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '●' : '○'}
            </span>
          </div>
          <div className="shell-terminal-actions">
            {onMinimize && (
              <button className="shell-btn" onClick={onMinimize} title="Minimize">
                <Minus size={14} />
              </button>
            )}
            <button
              className="shell-btn"
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'Restore window' : 'Maximize'}
            >
              {isMaximized ? <Square size={14} /> : <Maximize size={14} />}
            </button>
            <button className="shell-btn close" onClick={onClose} title="Close">
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="shell-terminal-body" ref={terminalRef} />
      </div>
    </div>
  );
}
