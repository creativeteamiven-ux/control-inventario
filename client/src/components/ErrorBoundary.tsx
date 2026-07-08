import { Component, ErrorInfo, ReactNode } from 'react';
import { isChunkLoadError } from '@/lib/lazyWithRetry';

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
    // Tras un despliegue, el chunk viejo ya no existe: recargar suele resolverlo al instante.
    if (isChunkLoadError(error) && !sessionStorage.getItem('chunk-reload')) {
      sessionStorage.setItem('chunk-reload', '1');
      window.location.reload();
    }
  }

  handleRetry = () => {
    const err = this.state.error;
    if (err && isChunkLoadError(err)) {
      sessionStorage.removeItem('chunk-reload');
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message ?? 'Error desconocido';
      const isChunk = isChunkLoadError(this.state.error);
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="bg-card border border-border rounded-xl p-8 max-w-md text-center">
            <h1 className="text-xl font-semibold text-foreground mb-2">Algo salió mal</h1>
            <p className="text-sm text-muted mb-4">
              {isChunk
                ? 'Hay una versión nueva de la aplicación. Recarga la página para continuar (suele pasar justo después de un despliegue).'
                : 'La aplicación encontró un error. Si acabas de desplegar, comprueba que la URL del API (VITE_API_URL) sea correcta y que el backend esté en marcha.'}
            </p>
            <p className="text-xs text-muted font-mono break-all mb-6">{msg}</p>
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
            >
              {isChunk ? 'Recargar página' : 'Reintentar'}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
