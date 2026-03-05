import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message ?? 'Error desconocido';
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="bg-card border border-border rounded-xl p-8 max-w-md text-center">
            <h1 className="text-xl font-semibold text-foreground mb-2">Algo salió mal</h1>
            <p className="text-sm text-muted mb-4">
              La aplicación encontró un error. Si acabas de desplegar, comprueba que la URL del API (VITE_API_URL) sea correcta y que el backend esté en marcha.
            </p>
            <p className="text-xs text-muted font-mono break-all mb-6">{msg}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
